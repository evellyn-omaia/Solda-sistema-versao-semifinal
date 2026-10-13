// Estado de navegação e filtro de gestos. Não executa produção nem publica MQTT.
export const CHAVE_SESSAO = "soldatouch.visao.v1";
export const CHAVE_RETORNO = "soldatouch.visao.retorno.v1";
export const VALIDADE_MS = 30 * 60 * 1000;
export const CAMERA_URL = "../new-program/camera.html";
export const RETORNO_URL = "../iniciar-producao/iniciarproducao.html";

export function validarQuantidade(valor) {
  const quantidade = Number(valor);
  if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
    throw new Error("Informe uma quantidade inteira maior que zero.");
  }
  return quantidade;
}

function assinatura(valor) {
  if (Array.isArray(valor)) return valor.map(assinatura);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.keys(valor).sort().map(k => [k, assinatura(valor[k])]));
  }
  return valor;
}

export function validarItens(itens, programas) {
  if (!Array.isArray(itens) || !itens.length || itens.length > 100) {
    throw new Error("Selecione um programa ou adicione programas à fila (máximo 100).");
  }
  const resultado = itens.map(item => {
    const programa = Object.hasOwn(programas, item.programa) && programas[item.programa];
    const pontos = programa && Object.values(programa.pontos || {});
    if (!programa || Number(programa.versaoFormato) !== 3 || !pontos?.length) {
      throw new Error("Programa indisponível ou inválido. Volte e selecione novamente.");
    }
    const revisao = JSON.stringify(assinatura(programa));
    if (item.revisao && item.revisao !== revisao) {
      throw new Error("O programa foi alterado. Volte e configure novamente.");
    }
    return { programa: item.programa, nome: programa.nome || item.programa,
      quantidade: validarQuantidade(item.quantidade), totalPontos: pontos.length,
      tipoMaterial: String(item.tipoMaterial || ""), materialSolda: String(item.materialSolda || ""), revisao };
  });
  validarQuantidade(resultado.reduce((soma, item) => soma + item.quantidade, 0));
  return resultado;
}

export function criarSessao({ contexto, programas, fila, selecao, agora = Date.now(), id = globalThis.crypto.randomUUID() }) {
  if (!contexto?.uid || !contexto?.empresaId) throw new Error("Entre na sua conta novamente.");
  const itens = [...fila];
  if (selecao.programa) itens.push(selecao);
  return { versao: 1, id, uid: contexto.uid, empresaId: contexto.empresaId,
    criadaEm: agora, modo: "DEMONSTRACAO", itens: validarItens(itens, programas),
    rascunho: { fila: JSON.parse(JSON.stringify(fila)), selecao: { ...selecao } } };
}

export function validarSessao(sessao, contexto, agora = Date.now()) {
  if (!sessao || sessao.versao !== 1 || typeof sessao.id !== "string" || !sessao.id ||
      sessao.uid !== contexto?.uid || sessao.empresaId !== contexto?.empresaId ||
      sessao.modo !== "DEMONSTRACAO" || !Number.isFinite(sessao.criadaEm) ||
      agora < sessao.criadaEm || agora - sessao.criadaEm >= VALIDADE_MS ||
      !Array.isArray(sessao.itens) || !sessao.itens.length) {
    throw new Error("Configuração ausente, expirada ou de outra conta. Volte e configure a produção.");
  }
  sessao.itens.forEach(item => validarQuantidade(item.quantidade));
  return sessao;
}

export function lerSessao(storage, contexto, agora) {
  try {
    return validarSessao(JSON.parse(storage.getItem(CHAVE_SESSAO)), contexto, agora);
  } catch (erro) {
    storage.removeItem(CHAVE_SESSAO);
    storage.removeItem(CHAVE_RETORNO);
    throw erro;
  }
}

export function classificarResultado(resultado) {
  if (!resultado?.landmarks?.length) return "SEM_MAO";
  if (resultado.landmarks.length !== 1) return "DESCONHECIDO";
  const categoria = resultado.gestures?.[0]?.[0];
  if (!(categoria?.score >= 0.65)) return "DESCONHECIDO";
  return { Open_Palm: "START", Closed_Fist: "PAUSA" }[categoria.categoryName] || "DESCONHECIDO";
}

export class FiltroGestos {
  constructor({ estabilidade = 600, cooldown = 1800, intervaloMaximo = 400 } = {}) {
    this.intervaloMaximo = intervaloMaximo;
    this.estabilidade = estabilidade;
    this.cooldown = cooldown;
    this.ultimoEnvio = -Infinity;
    this.enviado = null;
    this.reiniciar(false);
  }
  reiniciar(exigirNeutro = true) {
    this.candidato = null;
    this.desde = 0;
    this.ultimoFrame = null;
    this.exigirNeutro = exigirNeutro;
  }
  atualizar(gesto, agora, conectado = true) {
    if (!conectado) { this.reiniciar(); return null; }
    const atual = ["START", "PAUSA"].includes(gesto) ? gesto : "NEUTRO";
    if (this.ultimoFrame !== null && (agora - this.ultimoFrame > this.intervaloMaximo || agora < this.ultimoFrame)) {
      this.candidato = null;
    }
    this.ultimoFrame = agora;
    if (atual !== this.candidato) { this.candidato = atual; this.desde = agora; return null; }
    if (agora - this.desde < this.estabilidade) return null;
    if (atual === "NEUTRO") { this.enviado = null; this.exigirNeutro = false; return null; }
    if (this.exigirNeutro || atual === this.enviado || agora - this.ultimoEnvio < this.cooldown) return null;
    this.enviado = atual;
    this.ultimoEnvio = agora;
    return atual;
  }
}

// Não há adaptador operacional habilitado: nem flags, nem dados do storage autorizam CLP.
export function solicitarGestoDemonstracao(sessao, contexto, gesto, agora = Date.now()) {
  validarSessao(sessao, contexto, agora);
  if (!["START", "PAUSA"].includes(gesto)) throw new Error("Gesto desconhecido.");
  return Object.freeze({ tipo: "GESTO_VISAO", gesto, sessaoId: sessao.id,
    enviado: false, executado: false,
    mensagem: `${gesto} reconhecido em demonstração. Nenhuma solicitação enviada à máquina.` });
}
