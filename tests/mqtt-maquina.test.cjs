const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");

class EventoCustomizado extends Event {
  constructor(tipo, opcoes = {}) {
    super(tipo);
    this.detail = opcoes.detail;
  }
}

class ClienteMqttFalso extends EventEmitter {
  constructor() {
    super();
    this.publicacoes = [];
    this.inscricoes = [];
  }

  subscribe(topicos, opcoes, callback) {
    this.inscricoes.push({ topicos, opcoes });
    callback?.(null);
  }

  publish(topico, payload, opcoes, callback) {
    this.publicacoes.push({ topico, payload: JSON.parse(payload), opcoes });
    callback?.(null);
  }
}

function criarAmbiente(config = {}, relogio = Date) {
  const cliente = new ClienteMqttFalso();
  let conexoesCriadas = 0;
  let sequenciaUuid = 0;
  const janela = new EventTarget();

  Object.assign(janela, {
    location: { hostname: "192.0.2.10", protocol: "http:" },
    SoldaTechMQTTConfig: config,
    crypto: {
      randomUUID: () => `uuid-${++sequenciaUuid}`,
    },
    mqtt: {
      connect: (url, opcoes) => {
        cliente.url = url;
        cliente.opcoes = opcoes;
        conexoesCriadas += 1;
        return cliente;
      },
    },
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
  });

  const documento = {
    getElementById: () => null,
    createElement: () => ({ setAttribute() {} }),
    createTextNode: (texto) => ({ texto }),
  };
  const consoleSilencioso = {
    log() {},
    info() {},
    warn() {},
    error() {},
  };
  const contexto = vm.createContext({
    window: janela,
    document: documento,
    console: consoleSilencioso,
    CustomEvent: EventoCustomizado,
    Event,
    EventTarget,
    Error,
    Map,
    Set,
    Date: relogio,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Promise,
    TypeError,
  });
  const arquivo = path.resolve(__dirname, "../new-program/mqtt-maquina.js");

  vm.runInContext(fs.readFileSync(arquivo, "utf8"), contexto, {
    filename: arquivo,
  });

  return {
    cliente,
    janela,
    obterConexoesCriadas: () => conexoesCriadas,
  };
}

test("camada MQTT preserva estados e correlaciona comandos", async () => {
  const ambiente = criarAmbiente();
  const { cliente, janela } = ambiente;
  const api = janela.SoldaTouchMQTT;

  assert.equal(ambiente.obterConexoesCriadas(), 1);
  assert.equal(janela.obterEstadoConexaoMaquina().mqttConectado, false);

  cliente.emit("connect");
  assert.equal(janela.obterEstadoConexaoMaquina().mqttConectado, true);
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "AGUARDANDO RESPOSTA");

  const status = api.processarMensagemMaquina(
    api.topicos.status,
    JSON.stringify({ tipo: "STATUS", estado: "PRONTA" }),
  );
  assert.equal(status.processado, true);
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "CONECTADO");

  assert.doesNotThrow(() => {
    api.processarMensagemMaquina(api.topicos.status, "STATUS_LEGADO");
  });

  const promessaOk = api.enviarComandoComConfirmacao("TESTE", { valor: 1 });
  const comandoOk = cliente.publicacoes.at(-1).payload;
  assert.match(comandoOk.idComando, /^cmd-/);
  assert.deepEqual(
    Object.keys(comandoOk),
    ["idComando", "comando", "dados", "origem", "timestamp"],
  );
  api.processarMensagemMaquina(
    api.topicos.resposta,
    JSON.stringify({ idComando: comandoOk.idComando, tipo: "COMANDO_OK" }),
  );
  assert.equal((await promessaOk).tipo, "COMANDO_OK");

  const promessaPonto = api.enviarComandoComConfirmacao(
    "MOVER_PONTO",
    { zMm: 12 },
    { tiposSucesso: ["PONTO_ATINGIDO"] },
  );
  const comandoPonto = cliente.publicacoes.at(-1).payload;
  api.processarMensagemMaquina(
    api.topicos.resposta,
    JSON.stringify({
      idComando: comandoPonto.idComando,
      tipo: "PONTO_ATINGIDO",
    }),
  );
  assert.equal((await promessaPonto).tipo, "PONTO_ATINGIDO");

  const mesaPronta = api.aguardarEventoMaquina("MESA_READY", { timeoutMs: 50 });
  api.processarMensagemMaquina(
    api.topicos.resposta,
    JSON.stringify({ tipo: "MESA_READY" }),
  );
  assert.equal((await mesaPronta).tipo, "MESA_READY");

  assert.doesNotThrow(() => {
    api.processarMensagemMaquina(
      api.topicos.resposta,
      JSON.stringify({ idComando: "cmd-inexistente", tipo: "COMANDO_OK" }),
    );
  });

  await assert.rejects(
    api.enviarComandoComConfirmacao("SEM_RESPOSTA", {}, { timeoutMs: 5 }),
    (erro) => erro.codigo === "MQTT_COMMAND_TIMEOUT",
  );

  const promessaErro = api.enviarComandoComConfirmacao("COM_ERRO");
  const comandoErro = cliente.publicacoes.at(-1).payload;
  api.processarMensagemMaquina(
    api.topicos.erro,
    JSON.stringify({
      idComando: comandoErro.idComando,
      tipo: "ERRO",
      mensagem: "Falha simulada",
    }),
  );
  await assert.rejects(promessaErro, (erro) => erro.idComando === comandoErro.idComando);

  cliente.emit("close");
  assert.equal(janela.obterEstadoConexaoMaquina().mqttConectado, false);
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "INDISPONÍVEL");

  cliente.emit("connect");
  assert.equal(ambiente.obterConexoesCriadas(), 1);
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "AGUARDANDO RESPOSTA");

  const capacidades = janela.SoldaTouchIntegracaoFisica.obterCapacidades();
  assert.equal(capacidades.movimentoManual, false);
  assert.equal(capacidades.soldagem, false);
});

test("capacidades exigem status recente e jog bloqueia durante execução/emergência", async () => {
  const { cliente, janela } = criarAmbiente();
  const api = janela.SoldaTouchMQTT;
  const fisica = janela.SoldaTouchIntegracaoFisica;
  cliente.emit("connect");
  assert.equal(fisica.iniciarMovimentoManual("CIMA"), false);
  for (const payload of ["{invalido", "null", "[]", "{}", "STATUS_LEGADO"]) {
    assert.doesNotThrow(() => cliente.emit("message", api.topicos.status, payload));
    assert.equal(fisica.obterCapacidades().movimentoManual, false);
  }
  const status = (estado, emergencia = false) => cliente.emit("message", api.topicos.status,
    JSON.stringify({ tipo: "STATUS", estado, emergencia }));
  status("PARADA");
  assert.equal(fisica.obterCapacidades().movimentoManual, true);
  assert.equal(fisica.iniciarMovimentoManual("CIMA"), true);
  assert.equal(cliente.publicacoes.at(-1).payload.comando, "JOG_CIMA");
  status("EXECUTANDO");
  assert.equal(fisica.iniciarMovimentoManual("BAIXO"), false);
  status("EMERGENCIA", true);
  assert.equal(fisica.definirSoldagemAtiva(true), false);
  assert.equal(await janela.enviarComandoMaquina("jog_cima"), false);
  assert.equal(fisica.pararMovimentoManual(), true);
  assert.equal(fisica.definirSoldagemAtiva(false), true);
});

test("desconexão rejeita pendências e reconexão exige novo status sem duplicar cliente", async () => {
  const { cliente, janela, obterConexoesCriadas } = criarAmbiente();
  cliente.emit("connect");
  const pendente = janela.enviarComandoComConfirmacao("PING");
  cliente.emit("offline");
  await assert.rejects(pendente, (erro) => erro.codigo === "MQTT_DESCONECTADO");
  assert.equal(janela.obterEstadoConexaoMaquina().comandosPendentes, 0);
  cliente.emit("reconnect");
  cliente.emit("connect");
  assert.equal(obterConexoesCriadas(), 1);
  assert.equal(janela.SoldaTouchIntegracaoFisica.obterCapacidades().movimentoManual, false);
  assert.equal(cliente.opcoes.queueQoSZero, false);
  assert.equal(cliente.opcoes.resubscribe, false);
});

test("gestos compatíveis com Python são entregues uma vez; retidos e inválidos são ignorados", () => {
  const { cliente, janela } = criarAmbiente();
  const gestos = [];
  janela.addEventListener("soldatech:gesto-visao", (evento) => gestos.push(evento.detail.gesto));
  for (const gesto of ["START", "PAUSA"]) {
    cliente.emit("message", "soldatech/visao/gesto", JSON.stringify({ tipo: "GESTO_VISAO", gesto }));
  }
  cliente.emit("message", "soldatech/visao/gesto", '{"gesto":"START"}', { retain: true });
  cliente.emit("message", "soldatech/visao/gesto", '{"gesto":"INVALIDO"}');
  cliente.emit("message", "soldatech/visao/gesto", "{");
  assert.deepEqual(gestos, ["START", "PAUSA"]);
  cliente.emit("connect");
  cliente.emit("message", janela.SoldaTouchMQTT.topicos.status, '{"estado":"PRONTA"}', { retain: true });
  assert.equal(janela.SoldaTouchIntegracaoFisica.obterCapacidades().movimentoManual, false);
});

test("broker acompanha o host da página e aceita configuração explícita sem credencial embutida", () => {
  const local = criarAmbiente().cliente;
  assert.equal(local.url, "ws://192.0.2.10:8888");
  assert.equal(local.opcoes.username, undefined);
  assert.equal(local.opcoes.password, undefined);
  const remoto = criarAmbiente({ url: "wss://example.test/mqtt" }).cliente;
  assert.equal(remoto.url, "wss://example.test/mqtt");
});

test("status expirado bloqueia movimento mesmo com respostas MQTT recentes", () => {
  let agora = 1000;
  const { cliente, janela } = criarAmbiente({}, { now: () => agora });
  const api = janela.SoldaTouchMQTT;
  cliente.emit("connect");
  cliente.emit("message", api.topicos.status, '{"estado":"PRONTA"}');
  assert.equal(janela.SoldaTouchIntegracaoFisica.obterCapacidades().movimentoManual, true);
  agora += 10001;
  cliente.emit("message", api.topicos.resposta, '{"tipo":"COMANDO_OK"}');
  assert.equal(janela.SoldaTouchIntegracaoFisica.iniciarMovimentoManual("CIMA"), false);
  assert.deepEqual(cliente.publicacoes.map(p => p.payload.comando), ['PING']);
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "SEM RESPOSTA");
});

test('produção ignora respostas de outra revisão', async () => {
  const { cliente, janela } = criarAmbiente();
  cliente.emit('connect');
  const dados = { producaoId: 'p', revisao: 'r' };
  const pendente = janela.enviarComandoComConfirmacao('CARREGAR_PRODUCAO', dados);
  const envelope = cliente.publicacoes.at(-1).payload;
  const api = janela.SoldaTouchMQTT;
  const quantidade = janela.obterEstadoConexaoMaquina().comandosPendentes;
  for (const tipo of ['COMANDO_OK', 'COMANDO_ERRO']) {
    for (const topico of [api.topicos.resposta, api.topicos.erro]) {
      cliente.emit('message', topico, JSON.stringify({ ...envelope, ...dados, revisao: 'outra', tipo }));
      assert.equal(janela.obterEstadoConexaoMaquina().comandosPendentes, quantidade);
    }
  }
  cliente.emit('message', api.topicos.resposta, JSON.stringify({ ...envelope, ...dados, tipo: 'COMANDO_OK', estado: 'RECEBIDA_NAO_EXECUTADA' }));
  assert.equal((await pendente).estado, 'RECEBIDA_NAO_EXECUTADA');
  cliente.emit('offline');
});

test("PING distingue Node-RED do CLP; status atrasado não ressuscita estado", () => {
  let agora = 20000;
  const { cliente, janela } = criarAmbiente({}, { now: () => agora });
  const api = janela.SoldaTouchMQTT;
  cliente.emit("connect");
  api.processarMensagemMaquina(api.topicos.resposta, '{"tipo":"COMANDO_OK","mensagem":"pong"}');
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "AGUARDANDO RESPOSTA");
  assert.equal(janela.obterEstadoConexaoMaquina().nodeRed, "CONECTADO");
  const status = (dados) => api.processarMensagemMaquina(api.topicos.status, JSON.stringify(dados));
  status({ estado: "PARADA", timestamp: agora });
  assert.equal(status({ estado: "PRONTA", timestamp: agora - 1 }).processado, false);
  agora++;
  status({ estado: "INDISPONIVEL", clpConectado: false, timestamp: agora });
  assert.equal(janela.SoldaTouchIntegracaoFisica.obterCapacidades().movimentoManual, false);
  assert.equal(janela.obterEstadoConexaoMaquina().clp, "AGUARDANDO RESPOSTA");
});
