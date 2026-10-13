const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const nodes = JSON.parse(fs.readFileSync(path.join(__dirname, "../node-red/flows.json"), "utf8"));

function ambiente(conectado = true) {
  const escritas = [], respostas = [];
  const memoria = new Map();
  // Endereços exclusivamente fictícios; nenhum cliente Modbus é criado.
  const regs = {
    coils: { jogCima: 101, jogBaixo: 102, mesaStart: 103, soldaOn: 104 },
    holdingRegisters: { zAlvoDecimm: 201 },
    discreteInputs: { executando: 301 },
  };
  const dados = {
    clpRegs: regs, clpEstado: { conectado },
    clpControleManualHomologado: true,
    clpUltimoStatus: { timestamp: Date.now(), emergencia: false, executando: false },
    clpClient: {
      writeCoil: async (endereco, valor) => escritas.push(["coil", endereco, valor]),
      writeRegister: async (endereco, valor) => escritas.push(["register", endereco, valor]),
      readDiscreteInputs: async () => ({ data: [false, true, false, false, true] }),
    },
  };
  return {
    dados, escritas, respostas, memoria,
    async executar(id, payload = {}) {
      const source = nodes.find((n) => n.id === id).func;
      const executar = new Function("msg", "node", "global", "flow", "setTimeout", source);
      executar({ payload: { timestamp: Date.now(), ...payload } }, { send: (m) => respostas.push(m), warn() {}, error() {} },
        { get: (k) => dados[k], set: (k, v) => { dados[k] = v; } }, { get: (k) => memoria.get(k), set: (k, v) => memoria.set(k, v) },
        (fn) => fn());
      await new Promise(setImmediate);
    },
  };
}

test("flow: PING não depende de CLP e comandos offline não escrevem Modbus", async () => {
  const a = ambiente(false);
  await a.executar("fnProcessarComando", { comando: "PING", idComando: "ping-1" });
  assert.equal(a.respostas[0][0].payload.idComando, "ping-1");
  assert.equal(a.respostas[0][0].payload.mensagem, "pong");
  await a.executar("fnProcessarComando", { comando: "JOG_CIMA", idComando: "jog-1" });
  assert.equal(a.respostas[1][1].payload.codigo, "CLP_OFFLINE");
  assert.deepEqual(a.escritas, []);
});

test("flow: contratos manuais preservam coils e correlação usando Modbus falso", async () => {
  const casos = {
    JOG_CIMA: [["coil", 102, false], ["coil", 101, true]],
    JOG_BAIXO: [["coil", 101, false], ["coil", 102, true]],
    JOG_PARAR: [["coil", 101, false], ["coil", 102, false]],
    JOG_PULSO: [["coil", 102, false], ["coil", 101, true], ["coil", 101, false]],
    MESA_START: [["coil", 103, true]], MESA_STOP: [["coil", 103, false]],
  };
  for (const [comando, esperado] of Object.entries(casos)) {
    const a = ambiente();
    await a.executar("fnProcessarComando", { comando, idComando: "id-1", dados: { direcao: "CIMA", duracaoMs: 30 } });
    assert.deepEqual(a.escritas, esperado, comando);
    assert.equal(a.respostas[0][0].payload.tipo, "COMANDO_OK");
    assert.equal(a.respostas[0][0].payload.idComando, "id-1");
  }
});

test("flow: posicionamento, solda e coil de emerg?ncia n?o homologados s?o bloqueados", async () => {
  const a = ambiente();
  for (const comando of ["MOVER_PONTO", "SOLDA_ON", "SOLDA_OFF", "EMERGENCIA"]) {
    await a.executar("fnProcessarComando", { comando, idComando: comando, dados: { zMm: 12.5 } });
    assert.equal(a.respostas.at(-1)[1].payload.codigo, "NAO_HOMOLOGADO");
  }
  assert.deepEqual(a.escritas, []);
  await a.executar("fnLerStatus");
  assert.equal(a.respostas.at(-1)[2], null);
  assert.equal(a.respostas.at(-1)[0].payload.clpConectado, true);
});

test("flow: entrada inválida e falha Modbus retornam erro correlacionado", async () => {
  const a = ambiente();
  await a.executar("fnProcessarComando", { comando: "MOVER_PONTO", idComando: "invalido", dados: { zMm: "x" } });
  assert.equal(a.escritas.length, 0);
  assert.equal(a.respostas[0][1].payload.idComando, "invalido");
  a.dados.clpClient.writeCoil = async () => { throw new Error("Falha simulada"); };
  await a.executar("fnProcessarComando", { comando: "JOG_CIMA", idComando: "erro" });
  assert.equal(a.respostas[1][1].payload.codigo, "ERRO_MODBUS");
  assert.equal(a.respostas[1][1].payload.idComando, "erro");
});

test("flow: duplicatas, atraso, emergência e leitura perdida não autorizam movimento", async () => {
  const a = ambiente();
  const comando = { comando: "MESA_START", idComando: "uma-vez" };
  await a.executar("fnProcessarComando", comando);
  await a.executar("fnProcessarComando", comando);
  assert.equal(a.respostas.at(-1)[1].payload.codigo, "COMANDO_DUPLICADO");
  assert.equal(a.escritas.length, 1);
  await a.executar("fnProcessarComando", { ...comando, idComando: "velho", timestamp: Date.now() - 9000 });
  assert.equal(a.respostas.at(-1)[1].payload.codigo, "ENVELOPE_INVALIDO");
  a.dados.clpUltimoStatus.emergencia = true;
  await a.executar("fnProcessarComando", { ...comando, idComando: "emergencia" });
  assert.equal(a.respostas.at(-1)[1].payload.codigo, "CLP_NAO_PERMITIDO");
  a.dados.clpClient.readDiscreteInputs = async () => { throw new Error("offline"); };
  await a.executar("fnLerStatus");
  assert.equal(a.respostas.at(-1)[0].payload.clpConectado, false);
  assert.equal(a.dados.clpUltimoStatus, null);
});
