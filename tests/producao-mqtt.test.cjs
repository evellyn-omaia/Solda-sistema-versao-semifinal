const test = require('node:test');
const assert = require('node:assert/strict');
const { ProducaoMQTT } = require('../new-program/producao-mqtt.js');
function ambiente(enviar) {
  const dados = new Map();
  const storage = { getItem: k => dados.get(k), setItem: (k,v) => dados.set(k,v), removeItem: k => dados.delete(k) };
  const chamadas = [];
  const c = new ProducaoMQTT({ storage, enviar: async (comando, d) => {
    chamadas.push(comando);
    return enviar ? enviar(comando,d) : { comando, ...d, estado: comando === 'CARREGAR_PRODUCAO' ? 'RECEBIDA_NAO_EXECUTADA' : 'AGUARDANDO_CLP' };
  }});
  return { c, chamadas, storage };
}
const plano = { producaoId: 'p1', revisao: 'r1', modo: 'FISICO', fila: [{ quantidade: 6, pontos: [{ ordem: 1 }, { ordem: 2 }, { ordem: 3 }] }] };
test('recebimento nunca equivale a execução e repetição não reenvia plano', async () => {
  const { c, chamadas } = ambiente();
  await c.carregar(plano); await c.carregar(plano);
  assert.equal(c.estado, 'PLANEJAMENTO_RECEBIDO');
  await c.controlar('INICIAR');
  assert.deepEqual(chamadas, ['CARREGAR_PRODUCAO','INICIAR_PRODUCAO']);
  assert.equal(c.estado, 'AGUARDANDO_CLP');
});
test('comando concorrente bloqueado até confirmação', async () => {
  let resolver;
  const { c } = ambiente((comando,d) => new Promise(r => { resolver = () => r({ comando,...d,estado:'RECEBIDA_NAO_EXECUTADA' }); }));
  const primeiro = c.carregar(plano);
  await assert.rejects(c.carregar(plano), /aguardando/);
  resolver(); await primeiro;
});
test('timeout e desconexão exigem consulta sem reenvio de início', async () => {
  const { c, chamadas, storage } = ambiente();
  await c.carregar(plano); c.desconectar();
  await assert.rejects(c.controlar('INICIAR'), /Consulte/);
  const recuperado = new ProducaoMQTT({ storage, enviar: c.enviar });
  assert.equal(recuperado.reconciliar,true);
  await assert.rejects(recuperado.controlar('RETOMAR'), /Consulte/);
  assert.deepEqual(chamadas,['CARREGAR_PRODUCAO']);
  const falha = ambiente(() => Promise.reject(new Error('timeout')));
  await assert.rejects(falha.c.carregar(plano), /timeout/);
  assert.equal(falha.c.reconciliar,true);
});
test('resposta de outra produção ou revisão não confirma recebimento', async () => {
  for (const campo of ['producaoId','revisao','comando']) {
    const { c } = ambiente((comando,d) => ({ comando,...d,estado:'RECEBIDA_NAO_EXECUTADA',[campo]:'outro' }));
    await assert.rejects(c.carregar(plano), /incompatível/);
  }
});
test('pausa e retomada físicas usam confirmação e impedem comandos concorrentes', async () => {
  const { c, chamadas } = ambiente((comando, d) => ({ comando, ...d, confirmacaoClp: true,
    estado: ({ CARREGAR_PRODUCAO: 'RECEBIDA_NAO_EXECUTADA', INICIAR_PRODUCAO: 'EXECUTANDO',
      PAUSAR_PRODUCAO: 'PAUSADO', RETOMAR_PRODUCAO: 'EXECUTANDO' })[comando] }));
  await c.carregar(plano); await c.controlar('INICIAR');
  const pausa = c.controlar('PAUSAR');
  await assert.rejects(c.controlar('PAUSAR'), /aguardando/);
  await pausa; assert.equal(c.estado, 'PAUSADO');
  await c.controlar('RETOMAR'); assert.equal(c.estado, 'EXECUTANDO');
  assert.deepEqual(chamadas, ['CARREGAR_PRODUCAO', 'INICIAR_PRODUCAO', 'PAUSAR_PRODUCAO', 'RETOMAR_PRODUCAO']);
});

test('execução, pausa e conclusão precisam de confirmação CLP', async () => {
  const { c } = ambiente(); await c.carregar(plano);
  for (const estado of ['EXECUTANDO','PAUSADO','FINALIZADO'])
    assert.throws(() => c.aceitar({estado}), /sem confirmação/);
  c.aceitar({ estado:'PAUSADO',confirmacaoClp:true });
  assert.equal(c.estado,'PAUSADO');
  await assert.rejects(c.controlar('INICIAR'), /incompatível/);
});
