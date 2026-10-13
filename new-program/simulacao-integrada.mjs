import { CameraGestos } from './visao-camera.mjs';

// Controles adicionais da demonstração; o programa e o desenho 3D existentes são preservados.
if (document.getElementById("painelConexao")) {
  const panel = document.getElementById('painelConexao');
  const physical = document.getElementById('chkMaquinaReal');
  physical.checked = false; physical.disabled = true;
  physical.parentElement.title = 'Operações físicas bloqueadas nesta distribuição.';
  const section = document.createElement('section');
  section.className = 'simulacao-integrada';
  section.innerHTML = `<h3>Demonstração integrada</h3>
    <p>Comandos abaixo usam apenas o CLP simulado.</p>
    <div class="simulacao-acoes"><button data-comando="PING">Testar ponte</button>
    <button data-comando="MESA_START">Girar mesa simulada</button>
    <button data-comando="MESA_STOP">Parar mesa simulada</button></div>
    <button id="liberarSimulacao">Voltar à edição local</button>
    <p id="resultadoSimulacao" role="status">Aguardando Node-RED.</p>
    <details><summary>Câmera e gestos</summary>
    <video id="videoIntegrado" autoplay muted playsinline></video>
    <button id="ativarCameraIntegrada">Ativar câmera</button>
    <button id="pararCameraIntegrada" disabled>Desativar câmera</button>
    <p id="estadoCameraIntegrada" role="status">Câmera desligada.</p>
    <p id="gestoIntegrado">Nenhum gesto.</p>
    <small>Mão aberta: START. Punho fechado: PAUSA. Eventos apenas de simulação.</small></details>`;
  panel.append(section);
  if (!window.SoldaTechMQTTConfig?.simulacao) {
    section.querySelector('.simulacao-acoes').hidden = true;
    section.querySelector('#liberarSimulacao').hidden = true;
    section.querySelector('p').textContent = 'Demonstração 3D pública: não depende de MQTT ou CLP.';
  }
  const el = id => document.getElementById(id);
  let lastSimulationState;
  function update() {
    const state = window.obterEstadoConexaoMaquina();
    const ready = state.mqttConectado && state.simulacao && state.clp === 'SIMULAÇÃO';
    section.querySelectorAll('[data-comando]').forEach(button => { button.disabled = !ready; });
    if (!ready && lastSimulationState !== false) el('resultadoSimulacao').textContent = window.SoldaTechMQTTConfig?.publico
      ? 'Simulação 3D local pronta. Carregue um programa para iniciar.'
      : 'Aguardando comunicação com o simulador.';
    if (ready && lastSimulationState !== true) el('resultadoSimulacao').textContent = 'Simulador pronto. Teste a ponte ou gire a mesa.';
    lastSimulationState = ready;
  }
  section.querySelectorAll('[data-comando]').forEach(button => button.addEventListener('click', async () => {
    try {
      if (button.dataset.comando !== 'PING') window.acompanharSimulador = true;
      const resposta = await window.enviarComandoComConfirmacao(button.dataset.comando);
      el('resultadoSimulacao').textContent = `${resposta.comando}: ${resposta.mensagem || 'confirmado pelo Node-RED'}`;
    } catch (error) { el('resultadoSimulacao').textContent = error.message; }
  }));
  el('liberarSimulacao').onclick = async () => {
    try {
      await window.enviarComandoComConfirmacao('MESA_STOP');
      window.acompanharSimulador = false;
      el('resultadoSimulacao').textContent = 'Edição local liberada.';
    } catch (error) { el('resultadoSimulacao').textContent = error.message; }
  };
  const camera = new CameraGestos({ video: el('videoIntegrado'), mediaDevices: navigator.mediaDevices,
    aoEstado(estado, mensagem) {
      el('estadoCameraIntegrada').textContent = mensagem;
      el('ativarCameraIntegrada').disabled = ['ativa', 'preparando'].includes(estado);
      el('pararCameraIntegrada').disabled = !['ativa', 'preparando'].includes(estado);
    },
    aoResultado(gesto, resultado) {
      const categoria = resultado?.gestures?.[0]?.[0];
      el('gestoIntegrado').textContent = (({ START: 'Mão aberta — START', PAUSA: 'Punho fechado — PAUSA' })[gesto] || 'Nenhum gesto reconhecido.') +
        ` | Mãos: ${resultado?.landmarks?.length || 0} | ${categoria?.categoryName || 'sem categoria'}: ${Math.round((categoria?.score || 0) * 100)}%`;
    },
    async aoGesto(gesto) {
      try {
        const resultado = await window.controlarSimulacaoPorGesto(gesto);
        el('resultadoSimulacao').textContent = resultado.mensagem;
      } catch (erro) { el('resultadoSimulacao').textContent = erro.message; }
    },
  });
  el('ativarCameraIntegrada').onclick = () => void camera.iniciar();
  el('pararCameraIntegrada').onclick = () => camera.parar();
  window.addEventListener('soldatouch:mqtt-status', () => { camera.filtro.reiniciar(true); update(); });
  window.addEventListener('soldatouch:maquina-evento', event => {
    update();
    if (event.detail.dados.comando === 'GESTO_VISAO') el('resultadoSimulacao').textContent = `${event.detail.dados.gesto}: recebido pelo Node-RED (simulação).`;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) camera.parar(); });
  const timer = setInterval(update, 1000);
  window.addEventListener('pagehide', () => { clearInterval(timer); camera.parar(); });
  update();
}
