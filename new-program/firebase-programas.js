import { db, auth } from "../solda-login/firebase.js";

import {
  ref,
  set,
  get,
  remove,
  push,
  update,
  onValue,
  query,
  orderByChild,
  equalTo,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ==========================
AGUARDAR USUÁRIO LOGADO
========================== */

function esperarUsuarioLogado() {
  return new Promise((resolve, reject) => {
    const parar = onAuthStateChanged(auth, (user) => {
      parar();

      if (user) {
        resolve(user);
      } else {
        reject("Usuário não está logado.");
      }
    });
  });
}

// A sessão é apenas um cache: o vínculo autorizado vem do cadastro no Firebase.
async function obterEmpresaId(usuario) {
  if (!usuario?.uid || auth.currentUser?.uid !== usuario.uid) {
    throw new Error("Usuário não está logado.");
  }

  const empresaIdSessao = sessionStorage.getItem("empresaId");
  const snapshotUsuario = await get(ref(db, `usuarios/${usuario.uid}`));

  if (!snapshotUsuario.exists()) {
    sessionStorage.removeItem("empresaId");
    throw new Error("Dados do usuário não encontrados.");
  }

  const empresaIdCadastro = snapshotUsuario.val()?.empresaId;
  if (
    typeof empresaIdCadastro !== "string" ||
    !empresaIdCadastro.trim() ||
    /[.#$/[\]\u0000-\u001f\u007f]/.test(empresaIdCadastro)
  ) {
    sessionStorage.removeItem("empresaId");
    throw new Error("Empresa do usuário não identificada no cadastro.");
  }

  const empresaId = empresaIdSessao === empresaIdCadastro
    ? empresaIdSessao
    : empresaIdCadastro;
  const snapshotEmpresa = await get(ref(db, `empresas/${empresaId}`));

  // A autenticação pode mudar enquanto as consultas estão em andamento.
  if (auth.currentUser?.uid !== usuario.uid) {
    throw new Error("Usuário autenticado mudou. Tente novamente.");
  }
  if (!snapshotEmpresa.exists()) {
    sessionStorage.removeItem("empresaId");
    throw new Error("Empresa do usuário não encontrada.");
  }

  sessionStorage.setItem("empresaId", empresaId);
  return empresaId;
}

// Identidade conferida no cadastro, reutilizada pela navegação da visão mobile.
window.obterContextoVisaoFirebase = async function () {
  const usuario = await esperarUsuarioLogado();
  const empresaId = await obterEmpresaId(usuario);
  return { uid: usuario.uid, empresaId };
};

/* ==========================
INICIAR PAUSA
========================== */

window.iniciarPausaFirebase = async function (
  motivo = "Sem motivo",
  inicioTimestampInformado = null,
) {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  const operadorNome =
    sessionStorage.getItem("nomeUsuario") ||
    usuario.displayName ||
    usuario.email ||
    "Operador";

  if (!empresaId) {
    throw new Error("Empresa do usuário não identificada.");
  }

  const motivoFinal = motivo || "Sem motivo";

  const inicioTimestamp = Number(inicioTimestampInformado) || Date.now();

  const pausasRef = ref(db, `empresas/${empresaId}/pausas`);

  const novaPausa = push(pausasRef);

  await set(novaPausa, {
    empresaId: empresaId,

    operadorUid: usuario.uid,

    operadorNome: operadorNome,

    operadorEmail: usuario.email || "",

    motivo: motivoFinal,

    inicioTimestamp: inicioTimestamp,

    status: "ABERTA",
  });

  console.log("Pausa iniciada no Firebase:", {
    id: novaPausa.key,

    motivo: motivoFinal,

    operador: operadorNome,
  });

  return {
    id: novaPausa.key,

    inicioTimestamp: inicioTimestamp,

    motivo: motivoFinal,
  };
};

/* ==========================
ATUALIZAR MOTIVO DA PAUSA
========================== */

window.atualizarMotivoPausaFirebase = async function (pausaId, motivo) {
  await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("Empresa do usuário não identificada.");
  }

  if (!pausaId) {
    throw new Error("ID da pausa não informado.");
  }

  const pausaRef = ref(db, `empresas/${empresaId}/pausas/${pausaId}`);

  const snapshot = await get(pausaRef);

  if (!snapshot.exists()) {
    throw new Error("Pausa não encontrada.");
  }

  const pausa = snapshot.val();

  if (pausa.status !== "ABERTA") {
    throw new Error("Apenas pausas abertas podem ter o motivo atualizado.");
  }

  const motivoFinal = motivo || "Sem motivo";

  await update(pausaRef, {
    motivo: motivoFinal,
  });

  return {
    id: pausaId,
    motivo: motivoFinal,
  };
};

/* ==========================
FINALIZAR PAUSA
========================== */

window.finalizarPausaFirebase = async function (pausaId) {
  await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("Empresa do usuário não identificada.");
  }

  if (!pausaId) {
    throw new Error("ID da pausa não informado.");
  }

  const pausaRef = ref(db, `empresas/${empresaId}/pausas/${pausaId}`);

  const snapshot = await get(pausaRef);

  if (!snapshot.exists()) {
    throw new Error("Pausa não encontrada.");
  }

  const pausa = snapshot.val();

  const fimTimestamp = Date.now();

  const inicioTimestamp = Number(pausa.inicioTimestamp) || fimTimestamp;

  const duracaoSegundos = Math.max(
    0,
    Math.floor((fimTimestamp - inicioTimestamp) / 1000),
  );

  await set(pausaRef, {
    ...pausa,

    fimTimestamp: fimTimestamp,

    duracaoSegundos: duracaoSegundos,

    status: "FINALIZADA",
  });

  console.log("Pausa finalizada:", {
    id: pausaId,

    motivo: pausa.motivo,

    duracaoSegundos: duracaoSegundos,
  });

  return {
    fimTimestamp: fimTimestamp,

    duracaoSegundos: duracaoSegundos,
  };
};

/* ==========================
BUSCAR OPERADORES DA EMPRESA
========================== */

window.buscarOperadoresEmpresaFirebase =
async function(incluirProprioAdmin = false) {

  const usuario =
    await esperarUsuarioLogado();

  const empresaId =
    sessionStorage.getItem(
      "empresaId"
    );

  const tipoUsuario =
    sessionStorage.getItem(
      "tipoUsuario"
    );

  if (!empresaId) {
    throw new Error(
      "Empresa do usuário não identificada."
    );
  }

  if (tipoUsuario !== "admin") {
    throw new Error(
      "Apenas administradores podem consultar os operadores."
    );
  }

  const consultaOperadores =
    query(
      ref(db, "usuarios"),
      orderByChild("empresaId"),
      equalTo(empresaId)
    );

  const snapshot =
    await get(
      consultaOperadores
    );

  if (!snapshot.exists()) {
    return [];
  }

  const operadores = [];

  snapshot.forEach(
    (filho) => {

      const dados =
        filho.val();

      if (
        dados.tipoUsuario !==
        "operador" && !(incluirProprioAdmin && filho.key === usuario.uid)
      ) {
        return;
      }

      operadores.push({
        uid:
          filho.key,

        nome:
          dados.nome ||
          dados.email ||
          "Operador",

        email:
          dados.email || "",

        empresaId:
          dados.empresaId
      });
    }
  );

  operadores.sort(
    (a, b) =>
      a.nome.localeCompare(
        b.nome,
        "pt-BR"
      )
  );

  console.log(
    "Operadores da empresa:",
    operadores
  );

  return operadores;
};

/* Pausas administrativas: somente a empresa autenticada é consultada. */
window.buscarPausasEmpresaFirebase = async function () {
  await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);
  const tipoUsuario = sessionStorage.getItem("tipoUsuario");

  if (!empresaId) {
    throw new Error("Empresa do usuário não identificada.");
  }

  if (tipoUsuario !== "admin") {
    throw new Error("Apenas administradores podem consultar as pausas da empresa.");
  }

  const snapshot = await get(ref(db, `empresas/${empresaId}/pausas`));

  if (!snapshot.exists()) {
    return [];
  }

  return Object.entries(snapshot.val()).map(([id, pausa]) => ({
    id,
    ...pausa,
  })).filter((pausa) => pausa.empresaId === empresaId);
};

/* ==========================
SALVAR PROGRAMA
========================== */

window.salvarProgramaFirebase = async function (nome, programa) {
  if (typeof nome !== "string" || !nome.trim() || /[\u0000-\u001f\u007f]/.test(nome)) {
    throw new Error("Informe um nome válido para o programa.");
  }
  if (!programa || typeof programa !== "object" || Array.isArray(programa)) {
    throw new Error("Dados do programa inválidos.");
  }
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(usuario);

  const nomeSeguro = nome.trim().replace(/[.#$/[\]]/g, "-");

  await set(ref(db, `empresas/${empresaId}/programas/${nomeSeguro}`), {
    ...programa,

    nome: nome,

    chave: nomeSeguro,

    uidUsuario: usuario.uid,

    emailUsuario: usuario.email,

    empresaId: empresaId,

    data: new Date().toLocaleString("pt-BR"),
  });

  return nomeSeguro;
};

/* ==========================
CARREGAR UM PROGRAMA
========================== */

window.carregarProgramaFirebase = async function (nome) {
  validarChavePrograma(nome);
  const usuario = await esperarUsuarioLogado();
  const empresaId = await obterEmpresaId(usuario);

  const snapshot = await get(
    ref(db, `empresas/${empresaId}/programas/${nome}`),
  );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val();
};

/* ==========================
LISTAR PROGRAMAS DO USUÁRIO
========================== */

window.listarProgramasFirebase = async function () {
  const usuario = await esperarUsuarioLogado();
  const empresaId = await obterEmpresaId(usuario);

  const snapshot = await get(ref(db, `empresas/${empresaId}/programas`));

  if (!snapshot.exists()) {
    return {};
  }

  return snapshot.val();
};
/* ==========================
EXCLUIR PROGRAMA
========================== */

function validarChavePrograma(nome) {
  if (typeof nome !== "string" || !nome.trim() || /[.#$/[\]\u0000-\u001f\u007f]/.test(nome)) {
    throw new Error("Chave de programa inválida.");
  }
}

window.excluirProgramaFirebase = async function (nome) {
  validarChavePrograma(nome);
  const usuario = await esperarUsuarioLogado();
  const empresaId = await obterEmpresaId(usuario);

  await remove(ref(db, `empresas/${empresaId}/programas/${nome}`));
};
/* ==========================
SALVAR PRODUÇÃO DO DIA
========================== */

function obterDataLocalISO() {
  const agora = new Date();

  return [
    agora.getFullYear(),

    String(agora.getMonth() + 1).padStart(2, "0"),

    String(agora.getDate()).padStart(2, "0"),
  ].join("-");
}

window.salvarProducaoDiaFirebase = async function (filaProducao, tempoTotal) {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  const operadorNome =
    sessionStorage.getItem("nomeUsuario") ||
    usuario.displayName ||
    usuario.email ||
    "Operador";

  const hoje = obterDataLocalISO();

  let totalPecas = 0;
  let programas = {};

  filaProducao.forEach((item) => {
    totalPecas += Number(item.quantidade) || 0;

    programas[item.programa] = {
      quantidade: Number(item.quantidade) || 0,
    };
  });

  const caminhoEmpresa = `empresas/${empresaId}/producao/${hoje}/${usuario.uid}`;

  const caminhoAntigo = `usuarios/${usuario.uid}/producao/${hoje}`;

  /*
  Primeiro tenta usar os dados
  já existentes na empresa.
  */
  let snapshotAnterior = await get(ref(db, caminhoEmpresa));

  /*
  Se ainda não existir no caminho
  novo, usa o antigo como base.
  */
  if (!snapshotAnterior.exists()) {
    snapshotAnterior = await get(ref(db, caminhoAntigo));
  }

  const producaoAnterior = snapshotAnterior.exists()
    ? snapshotAnterior.val()
    : {
        totalPecas: 0,
        totalProgramas: 0,
        programas: {},
      };

  Object.entries(programas).forEach(([nome, dados]) => {
    const quantidadeAnterior =
      producaoAnterior.programas?.[nome]?.quantidade || 0;

    programas[nome].quantidade = quantidadeAnterior + dados.quantidade;
  });

  const dadosProducao = {
    totalPecas: (Number(producaoAnterior.totalPecas) || 0) + totalPecas,

    totalProgramas: Object.keys({
      ...producaoAnterior.programas,
      ...programas,
    }).length,

    programas: {
      ...producaoAnterior.programas,
      ...programas,
    },

    tempoTotal: tempoTotal,

    ultimaAtualizacao: new Date().toLocaleString("pt-BR"),

    empresaId: empresaId,

    operadorUid: usuario.uid,

    operadorNome: operadorNome,

    operadorEmail: usuario.email,

    uidUsuario: usuario.uid,

    emailUsuario: usuario.email,
  };

  /*
  Nova estrutura multiempresa.
  */
  await set(ref(db, caminhoEmpresa), dadosProducao);

  /*
  Caminho antigo mantido
  temporariamente.
  */
  await set(ref(db, caminhoAntigo), dadosProducao);
};

window.buscarProducaoDiaFirebase = async function () {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  const hoje = obterDataLocalISO();

  // Primeiro busca na estrutura multiempresa
  const snapshotEmpresa = await get(
    ref(db, `empresas/${empresaId}/producao/${hoje}/${usuario.uid}`),
  );

  if (snapshotEmpresa.exists()) {
    return snapshotEmpresa.val();
  }

  // Compatibilidade com dados antigos
  const snapshotAntigo = await get(
    ref(db, `usuarios/${usuario.uid}/producao/${hoje}`),
  );

  if (snapshotAntigo.exists()) {
    return snapshotAntigo.val();
  }

  return {
    totalPecas: 0,
    totalProgramas: 0,
    programas: {},
  };
};

window.buscarHistoricoDiarioFirebase = async function () {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  /*
  Primeiro busca a produção
  da empresa.
  */
  const snapshotEmpresa = await get(ref(db, `empresas/${empresaId}/producao`));

  const historico = [];
  const tipoUsuario = sessionStorage.getItem("tipoUsuario");

  if (snapshotEmpresa.exists()) {
    const dadosEmpresa = snapshotEmpresa.val();

    Object.entries(dadosEmpresa).forEach(([dataISO, operadores]) => {
      const operadoresDoDia =
        tipoUsuario === "admin"
          ? Object.entries(operadores || {})
          : [[usuario.uid, operadores?.[usuario.uid]]];

      operadoresDoDia.forEach(([operadorUid, dia]) => {
        if (!dia) {
          return;
        }

        const programas = dia.programas || {};

        Object.entries(programas).forEach(([programa, info]) => {
          const partes = dataISO.split("-");

          if (partes.length !== 3) {
            return;
          }

          const ano = Number(partes[0]);

          const mes = Number(partes[1]);

          const numeroDia = Number(partes[2]);

          historico.push({
            programa: programa,

            quantidade: Number(info.quantidade) || 0,

            data: `${String(numeroDia).padStart(2, "0")}/${String(mes).padStart(
              2,
              "0",
            )}/${ano}`,

            hora: "--",

            timestamp: new Date(ano, mes - 1, numeroDia, 12, 0, 0).getTime(),

            tempo: dia.tempoTotal || "00:00",

            eficiencia: null,

            status: "Concluído",

            origem: "producao-diaria",

            empresaId: empresaId,

            operadorUid: operadorUid,

            operadorNome:
              dia.operadorNome ||
              (operadorUid === usuario.uid
                ? sessionStorage.getItem("nomeUsuario") ||
                  usuario.email ||
                  "Operador"
                : "Operador"),
          });
        });
      });
    });

    if (historico.length > 0) {
      return historico;
    }
  }

  /*
  Compatibilidade temporária
  com dados antigos.
  */
  const snapshotAntigo = await get(ref(db, `usuarios/${usuario.uid}/producao`));

  if (!snapshotAntigo.exists()) {
    return [];
  }

  const dadosAntigos = snapshotAntigo.val();

  Object.entries(dadosAntigos).forEach(([dataISO, dia]) => {
    const programas = dia.programas || {};

    Object.entries(programas).forEach(([programa, info]) => {
      const partes = dataISO.split("-");

      if (partes.length !== 3) {
        return;
      }

      const ano = Number(partes[0]);

      const mes = Number(partes[1]);

      const numeroDia = Number(partes[2]);

      historico.push({
        programa: programa,

        quantidade: Number(info.quantidade) || 0,

        data: `${String(numeroDia).padStart(2, "0")}/${String(mes).padStart(
          2,
          "0",
        )}/${ano}`,

        hora: "--",

        timestamp: new Date(ano, mes - 1, numeroDia, 12, 0, 0).getTime(),

        tempo: dia.tempoTotal || "00:00",

        eficiencia: null,

        status: "Concluído",

        origem: "producao-diaria",
      });
    });
  });

  return historico;
};
/* ==========================
SALVAR HISTÓRICO DE PRODUÇÃO
========================== */
window.salvarHistoricoProducaoFirebase = async function (dadosExecucao) {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  const operadorNome =
    sessionStorage.getItem("nomeUsuario") ||
    usuario.displayName ||
    usuario.email ||
    "Operador";

  const dadosHistorico = {
    ...dadosExecucao,

    empresaId: empresaId,

    operadorUid: usuario.uid,

    operadorNome: operadorNome,

    operadorEmail: usuario.email,

    uidUsuario: usuario.uid,

    emailUsuario: usuario.email,

    timestamp: Date.now(),
  };

  /*
  Caminho antigo.
  Mantido temporariamente.
  */
  const historicoAntigoRef = ref(
    db,
    `usuarios/${usuario.uid}/historicoProducao`,
  );

  if (dadosExecucao.producaoId) validarChavePrograma(dadosExecucao.producaoId);
  const registroAntigo = dadosExecucao.producaoId
    ? ref(db, `usuarios/${usuario.uid}/historicoProducao/${dadosExecucao.producaoId}`)
    : push(historicoAntigoRef);

  await set(registroAntigo, dadosHistorico);

  /*
  Novo histórico da empresa.
  Cada registro informa qual
  operador realizou a produção.
  */
  const historicoEmpresaRef = ref(
    db,
    `empresas/${empresaId}/historicoProducao`,
  );

  const registroEmpresa = dadosExecucao.producaoId
    ? ref(db, `empresas/${empresaId}/historicoProducao/${dadosExecucao.producaoId}`)
    : push(historicoEmpresaRef);

  await set(registroEmpresa, dadosHistorico);
};

/* ==========================
BUSCAR HISTÓRICO DE PRODUÇÃO
========================== */

window.buscarHistoricoProducaoFirebase = async function () {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  /*
  Primeiro tenta buscar
  o histórico da empresa.
  */
  const snapshotEmpresa = await get(
    ref(db, `empresas/${empresaId}/historicoProducao`),
  );

  if (snapshotEmpresa.exists()) {
    const dadosEmpresa = Object.values(snapshotEmpresa.val());

    const tipoUsuario = sessionStorage.getItem("tipoUsuario");

    // ADMIN vê toda a empresa
    if (tipoUsuario === "admin") {
      return dadosEmpresa.sort(
        (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
      );
    }

    // OPERADOR vê somente os próprios dados
    return dadosEmpresa
      .filter(
        (registro) =>
          registro.operadorUid === usuario.uid ||
          registro.uidUsuario === usuario.uid,
      )
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  /*
  Compatibilidade temporária
  com histórico antigo.
  */
  const snapshotAntigo = await get(
    ref(db, `usuarios/${usuario.uid}/historicoProducao`),
  );

  if (!snapshotAntigo.exists()) {
    return [];
  }

  const dadosAntigos = snapshotAntigo.val();

  return Object.values(dadosAntigos).sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
  );
};

/* ==========================
PRODUÇÃO ATUAL
========================== */

window.salvarProducaoAtualFirebase = async function (dados) {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(usuario);

  const operadorNome =
    sessionStorage.getItem("nomeUsuario") ||
    usuario.displayName ||
    usuario.email ||
    "Operador";

  const dadosProducao = {
    ...dados,

    empresaId: empresaId,

    operadorUid: usuario.uid,

    operadorNome: operadorNome,

    operadorEmail: usuario.email,

    uidUsuario: usuario.uid,

    emailUsuario: usuario.email,

    ultimaAtualizacao: Date.now(),
  };

  /*
  Caminho antigo.
  Mantemos temporariamente para
  não quebrar as telas existentes.
  */
  await update(ref(db), {
    [`usuarios/${usuario.uid}/producaoAtual`]: dadosProducao,
    [`empresas/${empresaId}/producaoAtual/${usuario.uid}`]: dadosProducao,
  });

  /*
  Nova estrutura multiempresa.
  */

};

/* ==========================
BUSCAR PRODUÇÃO ATUAL
========================== */

window.buscarProducaoAtualFirebase = async function () {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(usuario);

  /*
  Primeiro tenta buscar na
  nova estrutura multiempresa.
  */
  const snapshotEmpresa = await get(
    ref(db, `empresas/${empresaId}/producaoAtual/${usuario.uid}`),
  );

  if (snapshotEmpresa.exists()) {
    return snapshotEmpresa.val();
  }

  /*
  Compatibilidade temporária
  com produções antigas.
  */
  const snapshotAntigo = await get(
    ref(db, `usuarios/${usuario.uid}/producaoAtual`),
  );

  if (snapshotAntigo.exists()) {
    return snapshotAntigo.val();
  }

  return null;
};

async function validarOperadorParaConsultaAdmin(operadorUid) {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(usuario);
  const tipoUsuario = sessionStorage.getItem("tipoUsuario");
  const uid = String(operadorUid || "").trim();

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  if (tipoUsuario !== "admin") {
    throw new Error("Apenas administradores podem consultar a produção de operadores.");
  }

  if (!uid) {
    throw new Error("UID do operador não informado.");
  }

  const snapshotOperador = await get(ref(db, `usuarios/${uid}`));

  if (!snapshotOperador.exists()) {
    throw new Error("Operador não encontrado.");
  }

  const operador = snapshotOperador.val();

  if (operador.tipoUsuario !== "operador" && uid !== usuario.uid) {
    throw new Error("O usuário selecionado não é um operador.");
  }

  if (operador.empresaId !== empresaId) {
    throw new Error("O operador selecionado não pertence à empresa do administrador.");
  }

  return { empresaId, operadorUid: uid };
}

window.buscarProducaoAtualOperadorFirebase = async function (operadorUid) {
  const consulta = await validarOperadorParaConsultaAdmin(operadorUid);
  const snapshot = await get(
    ref(
      db,
      `empresas/${consulta.empresaId}/producaoAtual/${consulta.operadorUid}`,
    ),
  );

  return snapshot.exists() ? snapshot.val() : null;
};

window.observarProducaoAtualOperadorFirebase = async function (
  operadorUid,
  callback,
) {
  if (typeof callback !== "function") {
    throw new Error("Callback de observação não informado.");
  }

  const consulta = await validarOperadorParaConsultaAdmin(operadorUid);
  const producaoRef = ref(
    db,
    `empresas/${consulta.empresaId}/producaoAtual/${consulta.operadorUid}`,
  );

  return onValue(
    producaoRef,
    (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
    (erro) => callback(null, erro),
  );
};

/* ==========================
REMOVER PRODUÇÃO ATUAL
========================== */

window.removerProducaoAtualFirebase = async function () {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  // Nova estrutura multiempresa
  await remove(ref(db, `empresas/${empresaId}/producaoAtual/${usuario.uid}`));

  // Caminho antigo mantido temporariamente
  await remove(ref(db, `usuarios/${usuario.uid}/producaoAtual`));
};

window.cancelarProducaoAtualFirebase = async function () {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(auth.currentUser);

  if (!empresaId) {
    throw new Error("empresaId não encontrado na sessão.");
  }

  /*
Primeiro busca pela nova
estrutura multiempresa.
*/
  let snapshot = await get(
    ref(db, `empresas/${empresaId}/producaoAtual/${usuario.uid}`),
  );

  /*
Compatibilidade temporária
com produção antiga.
*/
  if (!snapshot.exists()) {
    snapshot = await get(ref(db, `usuarios/${usuario.uid}/producaoAtual`));
  }

  if (!snapshot.exists()) {
    throw new Error("Nenhuma produção pendente encontrada.");
  }

  const producao = snapshot.val();

  if (
    producao.status !== "PAUSADO" &&
    producao.status !== "AGUARDANDO_PECA" &&
    producao.status !== "AGUARDANDO_INICIO"
  ) {
    throw new Error("A produção precisa estar parada para ser cancelada.");
  }

  if (producao.pausaIdAtual) {
    if (typeof window.finalizarPausaFirebase !== "function") {
      throw new Error("Função finalizarPausaFirebase não disponível.");
    }

    try {
      await window.finalizarPausaFirebase(producao.pausaIdAtual);

      console.log("Pausa encerrada devido ao cancelamento da produção.");
    } catch (erro) {
      console.error("Erro ao encerrar pausa durante cancelamento:", erro);

      throw erro;
    }
  }

  const agora = new Date();

  const fila = Array.isArray(producao.fila) ? producao.fila : [];

  const indiceAtual = Number(producao.indiceFila) || 0;

  /*
  =============================
  PROGRAMAS ANTERIORES DA FILA
  =============================

  Se A terminou e o usuário
  cancelou durante B, A não pode
  desaparecer do histórico.
  */

  for (let i = 0; i < indiceAtual; i++) {
    const item = fila[i];

    if (!item) {
      continue;
    }

    await window.salvarHistoricoProducaoFirebase({
      data: agora.toLocaleDateString("pt-BR"),

      hora: agora.toLocaleTimeString("pt-BR"),

      programa: item.nome || item.programa,

      chavePrograma: item.programa,

      quantidade: Number(item.quantidade) || 0,

      quantidadePlanejada: Number(item.quantidade) || 0,

      quantidadeConcluida: Number(item.quantidade) || 0,

      percentual: 100,

      status: "Concluído",

      origem: "cancelamento-fila",
    });
  }

  /*
  =============================
  PROGRAMA ATUAL
  =============================
  */

  const quantidadeTotal = Number(producao.quantidadeTotal) || 0;

  const quantidadeConcluida = Number(producao.quantidadeConcluida) || 0;

  const percentual =
    quantidadeTotal > 0
      ? Math.round((quantidadeConcluida / quantidadeTotal) * 100)
      : 0;

  await window.salvarHistoricoProducaoFirebase({
    data: agora.toLocaleDateString("pt-BR"),

    hora: agora.toLocaleTimeString("pt-BR"),

    programa: producao.programa || "Programa",

    chavePrograma: producao.programa || "Programa",

    quantidade: quantidadeConcluida,

    quantidadePlanejada: quantidadeTotal,

    quantidadeConcluida: quantidadeConcluida,

    percentual: percentual,

    status: "Cancelado",

    indiceFila: indiceAtual,

    pontoAtual: Number(producao.pontoAtual) || 0,

    origem: "cancelamento",
  });

  /*
  Só remove depois do histórico
  ter sido salvo.
  */

  /*
Remove da nova estrutura
multiempresa.
*/
  await remove(ref(db, `empresas/${empresaId}/producaoAtual/${usuario.uid}`));

  /*
Remove também o caminho antigo
enquanto ele ainda existe.
*/
  await remove(ref(db, `usuarios/${usuario.uid}/producaoAtual`));

  return {
    programa: producao.programa,

    quantidadeTotal,

    quantidadeConcluida,

    percentual,
  };
};
/* ==========================
OBSERVAR PRODUÇÃO ATUAL
EM TEMPO REAL
========================== */
window.observarProducaoAtualFirebase = async function (callback) {
  const usuario = await esperarUsuarioLogado();

  const empresaId = await obterEmpresaId(usuario);

  /*
  Observa a nova estrutura
  multiempresa.
  */
  const producaoEmpresaRef = ref(
    db,
    `empresas/${empresaId}/producaoAtual/${usuario.uid}`,
  );

  const cancelarObservacao = onValue(
    producaoEmpresaRef,

    async (snapshot) => {
      /*
        Se existir na estrutura nova,
        usa normalmente.
        */
      if (snapshot.exists()) {
        callback(snapshot.val());

        return;
      }

      /*
        Se não existir, tenta o
        caminho antigo para manter
        compatibilidade com produções
        salvas antes da migração.
        */
      const snapshotAntigo = await get(
        ref(db, `usuarios/${usuario.uid}/producaoAtual`),
      );

      if (snapshotAntigo.exists()) {
        callback(snapshotAntigo.val());
      } else {
        callback(null);
      }
    },
  );

  return cancelarObservacao;
};

// Token curto do operador para o emissor HTTPS de credenciais MQTT.
window.obterTokenOperadorMQTT = async function () {
  const usuario = await esperarUsuarioLogado();
  await obterEmpresaId(usuario);
  return usuario.getIdToken();
};
onAuthStateChanged(auth, () => window.encerrarSessaoMQTT?.());
