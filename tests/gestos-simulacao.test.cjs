const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../new-program/novoprograma.js'), 'utf8');
const api = source.slice(source.indexOf('window.controlarSimulacaoPorGesto ='), source.indexOf('let inicioReproducaoPendente ='));
function ambiente() {
  const contexto = vm.createContext({
    window: {}, document: { getElementById: () => ({ textContent: '' }) },
    maquinaRealAtiva: () => false, estadoExecucao: 'PARADA', EstadoExecucao: { EMERGENCIA: 'EMERGENCIA', PAUSADO: 'PAUSADO' },
    producaoCancelada: false, executandoPrograma: false, inicioReproducaoPendente: false,
    filaProducao: [],
    pontos: [{ zMm: 10, anguloMesaGraus: 90 }], mesaReal: {}, conjuntoMovel: {},
    modoReproducaoSimples: true, programaPausado: false, indicePontoAtual: 3,
  });
  contexto.iniciarReproducaoSimples = async modo => {
    assert.equal(modo, 'SINGULAR'); contexto.executandoPrograma = true; contexto.estadoExecucao = 'EXECUTANDO';
  };
  contexto.alternarMovimentoReproducaoSimples = () => { contexto.programaPausado = true; contexto.estadoExecucao = 'PAUSADO'; };
  contexto.alternarMovimento = async () => {
    contexto.programaPausado = !contexto.programaPausado;
    contexto.estadoExecucao = contexto.programaPausado ? 'PAUSADO' : 'EXECUTANDO';
  };
  vm.runInContext(api, contexto);
  return contexto;
}
test('gestos locais iniciam uma vez, pausam e retomam pelo controle central preservando ponto', async () => {
  const c = ambiente();
  assert.equal((await c.window.controlarSimulacaoPorGesto('START')).estado, 'EXECUTANDO');
  await assert.rejects(c.window.controlarSimulacaoPorGesto('START'), /Já existe/);
  assert.equal((await c.window.controlarSimulacaoPorGesto('PAUSA')).estado, 'PAUSADO');
  assert.equal(c.indicePontoAtual, 3);
  assert.equal((await c.window.controlarSimulacaoPorGesto('START')).estado, 'EXECUTANDO');
  assert.equal(c.indicePontoAtual, 3);
});
test('modo físico, emergência, cancelamento, ausência de pontos/modelo e seleção pendente bloqueiam START', async () => {
  for (const dados of [{ maquinaRealAtiva: () => true }, { estadoExecucao: 'EMERGENCIA' },
    { producaoCancelada: true }, { pontos: [] }, { pontos: [{ zMm: NaN, anguloMesaGraus: 0 }] },
    { mesaReal: null }, { conjuntoMovel: null }, { inicioReproducaoPendente: true },
    { window: { acompanharSimulador: true } }]) {
    const c = ambiente();
    if (dados.window) c.window.acompanharSimulador = true;
    else Object.assign(c, dados);
    await assert.rejects(c.window.controlarSimulacaoPorGesto('START'));
    assert.equal(c.executandoPrograma, false);
  }
});
test('filtro aceita inferência lenta configurada sem repetir gesto mantido', async () => {
  const { FiltroGestos } = await import('../new-program/visao-core.mjs');
  const filtro = new FiltroGestos({ intervaloMaximo: 1500 });
  assert.equal(filtro.atualizar('START', 0), null);
  assert.equal(filtro.atualizar('START', 700), 'START');
  assert.equal(filtro.atualizar('START', 1400), null);
});
