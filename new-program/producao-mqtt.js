// Coordenação MQTT: nunca movimenta e nunca usa a animação como confirmação física.
(function (root) {
  class ProducaoMQTT {
    constructor({ enviar, storage, atualizar = () => {} }) {
      Object.assign(this, { enviar, storage, atualizar });
      this.estado = 'PARADA'; this.pendente = false; this.reconciliar = false;
      try {
        this.sessao = JSON.parse(storage?.getItem('soldatouch.producao.mqtt') || 'null');
        if (this.sessao) { this.reconciliar = true; this.estado = 'AGUARDANDO_CLP'; }
      } catch { this.reconciliar = true; }
    }
    bloqueada() {
      return this.pendente || this.reconciliar || Boolean(this.sessao && !['FINALIZADO', 'CANCELADO'].includes(this.estado));
    }
    definir(estado, mensagem = '') {
      this.estado = estado;
      this.atualizar({ estado, mensagem, sessao: this.sessao });
    }
    async exclusivo(acao) {
      if (this.pendente) throw new Error('Comando de produção aguardando confirmação.');
      this.pendente = true;
      try { return await acao(); }
      catch (erro) {
        this.reconciliar = Boolean(this.sessao);
        this.definir('AGUARDANDO_CLP', erro.message + ' Consulte o estado antes de tentar novamente.');
        throw erro;
      } finally { this.pendente = false; }
    }
    async comando(nome, dados = {}) {
      const resposta = await this.enviar(nome, { ...dados, producaoId: this.sessao.producaoId,
        revisao: this.sessao.revisao }, { timeoutMs: 12000 });
      if (resposta.comando !== nome || resposta.producaoId !== this.sessao.producaoId ||
          resposta.revisao !== this.sessao.revisao) throw new Error('Confirmação incompatível com o planejamento.');
      return resposta;
    }
    async carregar(plano) {
      return this.exclusivo(async () => {
        if (this.reconciliar) throw new Error('Reconciliação necessária.');
        if (this.sessao) {
          if (this.sessao.producaoId === plano.producaoId && this.sessao.revisao === plano.revisao &&
              ['PLANEJAMENTO_RECEBIDO','AGUARDANDO_CLP','AGUARDANDO_INICIO'].includes(this.estado)) return;
          throw new Error('Já existe planejamento pendente. Consulte ou cancele antes de substituir.');
        }
        this.sessao = { producaoId: plano.producaoId, revisao: plano.revisao, modo: plano.modo };
        this.storage?.setItem('soldatouch.producao.mqtt', JSON.stringify(this.sessao));
        this.definir('PLANEJAMENTO_PENDENTE');
        const r = await this.comando('CARREGAR_PRODUCAO', plano);
        if (r.estado !== 'RECEBIDA_NAO_EXECUTADA') throw new Error('Recebimento do planejamento não confirmado.');
        this.definir('PLANEJAMENTO_RECEBIDO');
      });
    }
    aceitar(r) {
      const estados = ['AGUARDANDO_CLP','AGUARDANDO_INICIO','PREPARANDO','EXECUTANDO','PAUSANDO',
        'PAUSADO','RETOMANDO','AGUARDANDO_PECA','FINALIZADO','CANCELADO','FALHA','EMERGENCIA'];
      if (r.estado === 'RECEBIDA_NAO_EXECUTADA') r = { ...r, estado: 'PLANEJAMENTO_RECEBIDO' };
      else if (!estados.includes(r.estado)) throw new Error('Estado de produção desconhecido.');
      if (['PREPARANDO','EXECUTANDO','PAUSADO','AGUARDANDO_PECA','FINALIZADO','CANCELADO'].includes(r.estado) &&
          r.confirmacaoClp !== true && !(r.estado === 'CANCELADO' && r.execucaoIniciada === false)) throw new Error('Estado físico sem confirmação do CLP.');
      this.reconciliar = false;
      this.definir(r.estado, r.mensagem);
      if (['FINALIZADO','CANCELADO'].includes(r.estado)) {
        this.storage?.removeItem('soldatouch.producao.mqtt'); this.sessao = null;
      }
      return r;
    }
    async controlar(acao) {
      if (acao === 'INICIAR' && this.estado !== 'PLANEJAMENTO_RECEBIDO')
        throw new Error(this.reconciliar ? 'Consulte a produção para reconciliar o estado.' :
          'Início incompatível com o estado confirmado; consulte a produção.');
      return this.exclusivo(async () => {
        if (!this.sessao) throw new Error('Nenhum planejamento recebido.');
        if (acao === 'CONSULTAR') return this.aceitar(await this.comando('CONSULTAR_PRODUCAO'));
        if (this.reconciliar) throw new Error('Consulte a produção para reconciliar o estado.');
        const permitidos = { INICIAR: ['PLANEJAMENTO_RECEBIDO'],
          PAUSAR: ['EXECUTANDO','PREPARANDO','AGUARDANDO_PECA'], RETOMAR: ['PAUSADO'],
          CANCELAR: ['PLANEJAMENTO_RECEBIDO','AGUARDANDO_CLP','AGUARDANDO_INICIO','EXECUTANDO','PREPARANDO','PAUSADO','AGUARDANDO_PECA'] };
        if (!permitidos[acao]?.includes(this.estado)) throw new Error('Ação incompatível com o estado confirmado.');
        this.definir(({ INICIAR: 'AGUARDANDO_INICIO', PAUSAR: 'PAUSANDO', RETOMAR: 'RETOMANDO', CANCELAR: 'AGUARDANDO_CLP' })[acao]);
        return this.aceitar(await this.comando(acao + '_PRODUCAO'));
      });
    }
    desconectar() {
      if (!this.sessao) return;
      this.reconciliar = true;
      this.definir('AGUARDANDO_CLP', 'Comunicação perdida; execução física desconhecida. Consulte o estado.');
    }
  }
  root.ProducaoMQTT = ProducaoMQTT;
  if (typeof module !== 'undefined') module.exports = { ProducaoMQTT };
})(globalThis);
