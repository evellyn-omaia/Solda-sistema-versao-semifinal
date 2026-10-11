/*
=====================================
MQTT - SOLDATECH
=====================================
*/


/*
Broker MQTT local (ver pasta mqtt-broker/
na raiz do projeto). Roda no mesmo PC do
Node-RED, sem depender de nuvem.

Se o app for aberto de OUTRO computador/
tablet na mesma rede (não o PC onde o
broker está rodando), troque "localhost"
pelo IP desse PC na rede local.
*/
const MQTT_BROKER = "ws://localhost:8888";


const MQTT_TOPICO_COMANDO = "soldatech/maquina/comando";

const MQTT_TOPICO_STATUS = "soldatech/maquina/status";

const MQTT_TOPICO_RESPOSTA = "soldatech/maquina/resposta";

const MQTT_TOPICO_ERRO = "soldatech/maquina/erro";

const MQTT_TOPICO_VISAO = "soldatech/visao/gesto";

let mqttCliente = null;
let mqttConectado = false;
const CLP_TIMEOUT_MS = 10000;
const MQTT_COMMAND_TIMEOUT_MS = 8000;
const INTERVALO_ATUALIZACAO_STATUS_MS = 1000;
let ultimoContatoClp = null;
let ultimaMensagemClp = null;
let ultimoEstadoDeclaradoClp = null;
let ultimoEstadoVisualClp = null;

const comandosPendentes = new Map();
const eventosMaquina = new EventTarget();
const TIPOS_EVENTO_SUPORTADOS = new Set([
  "STATUS",
  "COMANDO_OK",
  "COMANDO_ERRO",
  "MESA_READY",
  "PONTO_RECEBIDO",
  "PONTO_ATINGIDO",
  "ESTADO_MAQUINA",
  "ERRO",
]);

function emitirEventoMaquina(nome, detalhe) {
  const eventoInterno = new CustomEvent(nome, { detail: detalhe });
  eventosMaquina.dispatchEvent(eventoInterno);

  window.dispatchEvent(
    new CustomEvent(`soldatouch:${nome}`, { detail: detalhe }),
  );
}

function gerarIdComando() {
  if (typeof window.crypto?.randomUUID === "function") {
    return `cmd-${window.crypto.randomUUID()}`;
  }

  const parteAleatoria = Math.random().toString(36).slice(2, 12);
  return `cmd-${Date.now().toString(36)}-${parteAleatoria}`;
}

function atualizarElementoStatus(elemento, texto, modificador, mostrarPonto) {
  if (!elemento) {
    return;
  }

  elemento.className = `conexao-status conexao-status--${modificador}`;
  elemento.replaceChildren();

  if (mostrarPonto) {
    const ponto = document.createElement("i");
    ponto.setAttribute("aria-hidden", "true");
    elemento.appendChild(ponto);
  }

  elemento.appendChild(document.createTextNode(texto));
}

function formatarTempoDesdeContato(timestamp) {
  const segundos = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (segundos < 2) {
    return "agora";
  }

  if (segundos < 60) {
    return `há ${segundos} s`;
  }

  return `há ${Math.floor(segundos / 60)} min`;
}

function obterEstadoClp() {
  if (!mqttConectado) {
    return {
      texto: "INDISPONÍVEL",
      modificador: "indisponivel",
      mostrarPonto: false,
    };
  }

  if (ultimoContatoClp === null) {
    return {
      texto: "AGUARDANDO RESPOSTA",
      modificador: "aguardando",
      mostrarPonto: false,
    };
  }

  if (Date.now() - ultimoContatoClp <= CLP_TIMEOUT_MS) {
    return {
      texto: "CONECTADO",
      modificador: "conectado",
      mostrarPonto: true,
    };
  }

  return {
    texto: "SEM RESPOSTA",
    modificador: "sem-resposta",
    mostrarPonto: true,
  };
}

function atualizarStatusMaquinaReal(estadoClp) {
  const statusMaquina = document.getElementById("statusMaquinaReal");

  if (!statusMaquina) {
    return;
  }

  const estadoDeclarado = ultimoEstadoDeclaradoClp;
  const possuiConfirmacao =
    estadoClp.modificador === "conectado" && Boolean(estadoDeclarado);

  statusMaquina.textContent = possuiConfirmacao
    ? estadoDeclarado
    : "SEM CONFIRMAÇÃO";
  statusMaquina.className = possuiConfirmacao
    ? "status-maquina-confirmada"
    : "status-maquina-sem-confirmacao";
}

function atualizarStatusConexao() {
  const statusMqtt = document.getElementById("statusMqtt");
  const statusClp = document.getElementById("statusClp");
  const ultimoContato = document.getElementById("ultimoContatoClp");
  const estadoClp = obterEstadoClp();

  atualizarElementoStatus(
    statusMqtt,
    mqttConectado ? "ONLINE" : "OFFLINE",
    mqttConectado ? "online" : "offline",
    true,
  );

  atualizarElementoStatus(
    statusClp,
    estadoClp.texto,
    estadoClp.modificador,
    estadoClp.mostrarPonto,
  );

  atualizarStatusMaquinaReal(estadoClp);

  if (ultimoContato) {
    ultimoContato.textContent =
      ultimoContatoClp === null
        ? "Última resposta: --"
        : `Última resposta: ${formatarTempoDesdeContato(ultimoContatoClp)}`;
  }

  const chaveEstado = `${mqttConectado}:${estadoClp.modificador}`;

  if (chaveEstado !== ultimoEstadoVisualClp) {
    ultimoEstadoVisualClp = chaveEstado;
    emitirEventoMaquina("clp-status", {
      mqttConectado,
      clp: estadoClp.texto,
      ultimoContatoClp,
    });
  }
}

function extrairEstadoDeclaradoClp(mensagem) {
  try {
    const dados =
      typeof mensagem === "string" ? JSON.parse(mensagem) : mensagem;
    const estado =
      dados?.estado ?? dados?.clp ?? dados?.status ?? dados?.dados?.estado;

    return typeof estado === "string" ? estado.toUpperCase() : null;
  } catch {
    return null;
  }
}

function registrarContatoClp(topico, mensagemProcessada) {
  const topicoConfirmaContato =
    topico === MQTT_TOPICO_STATUS || topico === MQTT_TOPICO_RESPOSTA;

  if (!topicoConfirmaContato || !mensagemProcessada?.valido) {
    return;
  }

  ultimoContatoClp = Date.now();
  const estadoDeclarado = extrairEstadoDeclaradoClp(mensagemProcessada.dados);

  if (estadoDeclarado) {
    ultimoEstadoDeclaradoClp = estadoDeclarado;
  }

  ultimaMensagemClp = {
    topico,
    recebidoEm: ultimoContatoClp,
    estadoDeclarado,
  };

  atualizarStatusConexao();
}

function converterPayloadParaTexto(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  try {
    return payload?.toString?.() ?? "";
  } catch {
    return "";
  }
}

function parsearMensagemMqtt(payload) {
  const texto = converterPayloadParaTexto(payload).trim();

  if (!texto) {
    return {
      valido: false,
      formato: "vazio",
      texto: "",
      dados: null,
      erro: "Payload vazio",
    };
  }

  try {
    const dados = JSON.parse(texto);
    const objetoValido =
      dados !== null && typeof dados === "object" && !Array.isArray(dados);

    return {
      valido: objetoValido,
      formato: "json",
      texto,
      dados: objetoValido ? dados : null,
      erro: objetoValido ? null : "O JSON precisa ser um objeto",
    };
  } catch (erro) {
    return {
      valido: true,
      formato: "texto",
      texto,
      dados: {
        mensagem: texto,
        legado: true,
      },
      erroParse: erro.message,
    };
  }
}

function normalizarTipoMensagem(dados, categoria) {
  const tipoRecebido = dados?.tipo ?? dados?.evento;

  if (typeof tipoRecebido === "string" && tipoRecebido.trim()) {
    return tipoRecebido.trim().toUpperCase();
  }

  if (categoria === "STATUS") {
    return "STATUS";
  }

  if (categoria === "ERRO") {
    return "ERRO";
  }

  return null;
}

function obterCategoriaTopico(topico) {
  if (topico === MQTT_TOPICO_STATUS) {
    return "STATUS";
  }

  if (topico === MQTT_TOPICO_RESPOSTA) {
    return "RESPOSTA";
  }

  if (topico === MQTT_TOPICO_ERRO) {
    return "ERRO";
  }

  return null;
}

function validarCamposMinimos(categoria, mensagemProcessada) {
  if (mensagemProcessada.formato === "texto") {
    return null;
  }

  const dados = mensagemProcessada.dados;

  if (categoria === "STATUS") {
    return Object.keys(dados).length > 0
      ? null
      : "Mensagem de status sem campos";
  }

  if (categoria === "RESPOSTA") {
    return typeof (dados.tipo ?? dados.evento) === "string"
      ? null
      : "Resposta sem campo tipo/evento";
  }

  if (categoria === "ERRO") {
    return dados.tipo || dados.mensagem || dados.codigo
      ? null
      : "Mensagem de erro sem tipo, mensagem ou código";
  }

  return null;
}

function criarErroComando(mensagem, dados = {}) {
  const erro = new Error(mensagem);
  erro.codigo = dados.codigo ?? dados.tipo ?? "ERRO_MQTT";
  erro.idComando = dados.idComando ?? null;
  erro.dados = dados;
  return erro;
}

function finalizarComandoPendente(idComando, acao, valor) {
  if (!idComando || !comandosPendentes.has(idComando)) {
    return false;
  }

  const pendente = comandosPendentes.get(idComando);
  window.clearTimeout(pendente.timeout);
  comandosPendentes.delete(idComando);
  pendente[acao](valor);

  emitirEventoMaquina(
    acao === "resolve" ? "comando-resolvido" : "comando-rejeitado",
    {
      idComando,
      comando: pendente.comando,
      resposta: acao === "resolve" ? valor : null,
      erro: acao === "reject" ? valor : null,
    },
  );

  return true;
}

function processarResposta(dados, tipo) {
  const idComando =
    typeof dados?.idComando === "string" ? dados.idComando : null;

  if (!idComando) {
    return;
  }

  const pendente = comandosPendentes.get(idComando);

  if (!pendente) {
    console.warn("Resposta MQTT para idComando não pendente.", {
      idComando,
      tipo,
    });
    return;
  }

  if (tipo === "COMANDO_ERRO" || tipo === "ERRO") {
    finalizarComandoPendente(
      idComando,
      "reject",
      criarErroComando(
        dados.mensagem || "Comando rejeitado pela máquina.",
        dados,
      ),
    );
    return;
  }

  if (pendente.tiposSucesso.has(tipo)) {
    finalizarComandoPendente(idComando, "resolve", dados);
  }
}

function processarErroMaquina(dados) {
  console.error("Erro informado pela máquina via MQTT:", dados);

  if (typeof dados?.idComando === "string") {
    finalizarComandoPendente(
      dados.idComando,
      "reject",
      criarErroComando(dados.mensagem || "Erro retornado pela máquina.", dados),
    );
  }
}

function processarMensagemMaquina(topico, payload) {
  const categoria = obterCategoriaTopico(topico);

  if (!categoria) {
    console.warn("Mensagem recebida em tópico MQTT não reconhecido.", {
      topico,
    });
    return { processado: false, motivo: "topico-desconhecido" };
  }

  const mensagemProcessada = parsearMensagemMqtt(payload);

  if (!mensagemProcessada.valido) {
    console.warn("Payload MQTT inválido ignorado.", {
      topico,
      erro: mensagemProcessada.erro,
    });
    return { processado: false, motivo: "payload-invalido" };
  }

  const erroValidacao = validarCamposMinimos(categoria, mensagemProcessada);

  if (erroValidacao) {
    console.warn("Payload MQTT sem os campos mínimos esperados.", {
      topico,
      erro: erroValidacao,
    });
    return { processado: false, motivo: "campos-minimos-ausentes" };
  }

  if (mensagemProcessada.formato === "texto") {
    console.warn("Payload MQTT legado (não JSON) recebido.", {
      topico,
      mensagem: mensagemProcessada.texto,
    });
  }

  const dados = mensagemProcessada.dados;
  const tipo = normalizarTipoMensagem(dados, categoria);

  registrarContatoClp(topico, mensagemProcessada);

  if (categoria === "RESPOSTA") {
    processarResposta(dados, tipo);
  } else if (categoria === "ERRO") {
    processarErroMaquina(dados);
  }

  if (tipo && !TIPOS_EVENTO_SUPORTADOS.has(tipo)) {
    console.info(
      "Tipo de evento MQTT ainda não possui tratamento específico.",
      {
        tipo,
        topico,
      },
    );
  }

  const detalheEvento = {
    topico,
    categoria,
    tipo,
    dados,
    formato: mensagemProcessada.formato,
    recebidoEm: Date.now(),
  };

  emitirEventoMaquina("maquina-evento", detalheEvento);

  if (tipo) {
    eventosMaquina.dispatchEvent(
      new CustomEvent("tipo-evento", { detail: detalheEvento }),
    );
  }

  return { processado: true, ...detalheEvento };
}

function rejeitarComandosPendentes(mensagem, codigo) {
  for (const [idComando] of comandosPendentes) {
    finalizarComandoPendente(
      idComando,
      "reject",
      criarErroComando(mensagem, { idComando, codigo }),
    );
  }
}

function marcarMqttDesconectado() {
  const estavaConectado = mqttConectado;
  mqttConectado = false;
  ultimoContatoClp = null;
  ultimaMensagemClp = null;
  ultimoEstadoDeclaradoClp = null;
  atualizarStatusConexao();

  if (estavaConectado) {
    rejeitarComandosPendentes(
      "MQTT desconectou antes da confirmação do comando.",
      "MQTT_DESCONECTADO",
    );
    emitirEventoMaquina("mqtt-status", { mqttConectado: false });
  }
}

/*
=====================================
CONECTAR AO BROKER
=====================================
*/

function conectarMQTT() {
  if (mqttCliente) {
    return mqttCliente;
  }

  if (typeof window.mqtt?.connect !== "function") {
    console.error("Biblioteca MQTT não disponível.");
    atualizarStatusConexao();
    return null;
  }

  const clientId =
    "soldatech-web-" + Math.random().toString(16).substring(2, 10);

  console.log("Conectando ao MQTT...", {
    broker: MQTT_BROKER,

    clientId: clientId,
  });

  mqttCliente = window.mqtt.connect(MQTT_BROKER, {
    clientId: clientId,

    username: "SoldaTouch",

    password: "MQtesteVisao",


      // Broker local (mqtt-broker/) não exige autenticação.
      clean:
        true,

      reconnectPeriod:
        3000,

      connectTimeout:
        10000
    }
  );


  /*
  =============================
  CONECTADO
  =============================
  */

  mqttCliente.on("connect", () => {
    mqttConectado = true;

    atualizarStatusConexao();

    emitirEventoMaquina("mqtt-status", { mqttConectado: true });

    console.log("✅ MQTT conectado ao broker!");

    /*
      Escuta respostas/status.
      */

    mqttCliente.subscribe(
      [
        MQTT_TOPICO_STATUS,
        MQTT_TOPICO_RESPOSTA,
        MQTT_TOPICO_ERRO,
        MQTT_TOPICO_VISAO,
      ],
      {
        qos: 0,
      },
      (erro) => {
        if (erro) {
          console.error("Erro ao assinar tópicos MQTT:", erro);

          return;
        }

        console.log("✅ Inscrito nos tópicos da máquina.");
      },
    );
  });

  /*
  =============================
  RECEBER MENSAGEM
  =============================
  */

  mqttCliente.on("message", (topico, mensagem) => {
    if (topico === MQTT_TOPICO_VISAO) {
      try {
        const dados = JSON.parse(mensagem.toString());

        const gesto = dados?.gesto;

        if (gesto !== "START" && gesto !== "PAUSA") {
          console.warn("⚠️ Gesto de visão inválido:", dados);
          return;
        }

        console.log("👋 [VISÃO] gesto recebido:", gesto);

        window.dispatchEvent(
          new CustomEvent("soldatech:gesto-visao", {
            detail: {
              gesto: gesto,
            },
          }),
        );
      } catch (erro) {
        console.error("❌ Erro ao processar mensagem da visão:", erro);
      }

      return;
    }

    const resultado = processarMensagemMaquina(topico, mensagem);

    console.log("📥 MQTT recebido:", {
      topico: topico,

      mensagem: resultado,
    });
  });

  /*
  =============================
  DESCONECTADO
  =============================
  */

  mqttCliente.on("close", () => {
    marcarMqttDesconectado();

    console.warn("MQTT desconectado.");
  });

  /*
  =============================
  ERRO
  =============================
  */

  mqttCliente.on("error", (erro) => {
    console.error("Erro MQTT:", erro);
  });

  return mqttCliente;
}

/*
=====================================
PUBLICAR COMANDO
=====================================
*/

function criarEnvelopeComando(
  comando,
  dados = {},
  idComando = gerarIdComando(),
) {
  return {
    idComando,
    comando,
    dados,
    origem: "SoldaTouch",
    timestamp: Date.now(),
  };
}

function publicarEnvelopeComando(mensagem, aoConcluir) {
  if (!mqttCliente || !mqttConectado) {
    console.warn("MQTT ainda não está conectado.");
    return false;
  }

  try {
    mqttCliente.publish(
      MQTT_TOPICO_COMANDO,
      JSON.stringify(mensagem),
      {
        qos: 0,
        retain: false,
      },
      (erro) => {
        if (erro) {
          console.error("Erro ao publicar comando MQTT:", erro);
        }

        aoConcluir?.(erro ?? null);
      },
    );
  } catch (erro) {
    console.error("Erro ao serializar/publicar comando MQTT:", erro);
    aoConcluir?.(erro);
    return false;
  }

  console.log("📤 MQTT enviado:", {
    topico: MQTT_TOPICO_COMANDO,
    payload: mensagem,
  });

  return true;
}

function publicarMQTT(comando, dados = {}) {
  return publicarEnvelopeComando(criarEnvelopeComando(comando, dados));
}

function enviarComandoComConfirmacao(comando, dados = {}, opcoes = {}) {
  if (!mqttCliente || !mqttConectado) {
    return Promise.reject(
      criarErroComando("MQTT ainda não está conectado.", {
        codigo: "MQTT_OFFLINE",
      }),
    );
  }

  const idComando = gerarIdComando();
  const mensagem = criarEnvelopeComando(comando, dados, idComando);
  const timeoutMs =
    Number.isFinite(opcoes.timeoutMs) && opcoes.timeoutMs > 0
      ? opcoes.timeoutMs
      : MQTT_COMMAND_TIMEOUT_MS;
  const tiposSucesso = new Set(
    Array.isArray(opcoes.tiposSucesso) && opcoes.tiposSucesso.length
      ? opcoes.tiposSucesso.map((tipo) => String(tipo).toUpperCase())
      : ["COMANDO_OK"],
  );

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      finalizarComandoPendente(
        idComando,
        "reject",
        criarErroComando(`Tempo esgotado para o comando ${comando}.`, {
          idComando,
          comando,
          codigo: "MQTT_COMMAND_TIMEOUT",
        }),
      );
    }, timeoutMs);

    comandosPendentes.set(idComando, {
      resolve,
      reject,
      timeout,
      comando,
      horarioEnvio: Date.now(),
      tiposSucesso,
    });

    const publicado = publicarEnvelopeComando(mensagem, (erro) => {
      if (erro) {
        finalizarComandoPendente(
          idComando,
          "reject",
          criarErroComando("Falha ao publicar comando MQTT.", {
            idComando,
            comando,
            codigo: "MQTT_PUBLICACAO_ERRO",
          }),
        );
      }
    });

    if (!publicado) {
      finalizarComandoPendente(
        idComando,
        "reject",
        criarErroComando("Não foi possível publicar o comando MQTT.", {
          idComando,
          comando,
          codigo: "MQTT_PUBLICACAO_ERRO",
        }),
      );
    }
  });
}

function aguardarEventoMaquina(tipoEsperado, opcoes = {}) {
  const tipoNormalizado = String(tipoEsperado || "").toUpperCase();
  const timeoutMs =
    Number.isFinite(opcoes.timeoutMs) && opcoes.timeoutMs > 0
      ? opcoes.timeoutMs
      : MQTT_COMMAND_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      eventosMaquina.removeEventListener("tipo-evento", aoReceberEvento);
      reject(
        criarErroComando(`Tempo esgotado aguardando ${tipoNormalizado}.`, {
          idComando: opcoes.idComando ?? null,
          codigo: "MQTT_EVENT_TIMEOUT",
        }),
      );
    }, timeoutMs);

    function aoReceberEvento(evento) {
      const detalhe = evento.detail;
      const idConfere =
        !opcoes.idComando || detalhe.dados?.idComando === opcoes.idComando;

      if (detalhe.tipo !== tipoNormalizado || !idConfere) {
        return;
      }

      window.clearTimeout(timeout);
      eventosMaquina.removeEventListener("tipo-evento", aoReceberEvento);
      resolve(detalhe.dados);
    }

    eventosMaquina.addEventListener("tipo-evento", aoReceberEvento);
  });
}

/*
=====================================
FUNÇÃO USADA PELA MÁQUINA
=====================================
*/

window.enviarComandoMaquina = async function (comando, dados = {}) {
  return publicarMQTT(comando, dados);
};

window.enviarComandoComConfirmacao = enviarComandoComConfirmacao;
window.aguardarEventoMaquina = aguardarEventoMaquina;

const adaptadoresIntegracaoFutura = {
  movimentoManual: null,
  soldagem: null,
};

window.SoldaTouchIntegracaoFisica = Object.freeze({
  registrarMovimentoManual(adaptador) {
    if (
      !adaptador ||
      typeof adaptador.iniciar !== "function" ||
      typeof adaptador.parar !== "function"
    ) {
      throw new TypeError(
        "O adaptador de movimento manual deve fornecer iniciar(direcao) e parar().",
      );
    }

    adaptadoresIntegracaoFutura.movimentoManual = adaptador;
    return () => {
      if (adaptadoresIntegracaoFutura.movimentoManual === adaptador) {
        adaptadoresIntegracaoFutura.movimentoManual = null;
      }
    };
  },

  registrarSoldagem(adaptador) {
    if (!adaptador || typeof adaptador.definirAtiva !== "function") {
      throw new TypeError(
        "O adaptador de soldagem deve fornecer definirAtiva(ativa, contexto).",
      );
    }

    adaptadoresIntegracaoFutura.soldagem = adaptador;
    return () => {
      if (adaptadoresIntegracaoFutura.soldagem === adaptador) {
        adaptadoresIntegracaoFutura.soldagem = null;
      }
    };
  },

  iniciarMovimentoManual(direcao) {
    const direcaoNormalizada = String(direcao || "").toUpperCase();

    if (!["CIMA", "BAIXO"].includes(direcaoNormalizada)) {
      throw new TypeError("A direção deve ser CIMA ou BAIXO.");
    }

    if (!adaptadoresIntegracaoFutura.movimentoManual) {
      return false;
    }

    return adaptadoresIntegracaoFutura.movimentoManual.iniciar(
      direcaoNormalizada,
    );
  },

  pararMovimentoManual() {
    if (!adaptadoresIntegracaoFutura.movimentoManual) {
      return false;
    }

    return adaptadoresIntegracaoFutura.movimentoManual.parar();
  },

  definirSoldagemAtiva(ativa, contexto = {}) {
    if (!adaptadoresIntegracaoFutura.soldagem) {
      return false;
    }

    return adaptadoresIntegracaoFutura.soldagem.definirAtiva(
      Boolean(ativa),
      contexto,
    );
  },

  obterCapacidades() {
    return {
      movimentoManual: Boolean(adaptadoresIntegracaoFutura.movimentoManual),
      soldagem: Boolean(adaptadoresIntegracaoFutura.soldagem),
    };
  },
});

/*
=====================================
ADAPTADOR FÍSICO PADRÃO (MQTT -> CLP)
=====================================

Liga os pontos de extensão acima ao
transporte MQTT deste arquivo. Assim
o resto do sistema (novoprograma.js)
só precisa chamar
window.SoldaTouchIntegracaoFisica,
sem saber que o transporte é MQTT.

Comandos usados aqui (JOG_CIMA,
JOG_BAIXO, JOG_PARAR, SOLDA_ON,
SOLDA_OFF) devem ser tratados pelo
flow do Node-RED que fica entre o
broker MQTT e o CLP real.
*/

window.SoldaTouchIntegracaoFisica.registrarMovimentoManual({
  iniciar(direcao) {
    const comando = direcao === "CIMA" ? "JOG_CIMA" : "JOG_BAIXO";
    return publicarMQTT(comando, {});
  },

  parar() {
    return publicarMQTT("JOG_PARAR", {});
  },
});

window.SoldaTouchIntegracaoFisica.registrarSoldagem({
  definirAtiva(ativa, contexto = {}) {
    return publicarMQTT(ativa ? "SOLDA_ON" : "SOLDA_OFF", contexto);
  },
});


/*
=====================================
FUNÇÕES PARA TESTE
=====================================
*/

window.testarMQTT = function () {
  return publicarMQTT("TESTE", {
    mensagem: "Olá do SoldaTech",
  });
};

window.mqttEstaConectado = function () {
  return mqttConectado;
};

window.obterEstadoConexaoMaquina = function () {
  return {
    mqttConectado,
    clp: obterEstadoClp().texto,
    ultimoContatoClp,
    ultimaMensagemClp,
    timeoutClpMs: CLP_TIMEOUT_MS,
    timeoutComandoMs: MQTT_COMMAND_TIMEOUT_MS,
    comandosPendentes: comandosPendentes.size,
  };
};

window.SoldaTouchMQTT = Object.freeze({
  gerarIdComando,
  enviarComandoComConfirmacao,
  aguardarEventoMaquina,
  processarMensagemMaquina,
  parsearMensagemMqtt,
  eventos: eventosMaquina,
  obterEstado: window.obterEstadoConexaoMaquina,
  topicos: Object.freeze({
    comando: MQTT_TOPICO_COMANDO,
    status: MQTT_TOPICO_STATUS,
    resposta: MQTT_TOPICO_RESPOSTA,
    erro: MQTT_TOPICO_ERRO,
  }),
  tiposSuportados: Object.freeze(Array.from(TIPOS_EVENTO_SUPORTADOS)),
  timeoutComandoMs: MQTT_COMMAND_TIMEOUT_MS,
});

/*
=====================================
INICIAR
=====================================
*/

atualizarStatusConexao();
conectarMQTT();

const intervaloStatusConexao = window.setInterval(
  atualizarStatusConexao,
  INTERVALO_ATUALIZACAO_STATUS_MS,
);

window.addEventListener("pagehide", () => {
  window.clearInterval(intervaloStatusConexao);
});
