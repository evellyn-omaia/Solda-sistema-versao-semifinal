
const btnMapaAnterior = document.getElementById("btnMapaAnterior");
const btnMapaProximo = document.getElementById("btnMapaProximo");
const nomeMapaPrograma = document.getElementById("nomeMapaPrograma");


const tipoUsuario =
  sessionStorage.getItem(
    "tipoUsuario"
  );

const abasAdmin =
  document.getElementById(
    "abasAdmin"
  );

const abaProducaoEmpresa =
  document.getElementById(
    "abaProducaoEmpresa"
  );

const abaOperadores =
  document.getElementById(
    "abaOperadores"
  );

const conteudoProducaoEmpresa =
  document.getElementById(
    "conteudoProducaoEmpresa"
  );

const conteudoOperadores =
  document.getElementById(
    "conteudoOperadores"
  );

  const listaOperadoresPainel =
  document.getElementById(
    "listaOperadoresPainel"
  );

const rankingPecas =
  document.getElementById(
    "rankingPecas"
  );

const rankingTempo =
  document.getElementById(
    "rankingTempo"
  );

const rankingProducoes =
  document.getElementById(
    "rankingProducoes"
  );

const resumoPausasEquipe =
  document.getElementById(
    "resumoPausasEquipe"
  );

let operadoresEmpresa = [];

let operadoresPainelCarregados =
  false;


  if (
  tipoUsuario === "admin" &&
  abasAdmin
) {
  abasAdmin.style.display =
    "flex";
}



function abrirAbaProducao() {

  conteudoProducaoEmpresa.style.display =
    "block";

  conteudoOperadores.style.display =
    "none";

  abaProducaoEmpresa.classList.add(
    "ativa"
  );

  abaOperadores.classList.remove(
    "ativa"
  );
}

async function abrirAbaOperadores() {

  conteudoProducaoEmpresa.style.display =
    "none";

  conteudoOperadores.style.display =
    "block";

  abaProducaoEmpresa.classList.remove(
    "ativa"
  );

  abaOperadores.classList.add(
    "ativa"
  );

  if (!operadoresPainelCarregados) {

    await carregarOperadoresPainel();

  }
}


async function carregarOperadoresPainelLegado() {

  if (tipoUsuario !== "admin") {
    return;
  }

  listaOperadoresPainel.innerHTML = `
    <p>Carregando operadores...</p>
  `;

  try {

    if (
      !window.buscarOperadoresEmpresaFirebase
    ) {

      listaOperadoresPainel.innerHTML = `
        <p>
          Não foi possível carregar
          os operadores.
        </p>
      `;

      console.warn(
        "buscarOperadoresEmpresaFirebase ainda não está disponível."
      );

      return;
    }

    const operadores =
      await window
        .buscarOperadoresEmpresaFirebase();

    operadoresEmpresa =
      Array.isArray(operadores)
        ? operadores
        : [];

    operadoresPainelCarregados =
      true;

    renderizarOperadoresPainelLegado();

  } catch (erro) {

    console.error(
      "Erro ao carregar operadores:",
      erro
    );

    listaOperadoresPainel.innerHTML = `
      <p>
        Erro ao carregar operadores.
      </p>
    `;
  }
}


function renderizarOperadoresPainelLegado() {

  listaOperadoresPainel.innerHTML =
    "";

  if (
    operadoresEmpresa.length === 0
  ) {

    listaOperadoresPainel.innerHTML = `
      <p>
        Nenhum operador cadastrado.
      </p>
    `;

    return;
  }

  operadoresEmpresa.forEach(
    (operador) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "operador-accordion";

      item.innerHTML = `
        <button
          class="operador-accordion-topo"
          type="button"
        >

          <div class="operador-identificacao">

            <div class="operador-avatar">
              ${obterIniciaisOperador(
                operador.nome
              )}
            </div>

            <div>
              <strong>
                ${operador.nome ||
                  "Operador"}
              </strong>

              <span>
                Operador
              </span>
            </div>

          </div>

          <span
            class="operador-seta"
          >
            ▼
          </span>

        </button>

        <div
          class="operador-accordion-conteudo"
          style="display:none;"
        >

          <p>
            Carregando dados do
            operador...
          </p>

        </div>
      `;

      const botao =
        item.querySelector(
          ".operador-accordion-topo"
        );

      const conteudo =
        item.querySelector(
          ".operador-accordion-conteudo"
        );

      const seta =
        item.querySelector(
          ".operador-seta"
        );

      botao.addEventListener(
        "click",
        () => {

          const aberto =
            conteudo.style.display ===
            "block";

          conteudo.style.display =
            aberto
              ? "none"
              : "block";

          seta.textContent =
            aberto
              ? "▼"
              : "▲";
        }
      );

      listaOperadoresPainel.appendChild(
        item
      );
    }
  );
}


function obterIniciaisOperador(
  nome
) {

  if (!nome) {
    return "OP";
  }

  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      parte =>
        parte.charAt(0).toUpperCase()
    )
    .join("");
}


if (abaProducaoEmpresa) {
  abaProducaoEmpresa.addEventListener(
    "click",
    abrirAbaProducao
  );
}

if (abaOperadores) {
  abaOperadores.addEventListener(
    "click",
    abrirAbaOperadores
  );
}

/* =========================================================
   PAINEL ADMINISTRATIVO DE OPERADORES
   Não há presença confiável no modelo atual. Por isso nenhum
   usuário é classificado como online/offline artificialmente.
========================================================= */
const buscaOperador = document.getElementById("buscaOperador");
const filtroStatusOperador = document.getElementById("filtroStatusOperador");
const botoesPeriodoOperadores = document.querySelectorAll(".btn-periodo-operadores");
const graficoProducoesOperadores = document.getElementById("graficoProducoesOperadores");
const contadorOperadores = document.getElementById("contadorOperadores");
const kpiTotalOperadores = document.getElementById("kpiTotalOperadores");
const kpiOperadoresOnline = document.getElementById("kpiOperadoresOnline");
const kpiPercentualOnline = document.getElementById("kpiPercentualOnline");
const kpiTempoProdutivo = document.getElementById("kpiTempoProdutivo");
const kpiTempoPausas = document.getElementById("kpiTempoPausas");
const kpiProducoesConcluidas = document.getElementById("kpiProducoesConcluidas");

let historicoOperadores = [];
let pausasOperadores = [];
let periodoOperadores = "hoje";

function textoSeguro(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[caractere]);
}

function normalizarTexto(valor) {
  return String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function pausaFinalizada(registro) {
  return registro?.status === "FINALIZADA";
}

function timestampRegistro(registro) {
  const direto = Number(
    pausaFinalizada(registro)
      ? registro.fimTimestamp || registro.inicioTimestamp || registro.timestamp
      : registro.timestamp || registro.fimTimestamp || registro.inicioTimestamp,
  );
  if (Number.isFinite(direto) && direto > 0) return direto;
  const partes = String(registro.data || "").split("/").map(Number);
  if (partes.length !== 3) return 0;
  const hora = String(registro.hora || "0:0:0").split(":").map(Number);
  return new Date(partes[2], partes[1] - 1, partes[0], hora[0] || 0, hora[1] || 0, hora[2] || 0).getTime();
}

function dentroPeriodoOperadores(registro) {
  if (periodoOperadores === "tudo") return true;
  const timestamp = timestampRegistro(registro);
  if (!timestamp) return false;
  const agora = new Date();
  let inicio;
  if (periodoOperadores === "hoje") inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  else if (periodoOperadores === "ano") inicio = new Date(agora.getFullYear(), 0, 1);
  else {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    inicio.setDate(inicio.getDate() - (Number(periodoOperadores) - 1));
  }
  return timestamp >= inicio.getTime() && timestamp <= agora.getTime();
}

function quantidadeReal(registro) {
  return Math.max(0, Number(registro.quantidadeConcluida ?? registro.quantidade ?? 0) || 0);
}

function statusConcluido(registro) {
  return normalizarTexto(registro.status) === "concluido";
}

function formatarDuracaoPainel(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  if (horas) return `${horas}h${String(minutos).padStart(2, "0")}`;
  if (minutos) return `${minutos}min`;
  return `${total}s`;
}

function formatarDuracaoPausa(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundosRestantes = total % 60;
  const partes = [];

  if (horas) partes.push(`${horas}h`);
  if (minutos) partes.push(`${minutos}m`);
  if (segundosRestantes || partes.length === 0) partes.push(`${segundosRestantes}s`);

  return partes.join(" ");
}

function somarTempoProdutivo(registros) {
  const execucoes = new Map();
  registros.forEach((registro, indice) => {
    if (registro.origem === "producao-diaria") return;
    const segundos = converterTempoParaSegundos(String(registro.tempo || ""));
    if (!segundos) return;
    // Filas antigas podem repetir o tempo total em vários programas. Um ID de
    // execução é prioritário; data/hora/tempo é o fallback conservador.
    const chaveExecucao = registro.execucaoId || registro.producaoId || registro.idExecucao ||
      `${registro.operadorUid || registro.uidUsuario}|${registro.data || ""}|${registro.hora || timestampRegistro(registro)}|${registro.tempo}`;
    execucoes.set(chaveExecucao || indice, Math.max(execucoes.get(chaveExecucao) || 0, segundos));
  });
  return [...execucoes.values()].reduce((total, valor) => total + valor, 0);
}

function motivoPausa(pausa) {
  const motivo = String(pausa.motivo || "").trim();
  return motivo || "Sem motivo";
}

function dadosDoOperador(operador, historico, pausas) {
  const registros = historico.filter((item) => (item.operadorUid || item.uidUsuario) === operador.uid);
  const pausasOperador = pausas.filter(
    (item) => pausaFinalizada(item) && item.operadorUid === operador.uid,
  );
  const concluidas = registros.filter(statusConcluido);
  const eficiencias = registros.filter(item => item.eficiencia != null).map((item) => Number(item.eficiencia)).filter(Number.isFinite);
  return {
    registros,
    pausas: pausasOperador,
    pecas: registros.reduce((total, item) => total + quantidadeReal(item), 0),
    producoes: concluidas.length,
    tempoProdutivo: somarTempoProdutivo(registros),
    tempoPausas: pausasOperador.reduce((total, item) => total + (Number(item.duracaoSegundos) || 0), 0),
    eficiencia: eficiencias.length ? eficiencias.reduce((a, b) => a + b, 0) / eficiencias.length : null,
  };
}

function renderizarBarras(container, itens, valor, formatador, limite) {
  if (!container) return;
  const lista = limite ? itens.slice(0, limite) : itens;
  const maximo = Math.max(0, ...lista.map(valor));
  const visualRanking = container.id === "rankingPecas";
  const visualTempo = container.id === "rankingTempo";
  const classeVisual = visualRanking ? "barra-ranking" : visualTempo ? "barra-tempo" : "barra-producao";
  container.innerHTML = lista.length ? lista.map((item, indice) => `
    <div class="barra-operador-item ${classeVisual}">
      <div class="barra-operador-info">
        ${visualRanking ? `<span class="medalha-ranking medalha-${indice + 1}" aria-label="${indice + 1}º lugar">${indice + 1}º</span>` : ""}
        ${!visualTempo ? `<span class="avatar-barra">${textoSeguro(obterIniciaisOperador(item.operador.nome))}</span>` : ""}
        <span class="nome-barra-operador">${textoSeguro(item.operador.nome)}</span>
        <strong>${textoSeguro(formatador(valor(item)))}</strong>
      </div>
      <div class="barra-operador-trilho"><i style="width:${maximo ? Math.max(3, (valor(item) / maximo) * 100) : 0}%"></i></div>
    </div>`).join("") : '<p class="estado-vazio">Sem dados no período.</p>';
}

function agruparPausasPorMotivo(pausas) {
  return pausas.reduce((grupos, pausa) => {
    const motivo = motivoPausa(pausa);
    if (!grupos[motivo]) grupos[motivo] = { motivo, quantidade: 0, tempo: 0 };
    grupos[motivo].quantidade += 1;
    grupos[motivo].tempo += Number(pausa.duracaoSegundos) || 0;
    return grupos;
  }, {});
}

function renderizarDetalhesOperador(dados) {
  const motivos = Object.values(agruparPausasPorMotivo(dados.pausas)).sort((a, b) => b.tempo - a.tempo);
  const recentes = [...dados.registros].sort((a, b) => timestampRegistro(b) - timestampRegistro(a)).slice(0, 6);
  return `
    <div class="detalhes-kpis">
      <div><span>Peças produzidas</span><strong>${dados.pecas}</strong></div>
      <div><span>Produções concluídas</span><strong>${dados.producoes}</strong></div>
      <div><span>Tempo produtivo</span><strong>${formatarDuracaoPainel(dados.tempoProdutivo)}</strong></div>
      <div><span>Eficiência média</span><strong>${dados.eficiencia === null ? "—" : `${dados.eficiencia.toFixed(1)}%`}</strong></div>
    </div>
    <div class="detalhes-colunas">
      <div><h4>Pausas por motivo</h4>${motivos.length ? motivos.map((item) => `<div class="linha-detalhe"><span>${textoSeguro(item.motivo)}</span><strong>${item.quantidade} ${item.quantidade === 1 ? "pausa" : "pausas"} · ${formatarDuracaoPausa(item.tempo)}</strong></div>`).join("") : '<p class="estado-vazio">Sem pausas finalizadas no período.</p>'}</div>
      <div><h4>Produções recentes</h4>${recentes.length ? recentes.map((item) => `<div class="producao-recente"><span>${textoSeguro(item.data || "—")} ${textoSeguro(item.hora || "")}</span><strong>${textoSeguro(item.programa || "Programa")}</strong><span>${quantidadeReal(item)} peças · ${textoSeguro(item.tempo || "—")} · ${textoSeguro(item.status || "—")}</span></div>`).join("") : '<p class="estado-vazio">Sem produções no período.</p>'}</div>
    </div>`;
}

function renderizarOperadoresPainel() {
  const historico = historicoOperadores.filter(dentroPeriodoOperadores);
  const pausasFinalizadas = pausasOperadores.filter(
    (item) => pausaFinalizada(item) && dentroPeriodoOperadores(item),
  );
  const termo = normalizarTexto(buscaOperador?.value);
  const status = filtroStatusOperador?.value || "todos";
  const dadosEquipe = operadoresEmpresa.map((operador) => ({
    operador,
    ...dadosDoOperador(operador, historico, pausasFinalizadas),
  }));
  const uidsOperadores = new Set(
    operadoresEmpresa.map((operador) => operador.uid).filter(Boolean),
  );
  const pausasNaoAtribuidas = pausasFinalizadas.filter(
    (pausa) => !pausa.operadorUid || !uidsOperadores.has(pausa.operadorUid),
  );
  // Status permanece desconhecido até o sistema ter presença real.
  const visiveis = dadosEquipe.filter((item) => (status === "todos") && normalizarTexto(`${item.operador.nome} ${item.operador.email}`).includes(termo));

  if (contadorOperadores) contadorOperadores.textContent = `${visiveis.length} ${visiveis.length === 1 ? "operador" : "operadores"}`;
  listaOperadoresPainel.innerHTML = visiveis.length ? visiveis.map((item) => `
    <article class="operador-accordion" data-operador="${textoSeguro(item.operador.uid)}">
      <div class="operador-linha">
        <div class="operador-identificacao"><div class="operador-avatar">${textoSeguro(obterIniciaisOperador(item.operador.nome))}</div><div><strong>${textoSeguro(item.operador.nome || "Operador")}</strong><span>Operador · status indisponível</span></div></div>
        <div class="operador-metrica"><span>Peças</span><strong>${item.pecas}</strong></div>
        <div class="operador-metrica"><span>Produções</span><strong>${item.producoes}</strong></div>
        <div class="operador-metrica"><span>Tempo produtivo</span><strong>${formatarDuracaoPainel(item.tempoProdutivo)}</strong></div>
        <div class="operador-metrica"><span>Pausas</span><strong>${item.pausas.length} · ${formatarDuracaoPausa(item.tempoPausas)}</strong></div>
        <button class="btn-detalhes-operador" type="button" aria-expanded="false">Ver detalhes <span>⌄</span></button>
      </div>
      <div class="operador-accordion-conteudo" hidden>${renderizarDetalhesOperador(item)}</div>
    </article>`).join("") : `<p class="estado-vazio">${status === "todos" ? "Nenhum operador encontrado." : "Status online/offline indisponível: o sistema ainda não registra presença real."}</p>`;

  listaOperadoresPainel.querySelectorAll(".btn-detalhes-operador").forEach((botao) => botao.addEventListener("click", () => {
    const detalhes = botao.closest(".operador-accordion").querySelector(".operador-accordion-conteudo");
    const abrir = detalhes.hidden;
    detalhes.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
    botao.firstChild.textContent = abrir ? "Ocultar detalhes " : "Ver detalhes ";
  }));

  const ordenadosPecas = [...dadosEquipe].sort((a, b) => b.pecas - a.pecas);
  const ordenadosProducoes = [...dadosEquipe].sort((a, b) => b.producoes - a.producoes);
  const ordenadosTempo = [...dadosEquipe].sort((a, b) => b.tempoProdutivo - a.tempoProdutivo);
  renderizarBarras(graficoProducoesOperadores, ordenadosProducoes, (item) => item.producoes, (valor) => `${valor} ${valor === 1 ? "produção" : "produções"}`);
  renderizarBarras(rankingPecas, ordenadosPecas, (item) => item.pecas, (valor) => `${valor} peças`, 3);
  renderizarBarras(rankingTempo, ordenadosTempo, (item) => item.tempoProdutivo, formatarDuracaoPainel);

  const motivos = Object.values(agruparPausasPorMotivo(pausasFinalizadas)).sort((a, b) => b.tempo - a.tempo);
  const maiorTempoMotivo = Math.max(0, ...motivos.map((item) => item.tempo));
  const tempoPausasNaoAtribuidas = pausasNaoAtribuidas.reduce(
    (total, pausa) => total + (Number(pausa.duracaoSegundos) || 0),
    0,
  );
  const avisoNaoAtribuidas = pausasNaoAtribuidas.length
    ? `<p class="estado-vazio">Não atribuído: ${pausasNaoAtribuidas.length} ${pausasNaoAtribuidas.length === 1 ? "pausa" : "pausas"} · ${formatarDuracaoPausa(tempoPausasNaoAtribuidas)} — já ${pausasNaoAtribuidas.length === 1 ? "incluída" : "incluídas"} nos motivos acima.</p>`
    : "";
  resumoPausasEquipe.innerHTML = motivos.length ? motivos.map((item) => `<div class="motivo-pausa" data-motivo="${textoSeguro(normalizarTexto(item.motivo))}">
    <div class="motivo-pausa-info"><span class="icone-motivo-pausa" aria-hidden="true"></span><span>${textoSeguro(item.motivo)}</span><strong>${item.quantidade}</strong><small>${formatarDuracaoPausa(item.tempo)}</small></div>
    <div class="barra-motivo-trilho"><i style="width:${maiorTempoMotivo ? Math.max(3, (item.tempo / maiorTempoMotivo) * 100) : 0}%"></i></div>
  </div>`).join("") + avisoNaoAtribuidas : '<p class="estado-vazio">Sem pausas finalizadas no período.</p>';

  const tempoPausasAtribuidas = dadosEquipe.reduce(
    (total, item) => total + item.tempoPausas,
    0,
  );

  kpiTotalOperadores.textContent = operadoresEmpresa.length;
  kpiOperadoresOnline.textContent = "—";
  kpiPercentualOnline.textContent = "Presença não disponível";
  kpiTempoProdutivo.textContent = formatarDuracaoPainel(dadosEquipe.reduce((t, item) => t + item.tempoProdutivo, 0));
  kpiTempoPausas.textContent = formatarDuracaoPausa(
    tempoPausasAtribuidas + tempoPausasNaoAtribuidas,
  );
  kpiProducoesConcluidas.textContent = historico.filter(statusConcluido).length;
}

async function carregarOperadoresPainel() {
  if (tipoUsuario !== "admin") return;
  listaOperadoresPainel.innerHTML = "<p>Carregando operadores...</p>";
  try {
    const [operadores, historico, pausas] = await Promise.all([
      window.buscarOperadoresEmpresaFirebase(),
      window.buscarHistoricoProducaoFirebase(),
      window.buscarPausasEmpresaFirebase(),
    ]);
    operadoresEmpresa = Array.isArray(operadores) ? operadores : [];
    historicoOperadores = Array.isArray(historico) ? historico : [];
    pausasOperadores = Array.isArray(pausas) ? pausas : [];
    operadoresPainelCarregados = true;
    renderizarOperadoresPainel();
  } catch (erro) {
    console.error("Erro ao carregar painel de operadores:", erro);
    listaOperadoresPainel.innerHTML = '<p class="estado-vazio">Não foi possível carregar os dados dos operadores.</p>';
  }
}

botoesPeriodoOperadores.forEach((botao) => botao.addEventListener("click", () => {
  periodoOperadores = botao.dataset.periodo;
  botoesPeriodoOperadores.forEach((item) => item.classList.toggle("ativo", item === botao));
  renderizarOperadoresPainel();
}));
buscaOperador?.addEventListener("input", renderizarOperadoresPainel);
filtroStatusOperador?.addEventListener("change", renderizarOperadoresPainel);


let indiceMapaAtual = 0;
let historicoGlobal = [];

let historicoFiltrado = [];

let periodoSelecionado = "hoje";

let producaoAtualGlobal = null;

const botoesPeriodo =
  document.querySelectorAll(".btn-periodo");


const totalProduzido = document.getElementById("totalProduzido");
const totalProgramas = document.getElementById("totalProgramas");
const eficienciaMedia = document.getElementById("eficienciaMedia");

const tempoTotal = document.getElementById("tempoTotal");
const consumoArame = document.getElementById("consumoArame");

const programaAtual = document.getElementById("programaAtual");
const pecasAtual = document.getElementById("pecasAtual");
const pontosAtual = document.getElementById("pontosAtual");
const tempoAtual = document.getElementById("tempoAtual");
const percentualAtual = document.getElementById("percentualAtual");

const controleOperadorProducaoAdmin = document.getElementById(
  "controleOperadorProducaoAdmin",
);
const seletorOperadorProducaoAdmin = document.getElementById(
  "operadorProducaoAtualAdmin",
);
const rotuloOperadorPainel = document.getElementById("rotuloOperadorPainel");
const operadorPainelAtual = document.getElementById("operadorPainelAtual");

let cancelarObservacaoProducaoAdmin = null;
let cancelarObservacaoOperadorLogado = null;
let versaoObservacaoProducaoAdmin = 0;
let uidOperadorAcompanhado = "";

const listaFila = document.getElementById("listaFila");
const historicoRecente = document.getElementById("historicoRecente");
const tempoProgramas = document.getElementById("tempoProgramas");

const graficoProgresso = document.getElementById("graficoProgresso");
const graficoPizza = document.getElementById("graficoPizza");
const graficoBarras = document.getElementById("graficoBarras");
const graficoLinha = document.getElementById("graficoLinha");
const graficoPontos = document.getElementById("graficoPontos");

function configurarIdentificacaoOperadorPainel() {
  if (tipoUsuario === "admin") {
    controleOperadorProducaoAdmin.hidden = false;
    rotuloOperadorPainel.innerText = "Operador acompanhado";
    operadorPainelAtual.innerText = "—";
    return;
  }

  controleOperadorProducaoAdmin.hidden = true;
  rotuloOperadorPainel.innerText = "Operador";
  operadorPainelAtual.innerText =
    sessionStorage.getItem("nomeUsuario") || "Operador";
}

function definirOpcaoUnicaSeletorOperador(texto) {
  seletorOperadorProducaoAdmin.replaceChildren();
  const opcao = document.createElement("option");
  opcao.value = "";
  opcao.textContent = texto;
  seletorOperadorProducaoAdmin.appendChild(opcao);
}

function pararObservacaoProducaoAdmin() {
  if (typeof cancelarObservacaoProducaoAdmin === "function") {
    cancelarObservacaoProducaoAdmin();
  }

  cancelarObservacaoProducaoAdmin = null;
}

function limparAreaOperacionalAdmin() {
  atualizarProducaoAtual(null, [], [], false);
  atualizarFila([], [], false);
}

function atualizarAreaOperacionalAdmin(producaoAtual) {
  const fila = Array.isArray(producaoAtual?.fila)
    ? producaoAtual.fila
    : [];

  atualizarProducaoAtual(producaoAtual, fila, [], false);
  atualizarFila(fila, [], false);
}

async function acompanharProducaoOperadorAdmin(operadorUid) {
  const uid = String(operadorUid || "").trim();
  const versaoAtual = ++versaoObservacaoProducaoAdmin;

  pararObservacaoProducaoAdmin();
  uidOperadorAcompanhado = "";
  limparAreaOperacionalAdmin();

  const operador = operadoresEmpresa.find((item) => item.uid === uid);

  if (!operador) {
    operadorPainelAtual.innerText = "—";
    return;
  }

  uidOperadorAcompanhado = uid;
  operadorPainelAtual.innerText =
    operador.nome || operador.email || "Operador";

  try {
    const cancelar = await window.observarProducaoAtualOperadorFirebase(
      uid,
      (producaoAtual, erro) => {
        if (
          versaoAtual !== versaoObservacaoProducaoAdmin ||
          uid !== uidOperadorAcompanhado
        ) {
          return;
        }

        if (erro) {
          console.error("Erro na observação da produção do operador:", erro);
          limparAreaOperacionalAdmin();
          return;
        }

        atualizarAreaOperacionalAdmin(producaoAtual);
      },
    );

    if (
      versaoAtual !== versaoObservacaoProducaoAdmin ||
      uid !== uidOperadorAcompanhado
    ) {
      if (typeof cancelar === "function") cancelar();
      return;
    }

    cancelarObservacaoProducaoAdmin = cancelar;
  } catch (erro) {
    if (versaoAtual !== versaoObservacaoProducaoAdmin) return;
    console.error("Erro ao observar produção atual do operador:", erro);
    limparAreaOperacionalAdmin();
  }
}

async function carregarSeletorProducaoOperadorAdmin() {
  versaoObservacaoProducaoAdmin++;
  uidOperadorAcompanhado = "";
  pararObservacaoProducaoAdmin();
  configurarIdentificacaoOperadorPainel();
  limparAreaOperacionalAdmin();
  definirOpcaoUnicaSeletorOperador("Carregando operadores...");
  seletorOperadorProducaoAdmin.disabled = true;

  try {
    const operadores = await window.buscarOperadoresEmpresaFirebase(true);
    operadoresEmpresa = Array.isArray(operadores) ? operadores : [];

    if (operadoresEmpresa.length === 0) {
      definirOpcaoUnicaSeletorOperador("Nenhum operador cadastrado");
      await acompanharProducaoOperadorAdmin("");
      return;
    }

    seletorOperadorProducaoAdmin.replaceChildren();
    operadoresEmpresa.forEach((operador) => {
      const opcao = document.createElement("option");
      opcao.value = operador.uid;
      opcao.textContent = operador.nome || operador.email || "Operador";
      seletorOperadorProducaoAdmin.appendChild(opcao);
    });

    seletorOperadorProducaoAdmin.disabled = false;
    seletorOperadorProducaoAdmin.value = operadoresEmpresa[0].uid;
    await acompanharProducaoOperadorAdmin(operadoresEmpresa[0].uid);
  } catch (erro) {
    console.error("Erro ao carregar operadores para acompanhamento:", erro);
    definirOpcaoUnicaSeletorOperador("Não foi possível carregar operadores");
    await acompanharProducaoOperadorAdmin("");
  }
}

seletorOperadorProducaoAdmin?.addEventListener("change", () => {
  void acompanharProducaoOperadorAdmin(seletorOperadorProducaoAdmin.value);
});

window.addEventListener("beforeunload", () => {
  pararObservacaoProducaoAdmin();
  if (typeof cancelarObservacaoOperadorLogado === "function") {
    cancelarObservacaoOperadorLogado();
  }
});

document.getElementById("btnVoltar").addEventListener("click", () => {
  window.location.href = "../solda-system/index.html";
});

async function carregarHistorico() {

  let detalhado = [];
  let diario = [];


  try {

    if (
      window
        .buscarHistoricoProducaoFirebase
    ) {

      detalhado =
        await window
          .buscarHistoricoProducaoFirebase();

          console.log(
  "DETALHADO DIRETO DO FIREBASE:",
  detalhado
);

      if (!Array.isArray(detalhado)) {
        detalhado = [];
      }
    }


    if (
      window
        .buscarHistoricoDiarioFirebase
    ) {

      diario =
        await window
          .buscarHistoricoDiarioFirebase();

      if (!Array.isArray(diario)) {
        diario = [];
      }
    }

  } catch (erro) {

    console.error(
      "Erro ao carregar histórico:",
      erro
    );
  }


  /*
  ==============================
  DIAS COM HISTÓRICO DETALHADO
  ==============================
  */

  const diasDetalhados =
    new Set();


  detalhado.forEach(
    (item) => {

      const data =
        obterDataRegistro(item);


      if (!data) {
        return;
      }


      const chaveDia =
        `${data.getFullYear()}-` +
        `${String(
          data.getMonth() + 1
        ).padStart(2, "0")}-` +
        `${String(
          data.getDate()
        ).padStart(2, "0")}`;


      diasDetalhados.add(
        chaveDia
      );
    }
  );


  /*
  ==============================
  RECUPERA SOMENTE DIAS ANTIGOS
  ==============================

  Se o dia já possui histórico
  detalhado, NÃO usamos o resumo
  diário daquele dia.

  Isso evita duplicação e permite
  contar cancelamentos parciais.
  */

  const recuperados =
    diario.filter(
      (item) => {

        const data =
          obterDataRegistro(item);


        if (!data) {
          return false;
        }


        const chaveDia =
          `${data.getFullYear()}-` +
          `${String(
            data.getMonth() + 1
          ).padStart(2, "0")}-` +
          `${String(
            data.getDate()
          ).padStart(2, "0")}`;


        return (
          !diasDetalhados.has(
            chaveDia
          )
        );
      }
    );


  const completo = [
    ...detalhado,
    ...recuperados
  ];


  completo.sort(
    (a, b) => {

      const dataA =
        obterDataRegistro(a);

      const dataB =
        obterDataRegistro(b);


      return (
        (dataA?.getTime() || 0)
        -
        (dataB?.getTime() || 0)
      );
    }
  );


  console.log(
    "Histórico detalhado:",
    detalhado
  );

  console.log(
    "Histórico diário recuperado:",
    recuperados
  );

  console.log(
    "Histórico final do painel:",
    completo
  );


  if (completo.length > 0) {
    return completo;
  }


  return (
    JSON.parse(
      localStorage.getItem(
        "historicoProducao"
      )
    ) || []
  );
}

function carregarFila() {
  return JSON.parse(localStorage.getItem("filaProducao")) || [];
}

function atualizarDataHora() {
  const agora = new Date();

  document.getElementById("dataAtual").innerText =
    agora.toLocaleDateString("pt-BR");

  document.getElementById("horaAtual").innerText =
    agora.toLocaleTimeString("pt-BR");
}

function converterTempoParaSegundos(tempo) {
  if (!tempo || !tempo.includes(":")) return 0;

  const partes = tempo.split(":").map(Number);

  return partes[0] * 60 + partes[1];
}

function formatarTempo(segundosTotais) {
  const minutos = Math.floor(segundosTotais / 60);
  const segundos = segundosTotais % 60;

  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

function obterDataRegistro(item) {

  /*
  Registros novos do Firebase
  possuem timestamp.
  */

  if (item.timestamp) {
    return new Date(Number(item.timestamp));
  }


  /*
  Compatibilidade com registros
  que possuem apenas:
  data: "10/08/2026"
  */

  if (item.data) {

    const partes =
      item.data.split("/");

    if (partes.length === 3) {

      const dia =
        Number(partes[0]);

      const mes =
        Number(partes[1]) - 1;

      const ano =
        Number(partes[2]);

      return new Date(
        ano,
        mes,
        dia
      );
    }
  }


  return null;
}

function filtrarHistoricoPorPeriodo(
  historico,
  periodo
) {

  if (periodo === "todos") {
    return [...historico];
  }

  const agora = new Date();

  const inicioHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate()
  );

  const fimHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    23,
    59,
    59,
    999
  );

  let dataLimite;

  if (periodo === "hoje") {

    dataLimite = inicioHoje;

  } else {

    const quantidadeDias =
      Number(periodo);

    dataLimite =
      new Date(inicioHoje);

    dataLimite.setDate(
      dataLimite.getDate()
      - (quantidadeDias - 1)
    );
  }

  return historico.filter(
    (item) => {

      const dataRegistro =
        obterDataRegistro(item);

      if (!dataRegistro) {
        return false;
      }

      return (
        dataRegistro >= dataLimite
        &&
        dataRegistro <= fimHoje
      );
    }
  );
}
function producaoFoiCancelada(
  item
) {

  return (
    String(
      item?.status || ""
    ).toUpperCase() ===
    "CANCELADO"
  );
}

function agruparPorPrograma(historico) {
  const dados = {};

  historico.forEach((item) => {
    if (!dados[item.programa]) {
      dados[item.programa] = 0;
    }

    dados[item.programa] += Number(item.quantidade) || 0;
  });

  return dados;
}

function agruparProducaoPorData(
  historico
) {

  const dados = {};


  historico.forEach(
    (item) => {

      const data =
        obterDataRegistro(item);


      if (!data) {
        return;
      }


      const chave =
        data.toLocaleDateString(
          "pt-BR"
        );


      if (!dados[chave]) {

        dados[chave] = {
          data:
            new Date(
              data.getFullYear(),
              data.getMonth(),
              data.getDate()
            ),

          quantidade: 0
        };
      }


      dados[chave].quantidade +=
        Number(item.quantidade) || 0;
    }
  );


  return Object.values(dados)
    .sort(
      (a, b) =>
        a.data - b.data
    );
}

function atualizarKpis(
  historicoProduzido,
  historicoConcluido
) {

  let totalPecas = 0;

  let somaEficiencia = 0;

  let segundos = 0;


  /*
  Todas as peças reais,
  inclusive antes de cancelar.
  */

  historicoProduzido.forEach(
    (item) => {

      totalPecas +=
        Number(
          item.quantidade
        ) || 0;
    }
  );


  /*
  Somente produções realmente
  concluídas.
  */

  historicoConcluido.forEach(
    (item) => {

      segundos +=
        converterTempoParaSegundos(
          item.tempo
        );
    }
  );


  totalProduzido.innerText =
    totalPecas;


  totalProgramas.innerText =
    historicoConcluido.length;


  tempoTotal.innerText =
    formatarTempo(
      segundos
    );


  const eficiencias = historicoConcluido.filter(item => item.eficiencia != null && Number.isFinite(Number(item.eficiencia)));
  eficienciaMedia.innerText = eficiencias.length
    ? (eficiencias.reduce((total, item) => total + Number(item.eficiencia), 0) / eficiencias.length).toFixed(1) + "%"
    : "Indisponível";
  consumoArame.innerText = "Indisponível";

}
function atualizarProducaoAtual(
  producaoAtual,
  fila,
  historico,
  permitirFallback = true,
) {

  /*
  ==========================
  1. PRODUÇÃO REAL/ATUAL
  VINDO DO FIREBASE
  ==========================
  */

  if (producaoAtual) {

    const total =
      Number(
        producaoAtual.quantidadeTotal
      ) || 0;

    const concluidas =
      Number(
        producaoAtual.quantidadeConcluida
      ) || 0;

    const percentual =
      Number(
        producaoAtual.percentual
      ) || 0;


    programaAtual.innerText =
      producaoAtual.programa ||
      "--";


    pecasAtual.innerText =
      `${concluidas} / ${total}`;

    pontosAtual.innerText =
      `${Number(producaoAtual.pontoAtual) || 0} / ${Number(producaoAtual.totalPontos) || 0}`;


    percentualAtual.innerText =
      `${percentual}%`;


    /*
    Status mostrado no campo
    onde antes aparecia o tempo.
    */

    if (
      producaoAtual.status ===
      "PAUSADO"
    ) {

      tempoAtual.innerText =
        "Pausado";

    } else if (
      producaoAtual.status ===
      "EXECUTANDO"
    ) {

      tempoAtual.innerText =
        "Executando";

    } else if (
      producaoAtual.status ===
      "CONCLUIDO_PROGRAMA"
    ) {

      tempoAtual.innerText =
        "Concluído";

    } else {

      tempoAtual.innerText =
        producaoAtual.status ||
        "--";
    }


    desenharProgressoCircular(
      graficoProgresso,
      percentual
    );

    return;
  }

  if (!permitirFallback) {
    programaAtual.innerText = "Sem produção ativa";
    pecasAtual.innerText = "0 / 0";
    pontosAtual.innerText = "0 / 0";
    tempoAtual.innerText = "--";
    percentualAtual.innerText = "0%";
    desenharProgressoCircular(graficoProgresso, 0);
    return;
  }


  /*
  ==========================
  2. FALLBACK DA FILA
  ==========================
  */

  if (
    fila.length > 0
  ) {

    const atual =
      fila[0];

    programaAtual.innerText =
      atual.programa;

    pecasAtual.innerText =
      `0 / ${atual.quantidade}`;

    pontosAtual.innerText =
      "0 / 0";

    tempoAtual.innerText =
      "Em fila";

    percentualAtual.innerText =
      "0%";

    desenharProgressoCircular(
      graficoProgresso,
      0
    );

    return;
  }


  /*
  ==========================
  /*
==========================
3. ÚLTIMA PRODUÇÃO DE HOJE
==========================
*/

const historicoHoje =
  filtrarHistoricoPorPeriodo(
    historico,
    "hoje"
  );


if (
  historicoHoje.length > 0
) {

  const ultimo =
    historicoHoje[
      historicoHoje.length - 1
    ];


  const quantidade =
    Number(
      ultimo.quantidadeConcluida ??
      ultimo.quantidade ??
      0
    );


  programaAtual.innerText =
    ultimo.programa || "--";


  pecasAtual.innerText =
    `${quantidade} / ${quantidade}`;

  pontosAtual.innerText =
    "0 / 0";


  tempoAtual.innerText =
    ultimo.tempo || "--";


  percentualAtual.innerText =
    "100%";


  desenharProgressoCircular(
    graficoProgresso,
    100
  );


  return;
}


  /*
  ==========================
  4. SEM PRODUÇÃO
  ==========================
  */

  programaAtual.innerText =
    "--";

  pecasAtual.innerText =
    "0 / 0";

  pontosAtual.innerText =
    "0 / 0";

  tempoAtual.innerText =
    "--";

  percentualAtual.innerText =
    "0%";

  desenharProgressoCircular(
    graficoProgresso,
    0
  );
}

function atualizarFila(fila, historico, permitirFallback = true) {
  listaFila.innerHTML = "";

  if (fila.length > 0) {
    fila.forEach((item, index) => {
      const percentual = index === 0 ? 0 : 0;

      listaFila.innerHTML += `
        <div class="item-fila">
          <strong>${item.programa}</strong>
          <span>${item.quantidade} peças aguardando</span>
          <div class="barra-mini">
            <div style="width:${percentual}%"></div>
          </div>
        </div>
      `;
    });

    return;
  }

  if (!permitirFallback) {
    listaFila.innerHTML = `<p style="color:#94a3b8;">Fila vazia.</p>`;
    return;
  }

const historicoHoje =
  filtrarHistoricoPorPeriodo(
    historico,
    "hoje"
  );


if (
  historicoHoje.length > 0
) {

  const ultimaHoje =
    historicoHoje[
      historicoHoje.length - 1
    ];


  listaFila.innerHTML = `
    <p style="color:#94a3b8;">
      Nenhuma fila ativa.
    </p>

    <div class="item-fila">

      <strong>
        Última produção de hoje
      </strong>

      <span>
        ${ultimaHoje.programa}
      </span>

      <div class="barra-mini">
        <div style="width:100%"></div>
      </div>

    </div>
  `;

  return;
}

  listaFila.innerHTML = `<p style="color:#94a3b8;">Nenhuma fila ativa.</p>`;
}

function atualizarHistorico(
  historico
) {

  historicoRecente.innerHTML =
    "";


  if (
    historico.length === 0
  ) {

    historicoRecente.innerHTML =
      `<p style="color:#94a3b8;">
        Nenhum histórico registrado.
      </p>`;

    return;
  }


  historico
    .slice()
    .reverse()
    .slice(0, 6)
    .forEach(
      (item) => {

        if (
          producaoFoiCancelada(
            item
          )
        ) {

          const concluida =
            Number(
              item.quantidadeConcluida ??
              item.quantidade
            ) || 0;


          const planejada =
            Number(
              item.quantidadePlanejada
            ) || 0;


          const percentual =
            Number(
              item.percentual
            ) || 0;


          historicoRecente.innerHTML += `
            <div class="evento">

              <span>
                ${item.data || "--"}
                <br>
                ${item.hora || "--"}
              </span>

              <p>
                Produção cancelada -
                ${item.programa || "--"}
                (${concluida}/${planejada}
                peças - ${percentual}%)
              </p>

            </div>
          `;

          return;
        }


        historicoRecente.innerHTML += `
          <div class="evento">

            <span>
              ${item.data || "--"}
              <br>
              ${item.hora || "--"}
            </span>

            <p>
              Produção concluída -
              ${item.programa || "--"}
              (${item.quantidade || 0}
              peças)
            </p>

          </div>
        `;
      }
    );
}
function atualizarTempoProgramas(historico) {
  tempoProgramas.innerHTML = "";

  const agrupado = {};

  historico.forEach((item) => {
    if (!agrupado[item.programa]) {
      agrupado[item.programa] = 0;
    }

    agrupado[item.programa] += converterTempoParaSegundos(item.tempo);
  });

  const nomes = Object.keys(agrupado);

  if (nomes.length === 0) {
    tempoProgramas.innerHTML = `<p style="color:#94a3b8;">Sem dados de tempo.</p>`;
    return;
  }

  const maior = Math.max(...Object.values(agrupado));

  nomes.forEach((nome) => {
    const valor = agrupado[nome];
    const porcentagem = (valor / maior) * 100;

    tempoProgramas.innerHTML += `
      <div class="tempo-item">
        <span>${nome.substring(0, 12)}</span>

        <div class="tempo-barra">
          <div style="width:${porcentagem}%"></div>
        </div>

        <strong>${formatarTempo(valor)}</strong>
      </div>
    `;
  });
}

function ajustarCanvas(canvas) {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  return canvas.getContext("2d");
}

function desenharProgressoCircular(canvas, valor) {
  const ctx = ajustarCanvas(canvas);
  const centroX = canvas.width / 2;
  const centroY = canvas.height / 2;
  const raio = Math.min(canvas.width, canvas.height) / 2 - 18;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 15;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(centroX, centroY, raio, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#0ea5e9";
  ctx.beginPath();
  ctx.arc(
    centroX,
    centroY,
    raio,
    -Math.PI / 2,
    -Math.PI / 2 + (Math.PI * 2 * valor) / 100
  );
  ctx.stroke();
}

function desenharPizza(canvas, dados) {
  const ctx = ajustarCanvas(canvas);
  const nomes = Object.keys(dados);
  const valores = Object.values(dados);
  const total = valores.reduce((a, b) => a + b, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (total === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Segoe UI";
    ctx.fillText("Sem dados", 30, 50);
    return;
  }

  const cores = ["#0ea5e9", "#00e5ff", "#14b8a6", "#1d4ed8", "#22c55e"];
  let inicio = -Math.PI / 2;

  nomes.forEach((nome, i) => {
    const fatia = (valores[i] / total) * Math.PI * 2;

    ctx.fillStyle = cores[i % cores.length];
    ctx.beginPath();
    ctx.moveTo(110, 125);
    ctx.arc(110, 125, 78, inicio, inicio + fatia);
    ctx.closePath();
    ctx.fill();

    inicio += fatia;

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px Segoe UI";
    ctx.fillText(`${nome} - ${valores[i]}`, 220, 70 + i * 28);
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(110, 125, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function desenharBarras(
  canvas,
  historico
) {

  const ctx =
    ajustarCanvas(canvas);


  const dados =
    agruparProducaoPorData(
      historico
    );


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (dados.length === 0) {

    ctx.fillStyle =
      "#94a3b8";

    ctx.font =
      "16px Segoe UI";

    ctx.fillText(
      "Sem dados neste período",
      30,
      50
    );

    return;
  }


  const valores =
    dados.map(
      item => item.quantidade
    );


  const maior =
    Math.max(...valores, 1);


  const espacoDisponivel =
    canvas.width - 50;


  const larguraBloco =
    espacoDisponivel /
    dados.length;


  const larguraBarra =
    Math.min(
      55,
      Math.max(
        12,
        larguraBloco * 0.55
      )
    );


  dados.forEach(
    (item, i) => {

      const alturaMaxima =
        canvas.height - 80;


      const altura =
        (
          item.quantidade /
          maior
        ) * alturaMaxima;


      const x =
        25
        + i * larguraBloco
        + (
          larguraBloco
          - larguraBarra
        ) / 2;


      const y =
        canvas.height
        - altura
        - 45;


      const grad =
        ctx.createLinearGradient(
          0,
          y,
          0,
          canvas.height
        );


      grad.addColorStop(
        0,
        "#00e5ff"
      );


      grad.addColorStop(
        1,
        "#1d4ed8"
      );


      ctx.fillStyle =
        grad;


      ctx.fillRect(
        x,
        y,
        larguraBarra,
        altura
      );


      /*
      quantidade
      */

      ctx.fillStyle =
        "#ffffff";

      ctx.font =
        "bold 12px Segoe UI";


      ctx.fillText(
        item.quantidade,
        x,
        y - 7
      );


      /*
      data
      */

      const dataTexto =
        item.data
          .toLocaleDateString(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit"
            }
          );


      ctx.fillStyle =
        "#94a3b8";

      ctx.font =
        "11px Segoe UI";


      ctx.fillText(
        dataTexto,
        x - 3,
        canvas.height - 18
      );
    }
  );
}

function desenharLinha(canvas, historico) {
  const ctx = ajustarCanvas(canvas);
  const pontos = historico.filter(item => item.eficiencia != null && Number.isFinite(Number(item.eficiencia))).map(item => Number(item.eficiencia));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (pontos.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Segoe UI";
    ctx.fillText("Sem dados", 30, 50);
    return;
  }

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;

  for (let i = 1; i <= 4; i++) {
    const y = (canvas.height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(canvas.width - 25, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 4;
  ctx.beginPath();

  pontos.forEach((valor, i) => {
    const x = 30 + i * ((canvas.width - 60) / Math.max(pontos.length - 1, 1));
    const y = canvas.height - 30 - (valor / 100) * (canvas.height - 60);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  pontos.forEach((valor, i) => {
    const x = 30 + i * ((canvas.width - 60) / Math.max(pontos.length - 1, 1));
    const y = canvas.height - 30 - (valor / 100) * (canvas.height - 60);

    ctx.fillStyle = "#00e5ff";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}
function desenharMapaPontos(canvas, historico, indice) {
  const ctx = ajustarCanvas(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0,229,255,0.14)";
  ctx.lineWidth = 1;

  for (let x = 30; x < canvas.width; x += 35) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x - 80, canvas.height - 30);
    ctx.stroke();
  }

  for (let y = 30; y < canvas.height; y += 35) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(canvas.width - 20, y);
    ctx.stroke();
  }

  if (historico.length === 0) {
    nomeMapaPrograma.innerText = "Programa: --";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Segoe UI";
    ctx.fillText("Sem pontos registrados", 30, 50);
    return;
  }

  const item = historico[indice];
  const pontos = item.pontos || [];

  nomeMapaPrograma.innerText = `Programa: ${item.programa}`;

  if (pontos.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px Segoe UI";
    ctx.fillText("Programa sem pontos salvos", 30, 50);
    return;
  }

  const margemX = 45;
  const larguraUtil = canvas.width - margemX * 2;
  const alturaUtil = canvas.height - 90;

  const zValores = pontos.map(
    (ponto) => Number(ponto.zMm) || 0
);
  const zMin = Math.min(...zValores);
  const zMax = Math.max(...zValores);

  function calcularX(index) {
    if (pontos.length === 1) {
      return canvas.width / 2;
    }

    return margemX + index * (larguraUtil / (pontos.length - 1));
  }

  function calcularY(z) {
    if (zMax === zMin) {
      return canvas.height / 2;
    }

    return canvas.height - 50 - ((z - zMin) / (zMax - zMin)) * alturaUtil;
  }

  ctx.strokeStyle = "#0ea5e9";
  ctx.lineWidth = 3;
  ctx.beginPath();

  pontos.forEach((ponto, indexPonto) => {
    const x = calcularX(indexPonto);
    const y = calcularY(Number(ponto.zMm));

    if (indexPonto === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  pontos.forEach((ponto, indexPonto) => {
    const x = calcularX(indexPonto);
    const y = calcularY(Number(ponto.zMm));

    ctx.fillStyle = ponto.anguloMesaGraus ? "#00e5ff" : "#cbd5e1";
    ctx.beginPath();
    ctx.arc(x, y, ponto.anguloMesaGraus ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "13px Segoe UI";
    ctx.fillText("P" + (indexPonto + 1), x - 8, y - 14);
  });

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Segoe UI";
  ctx.fillText(
    "Azul = mesa girando | Cinza = mesa parada",
    25,
    canvas.height - 12
  );
}

function atualizarPainelPeriodo() {

  historicoFiltrado =
    filtrarHistoricoPorPeriodo(
      historicoGlobal,
      periodoSelecionado
    );


const historicoConcluido =
  historicoFiltrado.filter(
    (item) => {

      const status =
        String(
          item.status || ""
        ).toUpperCase();


      return (
        status === "CONCLUÍDO" ||
        status === "CONCLUIDO"
      );
    }
  );


  const producaoPorPrograma =
    agruparPorPrograma(
      historicoFiltrado
    );


  atualizarKpis(
    historicoFiltrado,
    historicoConcluido
  );


  atualizarHistorico(
    historicoFiltrado
  );


  atualizarTempoProgramas(
    historicoConcluido
  );


  desenharPizza(
    graficoPizza,
    producaoPorPrograma
  );


  desenharBarras(
    graficoBarras,
    historicoFiltrado
  );


  desenharLinha(
    graficoLinha,
    historicoConcluido
  );


  if (
    historicoFiltrado.length > 0
  ) {

    indiceMapaAtual =
      historicoFiltrado.length - 1;

  } else {

    indiceMapaAtual = 0;
  }


  desenharMapaPontos(
    graficoPontos,
    historicoFiltrado,
    indiceMapaAtual
  );
}
async function iniciarPainel() {

  const historico =
    await carregarHistorico();


  const fila =
    tipoUsuario === "admin"
      ? []
      : carregarFila();

    try {

  if (
    tipoUsuario !== "admin" &&
    window.buscarProducaoAtualFirebase
  ) {

    producaoAtualGlobal =
      await window.buscarProducaoAtualFirebase();
  }

} catch (erro) {

  console.error(
    "Erro ao buscar produção atual:",
    erro
  );

  producaoAtualGlobal = null;
}


  /*
  Guarda TODO o histórico
  vindo do Firebase.
  */

  historicoGlobal =
    historico;


  atualizarDataHora();

  configurarIdentificacaoOperadorPainel();


  /*
  Produção Atual e fila
  não dependem do filtro
  dos gráficos.
  */

  if (tipoUsuario === "admin") {
    limparAreaOperacionalAdmin();
  } else {
    atualizarProducaoAtual(
      producaoAtualGlobal,
      fila,
      historicoGlobal
    );

    atualizarFila(
      fila,
      historicoGlobal
    );
  }


  /*
  Gráficos e KPIs
  usam o período selecionado.
  */

  atualizarPainelPeriodo();
}


function funcoesFirebasePainelDisponiveis() {
  const historicoDisponivel =
    window.buscarHistoricoProducaoFirebase &&
    window.buscarHistoricoDiarioFirebase;

  if (tipoUsuario === "admin") {
    return Boolean(
      historicoDisponivel &&
      window.buscarOperadoresEmpresaFirebase &&
      window.buscarProducaoAtualOperadorFirebase &&
      window.observarProducaoAtualOperadorFirebase
    );
  }

  return Boolean(
    historicoDisponivel &&
    window.buscarProducaoAtualFirebase
  );
}


async function iniciarPainelComFirebase() {

  let tentativas = 0;

  /*
  Aguarda o firebase-programas.js
  terminar de carregar.
  */

  while (
    !funcoesFirebasePainelDisponiveis()
    &&
    tentativas < 50
  ) {

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );

    tentativas++;
  }


  /*
  Se as funções ainda não existem,
  não usamos dados antigos do
  localStorage como se fossem atuais.
  */

  if (!funcoesFirebasePainelDisponiveis()) {

    console.error(
      "Firebase do painel não foi carregado."
    );

    return;
  }


  console.log(
    "Firebase do painel carregado."
  );


  await iniciarPainel();


  /*
  Depois que o painel estiver pronto,
  começa a observação em tempo real.
  */

  if (tipoUsuario === "admin") {
    await carregarSeletorProducaoOperadorAdmin();
  } else {
    await iniciarObservacaoProducaoAtual();
  }
}

async function iniciarObservacaoProducaoAtual() {

  /*
  Aguarda o módulo do Firebase
  ficar disponível.
  */

  let tentativas = 0;


  while (
    !window.observarProducaoAtualFirebase
    &&
    tentativas < 30
  ) {

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );

    tentativas++;
  }


  if (
    !window.observarProducaoAtualFirebase
  ) {

    console.warn(
      "Observador da produção atual não ficou disponível."
    );

    return;
  }


  try {

    if (typeof cancelarObservacaoOperadorLogado === "function") {
      cancelarObservacaoOperadorLogado();
    }

    cancelarObservacaoOperadorLogado =
      await window.observarProducaoAtualFirebase(
      (producaoAtual) => {
        const producaoAnterior = producaoAtualGlobal;

        /*
        Atualiza variável local
        imediatamente.
        */

        producaoAtualGlobal =
          producaoAtual;


        /*
        Recupera fila apenas para
        manter compatibilidade.
        */

        const fila =
          carregarFila();


        /*
        Atualiza somente o cartão
        da produção atual.
        */

        atualizarProducaoAtual(
          producaoAtualGlobal,
          fila,
          historicoGlobal
        );
        // A execução salva o histórico antes de remover a produção ativa.
        // A outra aba precisa recarregar também os KPIs, sem exigir refresh.
        if (producaoAnterior && !producaoAtual) {
          carregarHistorico().then(historico => {
            historicoGlobal = historico;
            atualizarPainelPeriodo();
            atualizarProducaoAtual(producaoAtualGlobal, carregarFila(), historicoGlobal);
          }).catch(erro => console.error('Erro ao atualizar histórico após conclusão:', erro));
        }
      }
    );

  } catch (erro) {

    console.error(
      "Erro ao observar produção atual:",
      erro
    );
  }
}




botoesPeriodo.forEach(
  (botao) => {

    botao.addEventListener(
      "click",
      () => {

        periodoSelecionado =
          botao.dataset.periodo;


        botoesPeriodo.forEach(
          (item) =>
            item.classList.remove(
              "ativo"
            )
        );


        botao.classList.add(
          "ativo"
        );


        atualizarPainelPeriodo();
      }
    );
  }
);
btnMapaAnterior.addEventListener("click", () => {
if (historicoFiltrado.length === 0) return;

  indiceMapaAtual--;

  if (indiceMapaAtual < 0) {
   indiceMapaAtual = historicoFiltrado.length - 1;
  }
desenharMapaPontos(
  graficoPontos,
  historicoFiltrado,
  indiceMapaAtual
);
});

btnMapaProximo.addEventListener("click", () => {
  if (historicoFiltrado.length === 0) return;

  indiceMapaAtual++;

  if (
  indiceMapaAtual >=
  historicoFiltrado.length
) {
    indiceMapaAtual = 0;
  }

 desenharMapaPontos(
  graficoPontos,
  historicoFiltrado,
  indiceMapaAtual
);
});
setInterval(atualizarDataHora, 1000);
window.addEventListener(
  "resize",
  () => {

    desenharProgressoCircular(
      graficoProgresso,
      Number.parseFloat(percentualAtual.innerText) || 0
    );

    const producaoPorPrograma =
      agruparPorPrograma(
        historicoFiltrado
      );


    desenharPizza(
      graficoPizza,
      producaoPorPrograma
    );


    desenharBarras(
      graficoBarras,
      historicoFiltrado
    );


const historicoConcluido =
  historicoFiltrado.filter(
    (item) => {

      const status =
        String(
          item.status || ""
        ).toUpperCase();

      return (
        status === "CONCLUÍDO" ||
        status === "CONCLUIDO"
      );
    }
  );

desenharLinha(
  graficoLinha,
  historicoConcluido
);


    desenharMapaPontos(
      graficoPontos,
      historicoFiltrado,
      indiceMapaAtual
    );
  }
);

iniciarPainelComFirebase();
