const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { ProducaoMQTT } = require('../new-program/producao-mqtt.js');
const source = fs.readFileSync(path.join(__dirname, '../new-program/novoprograma.js'), 'utf8').replace(/\r\n/g, '\n');
function ambiente({ real = true, resposta } = {}) {
  const chamadas = [], elementos = new Map();
  const programa = { nome: 'Cadastro real', tipoMaterial: 'Aço', pontos: [
    { id: 'p2', ordem: 8, zMm: 12.345, anguloMesaGraus: 72.123, solda: { ativar: true, corrente: 42, tempo: 3 } },
    { id: 'p1', ordem: 2, zMm: 3.456, anguloMesaGraus: 9.876, solda: { ativar: false } }
  ] };
  const janela = {
    mqttEstaConectado: () => true,
    carregarProgramaFirebase: async () => programa,
    buscarProducaoAtualFirebase: async () => null,
    salvarProducaoAtualFirebase: async () => {},
  };
  janela.producaoMQTT = new ProducaoMQTT({ enviar: async (comando, dados) => {
    chamadas.push({ comando, dados });
    if (resposta) return resposta(comando, dados);
    return { comando, ...dados, estado: comando === 'CARREGAR_PRODUCAO' ? 'RECEBIDA_NAO_EXECUTADA' : 'AGUARDANDO_CLP' };
  } });
  const c = vm.createContext({ window: janela, crypto: webcrypto, TextEncoder,
    document: { getElementById(id) { if (!elementos.has(id)) elementos.set(id, { addEventListener() {} }); return elementos.get(id); } },
    console: { error() {} }, executandoPrograma: false,
    filaProducao: [{ programa: 'chave-a', quantidade: 2 }, { programa: 'chave-b', quantidade: 3 }],
    maquinaRealAtiva: () => real, prepararPontosDoPrograma: p => p.pontos,
    estadoExecucao: 'AGUARDANDO_INICIO', EstadoExecucao: { AGUARDANDO_INICIO: 'AGUARDANDO_INICIO' },
    esconderBotaoIniciarCiclo() {}, mostrarBotaoIniciarCiclo() {},
    iniciarExecucaoPrograma: async () => { c.executandoPrograma = true; chamadas.push({ comando: 'VIRTUAL' }); }
  });
  vm.runInContext(source.slice(source.indexOf('let envioFilaMqttPendente'), source.indexOf('window.producaoMQTT = new')), c);
  vm.runInContext(source.slice(source.indexOf('async function confirmarInicioCiclo()'), source.indexOf('\ndocument\n  .getElementById("btnIniciarCiclo")')), c);
  return { c, chamadas, janela, programa };
}
test('início físico envia fila real e inicia após ACK; gesto/clique repetido não reenvia', async () => {
  const { c, chamadas } = ambiente();
  await Promise.all([c.confirmarInicioCiclo(), c.confirmarInicioCiclo()]);
  await c.confirmarInicioCiclo();
  assert.deepEqual(chamadas.map(x => x.comando), ['CARREGAR_PRODUCAO', 'INICIAR_PRODUCAO']);
  const p = chamadas[0].dados;
  assert.equal(p.totalPecas, 5); assert.equal(p.modo, 'FISICO'); assert.equal(p.versaoContrato, 1);
  assert.match(p.revisao, /^[a-f0-9]{64}$/);
  assert.equal(p.fila[0].nome, 'Cadastro real'); assert.equal(p.fila[0].tipoMaterial, 'Aço');
  assert.deepEqual(Array.from(p.fila, x => x.programa), ['chave-a', 'chave-b']);
  assert.deepEqual(Array.from(p.fila[0].pontos, x => x.ordem), [2, 8]);
  assert.equal(p.fila[0].pontos[1].zMm, 12.345);
  assert.equal(p.fila[0].pontos[1].soldagem.corrente, 42);
  assert.equal(c.executandoPrograma, false);
});
test('virtual inicia mesmo com MQTT conectado e Node-RED sem resposta, sem publicar', async () => {
  const { c, chamadas } = ambiente({ real: false, resposta: () => { throw Error('offline'); } });
  await c.confirmarInicioCiclo();
  assert.deepEqual(chamadas.map(x => x.comando), ['VIRTUAL']);
});
test('ACK ausente ou incompatível nunca solicita início nem reenvia após falha', async () => {
  for (const resposta of [() => { throw Error('timeout Node-RED'); },
    (comando, dados) => ({ comando, ...dados, revisao: 'outra', estado: 'RECEBIDA_NAO_EXECUTADA' })]) {
    const { c, chamadas, janela } = ambiente({ resposta });
    await c.confirmarInicioCiclo(); await c.confirmarInicioCiclo();
    assert.deepEqual(chamadas.map(x => x.comando), ['CARREGAR_PRODUCAO']);
    assert.equal(janela.producaoMQTT.reconciliar, true);
  }
});
test('INICIAR aguarda o recebimento correlacionado antes de publicar', async () => {
  let confirmar;
  const { c, chamadas } = ambiente({ resposta: (comando, dados) => comando === 'CARREGAR_PRODUCAO'
    ? new Promise(resolve => { confirmar = () => resolve({ comando, ...dados, estado: 'RECEBIDA_NAO_EXECUTADA' }); })
    : { comando, ...dados, estado: 'AGUARDANDO_CLP' } });
  const pendente = c.confirmarInicioCiclo();
  while (!confirmar) await new Promise(resolve => setImmediate(resolve));
  assert.equal(chamadas.length, 1);
  confirmar(); await pendente;
  assert.equal(chamadas[1].comando, 'INICIAR_PRODUCAO');
});

test('START físico usa a mesma função central do botão', async () => {
  const { c, chamadas } = ambiente();
  vm.runInContext(source.slice(source.indexOf('window.controlarSimulacaoPorGesto ='), source.indexOf('let inicioReproducaoPendente =')), c);
  await c.window.controlarSimulacaoPorGesto('START');
  await c.window.controlarSimulacaoPorGesto('START');
  assert.deepEqual(chamadas.map(x => x.comando), ['CARREGAR_PRODUCAO', 'INICIAR_PRODUCAO']);
});

test('bloco manual Node-RED recebe planejamento, aguarda CLP e nunca escreve Modbus', async () => {
  const { c, chamadas } = ambiente(); await c.confirmarInicioCiclo();
  const manual = fs.readFileSync(path.join(__dirname, '../INSTRUCOES_NODE_RED_MANUAL.md'), 'utf8');
  const codigo = manual.match(/```javascript\s*([\s\S]*?)```/)[1];
  const memoria = () => { const m = new Map(); return { get: k => m.get(k), set: (k, v) => m.set(k, v) }; };
  const flow = memoria(), context = memoria(), saidas = [];
  const executar = (comando, dados, idComando = comando) => {
    vm.runInNewContext(`(function () { ${codigo} })()`, {
      msg: { payload: { comando, dados, idComando, timestamp: Date.now() } },
      flow, context, node: { send: s => saidas.push(s) },
      global: { get() { throw Error('Acesso indevido ao CLP'); } }
    });
    return saidas.at(-1).find(Boolean).payload;
  };
  const plano = chamadas[0].dados;
  assert.equal(executar('CARREGAR_PRODUCAO', plano).estado, 'RECEBIDA_NAO_EXECUTADA');
  const inicio = executar('INICIAR_PRODUCAO', plano);
  assert.equal(inicio.estado, 'AGUARDANDO_CLP'); assert.equal(inicio.confirmacaoClp, false);
  assert.equal(executar('CONSULTAR_PRODUCAO', plano).execucaoIniciada, false);
  assert.equal(executar('PAUSAR_PRODUCAO', plano).codigo, 'NAO_HOMOLOGADO');
  assert.equal(executar('RETOMAR_PRODUCAO', plano).codigo, 'NAO_HOMOLOGADO');
  assert.equal(executar('CANCELAR_PRODUCAO', plano).estado, 'CANCELADO');
  const totalSaidas = saidas.length;
  executar('PING', {});
  assert.equal(saidas.length, totalSaidas); // Segue para o roteador original.
});
