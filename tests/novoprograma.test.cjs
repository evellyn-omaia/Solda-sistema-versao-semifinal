const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../new-program/novoprograma.js"), "utf8").replace(/\r\n/g, "\n");

test("simulação não publica comandos; modo real bloqueia posicionamento automático", async () => {
  const trecho = source.slice(source.indexOf("async function solicitarComandoMaquina("),
    source.indexOf("async function iniciarMesaAutomatica("));
  let real = false;
  const enviados = [];
  const contexto = vm.createContext({
    maquinaRealAtiva: () => real,
    modoIntegracaoMaquina: "CLP_CONFIRMADO",
    ModoIntegracaoMaquina: { CLP_CONFIRMADO: "CLP_CONFIRMADO" },
    window: {
      enviarComandoMaquina: async (comando) => { enviados.push(comando); return true; },
      enviarComandoComConfirmacao: async (comando) => { enviados.push(`ACK:${comando}`); return {}; },
    }, console,
  });
  vm.runInContext(trecho, contexto);
  await contexto.solicitarComandoMaquina("MESA_START");
  await contexto.solicitarComandoMaquina("MOVER_PONTO", {}, { aguardarConfirmacao: true });
  assert.equal(enviados.length, 0);
  real = true;
  await contexto.solicitarComandoMaquina("MESA_STOP");
  await assert.rejects(contexto.solicitarComandoMaquina("MOVER_PONTO", {}, { aguardarConfirmacao: true }), /não homologada/);
  assert.deepEqual(enviados, ["MESA_STOP"]);
});

test("clique e gesto simultâneos não iniciam dois ciclos", async () => {
  const trecho = "let inicioCicloPendente = false;\n" + source.slice(source.indexOf("async function confirmarInicioCiclo()"),
    source.indexOf('\ndocument\n  .getElementById("btnIniciarCiclo")'));
  let inicios = 0;
  let concluir;
  const contexto = vm.createContext({
    estadoExecucao: "AGUARDANDO_INICIO",
    EstadoExecucao: { AGUARDANDO_INICIO: "AGUARDANDO_INICIO" },
    window: {}, maquinaRealAtiva: () => false, informarEnvioFilaMqtt() {},
    mostrarBotaoIniciarCiclo() {}, executandoPrograma: false,
    esconderBotaoIniciarCiclo() {},
    iniciarExecucaoPrograma: () => {
      inicios++;
      return new Promise((resolve) => { concluir = resolve; });
    },
  });
  vm.runInContext(trecho, contexto);
  const primeiro = contexto.confirmarInicioCiclo();
  await contexto.confirmarInicioCiclo();
  assert.equal(inicios, 1);
  concluir();
  await primeiro;
});

test("evento externo delega ao mesmo controle da câmera", async () => {
  const inicio = source.indexOf('window.addEventListener(\n  "soldatech:gesto-visao"');
  const trecho = source.slice(inicio, source.indexOf("/*\nRede de segurança", inicio));
  let handler; const chamadas = [];
  vm.runInNewContext(trecho, { window: { addEventListener: (_, fn) => { handler = fn; },
    controlarSimulacaoPorGesto: async gesto => chamadas.push(gesto) }, informarEnvioFilaMqtt() {} });
  await handler({ detail: { gesto: 'START' } });
  await handler({ detail: { gesto: 'PAUSA' } });
  assert.deepEqual(chamadas, ['START','PAUSA']);
});

test("espera de um segundo pertence à simulação; modo real aguarda MESA_READY", async () => {
  const inicio = source.indexOf("async function aguardarMesaPronta()");
  const trecho = source.slice(inicio, source.indexOf("function girarMesa()", inicio));
  const eventos = [];
  const contexto = vm.createContext({
    modoIntegracaoMaquina: "SIMULACAO",
    ModoIntegracaoMaquina: { CLP_CONFIRMADO: "CLP_CONFIRMADO" },
    TEMPO_PREPARACAO_MESA_MS: 1000,
    aguardar: async (ms) => eventos.push(ms),
    window: { aguardarEventoMaquina: async (tipo) => eventos.push(tipo) },
  });
  vm.runInContext(trecho, contexto);
  await contexto.aguardarMesaPronta();
  contexto.modoIntegracaoMaquina = "CLP_CONFIRMADO";
  await contexto.aguardarMesaPronta();
  assert.deepEqual(eventos, [1000, "MESA_READY"]);
});

test("P01: execução física não homologada não avança nem solda", () => {
  const inicio = source.indexOf("function animate()");
  const fim = source.indexOf("\n/* =====================================\nSALVAR E CARREGAR PROGRAMA", inicio);
  const soldas = [];
  const contexto = vm.createContext({
    requestAnimationFrame() {}, relogioAnimacao: { getDelta: () => 0.016 },
    controls: { update() {} }, renderer: { render() {} }, scene: {}, camera: {},
    encerrarSoldaNoProximoQuadro: false, indutorSoldando: false,
    executandoPrograma: true, programaPausado: false, estadoExecucao: "EXECUTANDO",
    EstadoExecucao: { EXECUTANDO: "EXECUTANDO" }, girando: false,
    modoIntegracaoMaquina: "CLP_CONFIRMADO", maquinaRealAtiva: () => true,
    pontos: [{ zMm: 10, anguloMesaGraus: 0, solda: { ativar: true } }],
    indicePontoAtual: 0, indiceUltimoPontoEnviadoMaquina: -1,
    // A confirmação nunca chega neste cenário.
    enviarPontoParaMaquina: () => new Promise(() => {}),
    estadoMaquina: { posicaoZMm: 10 }, TOLERANCIA_Z_MM: 0.1, TOLERANCIA_MESA_GRAUS: 0.1,
    definirPosicaoZMm() {}, definirAnguloMesaGraus() {}, obterAnguloMesaGraus: () => 0,
    diferencaAngularCurta: () => 0, atualizarStatusMesa() {},
    definirIndutorSoldando: (ativa) => soldas.push(ativa),
    document: { getElementById: () => null }, console: { log() {}, warn() {}, error() {} },
    modoReproducaoSimples: false, concluirProgramaAtual() {},
  });
  vm.runInContext(source.slice(inicio, fim), contexto);
  contexto.animate();
  assert.deepEqual({ ponto: contexto.indicePontoAtual, soldas }, { ponto: 0, soldas: [] });
});
