import { CHAVE_SESSAO, VALIDADE_MS, lerSessao, validarItens, solicitarGestoDemonstracao } from "./visao-core.mjs";
import { CameraGestos } from "./visao-camera.mjs";

const el = id => document.getElementById(id);
let sessao, contexto, identidade, pararObservacao, expiracao;
let validando = false;
let geracaoValidacao = 0;
let encerrada = false;
const camera = new CameraGestos({
  video: el("video"), mediaDevices: navigator.mediaDevices,
  aoEstado(estado, mensagem) {
    el("estadoCamera").textContent = mensagem;
    el("seloCamera").textContent = estado === "ativa" ? "Ao vivo · processamento local" : "Câmera desligada";
    el("ativar").disabled = !sessao || estado === "preparando" || estado === "ativa";
    el("encerrar").disabled = !["ativa", "preparando"].includes(estado);
    el("alternar").disabled = estado !== "ativa";
    el("video").classList.toggle("frontal", camera.lado === "user");
    if (estado === "ativa") void verificarCameras();
  },
  aoResultado(gesto, resultado) {
    el("gesto").textContent = ({ START: "MÃO ABERTA — START", PAUSA: "MÃO FECHADA — PAUSA" })[gesto] || "AGUARDANDO GESTO";
    el("deteccao").textContent = gesto === "SEM_MAO" ? "Nenhuma mão detectada." : gesto === "DESCONHECIDO" ?
      "Gesto desconhecido ou mais de uma mão. Mostre uma palma aberta ou um punho fechado." : "Mantenha o gesto estável para confirmar a intenção.";
    const categoria = resultado?.gestures?.[0]?.[0];
    el('deteccao').textContent += ` Mãos: ${resultado?.landmarks?.length || 0}. ${categoria?.categoryName || 'Sem categoria'}: ${Math.round((categoria?.score || 0) * 100)}%.`;
  },
  async aoGesto(gesto) {
    try {
      // Releitura impede reutilizar configuração substituída em outra navegação desta aba.
      const atual = lerSessao(sessionStorage, contexto);
      if (atual.id !== sessao?.id || JSON.stringify(atual) !== JSON.stringify(sessao)) throw new Error("A configuração mudou. Volte e configure novamente.");
      if (!el('simulacaoVirtual').hidden) {
        try {
          const controlar = el('simulacaoVirtual').contentWindow?.controlarSimulacaoPorGesto;
          if (!controlar) throw new Error('A simulação 3D ainda está carregando.');
          const retorno = await controlar(gesto);
          el('resultado').textContent = retorno.mensagem;
          el('producao').textContent = `${retorno.estado} · somente simulação 3D`;
        } catch (erro) { el('resultado').textContent = erro.message; }
        return;
      }
      const resultado = solicitarGestoDemonstracao(sessao, contexto, gesto);
      el("resultado").textContent = resultado.mensagem;
      el("producao").textContent = "Não iniciada · demonstração";
    } catch (erro) { invalidar(erro.message); }
  },
});

async function verificarCameras() {
  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    el("alternar").hidden = dispositivos.filter(d => d.kind === "videoinput").length < 2;
  } catch { el("alternar").hidden = true; }
}

function invalidar(mensagem) {
  ++geracaoValidacao;
  sessao = null;
  contexto = null;
  clearTimeout(expiracao);
  camera.parar(mensagem);
  el('simulacaoVirtual').src = 'about:blank';
  el('simulacaoVirtual').hidden = true;
  el('abrirSimulacao').disabled = true;
  el("conexao").textContent = "Desconectado";
  el("quantidade").textContent = "—";
  el("programas").replaceChildren();
  el("resultado").textContent = "Nenhuma solicitação enviada.";
  el("revalidar").hidden = false;
}

async function preparar(ativarAutomaticamente = false) {
  if (validando || encerrada) return;
  validando = true;
  const geracao = ++geracaoValidacao;
  el("revalidar").disabled = true;
  el("conexao").textContent = "Conectando";
  try {
    if (!navigator.onLine) throw new Error("Sem conexão. Reconecte e toque em Tentar conexão novamente.");
    identidade ||= await import("./visao-identidade.js");
    const usuario = await identidade.obterContexto();
    const configuracao = lerSessao(sessionStorage, usuario);
    const programas = await identidade.listarProgramas();
    validarItens(configuracao.itens, programas);
    const conferido = await identidade.obterContexto();
    if (usuario.uid !== conferido.uid || usuario.empresaId !== conferido.empresaId) throw new Error("A conta mudou. Volte e configure novamente.");
    if (geracao !== geracaoValidacao || encerrada || document.hidden) return;
    sessao = configuracao;
    contexto = usuario;
    const lista = configuracao.itens.map(item => {
      const li = document.createElement("li");
      li.textContent = `${item.nome} · ${item.quantidade} peça(s)`;
      return li;
    });
    el("programas").replaceChildren(...lista);
    el('programaVirtual').replaceChildren(...configuracao.itens.map(item => {
      const option = document.createElement('option');
      option.value = item.programa; option.textContent = item.nome;
      return option;
    }));
    el('abrirSimulacao').disabled = false;
    el("quantidade").textContent = `${configuracao.itens.reduce((s, i) => s + i.quantidade, 0)} peça(s)`;
    el("conexao").textContent = "Modo demonstração · configuração validada";
    el("revalidar").hidden = true;
    el("ativar").disabled = false;
    el("estadoCamera").textContent = "Configuração pronta. Toque em Ativar câmera se necessário.";
    clearTimeout(expiracao);
    expiracao = setTimeout(() => invalidar("A configuração expirou. Volte e configure novamente."),
      Math.max(0, configuracao.criadaEm + VALIDADE_MS - Date.now()));
    pararObservacao?.();
    pararObservacao = identidade.observarUsuario(uid => {
      if (uid !== usuario.uid) {
        sessionStorage.removeItem(CHAVE_SESSAO);
        invalidar("A conta mudou ou foi desconectada. Volte e entre novamente.");
      }
    });
    // A caixa de permissão pode permanecer aberta indefinidamente; não bloquear revalidação.
    if (ativarAutomaticamente) void camera.iniciar();
  } catch (erro) {
    if (geracao === geracaoValidacao) invalidar(erro.message || "Não foi possível validar a configuração. Verifique a conexão e tente novamente.");
  } finally {
    validando = false;
    el("revalidar").disabled = false;
  }
}

el("ativar").addEventListener("click", () => { if (sessao) void camera.iniciar(); });
el('abrirSimulacao').addEventListener('click', () => {
  if (!sessao) return;
  camera.filtro.reiniciar(true);
  el('simulacaoVirtual').src = `./novoprograma.html?programaVisao=${encodeURIComponent(el('programaVirtual').value)}&quantidade=${sessao.itens.find(item => item.programa === el('programaVirtual').value).quantidade}`;
  el('simulacaoVirtual').hidden = false;
  el('resultado').textContent = 'Preparando o modelo e os pontos. Retire a mão antes do próximo gesto.';
});
el("encerrar").addEventListener("click", () => camera.parar());
el("alternar").addEventListener("click", () => { if (sessao) void camera.alternar(); });
el("revalidar").addEventListener("click", () => void preparar());
document.querySelectorAll("a").forEach(link => link.addEventListener("click", () => camera.parar()));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) invalidar("Câmera encerrada enquanto a página está em segundo plano. Valide a conexão para continuar.");
});
window.addEventListener("offline", () => invalidar("Conexão interrompida. Nenhum gesto será reenviado. Reconecte e valide novamente."));
window.addEventListener("online", () => { el("revalidar").hidden = false; });
window.addEventListener("pagehide", () => {
  encerrada = true;
  ++geracaoValidacao;
  camera.parar();
  pararObservacao?.();
  clearTimeout(expiracao);
});
window.addEventListener("pageshow", event => {
  if (event.persisted) { encerrada = false; invalidar("Valide a configuração e ative a câmera novamente."); }
});
void preparar(true);
