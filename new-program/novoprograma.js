/* =====================================
CENA 3D COM MODELO REAL DO SOLIDWORKS
===================================== */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);

/* =====================================
CAMERA
===================================== */

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000,
);
camera.position.set(1500, 800, 1500);
camera.lookAt(0, 1.5, 0);

/* =====================================
RENDER
===================================== */

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;

document.body.appendChild(renderer.domElement);

let quadroResizeCena3D = null;
let raioModeloVisivel = 0;

function redimensionarCena3D() {
  quadroResizeCena3D = null;

  const retangulo = renderer.domElement.getBoundingClientRect();
  const largura = Math.max(1, Math.round(retangulo.width || window.innerWidth));
  const altura = Math.max(1, Math.round(retangulo.height || window.innerHeight));

  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
  if (raioModeloVisivel && typeof controls !== 'undefined') {
    const angulo = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    const direcao = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(direcao, raioModeloVisivel / Math.sin(angulo) * 1.12);
    controls.update();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(largura, altura, false);
}

function solicitarResizeCena3D() {
  if (quadroResizeCena3D !== null) {
    window.cancelAnimationFrame(quadroResizeCena3D);
  }

  quadroResizeCena3D = window.requestAnimationFrame(redimensionarCena3D);
}

solicitarResizeCena3D();
new ResizeObserver(solicitarResizeCena3D).observe(renderer.domElement);

/* =====================================
CONTROLES CAMERA
===================================== */

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 80;
controls.target.set(0, 1.5, 0);

/* =====================================
/* =====================================
LUZES
===================================== */

const ambiente = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambiente);

const luzPrincipal = new THREE.DirectionalLight(0xffffff, 0.9);
luzPrincipal.position.set(12, 20, 10);
luzPrincipal.castShadow = true;
scene.add(luzPrincipal);

const luzSuave = new THREE.HemisphereLight(0xffffff, 0x111827, 0.6);
scene.add(luzSuave);

/* =====================================
PISO DE REFERÊNCIA
===================================== */

const piso = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.15,
    roughness: 0.85,
  }),
);

piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
scene.add(piso);

const grid = new THREE.GridHelper(80, 80, 0x334155, 0x1e293b);
grid.position.y = 0.01;
scene.add(grid);

/* =====================================
MODELO REAL EXPORTADO DO SOLIDWORKS
===================================== */

let modeloMaquina = null;
const caminhoModelo = "../assets/models/montagem_victor_final.glb";

const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
);

const loader = new THREE.GLTFLoader();
loader.setDRACOLoader(dracoLoader);

let suporteMovel = null;
let suporteIndutor = null;
let indutor = null;
let bobina = null;
let mesaReal = null;
let finalizacaoEmAndamento = false;
let rotacaoInicialMesaZ = 0;
const materiaisNormaisIndutor = new Map();
let indutorSoldando = false;
let encerrarSoldaNoProximoQuadro = false;

function percorrerMateriais(objeto3D, callback) {
  if (!objeto3D) {
    return;
  }

  objeto3D.traverse((objeto) => {
    if (!objeto.isMesh || !objeto.material) {
      return;
    }

    const materiais = Array.isArray(objeto.material)
      ? objeto.material
      : [objeto.material];

    materiais.forEach((material) => callback(material));
  });
}

function aplicarAparenciaMetalica(objeto3D, cor, metalness, roughness) {
  percorrerMateriais(objeto3D, (material) => {
    material.color?.setHex(cor);
    material.emissive?.setHex(0x000000);
    material.emissiveIntensity = 0;
    material.metalness = metalness;
    material.roughness = roughness;
    material.needsUpdate = true;
  });
}

function configurarAparenciaNormalConjuntoIndutor() {
  aplicarAparenciaMetalica(suporteIndutor, 0x59636f, 0.72, 0.4);
  aplicarAparenciaMetalica(indutor, 0x8b949e, 0.82, 0.3);
  aplicarAparenciaMetalica(bobina, 0x66717c, 0.78, 0.34);

  materiaisNormaisIndutor.clear();

  percorrerMateriais(indutor, (material) => {
    materiaisNormaisIndutor.set(material, {
      color: material.color?.clone(),
      emissive: material.emissive?.clone(),
      emissiveIntensity: material.emissiveIntensity,
      metalness: material.metalness,
      roughness: material.roughness,
    });
  });

  indutorSoldando = false;
}

function aplicarAparenciaSoldaVisual(deveAtivar) {
  if (deveAtivar === indutorSoldando || materiaisNormaisIndutor.size === 0) {
    return false;
  }

  materiaisNormaisIndutor.forEach((aparenciaNormal, material) => {
    if (deveAtivar) {
      material.color?.setHex(0xb87333);
      material.emissive?.setHex(0x7a3218);
      material.emissiveIntensity = 0.28;
      material.metalness = 0.86;
      material.roughness = 0.26;
    } else {
      if (aparenciaNormal.color && material.color) {
        material.color.copy(aparenciaNormal.color);
      }

      if (aparenciaNormal.emissive && material.emissive) {
        material.emissive.copy(aparenciaNormal.emissive);
      }

      material.emissiveIntensity = aparenciaNormal.emissiveIntensity;
      material.metalness = aparenciaNormal.metalness;
      material.roughness = aparenciaNormal.roughness;
    }

    material.needsUpdate = true;
  });

  indutorSoldando = deveAtivar;
  return true;
}

/*
Comanda a solda: aplica o efeito visual
e, se a máquina real estiver conectada,
envia o comando SOLDA_ON/SOLDA_OFF via
window.SoldaTouchIntegracaoFisica (MQTT
-> Node-RED -> CLP).
*/
function definirIndutorSoldando(ativo) {
  const deveAtivar = Boolean(ativo);

  // Soldagem física automática ainda não homologada (P01).
  if (deveAtivar && maquinaRealAtiva()) return;

  if (!aplicarAparenciaSoldaVisual(deveAtivar)) {
    return;
  }

  if (maquinaRealAtiva()) {
    Promise.resolve(
      window.SoldaTouchIntegracaoFisica?.definirSoldagemAtiva(deveAtivar, {
        posicaoZMm: estadoMaquina.posicaoZMm,
      }),
    ).catch((erro) => {
      console.error("Erro ao acionar a solda na máquina real:", erro);
    });
  }
}

const conjuntoMovel = new THREE.Group();
const conjuntoMesa = new THREE.Group();

conjuntoMovel.name = "ConjuntoMovelSolda";
conjuntoMesa.name = "ConjuntoMesaGiratoria";

/*
Gera uma textura de fatias/aro (canvas 2D,
sem precisar de arquivo de imagem) e aplica
na peça da mesa giratória, pra dar pra ver o
giro a olho nu mesmo o disco sendo uma forma
simétrica sem nenhuma marca própria.
*/
function criarTexturaGiroMesa() {
  const tamanho = 512;
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;

  const ctx = canvas.getContext("2d");
  const centro = tamanho / 2;
  const raio = tamanho / 2;
  const fatias = 12;

  ctx.fillStyle = "#8b949e";
  ctx.fillRect(0, 0, tamanho, tamanho);

  for (let i = 0; i < fatias; i++) {
    const anguloInicio = (i / fatias) * Math.PI * 2;
    const anguloFim = ((i + 1) / fatias) * Math.PI * 2;

    ctx.fillStyle = i % 2 === 0 ? "#4b5563" : "#9aa4b0";
    ctx.beginPath();
    ctx.moveTo(centro, centro);
    ctx.arc(centro, centro, raio, anguloInicio, anguloFim);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#ff2d55";
  ctx.beginPath();
  ctx.moveTo(centro, centro);
  ctx.arc(centro, centro, raio, 0, Math.PI * 2 * (1 / fatias));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = tamanho * 0.02;
  ctx.beginPath();
  ctx.arc(centro, centro, raio - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(centro, centro, raio * 0.06, 0, Math.PI * 2);
  ctx.fill();

  const textura = new THREE.CanvasTexture(canvas);
  textura.needsUpdate = true;
  textura.encoding = THREE.sRGBEncoding;
  return textura;
}

function aplicarTexturaGiroMesa(objeto3D) {
  const textura = criarTexturaGiroMesa();

  const materiais = Array.isArray(objeto3D.material)
    ? objeto3D.material
    : [objeto3D.material];

  materiais.forEach((material) => {
    if (!material) {
      return;
    }

    material.map = textura;
    material.color?.setHex(0xffffff);
    material.needsUpdate = true;
  });
}

loader.load(
  caminhoModelo,
  (gltf) => {
    modeloMaquina = gltf.scene;
    console.log("Modelo carregado com sucesso!");

    // 1. Aplica rotação e escala na máquina inteira PRIMEIRO (seu código original)
    modeloMaquina.rotation.x = 0;
    modeloMaquina.rotation.y = Math.PI;
    modeloMaquina.rotation.z = Math.PI / 2 - 0.06;

    modeloMaquina.add(conjuntoMovel);
    modeloMaquina.add(conjuntoMesa);

    /*
    Adiciona o modelo à cena JÁ AQUI, antes de
    qualquer busca/ajuste que possa falhar (nomes
    de peças diferentes entre versões do GLB etc.).
    Assim, mesmo se algo abaixo der erro, o modelo
    continua visível em vez de sumir da tela inteiro.
    */
    scene.add(modeloMaquina);

    try {
    /*
=====================================
LOCALIZAÇÃO SEGURA DAS PEÇAS DO GLB
=====================================
*/

    function normalizarNome3D(nome = "") {
      return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    }

    function encontrarObjetoPorTermos(...termos) {
      const termosNormalizados = termos.map(normalizarNome3D);
      const candidatos = [];

      modeloMaquina.traverse((objeto) => {
        if (!objeto.name) {
          return;
        }

        const nomeNormalizado = normalizarNome3D(objeto.name);

        const corresponde = termosNormalizados.every((termo) =>
          nomeNormalizado.includes(termo),
        );

        if (corresponde) {
          candidatos.push(objeto);
        }
      });

      if (candidatos.length === 0) {
        console.warn(
          `Nenhum objeto encontrado com os termos: ${termos.join(", ")}`,
        );

        return null;
      }

      if (candidatos.length > 1) {
        console.warn(
          `Mais de um objeto encontrado com os termos: ${termos.join(", ")}`,
          candidatos.map((objeto) => ({
            nome: objeto.name,
            tipo: objeto.type,
          })),
        );
      }

      return candidatos[0];
    }

    suporteMovel = encontrarObjetoPorTermos("ap", "4001");

    suporteIndutor = encontrarObjetoPorTermos("suporte", "indutor");

    indutor =
      modeloMaquina.getObjectByName("Indutor-1") ||
      encontrarObjetoPorTermos("indutor");

    bobina =
      modeloMaquina.getObjectByName("Bobina-1") ||
      encontrarObjetoPorTermos("bobina");

    mesaReal = null;

    /*
    "Mesa Giratória" (modelo antigo) virou o
    disco "Base Motor Gira-1" no modelo novo
    (o disco entre a base grande estacionária
    "Acrilico-1" e o cilindro pequeno "Cone-1"
    por cima). Mantemos "mesagiratoria" como
    termo alternativo para compatibilidade com
    versões antigas do modelo.
    */
    modeloMaquina.traverse((objeto) => {
      if (mesaReal || !objeto.isMesh || !objeto.name) {
        return;
      }

      const nomeNormalizado = normalizarNome3D(objeto.name);

      if (
        nomeNormalizado.includes("mesagiratoria") ||
        nomeNormalizado.startsWith("basemotorgira")
      ) {
        mesaReal = objeto;
      }
    });

    if (mesaReal) {
      rotacaoInicialMesaZ = mesaReal.rotation.z;
      console.log("Mesa giratória correta encontrada:", {
        nome: mesaReal.name,
        tipo: mesaReal.type,
        pai: mesaReal.parent?.name || "sem pai",
        posicaoLocal: {
          x: mesaReal.position.x,
          y: mesaReal.position.y,
          z: mesaReal.position.z,
        },
      });

      /*
      Textura em fatias/aro (via canvas) na
      peça, pra ajudar a ver o giro no disco
      simétrico da mesa.
      */
      aplicarTexturaGiroMesa(mesaReal);
    } else {
      console.error("A malha da mesa giratória não foi encontrada.");
    }
    console.group("Peças selecionadas automaticamente");

    console.log("Suporte móvel:", suporteMovel?.name || "NÃO ENCONTRADO");

    console.log(
      "Suporte do indutor:",
      suporteIndutor?.name || "NÃO ENCONTRADO",
    );

    console.log("Indutor:", indutor?.name || "NÃO ENCONTRADO");

    console.log("Bobina:", bobina?.name || "NÃO ENCONTRADO");

    console.log("Mesa real:", mesaReal?.name || "NÃO ENCONTRADO");

    console.groupEnd();

    const pecasEncontradas = {
      suporteMovel,
      suporteIndutor,
      indutor,
      bobina,
      mesaReal,
    };

    Object.entries(pecasEncontradas).forEach(([nome, objeto]) => {
      if (objeto) {
        console.log(`Peça encontrada: ${nome}`, objeto);
      } else {
        console.error(`Peça não encontrada: ${nome}`);
      }
    });

    /*
    Atalho de depuração: digite "pecasDebug" no
    console pra ver rapidinho o nome de cada peça
    escolhida, sem precisar rolar o histórico.
    */
    window.pecasDebug = Object.fromEntries(
      Object.entries(pecasEncontradas).map(([nome, objeto]) => [
        nome,
        objeto?.name || null,
      ]),
    );

    conjuntoMovel.position.set(0, 0, 0);
    conjuntoMesa.position.set(0, 0, 0);
    if (suporteMovel) {
      conjuntoMovel.attach(suporteMovel);
    }

    if (suporteIndutor) {
      conjuntoMovel.attach(suporteIndutor);
    }

    if (indutor) {
      conjuntoMovel.attach(indutor);
    }

    if (bobina) {
      conjuntoMovel.attach(bobina);
    }

    // if (mesaReal) {
    //   conjuntoMesa.attach(mesaReal);
    // }

    const pecasAusentes = Object.entries({
      suporteMovel,
      suporteIndutor,
      indutor,
      bobina,
      mesaReal,
    })
      .filter(([, objeto]) => !objeto)
      .map(([nome]) => nome);

    if (pecasAusentes.length === 0) {
      console.log("Hierarquia móvel criada com todas as peças.");
    } else {
      console.warn(
        "Hierarquia criada parcialmente. Peças ausentes:",
        pecasAusentes,
      );
    }
    /*
    Usa a cor ORIGINAL de cada material,
    exatamente como veio do GLB (o próprio
    Three.js/GLTFLoader já lê o baseColorFactor
    de cada peça - não sobrescrevemos mais com
    uma cor nossa). As 2 texturas quebradas
    (marcadas como PNG mas eram DDS) já foram
    removidas do arquivo, então a maioria das
    129 peças mantém a cor própria do SolidWorks.
    Só ajustamos metalness/roughness, porque sem
    mapa de ambiente nesta cena simples, peças
    muito metálicas (ex.: perfis de alumínio)
    ficam pretas sem essa correção.
    */
    modeloMaquina.traverse((objeto) => {
      if (!objeto.isMesh) return;

      const materiais = Array.isArray(objeto.material)
        ? objeto.material
        : [objeto.material];

      materiais.forEach((material) => {
        if (!material) {
          return;
        }

        material.side = THREE.DoubleSide;

        if (material.metalness !== undefined) {
          material.metalness = 0.35;
        }

        if (material.roughness !== undefined) {
          material.roughness = 0.55;
        }
      });

      objeto.castShadow = true;

      objeto.receiveShadow = true;
    });

    configurarAparenciaNormalConjuntoIndutor();
    } catch (erro) {
      console.error(
        "Erro ao localizar/preparar peças do modelo 3D (o modelo continua visível, mas pode faltar alguma parte ou cor):",
        erro,
      );
    }

    try {
      ajustarModeloNaCena(modeloMaquina);
    } catch (erro) {
      console.error(
        "Erro ao ajustar escala/câmera do modelo 3D:",
        erro,
      );
    }

    if (MODO_CALIBRACAO) {
      conjuntoMovel.position.x = POSICAO_CALIBRACAO_INICIAL_X;

      console.log("Modo calibração iniciado em X:", conjuntoMovel.position.x);
    } else {
      definirPosicaoZMm(POSICAO_INICIAL_Z_MM);
    }
    // void iniciarSistema();

    void iniciarSistema();

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText =
        "Modelo carregado, todas as peças móveis unidas.";
    }
  },
  undefined,
  (erro) => {
    console.error("Erro ao carregar o modelo GLB:", erro);
    document.getElementById("statusPrograma").innerText =
      "Erro ao carregar o modelo 3D.";
  },
);

function ajustarModeloNaCena(modelo) {
  const box = new THREE.Box3().setFromObject(modelo);
  const tamanho = new THREE.Vector3();
  const centro = new THREE.Vector3();

  box.getSize(tamanho);
  box.getCenter(centro);

  const maiorEixo = Math.max(tamanho.x, tamanho.y, tamanho.z);
  const escalaDesejada =
    Number.isFinite(maiorEixo) && maiorEixo > 0 ? 12 / maiorEixo : 1;

  modelo.scale.setScalar(escalaDesejada);

  const boxEscalado = new THREE.Box3().setFromObject(modelo);
  const centroEscalado = new THREE.Vector3();
  boxEscalado.getCenter(centroEscalado);

  modelo.position.sub(centroEscalado);

  // Descobre onde está a parte mais baixa da máquina.
  const boxNoCentro = new THREE.Box3().setFromObject(modelo);

  // Coloca os pés exatamente sobre o piso.
  modelo.position.y += -boxNoCentro.min.y + 0.01;

  const boxFinal = new THREE.Box3().setFromObject(modelo);
  const tamanhoFinal = new THREE.Vector3();
  const centroFinal = new THREE.Vector3();

  boxFinal.getSize(tamanhoFinal);
  boxFinal.getCenter(centroFinal);

  controls.target.set(0, Math.max(1.2, tamanhoFinal.y * 0.45), 0);
  controls.update();

  camera.position.set(
    tamanhoFinal.x * 0.9,
    tamanhoFinal.y * 0.75,
    tamanhoFinal.z * 1.15,
  );

  raioModeloVisivel = tamanhoFinal.length() / 2;
  solicitarResizeCena3D();
  camera.near = 0.01;
  camera.far = 2000;
  camera.updateProjectionMatrix();
}

/* =====================================
REFERÊNCIAS VISUAIS DO PROCESSO
===================================== */

const materialcabecote = new THREE.MeshPhysicalMaterial({
  color: 0xff8800,
  emissive: 0xff6600,
  emissiveIntensity: 0.35,
  metalness: 1,
  roughness: 0.25,
});

const cabecote = new THREE.Group();

const corpocabecote = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.18, 1.1, 32),
  materialcabecote,
);

corpocabecote.rotation.z = Math.PI / 2;
// cabecote.add(corpocabecote);

const ponteiracabecote = new THREE.Mesh(
  new THREE.ConeGeometry(0.16, 0.35, 32),
  materialcabecote,
);

ponteiracabecote.rotation.z = -Math.PI / 2;
ponteiracabecote.position.x = -0.7;

const materialArame = new THREE.MeshPhysicalMaterial({
  color: 0xb45309,
  metalness: 1,
  roughness: 0.3,
});

const roloArame = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.22, 0.08, 32),
  materialArame,
);

roloArame.rotation.x = Math.PI / 2;
roloArame.position.set(0.35, 0, -0.2);
// cabecote.add(roloArame);

const fioArame = new THREE.Mesh(
  new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8),
  materialArame,
);

fioArame.rotation.z = Math.PI / 2;
fioArame.position.set(-0.85, 0, 0);

const luzSolda = new THREE.PointLight(0x00bbff, 0.3, 2);

/* =====================================
ESTADO LÓGICO DA MÁQUINA
===================================== */
const MODO_CALIBRACAO = false;

// Estes valores só são usados quando o modo de calibração está ativo.
const VELOCIDADE_CALIBRACAO_X = 0.015;
const LIMITE_TESTE_X_MIN = -0.35;
const LIMITE_TESTE_X_MAX = 0.05;
const POSICAO_CALIBRACAO_INICIAL_X = -0.17;

// Escala lógica temporária.
/*
Recalibrado com base no que a máquina real
respondeu: subindo, ela trava no fim de curso
quando o software estima 55.2mm; descendo,
trava quando o software estima 53.2mm. Como
não existe encoder ainda, esses dois números
(a estimativa do PRÓPRIO software no momento
em que os fins de curso reais bateram) são a
melhor referência que temos - por isso viram
os novos limites, no lugar dos valores antigos
(1 e 55.9), que eram só um placeholder inicial.
*/
const Z_MIN_MM = 53.2;
const Z_MAX_MM = 55.2;

// Limites visuais calibrados novamente.
const POSICAO_CENA_MIN_X = -0.12851;
const POSICAO_CENA_MAX_X = 0.01372;

// Velocidades.
const VELOCIDADE_JOG_MM_S = 45;
/*
Era 25mm/s quando o curso Z ia de 1 a 55.9mm
(~2.2s pra atravessar tudo). Com o curso
recalibrado pra só 2mm (53.2-55.2), a mesma
velocidade atravessava tudo em ~80ms - parecia
"supersônico". Reduzido na mesma proporção
pra continuar levando ~2s de ponta a ponta.
*/
const VELOCIDADE_PROGRAMA_MM_S = 1;
const VELOCIDADE_MESA_GRAUS_S = 45;
const TOLERANCIA_Z_MM = 0.2;
const VELOCIDADE_MESA_PROGRAMA_GRAUS_S = 45;

/*
Sentido visual da mesa: -1 = anti-horário
(visto de cima), 1 = horário. Depende da
orientação do eixo Z local da peça "mesaReal"
dentro do modelo 3D — se girar do lado errado
depois de trocar o modelo, só trocar este sinal.
*/
const SENTIDO_ROTACAO_MESA = -1;

const TOLERANCIA_MESA_GRAUS = 0.5;

// Posição inicial aproximadamente no meio.
const POSICAO_INICIAL_Z_MM = Z_MAX_MM;
const estadoMaquina = {
  posicaoZMm: POSICAO_INICIAL_Z_MM,
};

/*
=====================================
ESTADO DA EXECUÇÃO
=====================================

Separado de estadoMaquina,
que atualmente guarda a posição Z.
*/
const EstadoExecucao = {
  PARADA: "PARADA",

  AGUARDANDO_INICIO: "AGUARDANDO_INICIO",

  AGUARDANDO_PECA: "AGUARDANDO_PECA",

  PREPARANDO: "PREPARANDO",
  EXECUTANDO: "EXECUTANDO",
  PAUSADO: "PAUSADO",
  FINALIZADO: "FINALIZADO",
  CANCELADO: "CANCELADO",
  EMERGENCIA: "EMERGENCIA",
};

let estadoExecucao = EstadoExecucao.PARADA;

/*
Na simulação esperamos 1 segundo.

Futuramente este tempo será
substituído pela confirmação
MESA_READY vinda do CLP.
*/

const TEMPO_PREPARACAO_MESA_MS = 1000;

const TEMPO_CONFIRMACAO_PECA_MS = 3000;

const ModoIntegracaoMaquina = Object.freeze({
  SIMULACAO: "SIMULACAO",
  CLP_CONFIRMADO: "CLP_CONFIRMADO",
});

let modoIntegracaoMaquina = ModoIntegracaoMaquina.SIMULACAO;

window.definirModoIntegracaoMaquina = function definirModoIntegracaoMaquina(modo) {
  if (!Object.values(ModoIntegracaoMaquina).includes(modo)) {
    throw new TypeError(`Modo de integração inválido: ${modo}`);
  }

  if ([EstadoExecucao.EXECUTANDO, EstadoExecucao.PREPARANDO, EstadoExecucao.PAUSADO].includes(estadoExecucao)) {
    throw new Error("Pare a execução antes de trocar o modo de integração.");
  }
  modoIntegracaoMaquina = modo;
};

window.obterModoIntegracaoMaquina = () => modoIntegracaoMaquina;

function maquinaRealAtiva() {
  return modoIntegracaoMaquina === ModoIntegracaoMaquina.CLP_CONFIRMADO;
}

/*
=====================================
ALTERNAR SIMULAÇÃO <-> MÁQUINA REAL
=====================================

A opção fica salva no navegador e
começa desligada por segurança: um
operador só liga depois de validar
o Node-RED/CLP.
*/
const CHAVE_MAQUINA_REAL = "soldatech.maquinaReal";

function aplicarModoMaquinaReal(ativar) {
  window.definirModoIntegracaoMaquina(
    ativar
      ? ModoIntegracaoMaquina.CLP_CONFIRMADO
      : ModoIntegracaoMaquina.SIMULACAO,
  );
}

const chkMaquinaReal = document.getElementById("chkMaquinaReal");

if (chkMaquinaReal) {
  const ligadoSalvo = false; // Controle físico exige seleção explícita a cada sessão.

  chkMaquinaReal.checked = ligadoSalvo;
  aplicarModoMaquinaReal(ligadoSalvo);

  chkMaquinaReal.addEventListener("change", () => {
    if (executandoPrograma) {
      chkMaquinaReal.checked = maquinaRealAtiva();
      return;
    }
    pararControleManual();
    if (chkMaquinaReal.checked && !window.mqttEstaConectado?.()) {
      alert(
        "O MQTT ainda não está conectado ao broker. A máquina real pode não responder aos comandos.",
      );
    }

    localStorage.setItem(CHAVE_MAQUINA_REAL, String(chkMaquinaReal.checked));
    aplicarModoMaquinaReal(chkMaquinaReal.checked);
  });
}

let aguardandoTrocaPeca = false;

const relogioAnimacao = new THREE.Clock();

function limitarPosicaoZ(valorMm) {
  return THREE.MathUtils.clamp(valorMm, Z_MIN_MM, Z_MAX_MM);
}

function converterMmParaCenaX(valorMm) {
  const valorLimitado = limitarPosicaoZ(valorMm);

  const proporcao = (valorLimitado - Z_MIN_MM) / (Z_MAX_MM - Z_MIN_MM);

  return THREE.MathUtils.lerp(
    POSICAO_CENA_MIN_X,
    POSICAO_CENA_MAX_X,
    proporcao,
  );
}

const PASSO_Z_MM = 1;
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 100;
const TOLERANCIA_LIMITE_Z_MM = 0.0001;
let temporizadorInicioHold = null;
let temporizadorRepeticaoHold = null;
let botaoHoldAtivo = null;
let jogRealAtivo = false;

/*
=====================================
JOG CALIBRADO (TOQUE RÁPIDO) - MÁQUINA REAL
=====================================

Um toque rápido (< LIMITE_TAP_MS) manda um
pulso de duração FIXA pro CLP (controlada
pelo Node-RED, não pelo tempo de clique no
navegador) e anima a estimativa visual pelo
valor calibrado observado na máquina real.
Segurar além do limite vira jog contínuo,
como já era.

Calibração antiga: 1 pulso de
DURACAO_PULSO_JOG_MS chegou a mover 22mm -
só que isso foi medido ANTES de recalibrar
Z_MIN_MM/Z_MAX_MM para o curso real (que
hoje é de só 2mm, 53.2 a 55.2). 22mm não
cabe mais nesse curso (um toque já jogaria
pro limite oposto de uma vez). Reduzido pra
uma fração segura do curso atual até termos
uma medição nova - remeça essa calibração
segurando um toque rápido de novo e me
dizendo quantos mm ele moveu de verdade.
*/
const LIMITE_TAP_MS = 150;
const DURACAO_PULSO_JOG_MS = 30;
const INCREMENTO_PULSO_MM = 0.2;

/*
Velocidade estimada do jog CONTÍNUO (segurar)
na máquina real - separada do passo da
simulação (PASSO_Z_MM), porque a velocidade
real do motor é bem mais lenta. Calibração
inicial: usuário reportou que a estimativa
chegou a 100% do curso enquanto a máquina
real andou só 1/3 - ou seja, a estimativa
estava 3x mais rápida. Ajustar de novo se
ainda não bater.
*/
const PASSO_JOG_CONTINUO_REAL_MM = PASSO_Z_MM / 3;
let temporizadorDecisaoTap = null;
let aguardandoDecisaoTap = false;
let direcaoJogRealAtual = 0;

function atualizarIndicadorPosicao(mensagem = "") {
  const valorAltura = document.getElementById("valorAltura");
  const statusControleZ = document.getElementById("statusControleZ");
  const btnSubir = document.getElementById("btnSubirIndutor");
  const btnDescer = document.getElementById("btnDescerIndutor");
  const noLimiteSuperior =
    estadoMaquina.posicaoZMm >= Z_MAX_MM - TOLERANCIA_LIMITE_Z_MM;
  const noLimiteInferior =
    estadoMaquina.posicaoZMm <= Z_MIN_MM + TOLERANCIA_LIMITE_Z_MM;
  const controleBloqueado = executandoPrograma;

  if (valorAltura) {
    valorAltura.innerText = `Z: ${estadoMaquina.posicaoZMm.toFixed(1)} mm`;
  }

  if (btnSubir) {
    btnSubir.disabled = controleBloqueado || noLimiteSuperior;
  }

  if (btnDescer) {
    btnDescer.disabled = controleBloqueado || noLimiteInferior;
  }

  if (statusControleZ) {
    statusControleZ.innerText =
      mensagem ||
      (noLimiteSuperior
        ? "LIMITE SUPERIOR"
        : noLimiteInferior
          ? "LIMITE INFERIOR"
          : "");
  }
}

function definirPosicaoZMm(valorMm) {
  const valorNumerico = Number(valorMm);

  if (!Number.isFinite(valorNumerico)) {
    console.error("Posição Z inválida:", valorMm);
    atualizarIndicadorPosicao("POSIÇÃO INVÁLIDA");
    return false;
  }

  const novaPosicao = limitarPosicaoZ(valorNumerico);

  estadoMaquina.posicaoZMm = novaPosicao;

  conjuntoMovel.position.x = converterMmParaCenaX(novaPosicao);

  atualizarIndicadorPosicao();

  return true;
}

/*
Aplica a posição Z informada pelo CLP
real (mensagem STATUS via MQTT/Node-RED)
diretamente no gêmeo digital.

Diferente de definirPosicaoZMm, não
bloqueia por colisão: aqui estamos
apenas refletindo a posição real da
máquina, não simulando um movimento
hipotético.
*/
function aplicarPosicaoZReal(valorMm) {
  const valorNumerico = Number(valorMm);

  if (!Number.isFinite(valorNumerico)) {
    return;
  }

  estadoMaquina.posicaoZMm = limitarPosicaoZ(valorNumerico);
  conjuntoMovel.position.x = converterMmParaCenaX(estadoMaquina.posicaoZMm);
  atualizarIndicadorPosicao();
}

function pararMovimentoContinuo(evento) {
  window.clearTimeout(temporizadorInicioHold);
  window.clearInterval(temporizadorRepeticaoHold);
  temporizadorInicioHold = null;
  temporizadorRepeticaoHold = null;

  if (jogRealAtivo) {
    jogRealAtivo = false;

    if (aguardandoDecisaoTap) {
      /*
      Foi um toque rápido: cancela a decisão de
      virar jog contínuo e manda um pulso único
      de duração fixa, animando a estimativa
      visual pelo incremento calibrado.
      */
      window.clearTimeout(temporizadorDecisaoTap);
      aguardandoDecisaoTap = false;

      // Cancelamento, blur e início de programa nunca viram um novo pulso.
      if (evento?.type !== "pointerup") {
        botaoHoldAtivo?.classList.remove("is-pressed");
        botaoHoldAtivo?.setAttribute("aria-pressed", "false");
        botaoHoldAtivo = null;
        return;
      }
      const direcaoTexto = direcaoJogRealAtual > 0 ? "CIMA" : "BAIXO";

      Promise.resolve(
        window.enviarComandoMaquina?.("JOG_PULSO", {
          direcao: direcaoTexto,
          duracaoMs: DURACAO_PULSO_JOG_MS,
        }),
      ).catch((erro) => {
        console.error("Erro ao enviar pulso de jog para a máquina real:", erro);
      });

      aplicarPosicaoZReal(
        estadoMaquina.posicaoZMm + direcaoJogRealAtual * INCREMENTO_PULSO_MM,
      );
    } else {
      try {
        window.SoldaTouchIntegracaoFisica?.pararMovimentoManual();
      } catch (erro) {
        console.error("Erro ao parar o jog na máquina real:", erro);
      }
    }
  }

  if (botaoHoldAtivo) {
    botaoHoldAtivo.classList.remove("is-pressed");
    botaoHoldAtivo.setAttribute("aria-pressed", "false");
  }

  botaoHoldAtivo = null;
}

function moverIndutorIncremental(direcao, passoMm = PASSO_Z_MM) {
  if (executandoPrograma || MODO_CALIBRACAO) {
    pararMovimentoContinuo();
    atualizarIndicadorPosicao();
    return false;
  }

  try {
    const destinoSolicitado = estadoMaquina.posicaoZMm + direcao * passoMm;
    const destinoLimitado = limitarPosicaoZ(destinoSolicitado);

    if (
      Math.abs(destinoLimitado - estadoMaquina.posicaoZMm) <=
      TOLERANCIA_LIMITE_Z_MM
    ) {
      atualizarIndicadorPosicao(
        direcao > 0 ? "LIMITE SUPERIOR" : "LIMITE INFERIOR",
      );
      pararMovimentoContinuo();
      return false;
    }

    const moveu = definirPosicaoZMm(destinoLimitado);

    if (!moveu) {
      pararMovimentoContinuo();
    }

    return moveu;
  } catch (erro) {
    pararMovimentoContinuo();
    console.error("Erro no controle manual de altura Z:", erro);
    atualizarIndicadorPosicao("ERRO NO CONTROLE Z");
    return false;
  }
}

function iniciarMovimentoContinuo(direcao, botao) {
  pararMovimentoContinuo();

  /*
  MODO_CALIBRACAO só afeta o posicionamento
  visual pelas SETAS do teclado (ver animate());
  os botões continuam mandando o jog de verdade
  pro CLP normalmente, mesmo calibrando.
  */
  if (executandoPrograma) {
    atualizarIndicadorPosicao();
    return;
  }

  botaoHoldAtivo = botao;
  botaoHoldAtivo.classList.add("is-pressed");
  botaoHoldAtivo.setAttribute("aria-pressed", "true");

  /*
  IMPORTANTE: "Controlar a máquina real" fica
  marcado (localStorage) mesmo depois de fechar
  a página - então maquinaRealAtiva() pode ser
  true sem o Node-RED/CLP estar realmente
  conectado nesse momento (ex.: dia seguinte,
  serviços locais não religados ainda). Por
  isso o comportamento CALIBRADO (mais lento,
  com decisão toque/segurar) só entra quando o
  MQTT está de fato conectado - caso contrário
  o gêmeo digital se comporta como na simulação
  (sempre responsivo), e o comando real ainda é
  tentado em segundo plano, caso reconecte no
  meio do movimento.
  */
  const clpConectado = maquinaRealAtiva() && Boolean(window.mqttEstaConectado?.());

  if (maquinaRealAtiva()) {
    jogRealAtivo = true;
  }

  if (clpConectado) {
    aguardandoDecisaoTap = true;
    direcaoJogRealAtual = direcao;

    temporizadorDecisaoTap = window.setTimeout(() => {
      aguardandoDecisaoTap = false;

      Promise.resolve(
        window.SoldaTouchIntegracaoFisica?.iniciarMovimentoManual(
          direcao > 0 ? "CIMA" : "BAIXO",
        ),
      ).catch((erro) => {
        console.error("Erro ao enviar jog para a máquina real:", erro);
        atualizarIndicadorPosicao("ERRO NO CONTROLE Z");
      });

      moverIndutorIncremental(direcao, PASSO_JOG_CONTINUO_REAL_MM);

      temporizadorRepeticaoHold = window.setInterval(() => {
        moverIndutorIncremental(direcao, PASSO_JOG_CONTINUO_REAL_MM);
      }, HOLD_INTERVAL_MS);
    }, LIMITE_TAP_MS);

    return;
  }

  if (maquinaRealAtiva()) {
    // Sem confirmação de conexão agora - tenta mesmo assim, sem bloquear
    // a resposta visual (o painel CLP já indica offline/indisponível).
    Promise.resolve(
      window.SoldaTouchIntegracaoFisica?.iniciarMovimentoManual(
        direcao > 0 ? "CIMA" : "BAIXO",
      ),
    ).catch(() => {});
  }

  if (!moverIndutorIncremental(direcao)) {
    return;
  }

  temporizadorInicioHold = window.setTimeout(() => {
    temporizadorRepeticaoHold = window.setInterval(() => {
      moverIndutorIncremental(direcao);
    }, HOLD_INTERVAL_MS);
  }, HOLD_DELAY_MS);
}

function configurarBotaoMovimentoZ(botao, direcao) {
  if (!botao) {
    return;
  }

  botao.setAttribute("aria-pressed", "false");

  botao.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();
    iniciarMovimentoContinuo(direcao, botao);
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((tipoEvento) => {
    botao.addEventListener(tipoEvento, pararMovimentoContinuo);
  });

  botao.addEventListener("contextmenu", (event) => event.preventDefault());
}

configurarBotaoMovimentoZ(document.getElementById("btnSubirIndutor"), 1);
configurarBotaoMovimentoZ(document.getElementById("btnDescerIndutor"), -1);
window.addEventListener("pointerup", pararMovimentoContinuo);
window.addEventListener("pointercancel", pararMovimentoContinuo);

/*
=====================================
GÊMEO DIGITAL — ESPELHAMENTO DA MÁQUINA REAL
=====================================

Enquanto modoIntegracaoMaquina for
CLP_CONFIRMADO, a posição/estado
visual param de ser assumida
(open-loop) e passa a ser a posição
real informada pelo CLP através das
mensagens STATUS (via Node-RED/MQTT).
*/
window.SoldaTouchMQTT?.eventos.addEventListener("tipo-evento", (evento) => {
  const espelharSimulador = window.acompanharSimulador === true &&
    evento.detail?.dados?.simulacao === true && !executandoPrograma;
  if (evento.detail?.tipo !== "STATUS" || (!maquinaRealAtiva() && !espelharSimulador)) {
    return;
  }

  const dados = evento.detail.dados || {};

  if (espelharSimulador) {
    girando = false; // A posição vem do simulador, sem somar animação local.
    atualizarStatusMesa(dados.estado === "EXECUTANDO" ? "GIRANDO (SIMULAÇÃO)" : "PARADA (SIMULAÇÃO)");
  }

  if (dados.posicaoZMm !== undefined) {
    aplicarPosicaoZReal(dados.posicaoZMm);
  }

  if (dados.anguloMesaGraus !== undefined && mesaReal) {
    const angulo = Number(dados.anguloMesaGraus);

    if (Number.isFinite(angulo)) {
      definirAnguloMesaGraus(angulo);
    }
  }

  if (typeof dados.soldaAtiva === "boolean") {
    aplicarAparenciaSoldaVisual(dados.soldaAtiva);
  }
});

async function retornarCabecoteParaPosicaoInicial() {
  const destino = POSICAO_INICIAL_Z_MM;

  while (Math.abs(destino - estadoMaquina.posicaoZMm) > TOLERANCIA_Z_MM) {
    const diferenca = destino - estadoMaquina.posicaoZMm;

    const deslocamento =
      Math.sign(diferenca) *
      Math.min(Math.abs(diferenca), VELOCIDADE_PROGRAMA_MM_S * 0.016);

    definirPosicaoZMm(estadoMaquina.posicaoZMm + deslocamento);

    await aguardar(16);
  }

  definirPosicaoZMm(POSICAO_INICIAL_Z_MM);

  console.log("Cabeçote retornou à posição inicial.");
}

/* =====================================
PONTOS
===================================== */

let pontos = [];
let executandoPrograma = false;
let indicePontoAtual = 0;
let filaProducao = [];
let indiceFila = 0;
let repeticaoAtual = 0;
let producaoCancelada = false;
let inicioExecucao = Date.now();
let inicioProducao = null;
let fimProducao = null;
let indiceUltimoPontoEnviadoMaquina = -1;

function salvarPonto() {
  if (executandoPrograma) {
    alert(
      "Não é possível salvar pontos enquanto um programa está sendo executado.",
    );

    return;
  }

  if (!mesaReal) {
    alert("A mesa giratória ainda não foi carregada.");

    return;
  }

  /*
  A mesa precisa estar parada para que
  o ângulo salvo seja exato.
  */
  if (girando) {
    alert("Pare a mesa antes de salvar o ponto.");

    return;
  }

  const alturaZMm = Number(estadoMaquina.posicaoZMm.toFixed(2));

  const anguloMesaGraus = Number(obterAnguloMesaGraus().toFixed(2));

  const ponto = {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `ponto-${Date.now()}-${pontos.length + 1}`,

    ordem: pontos.length + 1,

    zMm: alturaZMm,

    anguloMesaGraus: anguloMesaGraus,

    solda: {
      ativar: true,
    },
  };

  pontos.push(ponto);

  atualizarLista();

  const statusPrograma = document.getElementById("statusPrograma");

  if (statusPrograma) {
    statusPrograma.innerText = `Ponto P${ponto.ordem} salvo: Z ${ponto.zMm.toFixed(2)} mm e mesa ${ponto.anguloMesaGraus.toFixed(2)}°.`;
  }

  console.log("Ponto salvo:", ponto);

  console.log("Lista completa de pontos:", pontos);
}

function excluirPonto(idPonto) {
  if (executandoPrograma) {
    alert(
      "Não é possível excluir pontos enquanto um programa está sendo executado.",
    );

    return;
  }

  const indicePonto = pontos.findIndex((ponto) => ponto.id === idPonto);

  if (indicePonto === -1) {
    console.error("Ponto não encontrado:", idPonto);

    return;
  }

  const pontoEncontrado = pontos[indicePonto];

  const confirmarExclusao = confirm(
    `Deseja realmente excluir o ponto P${pontoEncontrado.ordem}?`,
  );

  if (!confirmarExclusao) {
    return;
  }

  pontos.splice(indicePonto, 1);

  // Reorganiza a numeração:
  // P1, P2, P3...
  pontos = pontos.map((ponto, index) => ({
    ...ponto,
    ordem: index + 1,
  }));

  atualizarLista();

  const statusPrograma = document.getElementById("statusPrograma");

  if (statusPrograma) {
    statusPrograma.innerText = `Ponto P${pontoEncontrado.ordem} excluído com sucesso.`;
  }

  console.log("Ponto excluído:", pontoEncontrado);

  console.log("Pontos restantes:", pontos);
}

function atualizarLista() {
  const lista = document.getElementById("listaPontos");

  lista.innerHTML = "";

  if (pontos.length === 0) {
    const mensagem = document.createElement("p");
    mensagem.innerText = "Nenhum ponto salvo.";

    lista.appendChild(mensagem);
    return;
  }

  pontos.forEach((ponto, index) => {
    const card = document.createElement("div");

    card.style.marginTop = "10px";
    card.style.padding = "10px";
    card.style.borderRadius = "10px";
    card.style.background = "rgba(255,255,255,0.05)";
    card.style.borderLeft = "4px solid #38bdf8";

    const titulo = document.createElement("strong");

    titulo.innerText = `P${index + 1}`;

    const posicao = document.createElement("p");

    posicao.innerText = `Altura Z: ${Number(ponto.zMm).toFixed(2)} mm`;

    const posicaoMesa = document.createElement("p");

    posicaoMesa.innerText = `Mesa: ${Number(ponto.anguloMesaGraus).toFixed(
      2,
    )}°`;

    const botaoExcluir = document.createElement("button");

    botaoExcluir.type = "button";

    botaoExcluir.innerText = "Excluir ponto";

    botaoExcluir.style.width = "100%";

    botaoExcluir.style.marginTop = "8px";

    botaoExcluir.style.padding = "8px";

    botaoExcluir.style.border = "1px solid #ef4444";

    botaoExcluir.style.borderRadius = "6px";

    botaoExcluir.style.background = "rgba(239, 68, 68, 0.15)";

    botaoExcluir.style.color = "#fca5a5";

    botaoExcluir.style.cursor = "pointer";

    botaoExcluir.style.fontWeight = "600";

    botaoExcluir.addEventListener("mouseenter", () => {
      botaoExcluir.style.background = "rgba(239, 68, 68, 0.30)";
    });

    botaoExcluir.addEventListener("mouseleave", () => {
      botaoExcluir.style.background = "rgba(239, 68, 68, 0.15)";
    });

    botaoExcluir.addEventListener("click", () => {
      excluirPonto(ponto.id);
    });

    card.appendChild(titulo);
    card.appendChild(posicao);
    card.appendChild(posicaoMesa);
    card.appendChild(botaoExcluir);

    lista.appendChild(card);
  });
}

/* =====================================
MOVIMENTO AUTOMÁTICO
===================================== */

let programaPausado = false;
let motivoPausaAtual = null;
let inicioPausaAtual = null;
let pausaIdAtual = null;

async function salvarEstadoExecucaoFirebase(status, propagarErro = false) {
  /*
  =============================
  VALIDAR PRODUÇÃO
  =============================
  */

  if (filaProducao.length === 0) {
    console.warn("Não existe fila de produção para salvar.");

    if (propagarErro) {
      throw new Error("Não existe fila de produção para salvar.");
    }

    return;
  }

  if (typeof window.salvarProducaoAtualFirebase !== "function") {
    console.warn("Função salvarProducaoAtualFirebase não disponível.");

    if (propagarErro) {
      throw new Error("Função salvarProducaoAtualFirebase não disponível.");
    }

    return;
  }

  /*
  =============================
  ITEM ATUAL DA FILA
  =============================
  */

  const itemAtual = filaProducao[indiceFila];

  if (!itemAtual) {
    console.warn("Item atual da fila não encontrado.");

    if (propagarErro) {
      throw new Error("Item atual da fila não encontrado.");
    }

    return;
  }

  /*
  =============================
  QUANTIDADES
  =============================
  */

  const quantidadeTotal = Number(itemAtual.quantidade) || 0;

  const quantidadeConcluida = Number(repeticaoAtual) || 0;
  producaoId ||= crypto.randomUUID();
  const pontosExecutados = quantidadeConcluida * pontos.length + Math.min(indicePontoAtual, pontos.length);

  const percentual =
    quantidadeTotal > 0
      ? Math.min(100, Math.round(pontosExecutados / (quantidadeTotal * pontos.length) * 100))
      : 0;

  /*
  =============================
  SALVAR FIREBASE
  =============================
  */

  try {
    const dadosEstado = {
      producaoId, simulacao: true, pontosExecutados,
      tempoDecorridoSegundos: inicioProducao ? Math.max(0, (Date.now() - inicioProducao) / 1000) : 0,
      programa: itemAtual.programa,

      quantidadeTotal: quantidadeTotal,

      quantidadeConcluida: quantidadeConcluida,

      repeticaoAtual: Math.min(quantidadeConcluida + 1, quantidadeTotal),

      indiceFila: indiceFila,

      totalProgramasFila: filaProducao.length,

      fila: filaProducao,

      pontoAtual: Math.min(indicePontoAtual + 1, pontos.length),

      totalPontos: pontos.length,

      status: status,

      percentual: percentual,

      inicioTimestamp: inicioProducao,

      pausaIdAtual: pausaIdAtual || null,

      motivoPausaAtual: motivoPausaAtual || null,

      inicioPausaAtual: inicioPausaAtual || null,
    };
    gravacaoProducao = gravacaoProducao.catch(() => {}).then(() => window.salvarProducaoAtualFirebase(dadosEstado));
    await gravacaoProducao;

    console.log("Estado salvo no Firebase:", {
      status: status,

      programa: itemAtual.programa,

      pontoAtual: indicePontoAtual + 1,

      quantidadeConcluida: quantidadeConcluida,

      quantidadeTotal: quantidadeTotal,

      percentual: percentual,
    });
  } catch (erro) {
    console.error("Erro ao salvar estado da execução no Firebase:", erro);

    if (propagarErro) {
      throw erro;
    }
  }
}

/*
Pausa/retoma simples, usada só pelo fluxo
novo de "INICIAR REPRODUÇÃO" - não mexe em
fila/Firebase de produção (que não existem
nesse modo).
*/
function alternarMovimentoReproducaoSimples() {
  const botao = document.getElementById("btnPlayPause");
  const statusPrograma = document.getElementById("statusPrograma");

  if (!programaPausado) {
    programaPausado = true;
    estadoExecucao = EstadoExecucao.PAUSADO;
    girando = false;

    definirIndutorSoldando(false);
    encerrarSoldaNoProximoQuadro = false;
    pararControleManual();
    atualizarStatusMesa("PARADA");

    if (botao) {
      botao.innerText = "Continuar execução";
    }

    if (statusPrograma) {
      statusPrograma.innerText = "Reprodução pausada.";
    }
  } else {
    programaPausado = false;
    estadoExecucao = EstadoExecucao.EXECUTANDO;

    if (botao) {
      botao.innerText = "Pausar execução";
    }

    if (statusPrograma) {
      statusPrograma.innerText = "Reprodução retomada.";
    }
  }
}

async function alternarMovimento() {
  if (estadoExecucao === EstadoExecucao.EMERGENCIA) return;
  if (maquinaRealAtiva()) {
    informarBloqueioAutomatico();
    return;
  }
  /*
  =============================
  VALIDAR EXECUÇÃO
  =============================
  */

  if (!executandoPrograma) {
    console.warn("Não existe execução ativa.");

    return;
  }

  if (modoReproducaoSimples) {
    alternarMovimentoReproducaoSimples();

    return;
  }

  const botao = document.getElementById("btnPlayPause");

  const statusPrograma = document.getElementById("statusPrograma");

  /*
  =============================
  PAUSAR PRODUÇÃO
  =============================
  */

  if (!programaPausado && estadoExecucao === EstadoExecucao.EXECUTANDO) {
    inicioPausaAtual = Date.now();

    motivoPausaAtual = "Sem motivo";

    programaPausado = true;

    estadoExecucao = EstadoExecucao.PAUSADO;

    definirIndutorSoldando(false);
    encerrarSoldaNoProximoQuadro = false;
    pararControleManual();

    if (botao) {
      botao.disabled = true;
    }

    let erroAoPausar = null;

    try {
      await pararMesaAutomatica();
    } catch (erro) {
      erroAoPausar = erro;

      console.error("Erro ao parar a mesa durante a pausa:", erro);
    }

    if (botao) {
      botao.innerText = "Continuar execução";
    }

    if (statusPrograma) {
      statusPrograma.innerText = "Programa pausado. Selecione o motivo.";
    }

    try {
      if (typeof window.iniciarPausaFirebase !== "function") {
        throw new Error("Função iniciarPausaFirebase não disponível.");
      }

      const pausaCriada = await window.iniciarPausaFirebase(
        motivoPausaAtual,
        inicioPausaAtual,
      );

      pausaIdAtual = pausaCriada.id;

      inicioPausaAtual = pausaCriada.inicioTimestamp || inicioPausaAtual;

      await salvarEstadoExecucaoFirebase("PAUSADO", true);

      console.log("Produção pausada e registrada:", {
        pausaId: pausaIdAtual,
        inicioTimestamp: inicioPausaAtual,
      });
    } catch (erro) {
      erroAoPausar = erroAoPausar || erro;

      console.error("Erro ao registrar a pausa:", erro);

      try {
        await salvarEstadoExecucaoFirebase("PAUSADO", true);
      } catch (erroSalvarEstado) {
        console.error(
          "Erro ao salvar a produção como pausada:",
          erroSalvarEstado,
        );
      }
    }

    const modalMotivoPausa = document.getElementById("modalMotivoPausa");

    if (modalMotivoPausa) {
      modalMotivoPausa.style.display = "flex";
    }

    if (botao) {
      botao.disabled = false;
    }

    if (erroAoPausar) {
      if (statusPrograma) {
        statusPrograma.innerText =
          "Programa pausado. Houve um erro; selecione o motivo para tentar registrar novamente.";
      }

      alert(
        erroAoPausar.message ||
          "A produção permanece pausada, mas não foi possível registrar a pausa.",
      );
    }

    return;
  }

  /*
  =============================
  CONTINUAR PRODUÇÃO
  =============================
  */

  if (programaPausado && estadoExecucao === EstadoExecucao.PAUSADO) {
    if (!pausaIdAtual) {
      inicioPausaAtual = inicioPausaAtual || Date.now();

      motivoPausaAtual = motivoPausaAtual || "Sem motivo";

      if (botao) {
        botao.disabled = true;
        botao.innerText = "Registrando pausa...";
      }

      try {
        if (typeof window.iniciarPausaFirebase !== "function") {
          throw new Error("Função iniciarPausaFirebase não disponível.");
        }

        const pausaCriada = await window.iniciarPausaFirebase(
          motivoPausaAtual,
          inicioPausaAtual,
        );

        pausaIdAtual = pausaCriada.id;
        inicioPausaAtual = pausaCriada.inicioTimestamp || inicioPausaAtual;

        await salvarEstadoExecucaoFirebase("PAUSADO", true);
      } catch (erro) {
        console.error("Erro ao registrar a pausa antes da retomada:", erro);

        if (botao) {
          botao.disabled = false;
          botao.innerText = "Continuar execução";
        }

        if (statusPrograma) {
          statusPrograma.innerText =
            "Programa pausado. Não foi possível registrar a pausa.";
        }

        alert(
          erro.message ||
            "Não foi possível registrar a pausa. A produção continua pausada.",
        );

        return;
      }
    }

    if (typeof window.finalizarPausaFirebase !== "function") {
      console.error("Função finalizarPausaFirebase não disponível.");

      if (botao) {
        botao.disabled = false;
        botao.innerText = "Continuar execução";
      }

      if (statusPrograma) {
        statusPrograma.innerText =
          "Programa pausado. Não foi possível acessar o registro da pausa.";
      }

      alert("Função finalizarPausaFirebase não disponível.");

      return;
    }

    estadoExecucao = EstadoExecucao.PREPARANDO;

    if (botao) {
      botao.disabled = true;

      botao.innerText = "Preparando...";
    }

    if (statusPrograma) {
      statusPrograma.innerText = "Retomando execução...";
    }

    let pausaFinalizada;

    try {
      /*
      Ponto a ponto: não precisa mais
      "ligar a mesa e esperar estabilizar"
      - o loop de execução (animate())
      já leva Z e mesa até o ponto atual
      normalmente ao retomar.
      */

      if (estadoExecucao !== EstadoExecucao.PREPARANDO) {
        throw new Error("A execução não estava mais aguardando retomada.");
      }

      pausaFinalizada = await window.finalizarPausaFirebase(pausaIdAtual);
    } catch (erro) {
      estadoExecucao = EstadoExecucao.PAUSADO;

      programaPausado = true;

      try {
        await pararMesaAutomatica();
      } catch (erroParada) {
        console.error("Erro ao parar a mesa após falha na retomada:", erroParada);
      }

      try {
        await salvarEstadoExecucaoFirebase("PAUSADO", true);
      } catch (erroSalvarEstado) {
        console.error(
          "Erro ao manter a produção salva como pausada:",
          erroSalvarEstado,
        );
      }

      if (botao) {
        botao.disabled = false;

        botao.innerText = "Continuar execução";
      }

      if (statusPrograma) {
        statusPrograma.innerText =
          "Não foi possível continuar. O programa permanece pausado.";
      }

      console.error("Erro ao retomar a produção:", erro);

      alert(
        erro.message ||
          "Não foi possível continuar a execução. A produção permanece pausada.",
      );

      return;
    }

    console.log("Pausa encerrada:", pausaFinalizada);

    pausaIdAtual = null;
    motivoPausaAtual = null;
    inicioPausaAtual = null;

    /*
    =============================
    RETOMAR CABEÇOTE
    =============================

    Só agora liberamos novamente
    o animate().
    */

    programaPausado = false;

    estadoExecucao = EstadoExecucao.EXECUTANDO;

    if (botao) {
      botao.disabled = false;

      botao.innerText = "Pausar execução";
    }

    if (statusPrograma) {
      statusPrograma.innerText = `Continuando P${indicePontoAtual + 1}...`;
    }

    atualizarStatusMesa("GIRANDO");

    console.log("Produção retomada.", {
      estado: estadoExecucao,

      pontoAtual: indicePontoAtual + 1,

      mesa: "GIRANDO",
    });

    /*
    Atualiza Firebase.
    */

    await salvarEstadoExecucaoFirebase("EXECUTANDO");
  }
}

/* =====================================
   PAINEL DE MOTIVO DA PAUSA
===================================== */

document.querySelectorAll(".btn-motivo-pausa").forEach((botaoMotivo) => {
  botaoMotivo.addEventListener("click", async () => {
    await salvarMotivoPausaSelecionado(botaoMotivo.dataset.motivo);
  });
});

let salvandoMotivoPausa = false;

async function salvarMotivoPausaSelecionado(novoMotivo) {
  if (salvandoMotivoPausa) {
    return;
  }

  salvandoMotivoPausa = true;

  const botoesMotivo = document.querySelectorAll(".btn-motivo-pausa");
  const botaoSemMotivo = document.getElementById("btnCancelarMotivoPausa");

  botoesMotivo.forEach((botaoMotivo) => {
    botaoMotivo.disabled = true;
  });

  if (botaoSemMotivo) {
    botaoSemMotivo.disabled = true;
  }

  const motivoFinal = novoMotivo || "Sem motivo";

  try {
    if (pausaIdAtual) {
      if (typeof window.atualizarMotivoPausaFirebase !== "function") {
        throw new Error("Função atualizarMotivoPausaFirebase não disponível.");
      }

      await window.atualizarMotivoPausaFirebase(pausaIdAtual, motivoFinal);
    } else {
      if (typeof window.iniciarPausaFirebase !== "function") {
        throw new Error("Função iniciarPausaFirebase não disponível.");
      }

      inicioPausaAtual = inicioPausaAtual || Date.now();

      const pausaCriada = await window.iniciarPausaFirebase(
        motivoFinal,
        inicioPausaAtual,
      );

      pausaIdAtual = pausaCriada.id;
      inicioPausaAtual = pausaCriada.inicioTimestamp || inicioPausaAtual;
    }

    motivoPausaAtual = motivoFinal;

    await salvarEstadoExecucaoFirebase("PAUSADO", true);

    const modalMotivoPausa = document.getElementById("modalMotivoPausa");

    if (modalMotivoPausa) {
      modalMotivoPausa.style.display = "none";
    }

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = `Programa pausado — ${motivoPausaAtual}`;
    }

    console.log("Motivo da pausa salvo:", {
      pausaId: pausaIdAtual,
      motivo: motivoPausaAtual,
      inicioTimestamp: inicioPausaAtual,
    });
  } catch (erro) {
    console.error("Erro ao salvar o motivo da pausa:", erro);

    alert(
      erro.message ||
        "Não foi possível salvar o motivo. A produção continua pausada.",
    );
  } finally {
    salvandoMotivoPausa = false;

    botoesMotivo.forEach((botaoMotivo) => {
      botaoMotivo.disabled = false;
    });

    if (botaoSemMotivo) {
      botaoSemMotivo.disabled = false;
    }
  }
}

const btnCancelarMotivoPausa = document.getElementById(
  "btnCancelarMotivoPausa",
);

if (btnCancelarMotivoPausa) {
  btnCancelarMotivoPausa.addEventListener("click", async () => {
    await salvarMotivoPausaSelecionado("Sem motivo");
  });
}
/* =====================================
GIRAR MESA
===================================== */

let girando = false;

function atualizarStatusMesa(texto) {
  const statusMesa = document.getElementById("statusMesa");

  if (statusMesa) {
    statusMesa.innerText = texto;
  }
}

function aguardar(milissegundos) {
  return new Promise((resolve) => setTimeout(resolve, milissegundos));
}

/*
=====================================
CAMADA DE COMUNICAÇÃO DA MÁQUINA
=====================================

Hoje:
simulação 3D.

Futuramente:
MQTT -> ESP32/CLP.

O restante do sistema não precisa
saber qual tecnologia está em uso.
*/

async function solicitarComandoMaquina(comando, dados = {}, opcoes = {}) {
  if (!maquinaRealAtiva()) {
    return true;
  }

  if (["MOVER_PONTO", "SOLDA_ON"].includes(comando)) {
    throw new Error("Execução física automática não homologada (P01).");
  }

  const deveAguardarConfirmacao =
    modoIntegracaoMaquina === ModoIntegracaoMaquina.CLP_CONFIRMADO &&
    opcoes.aguardarConfirmacao === true;

  if (deveAguardarConfirmacao) {
    if (typeof window.enviarComandoComConfirmacao !== "function") {
      throw new Error("Camada MQTT sem suporte a confirmação de comandos.");
    }

    return await window.enviarComandoComConfirmacao(comando, dados, {
      tiposSucesso: opcoes.tiposSucesso,
      timeoutMs: opcoes.timeoutMs,
    });
  }

  if (typeof window.enviarComandoMaquina === "function") {
    return await window.enviarComandoMaquina(comando, dados);
  }

  console.log("[SIMULAÇÃO] comando da máquina:", comando, dados);

  return true;
}

async function iniciarMesaAutomatica() {
  girando = true;

  atualizarStatusMesa("GIRANDO");

  await solicitarComandoMaquina("MESA_START");
}

async function pararMesaAutomatica() {
  girando = false;

  atualizarStatusMesa("PARADA");

  await solicitarComandoMaquina("MESA_STOP");
}

async function aguardarMesaPronta() {
  if (modoIntegracaoMaquina === ModoIntegracaoMaquina.CLP_CONFIRMADO) {
    if (typeof window.aguardarEventoMaquina !== "function") {
      throw new Error("Camada MQTT não permite aguardar o evento MESA_READY.");
    }

    await window.aguardarEventoMaquina("MESA_READY");
    return true;
  }

  /*
  =============================
  SIMULAÇÃO ATUAL
  =============================
  */

  await aguardar(TEMPO_PREPARACAO_MESA_MS);

  /*
  FUTURO:

  return await
    aguardarConfirmacaoCLP(
      "MESA_READY"
    );

  O navegador NÃO deve considerar
  este delay como segurança física.
  */

  return true;
}

function girarMesa() {
  if (executandoPrograma) {
    alert("A mesa está sendo controlada pelo programa em execução.");

    return;
  }
  girando = !girando;

  const statusMesa = document.getElementById("statusMesa");

  if (statusMesa) {
    statusMesa.innerText = girando ? "GIRANDO" : "PARADA";
  }

  if (maquinaRealAtiva()) {
    void solicitarComandoMaquina(girando ? "MESA_START" : "MESA_STOP");
  }

  console.log(girando ? "Mesa iniciada." : "Mesa parada.", {
    rotacaoX: mesaReal?.rotation.x,
    rotacaoY: mesaReal?.rotation.y,
    rotacaoZ: mesaReal?.rotation.z,
  });
}

function normalizarAnguloGraus(anguloGraus) {
  return ((anguloGraus % 360) + 360) % 360;
}

function obterAnguloMesaGraus() {
  if (!mesaReal) {
    return 0;
  }

  const rotacaoRelativaRad = mesaReal.rotation.z - rotacaoInicialMesaZ;

  const anguloGraus = THREE.MathUtils.radToDeg(rotacaoRelativaRad);

  return normalizarAnguloGraus(anguloGraus);
}

function diferencaAngularCurta(destinoGraus, atualGraus) {
  return ((destinoGraus - atualGraus + 540) % 360) - 180;
}

function definirAnguloMesaGraus(anguloGraus) {
  if (!mesaReal) {
    return;
  }

  const anguloNormalizado = normalizarAnguloGraus(anguloGraus);

  mesaReal.rotation.z =
    rotacaoInicialMesaZ + THREE.MathUtils.degToRad(anguloNormalizado);
}

// BARRA
function atualizarBarraProgresso() {
  if (filaProducao.length === 0) return;

  let total = 0;
  let concluido = 0;

  filaProducao.forEach((item, index) => {
    total += Number(item.quantidade) || 0;

    if (index < indiceFila) {
      concluido += Number(item.quantidade) || 0;
    }
  });

  concluido += repeticaoAtual + (pontos.length ? Math.min(indicePontoAtual, pontos.length) / pontos.length : 0);

  const porcentagem = total > 0 ? Math.min((concluido / total) * 100, 100) : 0;
  document.getElementById("barraProgresso").style.width = porcentagem + "%";

  document.getElementById("textoProgresso").innerText =
    porcentagem.toFixed(0) + "%";
}
// TEmpo restante

function atualizarTempoRestante() {
  if (filaProducao.length === 0) return;

  const agora = Date.now();

  const tempoDecorrido = (agora - inicioExecucao) / 1000;

  let totalExecucoes = 0;

  filaProducao.forEach((item) => {
    totalExecucoes += Number(item.quantidade) || 0;
  });

  const execucoesAnteriores = filaProducao
    .slice(0, indiceFila)
    .reduce((total, item) => total + Number(item.quantidade), 0);

  const executadas = execucoesAnteriores + repeticaoAtual;

  document.getElementById("tempoRestante").innerText = "Tempo restante: 00:00";

  if (executadas === 0) {
    document.getElementById("tempoRestante").innerText =
      "Tempo restante: calculando...";
    return;
  }

  const mediaPorExecucao = tempoDecorrido / executadas;

  const restantes = totalExecucoes - executadas;

  const segundosRestantes = Math.round(mediaPorExecucao * restantes);

  const minutos = Math.floor(segundosRestantes / 60);

  const segundos = segundosRestantes % 60;

  document.getElementById("tempoRestante").innerText =
    `Tempo restante estimado: ${String(minutos).padStart(
      2,
      "0",
    )}:${String(segundos).padStart(2, "0")}`;
}
function calcularTempoProducao() {
  if (!inicioProducao) {
    return "00:00";
  }

  fimProducao = Date.now();

  const tempoTotalSegundos = Math.max(
    0,
    Math.round((fimProducao - inicioProducao) / 1000),
  );

  const minutos = Math.floor(tempoTotalSegundos / 60);

  const segundos = tempoTotalSegundos % 60;

  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(
    2,
    "0",
  )}`;
}

async function registrarProducaoFinalizada() {
  const tempoFormatado = calcularTempoProducao();

  const historico = JSON.parse(localStorage.getItem("historicoProducao")) || [];

  const agora = new Date();

  for (const item of filaProducao) {
    let programaCompleto = null;

    try {
      if (window.carregarProgramaFirebase) {
        programaCompleto = await window.carregarProgramaFirebase(item.programa);
      }
    } catch (erro) {
      console.error("Erro ao carregar programa para o histórico:", erro);
    }

    const registroHistorico = {
      data: agora.toLocaleDateString("pt-BR"),

      hora: agora.toLocaleTimeString("pt-BR"),

      programa: programaCompleto?.nome || item.programa,

      chavePrograma: item.programa,

      quantidade: Number(item.quantidade),

      tempo: tempoFormatado,

      producaoId: `${producaoId || inicioProducao}-${filaProducao.indexOf(item)}`,
      simulacao: true,
      inicioTimestamp: inicioProducao,
      fimTimestamp: Date.now(),

      status: "Concluído",

      unidade: programaCompleto?.unidade || "mm",

      versaoFormato: programaCompleto?.versaoFormato || 2,

      pontos: programaCompleto?.pontos || [],
    };

    /* mantém o histórico local por enquanto */
    historico.push(registroHistorico);

    /* salva também no Firebase */
    if (window.salvarHistoricoProducaoFirebase) {
      try {
        await window.salvarHistoricoProducaoFirebase(registroHistorico);
      } catch (erro) {
        throw erro;
      }
    }
  }

  localStorage.setItem("historicoProducao", JSON.stringify(historico));

  localStorage.setItem("historicoJaSalvo", "true");

  if (window.salvarProducaoDiaFirebase) {
    await window.salvarProducaoDiaFirebase(filaProducao, tempoFormatado);
  }

  return tempoFormatado;
}

async function finalizarProducao() {
  if (finalizacaoEmAndamento) {
    return;
  }

  finalizacaoEmAndamento = true;
  definirIndutorSoldando(false);
  encerrarSoldaNoProximoQuadro = false;
  pararControleManual();
  executandoPrograma = false;
  programaPausado = false;
  girando = false;

  document.getElementById("statusPrograma").innerText = "Produção concluída.";

  document.getElementById("barraProgresso").style.width = "100%";

  document.getElementById("textoProgresso").innerText = "100%";

  document.getElementById("programaAtualExecucao").innerText =
    "Todos os programas executados";

  document.getElementById("execucaoAtual").innerText = "Execução finalizada";

  document.getElementById("tempoRestante").innerText = "Tempo restante: 00:00";

  document.getElementById("statusMesa").innerText = "PARADA";

  try {
    if (!localStorage.getItem("historicoJaSalvo")) {
      await registrarProducaoFinalizada();
    }

    /*
A produção só é removida do Firebase
depois que o histórico foi salvo
com sucesso.
*/

    if (window.removerProducaoAtualFirebase) {
      await window.removerProducaoAtualFirebase();
    }

    localStorage.removeItem("filaProducao");

    console.log("Produção registrada com sucesso.");
  } catch (erro) {
    console.error("Erro ao finalizar produção:", erro);

    document.getElementById("statusPrograma").innerText =
      "Produção concluída, mas ocorreu um erro ao salvar o histórico.";
  }
}
/* =====================================
CONTROLE MANUAL — MODO ENSINO
===================================== */

const teclasPressionadas = {
  ArrowUp: false,
  ArrowDown: false,
};

let jogRealTecladoDirecao = 0;

/*
Espelha teclasPressionadas no jog da
máquina real (mesma via usada pelos
botões, window.SoldaTouchIntegracaoFisica).
Só age quando maquinaRealAtiva(); em
simulação o comportamento por quadro
em animate() continua igual.
*/
function sincronizarJogTecladoReal() {
  if (!maquinaRealAtiva()) {
    jogRealTecladoDirecao = 0;
    return;
  }

  const direcao =
    (teclasPressionadas.ArrowUp ? 1 : 0) -
    (teclasPressionadas.ArrowDown ? 1 : 0);

  if (direcao === jogRealTecladoDirecao) {
    return;
  }

  if (jogRealTecladoDirecao !== 0) {
    window.SoldaTouchIntegracaoFisica?.pararMovimentoManual();
  }

  if (direcao !== 0) {
    window.SoldaTouchIntegracaoFisica?.iniciarMovimentoManual(
      direcao > 0 ? "CIMA" : "BAIXO",
    );
  }

  jogRealTecladoDirecao = direcao;
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();

    if (!executandoPrograma) {
      teclasPressionadas.ArrowUp = true;
      sincronizarJogTecladoReal();
    }
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();

    if (!executandoPrograma) {
      teclasPressionadas.ArrowDown = true;
      sincronizarJogTecladoReal();
    }
  }

  if ((event.key === "g" || event.key === "G") && !executandoPrograma) {
    event.preventDefault();
    salvarPonto();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp") {
    teclasPressionadas.ArrowUp = false;
    sincronizarJogTecladoReal();
  }

  if (event.key === "ArrowDown") {
    teclasPressionadas.ArrowDown = false;
    sincronizarJogTecladoReal();
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    console.group("POSIÇÃO DO CABEÇOTE");

    console.log("Tecla:", event.key);

    console.log("Posição visual X:", conjuntoMovel.position.x);

    console.log("Posição visual completa:", {
      x: conjuntoMovel.position.x,
      y: conjuntoMovel.position.y,
      z: conjuntoMovel.position.z,
    });

    console.groupEnd();
  }
});

function pararControleManual() {
  teclasPressionadas.ArrowUp = false;
  teclasPressionadas.ArrowDown = false;
  sincronizarJogTecladoReal();
  pararMovimentoContinuo();
}

function interromperInteracoesVisuais() {
  pararControleManual();
  definirIndutorSoldando(false);
  encerrarSoldaNoProximoQuadro = false;
}

window.addEventListener("blur", interromperInteracoesVisuais);
window.addEventListener("error", interromperInteracoesVisuais);
window.addEventListener("unhandledrejection", interromperInteracoesVisuais);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    interromperInteracoesVisuais();
  }
});
//
async function enviarPontoParaMaquina(ponto, indice) {
  const zMm = Number(ponto.zMm);

  if (!Number.isFinite(zMm)) {
    console.error(`P${indice + 1} possui Z inválido.`, ponto);

    return false;
  }

  const anguloMesaGraus = Number(ponto.anguloMesaGraus) || 0;

  console.log(`Enviando P${indice + 1} para a máquina:`, {
    zMm,
    anguloMesaGraus,
  });

  const enviado = await solicitarComandoMaquina(
    "MOVER_PONTO",
    {
      ponto: indice + 1,
      zMm: Number(zMm.toFixed(2)),
      anguloMesaGraus: Number(anguloMesaGraus.toFixed(2)),
    },
    {
      aguardarConfirmacao: true,
      tiposSucesso: ["PONTO_ATINGIDO"],
    },
  );

  if (!enviado) {
    console.warn(`P${indice + 1} não foi enviado para a máquina.`);

    return false;
  }

  return true;
}

function animate() {
  requestAnimationFrame(animate);

  const deltaSegundos = Math.min(relogioAnimacao.getDelta(), 0.05);

  controls.update();

  if (encerrarSoldaNoProximoQuadro) {
    definirIndutorSoldando(false);
    encerrarSoldaNoProximoQuadro = false;
  }

  if (
    indutorSoldando &&
    (!executandoPrograma ||
      programaPausado ||
      estadoExecucao !== EstadoExecucao.EXECUTANDO)
  ) {
    definirIndutorSoldando(false);
  }

  /* ==========================
  MOVIMENTO MANUAL
  ========================== */

  if (!executandoPrograma) {
    let direcao = 0;

    if (teclasPressionadas.ArrowUp) {
      direcao += 1;
    }

    if (teclasPressionadas.ArrowDown) {
      direcao -= 1;
    }

    if (direcao !== 0) {
      if (MODO_CALIBRACAO) {
        const deslocamentoVisual =
          direcao * VELOCIDADE_CALIBRACAO_X * deltaSegundos;

        conjuntoMovel.position.x = THREE.MathUtils.clamp(
          conjuntoMovel.position.x + deslocamentoVisual,

          LIMITE_TESTE_X_MIN,
          LIMITE_TESTE_X_MAX,
        );
      } else {
        /*
        Anima por estimativa (mesma lógica
        da simulação). Enquanto não houver
        encoder cabeado, é o melhor feedback
        visual disponível; quando a posição
        real chegar via STATUS, aplicarPosicaoZReal
        corrige/sobrescreve essa estimativa.
        */
        const deslocamentoMm = direcao * VELOCIDADE_JOG_MM_S * deltaSegundos;

        definirPosicaoZMm(estadoMaquina.posicaoZMm + deslocamentoMm);
      }
    }
  }

  /* ==========================
  MOVIMENTO CONTÍNUO DA MESA
  ========================== */

  /*
  Só gira livre fora da execução automática -
  durante um programa, o ponto a ponto abaixo
  controla o ângulo da mesa diretamente.
  */
  if (girando && mesaReal && !executandoPrograma) {
    const velocidadeRadS = THREE.MathUtils.degToRad(VELOCIDADE_MESA_GRAUS_S);

    mesaReal.rotation.z += SENTIDO_ROTACAO_MESA * velocidadeRadS * deltaSegundos;

    /*
    Mostra o ângulo girando ao vivo na tela -
    prova visual direta de que está girando de
    verdade, sem depender de olhar pro disco (que
    pode parecer parado por ser uma peça simétrica).
    */
    atualizarStatusMesa(`GIRANDO (${obterAnguloMesaGraus().toFixed(1)}°)`);
  }

  /* ==========================
  EXECUÇÃO AUTOMÁTICA
  ========================== */

  if (executandoPrograma && !programaPausado && !maquinaRealAtiva()) {
    const pontoAtual = pontos[indicePontoAtual];

    /*
    Se não existe mais ponto,
    a peça terminou.
    */

    if (!pontoAtual) {
      if (modoReproducaoSimples) {
        finalizarOuReiniciarReproducaoSimples();
      } else {
        void concluirProgramaAtual();
      }
    } else {
      /*
      ==========================
      ENVIO DO PONTO
      ==========================

      O ponto é enviado somente
      uma vez enquanto estivermos
      trabalhando nele.
      */

      if (indiceUltimoPontoEnviadoMaquina !== indicePontoAtual) {
        indiceUltimoPontoEnviadoMaquina = indicePontoAtual;

        void enviarPontoParaMaquina(pontoAtual, indicePontoAtual);
      }

      /*
      ==========================
      DESTINO DO CABEÇOTE
      ==========================
      */

      const destinoZ = Number(pontoAtual.zMm);

      /*
      ==========================
      VALIDAÇÃO
      ==========================
      */

      if (!Number.isFinite(destinoZ)) {
        console.error("Ponto com coordenada Z inválida:", pontoAtual);

        /*
        Se existe erro de ponto,
        interrompemos o movimento
        e colocamos a máquina
        em condição pausada.
        */

        definirIndutorSoldando(false);
        encerrarSoldaNoProximoQuadro = false;
        executandoPrograma = false;

        programaPausado = true;

        estadoExecucao = EstadoExecucao.PAUSADO;

        void pararMesaAutomatica();

        const statusPrograma = document.getElementById("statusPrograma");

        if (statusPrograma) {
          statusPrograma.innerText = `Erro na coordenada de P${
            indicePontoAtual + 1
          }.`;
        }
      } else {
        /*
        ==========================
        MOVIMENTO DO CABEÇOTE
        ==========================
        */

        const diferencaZ = destinoZ - estadoMaquina.posicaoZMm;

        const chegouZ = Math.abs(diferencaZ) <= TOLERANCIA_Z_MM;

        if (!chegouZ) {
          const deslocamentoMaximo = VELOCIDADE_PROGRAMA_MM_S * deltaSegundos;

          const deslocamentoZ =
            Math.sign(diferencaZ) *
            Math.min(Math.abs(diferencaZ), deslocamentoMaximo);

          definirPosicaoZMm(estadoMaquina.posicaoZMm + deslocamentoZ);
        } else {
          definirPosicaoZMm(destinoZ);
        }

        /*
        ==========================
        ESTADO DA MESA
        ==========================

        Ponto a ponto (teach-and-repeat):
        a mesa vai até o ÂNGULO salvo
        naquele ponto e para lá, igual
        ao cabeçote faz com o Z. Só avança
        pro próximo ponto quando os dois
        (Z e ângulo) chegarem.
        */

        const anguloDestino = Number(pontoAtual.anguloMesaGraus) || 0;
        const anguloAtual = obterAnguloMesaGraus();
        const diferencaAngulo = diferencaAngularCurta(anguloDestino, anguloAtual);
        const chegouMesa = Math.abs(diferencaAngulo) <= TOLERANCIA_MESA_GRAUS;

        if (!chegouMesa) {
          const deslocamentoMaximoGraus =
            VELOCIDADE_MESA_PROGRAMA_GRAUS_S * deltaSegundos;

          const deslocamentoAngulo =
            Math.sign(diferencaAngulo) *
            Math.min(Math.abs(diferencaAngulo), deslocamentoMaximoGraus);

          definirAnguloMesaGraus(anguloAtual + deslocamentoAngulo);
        } else {
          definirAnguloMesaGraus(anguloDestino);
        }

        atualizarStatusMesa(chegouMesa ? "PARADA" : "GIRANDO");

        /*
        ==========================
        INFORMAÇÕES DA EXECUÇÃO
        ==========================
        */

        const execucaoAtual = document.getElementById("execucaoAtual");

        if (execucaoAtual) {
          execucaoAtual.innerText = `P${indicePontoAtual + 1}/${
            pontos.length
          } | Z: ${destinoZ.toFixed(2)} mm | Mesa: ${anguloDestino.toFixed(1)}°${
            chegouMesa ? "" : " (girando)"
          }`;
        }

        /*
        ==========================
        PONTO ALCANÇADO
        ==========================

        O ponto só é considerado
        alcançado quando Z E o
        ângulo da mesa chegam ao
        valor salvo.
        */

        if (chegouZ && chegouMesa) {
          definirPosicaoZMm(destinoZ);
          definirAnguloMesaGraus(anguloDestino);

          /*
          Efeito visual de solda.
          */

          if (pontoAtual.solda?.ativar) {
            definirIndutorSoldando(true);
            encerrarSoldaNoProximoQuadro = true;
          } else {
            definirIndutorSoldando(false);
          }

          console.log(`P${indicePontoAtual + 1} alcançado`, {
            zMm: estadoMaquina.posicaoZMm,

            anguloMesaGraus: anguloDestino,
          });

          /*
          Vai para o próximo
          ponto do programa.
          */

          indicePontoAtual++;
          if (!modoReproducaoSimples) {
            void salvarEstadoExecucaoFirebase("EXECUTANDO");
            atualizarBarraProgresso();
            atualizarTempoRestante();
          }

          /*
          ==========================
          FIM DOS PONTOS
          ==========================
          */

          if (indicePontoAtual >= pontos.length) {
            if (modoReproducaoSimples) {
              finalizarOuReiniciarReproducaoSimples();
            } else {
              void concluirProgramaAtual();
            }
          } else {
            const statusPrograma = document.getElementById("statusPrograma");

            if (statusPrograma) {
              statusPrograma.innerText = `Movendo para P${
                indicePontoAtual + 1
              }...`;
            }
          }
        }
      }
    }
  }

  renderer.render(scene, camera);
}
/* =====================================
SALVAR E CARREGAR PROGRAMA
===================================== */

async function salvarPrograma() {
  if (pontos.length === 0) {
    alert("Nenhum ponto salvo!");
    return;
  }

  const nomeDigitado = prompt("Digite o nome do programa:");

  const nome = nomeDigitado?.trim();

  if (!nome) {
    alert("Digite um nome válido para o programa.");

    return;
  }
  const programa = {
    nome: nome,

    dataCriacao: new Date().toISOString(),

    dataExibicao: new Date().toLocaleString("pt-BR"),

    versaoFormato: 3,

    unidade: "mm",

    eixos: {
      alturaZ: "mm",
      mesa: "graus",
    },

    limites: {
      zMinMm: Z_MIN_MM,
      zMaxMm: Z_MAX_MM,
      mesaMinGraus: 0,
      mesaMaxGraus: 360,
    },

    totalPontos: pontos.length,

    pontos: pontos.map((ponto, index) => ({
      id: ponto.id,

      ordem: index + 1,

      zMm: Number(ponto.zMm),

      anguloMesaGraus: Number(ponto.anguloMesaGraus),

      solda: {
        ativar: Boolean(ponto.solda?.ativar),
      },
    })),
  };

  if (!window.salvarProgramaFirebase) {
    alert("Firebase não carregou.");
    return;
  }

  try {
    const chavePrograma = await window.salvarProgramaFirebase(nome, programa);

    localStorage.setItem("programaAtual", chavePrograma);

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = `Programa "${nome}" salvo com sucesso!`;
    }
  } catch (erro) {
    console.error("Erro ao salvar programa:", erro);

    alert(`Não foi possível salvar o programa: ${erro.message || erro}`);
  }
}
async function carregarProgramaFila(
  nomePrograma,
  iniciarAutomaticamente = true,
) {
  if (!window.carregarProgramaFirebase) {
    console.error("Função carregarProgramaFirebase não está disponível.");

    return;
  }

  try {
    const programa = await window.carregarProgramaFirebase(nomePrograma);

    if (!programa) {
      console.error("Programa da fila não encontrado:", nomePrograma);

      return;
    }

    const pontosCarregados = prepararPontosDoPrograma(programa);

    if (pontosCarregados === null || pontosCarregados.length === 0) {
      document.getElementById("statusPrograma").innerText =
        "Programa inválido ou sem pontos.";

      return;
    }

    pontos = pontosCarregados;

    atualizarLista();

    indicePontoAtual = 0;
    executandoPrograma = false;

    document.getElementById("programaAtualExecucao").innerText =
      `Programa: ${programa.nome}`;

    if (iniciarAutomaticamente) {
      iniciarExecucaoPrograma();
    }
  } catch (erro) {
    console.error("Erro ao carregar programa da fila:", erro);

    document.getElementById("statusPrograma").innerText =
      "Erro ao carregar programa da fila.";
  }
}

function prepararPontosDoPrograma(programa) {
  if (!programa || !programa.pontos) {
    return [];
  }

  const pontosOriginais = Array.isArray(programa.pontos)
    ? [...programa.pontos]
    : Object.values(programa.pontos);

  if (pontosOriginais.length === 0) {
    return [];
  }

  if (Number(programa.versaoFormato) !== 3) {
    alert(
      `O programa "${programa.nome || "sem nome"}" está em um formato antigo e não possui as coordenadas completas da mesa.`,
    );

    return null;
  }

  const pontosOrdenados = pontosOriginais.sort((pontoA, pontoB) => {
    return Number(pontoA.ordem) - Number(pontoB.ordem);
  });

  const pontosPreparados = [];

  for (let index = 0; index < pontosOrdenados.length; index++) {
    const ponto = pontosOrdenados[index];

    const zMm = Number(ponto.zMm);

    const anguloMesaGraus = Number(ponto.anguloMesaGraus);

    if (!Number.isFinite(zMm)) {
      alert(`O ponto P${index + 1} possui uma altura inválida.`);

      return null;
    }

    if (zMm < Z_MIN_MM || zMm > Z_MAX_MM) {
      alert(`O ponto P${index + 1} possui altura fora dos limites: ${zMm} mm.`);

      return null;
    }

    if (!Number.isFinite(anguloMesaGraus)) {
      alert(`O ponto P${index + 1} não possui um ângulo válido para a mesa.`);

      return null;
    }

    pontosPreparados.push({
      id: ponto.id || `ponto-carregado-${index + 1}`,

      ordem: index + 1,

      zMm: Number(zMm.toFixed(2)),

      anguloMesaGraus: Number(
        normalizarAnguloGraus(anguloMesaGraus).toFixed(2),
      ),

      solda: {
        ativar: Boolean(ponto.solda?.ativar),
      },
    });
  }

  return pontosPreparados;
}

async function carregarProgramaParaExecucao() {
  const chavePrograma = localStorage.getItem("programaAtual");

  if (!chavePrograma) {
    return;
  }

  if (!window.carregarProgramaFirebase) {
    console.error("Firebase de programas ainda não foi carregado.");

    return;
  }

  try {
    const programa = await window.carregarProgramaFirebase(chavePrograma);

    if (!programa) {
      alert("O programa selecionado não foi encontrado.");

      return;
    }

    const pontosCarregados = prepararPontosDoPrograma(programa);

    if (pontosCarregados === null || pontosCarregados.length === 0) {
      return;
    }

    pontos = pontosCarregados;

    indicePontoAtual = 0;

    executandoPrograma = false;

    programaPausado = false;

    girando = false;

    atualizarLista();

    const programaAtual = document.getElementById("programaAtualExecucao");

    if (programaAtual) {
      programaAtual.innerText = `Programa: ${programa.nome}`;
    }

    const execucaoAtual = document.getElementById("execucaoAtual");

    if (execucaoAtual) {
      execucaoAtual.innerText = `Preparando P1 de ${pontos.length}`;
    }

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = `Programa "${programa.nome}" carregado. Aperte "INICIAR REPRODUÇÃO" quando quiser começar.`;
    }

    // Impede que atualizar a página
    // carregue de novo sozinho.
    localStorage.removeItem("modoPrograma");

    /*
    NÃO inicia sozinho mais - o operador
    decide quando apertando "INICIAR
    REPRODUÇÃO" (escolhendo sequencial ou
    singular na hora).
    */
  } catch (erro) {
    console.error("Erro ao carregar programa para execução:", erro);

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = "Erro ao carregar o programa.";
    }
  }
}

async function carregarPrograma() {
  const nome = localStorage.getItem("programaAtual");

  if (!nome) {
    return;
  }

  if (!window.carregarProgramaFirebase) {
    console.warn("Função carregarProgramaFirebase não encontrada.");

    return;
  }

  try {
    const programa = await window.carregarProgramaFirebase(nome);

    if (!programa) {
      return;
    }

    const pontosCarregados = prepararPontosDoPrograma(programa);

    if (pontosCarregados === null) {
      return;
    }

    pontos = pontosCarregados;

    executandoPrograma = false;
    programaPausado = false;
    indicePontoAtual = 0;

    atualizarLista();

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = `Programa "${programa.nome}" carregado para edição`;
    }
  } catch (erro) {
    console.error("Erro ao carregar programa:", erro);

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = "Erro ao carregar o programa.";
    }
  }
}
function mostrarBotaoIniciarCiclo() {
  const botao = document.getElementById("btnIniciarCiclo");

  if (botao) {
    botao.style.display = "block";

    botao.disabled = false;
  }
}

function esconderBotaoIniciarCiclo() {
  const botao = document.getElementById("btnIniciarCiclo");

  if (botao) {
    botao.style.display = "none";

    botao.disabled = true;
  }
}

let inicioCicloPendente = false;
let producaoId = null;
let gravacaoProducao = Promise.resolve();
let conclusaoPecaPendente = false;

async function confirmarInicioCiclo() {
  if (inicioCicloPendente || estadoExecucao !== EstadoExecucao.AGUARDANDO_INICIO) {
    return;
  }

  esconderBotaoIniciarCiclo();

  /*
  Agora sim o operador autorizou
  o primeiro movimento.
  */

  inicioCicloPendente = true;
  try {
    await iniciarExecucaoPrograma(true);
  } finally {
    inicioCicloPendente = false;
  }
}

document
  .getElementById("btnIniciarCiclo")
  ?.addEventListener("click", confirmarInicioCiclo);

/*
=====================================
REPRODUÇÃO SIMPLES (PLAY) - SEQUENCIAL/SINGULAR
=====================================

Fluxo independente do sistema de produção
em fila (quantidades/Firebase, usado pelas
telas de iniciar-produção) - só reproduz os
pontos carregados/salvos nesta tela, do jeito
mais direto possível. Usado pelo botão
"INICIAR REPRODUÇÃO".
*/

let modoReproducaoSimples = false;
let modoExecucaoAtual = null; // 'SEQUENCIAL' | 'SINGULAR'

function escolherModoReproducao() {
  const modal = document.getElementById("modalModoReproducao");

  return new Promise((resolve) => {
    if (!modal) {
      resolve("SINGULAR");
      return;
    }

    const botaoSequencial = document.getElementById("btnModoSequencial");
    const botaoSingular = document.getElementById("btnModoSingular");
    const botaoCancelar = document.getElementById(
      "btnCancelarModoReproducao",
    );

    function finalizar(modo) {
      modal.style.display = "none";
      botaoSequencial?.removeEventListener("click", aoSequencial);
      botaoSingular?.removeEventListener("click", aoSingular);
      botaoCancelar?.removeEventListener("click", aoCancelar);
      resolve(modo);
    }

    function aoSequencial() {
      finalizar("SEQUENCIAL");
    }

    function aoSingular() {
      finalizar("SINGULAR");
    }

    function aoCancelar() {
      finalizar(null);
    }

    botaoSequencial?.addEventListener("click", aoSequencial);
    botaoSingular?.addEventListener("click", aoSingular);
    botaoCancelar?.addEventListener("click", aoCancelar);

    modal.style.display = "flex";
  });
}

function finalizarOuReiniciarReproducaoSimples() {
  if (modoExecucaoAtual === "SEQUENCIAL") {
    /*
    Volta pro primeiro ponto e
    continua executando.
    */
    indicePontoAtual = 0;
    indiceUltimoPontoEnviadoMaquina = -1;

    const statusProgramaSeq = document.getElementById("statusPrograma");

    if (statusProgramaSeq) {
      statusProgramaSeq.innerText = "Reiniciando do P1 (modo sequencial)...";
    }

    return;
  }

  /*
  SINGULAR: para tudo e aguarda
  um novo clique em INICIAR REPRODUÇÃO.
  */
  executandoPrograma = false;
  programaPausado = true;
  estadoExecucao = EstadoExecucao.FINALIZADO;
  girando = false;
  modoReproducaoSimples = false;
  modoExecucaoAtual = null;
  indicePontoAtual = 0;
  indiceUltimoPontoEnviadoMaquina = -1;

  definirIndutorSoldando(false);
  encerrarSoldaNoProximoQuadro = false;
  atualizarStatusMesa("PARADA");
  atualizarIndicadorPosicao();

  const statusProgramaFim = document.getElementById("statusPrograma");

  if (statusProgramaFim) {
    statusProgramaFim.innerText = "Reprodução concluída (modo singular).";
  }

  const execucaoAtualFim = document.getElementById("execucaoAtual");

  if (execucaoAtualFim) {
    execucaoAtualFim.innerText = "";
  }

  const botaoPausaFim = document.getElementById("btnPlayPause");

  if (botaoPausaFim) {
    botaoPausaFim.disabled = true;
    botaoPausaFim.innerText = "Pausar execução";
  }

  const botaoIniciarFim = document.getElementById("btnIniciarReproducao");

  if (botaoIniciarFim) {
    botaoIniciarFim.disabled = false;
  }
}

async function iniciarReproducaoSimples(modoSolicitado = null) {
  if (estadoExecucao === EstadoExecucao.EMERGENCIA) return;
  if (maquinaRealAtiva()) { informarBloqueioAutomatico(); return; }
  if (executandoPrograma) {
    alert("Já existe uma reprodução em andamento.");
    return;
  }

  if (pontos.length === 0) {
    alert("Nenhum ponto salvo/carregado ainda.");
    return;
  }

  if (!mesaReal) {
    alert("A mesa giratória ainda não foi carregada.");
    return;
  }

  const modo = modoSolicitado === "SINGULAR" ? "SINGULAR" : await escolherModoReproducao();

  if (!modo || maquinaRealAtiva() || executandoPrograma || estadoExecucao === EstadoExecucao.EMERGENCIA) {
    return;
  }

  const botaoIniciar = document.getElementById("btnIniciarReproducao");

  if (botaoIniciar) {
    botaoIniciar.disabled = true;
  }

  modoReproducaoSimples = true;
  modoExecucaoAtual = modo;

  pararControleManual();
  definirIndutorSoldando(false);
  encerrarSoldaNoProximoQuadro = false;

  indicePontoAtual = 0;
  indiceUltimoPontoEnviadoMaquina = -1;
  girando = false;
  atualizarStatusMesa("PARADA");

  const statusPrograma = document.getElementById("statusPrograma");

  if (statusPrograma) {
    statusPrograma.innerText = `Iniciando reprodução (${
      modo === "SEQUENCIAL" ? "sequencial" : "singular"
    })...`;
  }

  const botaoPausa = document.getElementById("btnPlayPause");

  if (botaoPausa) {
    botaoPausa.disabled = false;
    botaoPausa.innerText = "Pausar execução";
  }

  estadoExecucao = EstadoExecucao.EXECUTANDO;
  programaPausado = false;
  executandoPrograma = true;

  atualizarIndicadorPosicao();
}

// Entrada da câmera local: reutiliza o motor virtual sem publicar comandos MQTT.
window.controlarSimulacaoPorGesto = async function (gesto) {
  if (maquinaRealAtiva()) throw new Error('Controle por gesto bloqueado no modo físico.');
  if (estadoExecucao === EstadoExecucao.EMERGENCIA || producaoCancelada)
    throw new Error('Execução interrompida. Libere manualmente antes de iniciar novamente.');
  if (gesto === 'START') {
    if (executandoPrograma) throw new Error('Já existe uma execução. Use os controles manuais para retomar uma pausa.');
    if (inicioReproducaoPendente) throw new Error('Seleção de reprodução em andamento.');
    if (!pontos.length || pontos.some(p => !Number.isFinite(p.zMm) || !Number.isFinite(p.anguloMesaGraus)))
      throw new Error('Nenhum programa válido carregado. Configure ou carregue os pontos.');
    if (!mesaReal || !conjuntoMovel) throw new Error('Modelo 3D ainda não está pronto.');
    if (window.acompanharSimulador) throw new Error('Volte à edição local antes de iniciar a reprodução 3D.');
    if (typeof filaProducao !== 'undefined' && filaProducao.length) {
      if (estadoExecucao !== EstadoExecucao.AGUARDANDO_INICIO) throw new Error('Produção não está aguardando início.');
      await confirmarInicioCiclo();
    } else {
      await iniciarReproducaoSimples('SINGULAR');
    }
    if (!executandoPrograma) throw new Error('A reprodução não pôde iniciar.');
  } else if (gesto === 'PAUSA') {
    if (!executandoPrograma || programaPausado)
      throw new Error('Não existe reprodução virtual em andamento para pausar.');
    if (modoReproducaoSimples) alternarMovimentoReproducaoSimples();
    else await alternarMovimento();
  } else throw new Error('Gesto desconhecido.');
  const mensagem = gesto === 'START' ? 'EXECUTANDO — reprodução virtual iniciada por gesto.' : 'PAUSADO — reprodução virtual pausada por gesto.';
  document.getElementById('statusPrograma').textContent = mensagem;
  return { estado: estadoExecucao, mensagem };
};
let inicioReproducaoPendente = false;
window.addEventListener('soldatouch:maquina-evento', event => {
  const dados = event.detail?.dados;
  if (dados?.emergencia !== true && dados?.estado !== 'EMERGENCIA') return;
  if (executandoPrograma && modoReproducaoSimples && !programaPausado)
    alternarMovimentoReproducaoSimples();
  estadoExecucao = EstadoExecucao.EMERGENCIA;
  document.getElementById('statusPrograma').textContent = 'EMERGENCIA — reprodução bloqueada. Reinicialização manual necessária.';
});

document
  .getElementById("btnIniciarReproducao")
  ?.addEventListener("click", () => {
    if (inicioReproducaoPendente) return;
    inicioReproducaoPendente = true;
    void iniciarReproducaoSimples().finally(() => { inicioReproducaoPendente = false; });
  });

function informarBloqueioAutomatico() {
  const status = document.getElementById("statusPrograma");
  if (status) status.innerText = "Execução física automática bloqueada: posicionamento e soldagem não homologados. Use o modo simulação.";
}

async function iniciarExecucaoPrograma(usarContagemInicial = true) {
  if (executandoPrograma || producaoCancelada || estadoExecucao === EstadoExecucao.EMERGENCIA) return;
  const item = filaProducao[indiceFila];
  if (!item || !Number.isSafeInteger(Number(item.quantidade)) || Number(item.quantidade) < 1) return;
  inicioProducao ||= Date.now();
  inicioExecucao ||= inicioProducao;
  modoReproducaoSimples = false;
  if (maquinaRealAtiva()) { informarBloqueioAutomatico(); return; }
  /*
  =============================
  VALIDAR PROGRAMA
  =============================
  */

  if (pontos.length === 0) {
    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = "O programa não possui pontos.";
    }

    return;
  }

  /*
  =============================
  VALIDAR MESA
  =============================
  */

  if (!mesaReal) {
    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = "A mesa giratória não foi encontrada.";
    }

    return;
  }

  pararControleManual();
  definirIndutorSoldando(false);
  encerrarSoldaNoProximoQuadro = false;

  /*
  =============================
  ESTADO PREPARANDO
  =============================
  */

  executandoPrograma = true;

  programaPausado = true;

  estadoExecucao = EstadoExecucao.PREPARANDO;

  atualizarIndicadorPosicao();

  indicePontoAtual = 0;

  indiceUltimoPontoEnviadoMaquina = -1;

  const botaoPausa = document.getElementById("btnPlayPause");

  const statusPrograma = document.getElementById("statusPrograma");

  const execucaoAtual = document.getElementById("execucaoAtual");

  if (botaoPausa) {
    botaoPausa.disabled = true;

    botaoPausa.innerText = "Preparando...";
  }

  if (execucaoAtual) {
    execucaoAtual.innerText = `Preparando P1 de ${pontos.length}`;
  }

  /*
  =============================
  CONTAGEM 3...2...1
  =============================

  É usada na PRIMEIRA peça.

  Nas próximas peças já existe
  a contagem do botão
  PEÇA POSICIONADA.
  */

  if (usarContagemInicial) {
    const contagemConcluida = await executarContagemRegressiva(
      "Iniciando produção",
      true,
    );

    if (!contagemConcluida) {
      return;
    }

    if (estadoExecucao !== EstadoExecucao.PREPARANDO) {
      return;
    }
  }

  /*
  =============================
  MESA - PONTO A PONTO
  =============================

  A execução é ponto a ponto: a mesa
  vai até o ângulo salvo de cada ponto
  (ver loop em animate()), não gira
  continuamente desde o início. Por
  isso não há mais um "aquecimento"
  da mesa aqui - ela começa parada e
  o primeiro ponto já define o ângulo
  inicial.
  */

  girando = false;
  atualizarStatusMesa("PARADA");

  if (estadoExecucao !== EstadoExecucao.PREPARANDO) {
    return;
  }

  /*
  =============================
  COMEÇAR EXECUÇÃO
  =============================
  */

  programaPausado = false;

  estadoExecucao = EstadoExecucao.EXECUTANDO;

  if (botaoPausa) {
    botaoPausa.disabled = false;

    botaoPausa.innerText = "Pausar execução";
  }

  atualizarStatusMesa("GIRANDO");

  if (execucaoAtual) {
    execucaoAtual.innerText = `Executando P1 de ${pontos.length}`;
  }

  if (statusPrograma) {
    statusPrograma.innerText = "Executando programa...";
  }

  await salvarEstadoExecucaoFirebase("EXECUTANDO");
  console.log("Máquina liberada para execução.", {
    estado: estadoExecucao,
    mesa: "GIRANDO",
    pontoInicial: 1,
  });
}

function ocultarElemento(elemento) {
  if (elemento) {
    elemento.style.display = "none";
  }
}

function ocultarControlesProducao() {
  ocultarElemento(document.getElementById("controleZ"));

  ocultarElemento(document.querySelector('button[onclick="girarMesa()"]'));

  ocultarElemento(document.querySelector('button[onclick="salvarPonto()"]'));

  ocultarElemento(document.querySelector('button[onclick="salvarPrograma()"]'));

  ocultarElemento(document.getElementById("listaPontos"));
}
async function iniciarSistema() {
  const programaVisao = new URLSearchParams(location.search).get('programaVisao');
  if (programaVisao) {
    try {
      const programa = await window.carregarProgramaFirebase(programaVisao);
      const preparados = programa && prepararPontosDoPrograma(programa);
      if (!preparados?.length) throw new Error('Programa inválido ou sem pontos.');
      pontos = preparados;
      const quantidade = Number(new URLSearchParams(location.search).get('quantidade') || 1);
      if (!Number.isSafeInteger(quantidade) || quantidade < 1) throw new Error('Quantidade inválida.');
      filaProducao = [{ programa: programaVisao, quantidade }];
      indiceFila = 0; repeticaoAtual = 0;
      inicioProducao = Date.now(); inicioExecucao = inicioProducao;
      producaoId = crypto.randomUUID();
      const anterior = await window.buscarProducaoAtualFirebase();
      if (anterior && ['EXECUTANDO', 'PAUSADO', 'AGUARDANDO_PECA', 'AGUARDANDO_INICIO'].includes(anterior.status)) {
        if (anterior.programa !== programaVisao) throw new Error('Existe outra produção pendente. Abra Produção para recuperá-la.');
        producaoId = anterior.producaoId || producaoId;
        filaProducao = anterior.fila || filaProducao;
        repeticaoAtual = Number(anterior.quantidadeConcluida) || 0;
        indicePontoAtual = Math.max(0, Number(anterior.pontoAtual || 1) - 1);
        inicioProducao = anterior.inicioTimestamp || inicioProducao;
        estadoExecucao = anterior.status === 'AGUARDANDO_INICIO' ? EstadoExecucao.AGUARDANDO_INICIO
          : anterior.status === 'AGUARDANDO_PECA' ? EstadoExecucao.AGUARDANDO_PECA : EstadoExecucao.PAUSADO;
        executandoPrograma = estadoExecucao === EstadoExecucao.PAUSADO;
        programaPausado = executandoPrograma;
        if (executandoPrograma) {
          document.getElementById('btnPlayPause').disabled = false;
          document.getElementById('btnPlayPause').innerText = 'Continuar execução';
        }
        if (estadoExecucao === EstadoExecucao.AGUARDANDO_PECA) mostrarPainelTrocaPeca();
      } else estadoExecucao = EstadoExecucao.AGUARDANDO_INICIO;
      if (estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO) mostrarBotaoIniciarCiclo();
      await salvarEstadoExecucaoFirebase(estadoExecucao, true);
      atualizarLista();
      document.getElementById('statusPrograma').textContent = 'Programa pronto para reprodução virtual por gesto.';
    } catch (erro) {
      document.getElementById('statusPrograma').textContent = `Não foi possível preparar a simulação: ${erro.message || erro}`;
    }
    return;
  }
  recuperarBackupProgramas();

  definirIndutorSoldando(false);
  encerrarSoldaNoProximoQuadro = false;
  pararControleManual();

  finalizacaoEmAndamento = false;

  let filaSalva = localStorage.getItem("filaProducao");

  let producaoSalvaFirebase = null;

  try {
    if (window.buscarProducaoAtualFirebase) {
      producaoSalvaFirebase = await window.buscarProducaoAtualFirebase();
    }
  } catch (erro) {
    console.error("Erro ao verificar produção salva no Firebase:", erro);
  }

  /*
Se a fila não estiver mais
no navegador, tenta recuperar
a fila salva no Firebase.
*/

  if (
    !filaSalva &&
    producaoSalvaFirebase &&
    Array.isArray(producaoSalvaFirebase.fila) &&
    producaoSalvaFirebase.fila.length > 0
  ) {
    filaSalva = JSON.stringify(producaoSalvaFirebase.fila);

    localStorage.setItem("filaProducao", filaSalva);

    console.log("Fila recuperada do Firebase.");
  }

  /*
  =============================
  MODO FILA DE PRODUÇÃO
  =============================
  */

  if (filaSalva) {
    inicioExecucao = Date.now();
    inicioProducao = Date.now();

    ocultarControlesProducao();

    try {
      filaProducao = JSON.parse(filaSalva);

      if (!Array.isArray(filaProducao)) {
        filaProducao = [];
      }
    } catch (erro) {
      console.error("Fila de produção inválida:", erro);

      localStorage.removeItem("filaProducao");

      filaProducao = [];
    }

    /*
    =============================
    BUSCAR PRODUÇÃO ATUAL
    =============================
    */

    let producaoRecuperada = producaoSalvaFirebase;

    /*
    Consideramos produção pendente
    tanto PAUSADO quanto EXECUTANDO.

    Se o navegador fechou enquanto
    estava executando, ao retornar
    sempre volta PAUSADA.
    */

    const existeProducaoPendente =
      producaoRecuperada &&
      (producaoRecuperada.status === "PAUSADO" ||
        producaoRecuperada.status === "EXECUTANDO" ||
        producaoRecuperada.status === "AGUARDANDO_PECA" ||
        producaoRecuperada.status === "AGUARDANDO_INICIO");

    /*
    =============================
    RESTAURAR ESTADO
    =============================
    */

    if (existeProducaoPendente) {
      producaoId = producaoRecuperada.producaoId || crypto.randomUUID();
      indiceFila = Number(producaoRecuperada.indiceFila) || 0;

      repeticaoAtual = Number(producaoRecuperada.quantidadeConcluida) || 0;

      inicioProducao = Number(producaoRecuperada.inicioTimestamp) || Date.now();

      /*
  Se estava esperando troca de peça,
  mantém AGUARDANDO_PECA.

  Se estava EXECUTANDO ou PAUSADO,
  ao reabrir volta PAUSADO.
  */

      let statusRecuperacao;

      if (producaoRecuperada.status === "AGUARDANDO_INICIO") {
        statusRecuperacao = "AGUARDANDO_INICIO";
      } else if (producaoRecuperada.status === "AGUARDANDO_PECA") {
        statusRecuperacao = "AGUARDANDO_PECA";
      } else {
        /*
  Se fechou enquanto estava
  EXECUTANDO ou PAUSADO,
  volta de forma segura PAUSADA.
  */

        statusRecuperacao = "PAUSADO";
      }

      girando = false;

      if (statusRecuperacao === "AGUARDANDO_INICIO") {
        /*
  A produção já foi preparada,
  mas o operador ainda não
  autorizou o primeiro ciclo.
  */

        executandoPrograma = false;

        programaPausado = false;

        estadoExecucao = EstadoExecucao.AGUARDANDO_INICIO;

        aguardandoTrocaPeca = false;
      } else if (statusRecuperacao === "AGUARDANDO_PECA") {
        /*
  Uma peça terminou e estamos
  esperando a próxima.
  */

        executandoPrograma = false;

        programaPausado = false;

        estadoExecucao = EstadoExecucao.AGUARDANDO_PECA;

        aguardandoTrocaPeca = true;
      } else {
        /*
  Produção interrompida no
  meio da execução.
  */

        executandoPrograma = true;

        programaPausado = true;

        pausaIdAtual = producaoRecuperada.pausaIdAtual || null;

        motivoPausaAtual = producaoRecuperada.motivoPausaAtual || null;

        inicioPausaAtual = producaoRecuperada.inicioPausaAtual || null;

        estadoExecucao = EstadoExecucao.PAUSADO;

        aguardandoTrocaPeca = false;
      }

      atualizarStatusMesa("PARADA");

      /*
  Atualiza o Firebase com o
  estado seguro recuperado.
  */

      if (window.salvarProducaoAtualFirebase) {
        try {
          await window.salvarProducaoAtualFirebase({
            ...producaoRecuperada,

            status: statusRecuperacao,
          });

          producaoRecuperada.status = statusRecuperacao;
        } catch (erro) {
          console.error("Erro ao restaurar estado da produção:", erro);
        }
      }
    } else {
      indiceFila = 0;

      repeticaoAtual = 0;

      programaPausado = false;

      executandoPrograma = false;

      estadoExecucao = EstadoExecucao.PARADA;

      aguardandoTrocaPeca = false;
    }

    /*
    =============================
    CARREGAR FILA
    =============================
    */

    if (filaProducao.length > 0) {
      const primeiroItem = filaProducao[0];

      /*
      Se não existe produção salva,
      significa que esta fila está
      começando agora.
      */

      if (!existeProducaoPendente) {
        if (window.salvarProducaoAtualFirebase) {
          try {
            await window.salvarProducaoAtualFirebase({
              programa: primeiroItem.programa,

              quantidadeTotal: Number(primeiroItem.quantidade),

              quantidadeConcluida: 0,

              repeticaoAtual: 1,

              indiceFila: 0,

              totalProgramasFila: filaProducao.length,

              fila: filaProducao,

              status: "AGUARDANDO_INICIO",

              percentual: 0,

              inicioTimestamp: inicioProducao,
            });
          } catch (erro) {
            console.error("Erro ao criar produção atual no Firebase:", erro);
          }
        }
      }

      /*
      Recupera exatamente o programa
      da fila onde a produção parou.
      */

      const itemParaCarregar = filaProducao[indiceFila];

      if (itemParaCarregar) {
        /*
        Produção nova:
        carrega e inicia.

        Produção recuperada:
        apenas carrega.
        */

        await carregarProgramaFila(itemParaCarregar.programa, false);

        /*
        =============================
        PRODUÇÃO RECUPERADA
        =============================
        */

        /*
=============================
NOVA PRODUÇÃO
=============================
*/

        if (!existeProducaoPendente) {
          // A máquina inicia completamente parada.
          executandoPrograma = false;
          programaPausado = false;
          girando = false;

          estadoExecucao = EstadoExecucao.AGUARDANDO_INICIO;

          aguardandoTrocaPeca = false;

          // Garante que a mesa esteja parada.
          await pararMesaAutomatica();

          // Coloca o cabeçote na posição inicial superior.
          await retornarCabecoteParaPosicaoInicial();

          atualizarStatusMesa("PARADA");

          // Mostra a confirmação para o operador.
          mostrarBotaoIniciarCiclo();

          const statusPrograma = document.getElementById("statusPrograma");

          if (statusPrograma) {
            statusPrograma.innerText =
              "Produção preparada. Confirme para iniciar o ciclo.";
          }

          const execucaoAtual = document.getElementById("execucaoAtual");

          if (execucaoAtual) {
            execucaoAtual.innerText = "Aguardando autorização do operador";
          }

          const botaoPausa = document.getElementById("btnPlayPause");

          if (botaoPausa) {
            botaoPausa.disabled = true;
            botaoPausa.innerText = "Pausar execução";
          }
        }

        if (existeProducaoPendente) {
          girando = false;

          /*
  =============================
  RECUPERAR TIPO DE ESTADO
  =============================
  */

          if (producaoRecuperada.status === "AGUARDANDO_INICIO") {
            /*
  Produção já preparada,
  mas ainda sem autorização
  do operador.
  */

            executandoPrograma = false;

            programaPausado = false;

            estadoExecucao = EstadoExecucao.AGUARDANDO_INICIO;

            aguardandoTrocaPeca = false;

            girando = false;

            atualizarStatusMesa("PARADA");

            esconderPainelTrocaPeca();

            mostrarBotaoIniciarCiclo();
          } else if (producaoRecuperada.status === "AGUARDANDO_PECA") {
            /*
  Uma peça já terminou
  e estamos esperando
  a próxima.
  */

            executandoPrograma = false;

            programaPausado = false;

            estadoExecucao = EstadoExecucao.AGUARDANDO_PECA;

            aguardandoTrocaPeca = true;

            girando = false;

            atualizarStatusMesa("PARADA");

            esconderBotaoIniciarCiclo();

            mostrarPainelTrocaPeca();
          } else {
            /*
  Se estava PAUSADO ou
  EXECUTANDO antes de fechar,
  volta de forma segura
  como PAUSADO.
  */

            executandoPrograma = true;

            programaPausado = true;

            estadoExecucao = EstadoExecucao.PAUSADO;

            aguardandoTrocaPeca = false;

            girando = false;

            atualizarStatusMesa("PARADA");

            esconderBotaoIniciarCiclo();

            esconderPainelTrocaPeca();
          }
          /*
          Recuperar ponto salvo.
          */

          const pontoSalvo = Number(producaoRecuperada.pontoAtual);

          if (Number.isFinite(pontoSalvo) && pontos.length > 0) {
            indicePontoAtual = THREE.MathUtils.clamp(
              pontoSalvo - 1,
              0,
              pontos.length - 1,
            );
          } else {
            indicePontoAtual = 0;
          }

          /*
          Permite reenviar o ponto
          para ESP32 somente depois
          que o operador continuar.
          */

          indiceUltimoPontoEnviadoMaquina = -1;

          const botao = document.getElementById("btnPlayPause");

          if (botao) {
            if (
              estadoExecucao === EstadoExecucao.AGUARDANDO_PECA ||
              estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO
            ) {
              botao.disabled = true;

              botao.innerText = "Pausar execução";
            } else {
              botao.disabled = false;

              botao.innerText = "Continuar execução";
            }
          }

          const statusPrograma = document.getElementById("statusPrograma");

          if (statusPrograma) {
            if (estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO) {
              statusPrograma.innerText =
                "Produção preparada. Confirme para iniciar o ciclo.";
            } else if (estadoExecucao === EstadoExecucao.AGUARDANDO_PECA) {
              statusPrograma.innerText = `Peça ${
                producaoRecuperada.quantidadeConcluida || 0
              } de ${
                producaoRecuperada.quantidadeTotal || 0
              } concluída. Posicione a próxima peça.`;
            } else {
              statusPrograma.innerText = `Produção pausada. ${
                producaoRecuperada.quantidadeConcluida || 0
              } / ${producaoRecuperada.quantidadeTotal || 0} peças concluídas.`;
            }
          }

          const execucaoAtual = document.getElementById("execucaoAtual");

          if (execucaoAtual) {
            if (estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO) {
              execucaoAtual.innerText = "Aguardando autorização do operador";
            } else if (estadoExecucao === EstadoExecucao.AGUARDANDO_PECA) {
              execucaoAtual.innerText = `${repeticaoAtual}/${
                producaoRecuperada.quantidadeTotal || 0
              } peças concluídas | aguardando nova peça`;
            } else {
              execucaoAtual.innerText = `${repeticaoAtual}/${
                producaoRecuperada.quantidadeTotal || 0
              } peças | P${indicePontoAtual + 1}/${
                pontos.length
              } aguardando retomada`;
            }
          }

          const statusMesa = document.getElementById("statusMesa");

          if (statusMesa) {
            statusMesa.innerText = "PARADA";
          }

          if (statusMesa) {
            statusMesa.innerText = "PARADA";
          }

          /*
Atualiza a barra com o progresso
recuperado do Firebase.
*/

          atualizarBarraProgresso();
        }
      }
    } else {
      localStorage.removeItem("filaProducao");
    }

    /*
    Entrou em modo fila.
    Não continua para os modos abaixo.
    */

    return;
  }

  /*
  =============================
  PROGRAMA SELECIONADO
  =============================
  */

  const modoPrograma = localStorage.getItem("modoPrograma");

  if (modoPrograma === "executar") {
    await carregarProgramaParaExecucao();
  }
} // <-- fecha iniciarSistema()

function salvarBackupProgramas() {
  const backup = [];

  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);

    if (
      chave === "programaAtual" ||
      chave === "filaProducao" ||
      chave === "historicoProducao" ||
      chave === "historicoJaSalvo" ||
      chave.startsWith("firebase:")
    ) {
      continue;
    }

    try {
      const dados = JSON.parse(localStorage.getItem(chave));

      if (!dados || !Array.isArray(dados.pontos)) {
        continue;
      }

      backup.push({
        chave: chave,
        dados: dados,
      });
    } catch (erro) {
      console.warn("Ignorado no backup:", chave);
    }
  }

  localStorage.setItem("backupProgramas", JSON.stringify(backup));
}

function recuperarBackupProgramas() {
  const programasAtuais = [];

  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);

    try {
      const dados = JSON.parse(localStorage.getItem(chave));

      if (dados && Array.isArray(dados.pontos)) {
        programasAtuais.push(chave);
      }
    } catch (erro) {}
  }

  if (programasAtuais.length > 0) return;

  const backup = JSON.parse(localStorage.getItem("backupProgramas")) || [];

  backup.forEach((item) => {
    localStorage.setItem(item.chave, JSON.stringify(item.dados));
  });
}

function mostrarPainelTrocaPeca() {
  const painel = document.getElementById("painelTrocaPeca");

  const mensagem = document.getElementById("mensagemTrocaPeca");

  const contador = document.getElementById("contadorTrocaPeca");

  const botao = document.getElementById("btnPecaPosicionada");

  if (painel) {
    painel.style.display = "block";
  }

  if (mensagem) {
    mensagem.innerText =
      "Retire a peça concluída, posicione a próxima peça e confirme.";
  }

  if (contador) {
    contador.innerText = "";
  }

  if (botao) {
    botao.disabled = false;

    botao.innerText = "PEÇA POSICIONADA";
  }
}

function esconderPainelTrocaPeca() {
  const painel = document.getElementById("painelTrocaPeca");

  const contador = document.getElementById("contadorTrocaPeca");

  if (painel) {
    painel.style.display = "none";
  }

  if (contador) {
    contador.innerText = "";
  }
}

async function executarContagemRegressiva(
  mensagemBase = "Iniciando",
  usarPainelInicio = false,
) {
  const contadorTroca = document.getElementById("contadorTrocaPeca");

  const painelInicio = document.getElementById("painelContagemInicio");

  const contadorInicio = document.getElementById("contadorInicio");

  const statusPrograma = document.getElementById("statusPrograma");

  /*
  Se for o início da produção,
  mostra um painel próprio.
  */

  if (usarPainelInicio && painelInicio) {
    painelInicio.style.display = "block";
  }

  for (let segundos = 3; segundos >= 1; segundos--) {
    const mensagem = `${mensagemBase} em ${segundos}...`;

    /*
    Contador da troca de peça.
    */

    if (!usarPainelInicio && contadorTroca) {
      contadorTroca.innerText = mensagem;
    }

    /*
    Contador da primeira peça.
    */

    if (usarPainelInicio && contadorInicio) {
      contadorInicio.innerText = mensagem;
    }

    if (statusPrograma) {
      statusPrograma.innerText = mensagem;
    }

    await aguardar(1000);
  }

  /*
  Esconde o painel inicial.
  */

  if (usarPainelInicio && painelInicio) {
    painelInicio.style.display = "none";
  }

  if (contadorInicio) {
    contadorInicio.innerText = "";
  }

  if (contadorTroca) {
    contadorTroca.innerText = "";
  }

  return true;
}

async function iniciarContagemTrocaPeca() {
  const botao = document.getElementById("btnPecaPosicionada");

  if (estadoExecucao !== EstadoExecucao.AGUARDANDO_PECA) {
    return false;
  }

  if (botao) {
    botao.disabled = true;
    botao.innerText = "AGUARDE...";
  }

  const resultado = await executarContagemRegressiva("Iniciando próxima peça");

  if (estadoExecucao !== EstadoExecucao.AGUARDANDO_PECA) {
    return false;
  }

  return resultado;
}

async function confirmarPecaPosicionada() {
  /*
  Só funciona quando realmente
  estamos esperando nova peça.
  */

  if (estadoExecucao !== EstadoExecucao.AGUARDANDO_PECA) {
    return;
  }

  /*
  =============================
  CONTAGEM DA TROCA
  =============================
  */

  const contagemConcluida = await iniciarContagemTrocaPeca();

  if (!contagemConcluida) {
    return;
  }

  /*
  =============================
  LOCALIZAR PROGRAMA
  =============================
  */

  const itemAtual = filaProducao[indiceFila];

  if (!itemAtual) {
    console.error("Não foi possível localizar o próximo item da produção.");

    return;
  }

  /*
  Esconde o painel depois
  da contagem.
  */

  esconderPainelTrocaPeca();

  /*
  Carrega os pontos, mas NÃO
  inicia automaticamente.
  */

  await carregarProgramaFila(itemAtual.programa, false);

  aguardandoTrocaPeca = false;

  /*
  Inicia SEM nova contagem.

  A contagem 3...2...1 já
  aconteceu acima.
  */

  await iniciarExecucaoPrograma(false);
}
/*
=============================
BOTÃO PEÇA POSICIONADA
=============================
*/

document
  .getElementById("btnPecaPosicionada")
  ?.addEventListener("click", confirmarPecaPosicionada);

async function concluirProgramaAtual() {
  if (conclusaoPecaPendente || !executandoPrograma || indicePontoAtual < pontos.length) return;
  conclusaoPecaPendente = true;
  try { await concluirPecaAtual(); } finally { conclusaoPecaPendente = false; }
}
async function concluirPecaAtual() {
  /*
  =============================
  FINALIZAR MOVIMENTO DA PEÇA
  =============================
  */

  pararControleManual();
  executandoPrograma = false;

  programaPausado = false;

  /*
  Ao concluir uma peça, a mesa
  precisa parar para permitir
  a troca segura.
  */

  await pararMesaAutomatica();

  /*
Após terminar a soldagem,
o cabeçote volta para a
posição inicial antes da
troca da peça.
*/

  await retornarCabecoteParaPosicaoInicial();

  const botaoPausa = document.getElementById("btnPlayPause");

  if (botaoPausa) {
    botaoPausa.disabled = true;

    botaoPausa.innerText = "Pausar execução";
  }

  if (filaProducao.length === 0) {
    estadoExecucao = EstadoExecucao.FINALIZADO;

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = "Programa concluído.";
    }

    return;
  }

  const itemAtual = filaProducao[indiceFila];

  if (!itemAtual) {
    console.error("Item atual da fila não encontrado.");

    return;
  }

  /*
  =============================
  CONTAR PEÇA CONCLUÍDA
  =============================
  */

  repeticaoAtual++;
  indicePontoAtual = 0;
  await gravacaoProducao.catch(() => {});

  const quantidadeTotal = Number(itemAtual.quantidade) || 0;

  const percentualPrograma =
    quantidadeTotal > 0
      ? Math.round((repeticaoAtual / quantidadeTotal) * 100)
      : 0;

  /*
  =============================
  ATUALIZAR FIREBASE
  =============================
  */

  if (window.salvarProducaoAtualFirebase) {
    try {
      await window.salvarProducaoAtualFirebase({
        programa: itemAtual.programa,

        quantidadeTotal: quantidadeTotal,

        quantidadeConcluida: repeticaoAtual,

        repeticaoAtual: Math.min(repeticaoAtual + 1, quantidadeTotal),

        indiceFila: indiceFila,

        totalProgramasFila: filaProducao.length,

        fila: filaProducao,

        status:
          repeticaoAtual >= quantidadeTotal
            ? "CONCLUIDO_PROGRAMA"
            : "AGUARDANDO_PECA",

        percentual: percentualPrograma,

        pontoAtual: 0,

        totalPontos: pontos.length,

        inicioTimestamp: inicioProducao,
      });
    } catch (erro) {
      console.error("Erro ao atualizar produção atual:", erro);
    }
  }

  atualizarBarraProgresso();

  atualizarTempoRestante();

  const execucaoAtual = document.getElementById("execucaoAtual");

  if (execucaoAtual) {
    execucaoAtual.innerText = `${repeticaoAtual}/${quantidadeTotal} peças concluídas`;
  }

  /*
  =============================
  AINDA FALTAM PEÇAS DO MESMO
  PROGRAMA
  =============================
  */

  if (repeticaoAtual < quantidadeTotal) {
    estadoExecucao = EstadoExecucao.AGUARDANDO_PECA;

    aguardandoTrocaPeca = true;

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = `Peça ${repeticaoAtual} de ${quantidadeTotal} concluída. Aguardando troca da peça.`;
    }

    atualizarStatusMesa("PARADA");

    mostrarPainelTrocaPeca();

    /*
    Não chamamos mais:
    carregarProgramaFila()

    O operador precisa confirmar
    a próxima peça primeiro.
    */

    return;
  }

  /*
  =============================
  PROGRAMA ATUAL COMPLETO
  =============================
  */

  indiceFila++;

  repeticaoAtual = 0;

  /*
  =============================
  EXISTE OUTRO PROGRAMA NA FILA
  =============================
  */

  if (indiceFila < filaProducao.length) {
    const proximoItem = filaProducao[indiceFila];

    estadoExecucao = EstadoExecucao.AGUARDANDO_PECA;

    aguardandoTrocaPeca = true;

    if (window.salvarProducaoAtualFirebase) {
      try {
        await window.salvarProducaoAtualFirebase({
          programa: proximoItem.programa,

          quantidadeTotal: Number(proximoItem.quantidade),

          quantidadeConcluida: 0,

          repeticaoAtual: 1,

          indiceFila: indiceFila,

          totalProgramasFila: filaProducao.length,

          fila: filaProducao,

          status: "AGUARDANDO_PECA",

          percentual: 0,

          pontoAtual: 0,

          inicioTimestamp: inicioProducao,
        });
      } catch (erro) {
        console.error("Erro ao preparar próximo programa:", erro);
      }
    }

    const statusPrograma = document.getElementById("statusPrograma");

    if (statusPrograma) {
      statusPrograma.innerText = `Programa anterior concluído. Posicione a peça para "${proximoItem.programa}".`;
    }

    mostrarPainelTrocaPeca();

    return;
  }

  /*
  =============================
  ÚLTIMA PEÇA DA FILA
  =============================
  */

  estadoExecucao = EstadoExecucao.FINALIZADO;

  esconderPainelTrocaPeca();

  void finalizarProducao();
}

animate();

/* =====================================
RESPONSIVO
===================================== */
document.getElementById("btnVoltar")?.addEventListener("click", () => {
  definirIndutorSoldando(false);
  pararControleManual();
  window.location.href = "../solda-system/index.html";
});

window.addEventListener("resize", solicitarResizeCena3D);
window.addEventListener("orientationchange", solicitarResizeCena3D);
window.visualViewport?.addEventListener("resize", solicitarResizeCena3D);

const observadorResizeCena3D =
  typeof ResizeObserver === "function"
    ? new ResizeObserver(solicitarResizeCena3D)
    : null;

observadorResizeCena3D?.observe(renderer.domElement);

window.addEventListener("pagehide", () => {
  observadorResizeCena3D?.disconnect();
});



window.addEventListener(
  "soldatech:gesto-visao",
  async (event) => {

    if (maquinaRealAtiva()) return;

    const gesto = event.detail?.gesto;

    console.log(
      "👋 [VISÃO] Processando gesto:",
      gesto,
      "| Estado:",
      estadoExecucao
    );

    if (gesto === "START") {

      if (
        estadoExecucao !==
        EstadoExecucao.AGUARDANDO_INICIO
      ) {
        console.warn(
          "⚠️ START por gesto ignorado. Estado atual:",
          estadoExecucao
        );

        return;
      }

      console.log(
        "▶️ [VISÃO] Iniciando ciclo por gesto."
      );

      await confirmarInicioCiclo();

      return;
    }

    if (gesto === "PAUSA") {

      if (
        estadoExecucao !==
        EstadoExecucao.EXECUTANDO
      ) {
        console.warn(
          "⚠️ PAUSA por gesto ignorada. Estado atual:",
          estadoExecucao
        );

        return;
      }

      console.log(
        "⏸️ [VISÃO] Pausando ciclo por gesto."
      );

      await alternarMovimento();
    }
  }
);

/*
Rede de segurança: se a página fechar/recarregar
enquanto a máquina real estiver girando a mesa ou
em jog, tenta mandar parar tudo. Isso é best-effort
(a aba pode fechar antes do MQTT sair). O reset ao conectar
no Node-RED não protege contra perda de comunicação durante
o movimento. A parada segura requer intertravamento/watchdog
no CLP e circuito físico de segurança validado.
*/
function pararTudoNaMaquinaReal() {
  if (!maquinaRealAtiva()) {
    return;
  }

  try {
    window.enviarComandoMaquina?.("JOG_PARAR", {});
    window.enviarComandoMaquina?.("MESA_STOP", {});
    window.enviarComandoMaquina?.("SOLDA_OFF", {});
  } catch (erro) {
    console.error("Erro ao tentar parar a máquina real ao sair da página:", erro);
  }
}

window.addEventListener("pagehide", pararTudoNaMaquinaReal);
