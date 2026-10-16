// As chamadas clássicas aguardam o módulo real; nenhum dado é salvo localmente.
(() => {
  const url = new URL('./firebase-programas.js', document.currentScript.src).href;
  const estado = window.SoldaTechFirebase = { estado: 'carregando', erro: null };
  const nomes = ['salvarProgramaFirebase', 'carregarProgramaFirebase', 'listarProgramasFirebase',
    'excluirProgramaFirebase', 'salvarProducaoAtualFirebase', 'buscarProducaoAtualFirebase'];
  const pendentes = {};
  const pronto = import(url).then(() => {
    for (const nome of nomes) {
      if (typeof window[nome] !== 'function' || window[nome] === pendentes[nome])
        throw new Error(`Módulo Firebase executou sem registrar ${nome}.`);
    }
    estado.estado = 'pronto';
  }).catch(causa => {
    estado.estado = 'erro';
    estado.erro = new Error(`Falha ao carregar Firebase (${url}): ${causa.message || causa}. Verifique a rede e o bloqueio do CDN no Console/Network.`);
    throw estado.erro;
  });
  window.firebaseProgramasPronto = pronto;
  pronto.catch(erro => {
    console.error(erro);
    const mostrar = () => {
      const alvo = document.getElementById('statusPrograma');
      if (alvo) alvo.textContent = erro.message;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrar, { once: true });
    else mostrar();
  });
  for (const nome of nomes) {
    if (typeof window[nome] === 'function') continue;
    pendentes[nome] = window[nome] = async (...args) => {
      await pronto;
      return window[nome](...args);
    };
  }
})();
