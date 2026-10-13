const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const mqtt = require("mqtt");
const vm = require("node:vm");
const net = require('node:net');
const { once } = require('node:events');
const { criarSimulador } = require('../scripts/simulador.cjs');
const raiz = path.resolve(__dirname, "..");
const delay = ms => new Promise(r => setTimeout(r, ms));

test("integração: frontend WS → Aedes → Node-RED real → simulador Modbus TCP → status", { timeout: 60000 }, async t => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "soldatouch-isolado-"));
  const processos = [], clientes = [];
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const modbusPort = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  let sim = criarSimulador(modbusPort);
  await once(sim.server._server, 'listening');
  t.after(async () => {
    await Promise.all(clientes.map(c => c.endAsync(true)));
    for (const p of processos) if (p.exitCode === null) p.kill();
    sim.close();
    // A pasta temporária é preservada até os processos encerrarem.
  });
  const senha = crypto.randomBytes(24).toString("hex");
  const contas = ["bridge", "observer", "operator"].map(role => {
    const salt = crypto.randomBytes(16).toString("hex");
    return { username: role, role, salt, hash: crypto.scryptSync(senha, salt, 32).toString("hex") };
  });
  const usuarios = path.join(pasta, "users.json");
  fs.writeFileSync(usuarios, JSON.stringify(contas));
  async function broker(portas = { tcp: 0, ws: 0 }) {
    const p = spawn(process.execPath, [path.join(raiz, "mqtt-broker/server.js")], {
      windowsHide: true, env: { ...process.env, MQTT_BIND_HOST: "127.0.0.1", MQTT_USERS_FILE: usuarios,
        MQTT_TCP_PORT: String(portas.tcp), MQTT_WS_PORT: String(portas.ws) }, stdio: ["ignore", "pipe", "pipe"],
    });
    processos.push(p);
    const endpoints = await new Promise((resolve, reject) => {
      let out = "";
      const timer = setTimeout(() => reject(new Error("Timeout broker")), 5000);
      p.once("error", reject);
      p.stdout.on("data", chunk => {
        out += chunk;
        const tcp = out.match(/mqtt:\/\/127\.0\.0\.1:(\d+)/), ws = out.match(/ws:\/\/127\.0\.0\.1:(\d+)/);
        if (tcp && ws) { clearTimeout(timer); resolve({ tcp: +tcp[1], ws: +ws[1] }); }
      });
    });
    return { p, ...endpoints };
  }
  let b = await broker();
  const flow = JSON.parse(fs.readFileSync(path.join(raiz, "node-red/flows.json"), "utf8"));
  // Flow original, sem substituir Functions: conexão Modbus TCP real apenas em loopback.
  const cfg = flow.find(n => n.id === "brokerSoldaTech");
  cfg.broker = "127.0.0.1"; cfg.port = String(b.tcp);
  fs.writeFileSync(path.join(pasta, "flows_cred.json"), JSON.stringify({ brokerSoldaTech: { user: "bridge", password: senha } }));
  fs.writeFileSync(path.join(pasta, "flows.json"), JSON.stringify(flow));
  function runtime() {
    const p = spawn(process.execPath, [path.join(__dirname, "fixtures/node-red-isolado.cjs"), pasta],
      { windowsHide: true, env: { ...process.env, TEST_MODBUS_PORT: String(modbusPort) }, stdio: ["ignore", "pipe", "pipe"] });
    processos.push(p);
    if (process.env.DEBUG_INTEGRACAO) {
      p.stdout.on("data", chunk => process.stdout.write(chunk));
      p.stderr.on("data", chunk => process.stderr.write(chunk));
    }
    return p;
  }
  let nr = runtime();
  class CE extends Event { constructor(type, o) { super(type); this.detail = o.detail; } }
  const janela = new EventTarget();
  Object.assign(janela, { location: { protocol: "http:", hostname: "127.0.0.1" }, crypto,
    SoldaTechMQTTConfig: { url: `ws://127.0.0.1:${b.ws}`, username: "operator", password: senha },
    mqtt: { connect(url, opts) { const c = mqtt.connect(url, opts); clientes.push(c); return c; } },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} });
  vm.runInNewContext(fs.readFileSync(path.join(raiz, "new-program/mqtt-maquina.js"), "utf8"), {
    window: janela, document: { getElementById: () => null }, EventTarget, CustomEvent: CE,
    console: { log() {}, error() {}, warn() {}, info() {} },
  });
  async function esperar(predicado, ms = 10000) {
    const fim = Date.now() + ms;
    while (!predicado()) { if (Date.now() > fim) throw new Error("Condição não atingida"); await delay(40); }
  }
  await esperar(() => janela.obterEstadoConexaoMaquina().clp === "SIMULAÇÃO");
  const api = janela.SoldaTouchMQTT;
  const respostas = [];
  api.eventos.addEventListener("tipo-evento", e => respostas.push(e.detail.dados));
  await t.test("comando correlacionado e estado retornam pelo runtime real", async () => {
    const resposta = await janela.enviarComandoComConfirmacao("MESA_START");
    assert.equal(resposta.comando, "MESA_START");
    assert.ok(resposta.idComando);
    await esperar(() => respostas.some(r => r.estado === "EXECUTANDO"));
    await janela.enviarComandoComConfirmacao("MESA_STOP");
    await esperar(() => respostas.at(-1)?.estado === "PARADA");
  });
  await t.test("duplicata, envelope vencido e inválido recebem erro correlacionado", async () => {
    const c = clientes[0];
    const enviar = payload => c.publish(api.topicos.comando, JSON.stringify(payload));
    const envelope = { idComando: "dedup", comando: "PING", timestamp: Date.now(), dados: {}, origem: "teste" };
    enviar(envelope); await esperar(() => respostas.some(r => r.idComando === "dedup"));
    enviar(envelope); await esperar(() => respostas.some(r => r.codigo === "COMANDO_DUPLICADO"));
    enviar({ ...envelope, idComando: "velho", timestamp: Date.now() - 9000 });
    await esperar(() => respostas.some(r => r.idComando === "velho" && r.codigo === "ENVELOPE_INVALIDO"));
    enviar({ comando: "PING" });
    await esperar(() => respostas.some(r => r.idComando === null && r.codigo === "ENVELOPE_INVALIDO"));
  });
  await t.test("reinício Node-RED causa timeout e recupera sem fabricar confirmação", async () => {
    nr.kill(); await new Promise(r => nr.once("exit", r));
    await assert.rejects(janela.enviarComandoComConfirmacao("PING", {}, { timeoutMs: 150 }), /Tempo esgotado/);
    nr = runtime();
    const inicio = respostas.length;
    await esperar(() => respostas.slice(inicio).some(r => r.tipo === "STATUS"));
    assert.equal((await janela.enviarComandoComConfirmacao("PING")).mensagem, "pong");
  });
  await t.test('perda do simulador invalida estado; reconexão Modbus recupera leitura', async () => {
    sim.close();
    await esperar(() => janela.obterEstadoConexaoMaquina().clp !== 'SIMULAÇÃO');
    await assert.rejects(janela.enviarComandoComConfirmacao('MESA_START'));
    sim = criarSimulador(modbusPort); await once(sim.server._server, 'listening');
    await esperar(() => janela.obterEstadoConexaoMaquina().clp === 'SIMULAÇÃO');
    assert.equal((await janela.enviarComandoComConfirmacao('PING')).mensagem, 'pong');
  });
  await t.test("reinício broker invalida status e reconecta frontend e Node-RED", async () => {
    b.p.kill(); await new Promise(r => b.p.once("exit", r));
    await esperar(() => !janela.mqttEstaConectado());
    assert.equal(janela.obterEstadoConexaoMaquina().clp, "INDISPONÍVEL");
    b = await broker(b);
    await esperar(() => janela.obterEstadoConexaoMaquina().clp === "SIMULAÇÃO", 15000);
    assert.equal((await janela.enviarComandoComConfirmacao("PING")).mensagem, "pong");
  });
});
