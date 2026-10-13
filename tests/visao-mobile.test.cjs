const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = import("../new-program/visao-core.mjs");
const cameraModule = import("../new-program/visao-camera.mjs");
const contexto = { uid: "operador-a", empresaId: "empresa-a" };
const programas = { solda01: { nome: "Soldagem 01", versaoFormato: 3, pontos: [{ zMm: 10, anguloMesaGraus: 0 }] } };
const selecao = { programa: "solda01", quantidade: "10", tipoMaterial: "Aço Inox", materialSolda: "ER308L" };
const criar = async (opcoes = {}) => (await core).criarSessao({ contexto, programas, fila: [], selecao, agora: 1000, id: "sessao-a", ...opcoes });

test("visão preserva programa, quantidade, materiais e rascunho sem alterar fila original", async () => {
  const fila = [{ ...selecao, quantidade: 2 }];
  const sessao = await criar({ fila });
  assert.equal(sessao.itens[1].nome, "Soldagem 01");
  assert.equal(sessao.itens[1].quantidade, 10);
  assert.equal(sessao.itens[1].tipoMaterial, "Aço Inox");
  assert.equal(sessao.itens.reduce((n, i) => n + i.quantidade, 0), 12);
  sessao.rascunho.fila[0].quantidade = 9;
  assert.equal(fila[0].quantidade, 2);
});

test("quantidade rejeita zero, fração, negativos, vazio e valores não seguros", async () => {
  const { validarQuantidade } = await core;
  for (const valor of [0, -1, "", "abc", 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validarQuantidade(valor));
  }
  assert.equal(validarQuantidade("10"), 10);
  await assert.rejects(criar({ selecao: { ...selecao, quantidade: 0 } }));
  await assert.rejects(criar({ selecao: { ...selecao, programa: "" } }));
});

test("configuração autentica usuário/empresa, expira e rejeita modo físico manipulado", async () => {
  const { validarSessao, VALIDADE_MS, solicitarGestoDemonstracao } = await core;
  const sessao = await criar();
  for (const usuario of [{ ...contexto, uid: "outro" }, { ...contexto, empresaId: "outra" }, null]) {
    assert.throws(() => validarSessao(sessao, usuario, 1001));
  }
  assert.throws(() => validarSessao(sessao, contexto, 1000 + VALIDADE_MS));
  assert.throws(() => validarSessao(sessao, contexto, 999));
  assert.throws(() => solicitarGestoDemonstracao({ ...sessao, modo: "CLP_CONFIRMADO" }, contexto, "START", 1001));
});

test("releitura rejeita programa excluído, incompatível e alterado desde a configuração", async () => {
  const { validarItens } = await core;
  const sessao = await criar();
  assert.throws(() => validarItens(sessao.itens, {}));
  assert.throws(() => validarItens(sessao.itens, { solda01: { ...programas.solda01, versaoFormato: 2 } }));
  assert.throws(() => validarItens(sessao.itens, { solda01: { ...programas.solda01, nome: "Revisão nova" } }));
  assert.equal(validarItens(sessao.itens, programas)[0].quantidade, 10);
});

test("armazenamento por aba elimina configuração inválida e impede troca de identidade", async () => {
  const { CHAVE_SESSAO, CHAVE_RETORNO, lerSessao } = await core;
  const dados = new Map([[CHAVE_SESSAO, JSON.stringify(await criar())], [CHAVE_RETORNO, "sessao-a"]]);
  const storage = { getItem: k => dados.get(k), removeItem: k => dados.delete(k) };
  assert.equal(lerSessao(storage, contexto, 1001).id, "sessao-a");
  assert.throws(() => lerSessao(storage, { ...contexto, uid: "b" }, 1001));
  assert.equal(dados.size, 0);
});

test("classificador reconhece START/PAUSA e rejeita ausência, desconhecidos, duas mãos e baixa confiança", async () => {
  const { classificarResultado } = await core;
  const resultado = (nome, score = .95) => ({ landmarks: [[]], gestures: [[{ categoryName: nome, score }]] });
  assert.equal(classificarResultado(resultado("Open_Palm")), "START");
  assert.equal(classificarResultado(resultado("Closed_Fist")), "PAUSA");
  assert.equal(classificarResultado({ landmarks: [] }), "SEM_MAO");
  assert.equal(classificarResultado(resultado("Victory")), "DESCONHECIDO");
  assert.equal(classificarResultado(resultado("Open_Palm", .6)), "DESCONHECIDO");
  assert.equal(classificarResultado({ ...resultado("Open_Palm"), landmarks: [[], []] }), "DESCONHECIDO");
});

function quadros(filtro, gesto, inicio, fim, conectado = true) {
  const acoes = [];
  for (let tempo = inicio; tempo <= fim; tempo += 100) {
    const acao = filtro.atualizar(gesto, tempo, conectado);
    if (acao) acoes.push([tempo, acao]);
  }
  return acoes;
}

test("estabilidade contínua e gesto mantido produzem somente uma solicitação", async () => {
  const filtro = new (await core).FiltroGestos();
  assert.deepEqual(quadros(filtro, "START", 0, 500), []);
  assert.deepEqual(quadros(filtro, "START", 600, 5000), [[600, "START"]]);
  assert.deepEqual(quadros(filtro, "SEM_MAO", 5100, 5800), []);
  assert.deepEqual(quadros(filtro, "START", 5900, 7000), [[6500, "START"]]);
});

test("cooldown mantém gesto elegível e não cria duplicatas", async () => {
  const filtro = new (await core).FiltroGestos();
  quadros(filtro, "START", 0, 600);
  assert.deepEqual(quadros(filtro, "PAUSA", 700, 2300), []);
  assert.deepEqual(quadros(filtro, "PAUSA", 2400, 4000), [[2400, "PAUSA"]]);
});

test("gestos instáveis, frames interrompidos e reconexão não reproduzem START antigo", async () => {
  const filtro = new (await core).FiltroGestos();
  for (let t = 0; t < 1000; t += 100) assert.equal(filtro.atualizar(t % 200 ? "START" : "DESCONHECIDO", t), null);
  assert.equal(filtro.atualizar("START", 2000), null);
  assert.equal(filtro.atualizar("START", 4000), null);
  assert.deepEqual(quadros(filtro, "START", 4100, 5000, false), []);
  assert.deepEqual(quadros(filtro, "START", 5100, 7000), []);
  quadros(filtro, "SEM_MAO", 7100, 7800);
  assert.deepEqual(quadros(filtro, "START", 7900, 8600), [[8500, "START"]]);
});

test("demonstração nunca transforma gesto em execução e mantém envelope compatível", async () => {
  const { solicitarGestoDemonstracao } = await core;
  for (const gesto of ["START", "PAUSA"]) {
    const r = solicitarGestoDemonstracao(await criar(), contexto, gesto, 1001);
    assert.equal(r.tipo, "GESTO_VISAO");
    assert.equal(r.gesto, gesto);
    assert.equal(r.enviado, false);
    assert.equal(r.executado, false);
  }
});

async function ambienteCamera(opcoes = {}) {
  const { CameraGestos } = await cameraModule;
  const estados = [], acoes = [];
  let paradas = 0, fechamentos = 0, agora = 0, callback;
  const track = { stop: () => paradas++, addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = { srcObject: null, readyState: 2, currentTime: 0, play: async () => {}, pause() {} };
  const modelo = { recognizeForVideo: () => ({ landmarks: [[]], gestures: [[{ categoryName: "Open_Palm", score: .99 }]] }), close: () => fechamentos++ };
  const camera = new CameraGestos({ video, mediaDevices: { getUserMedia: async () => stream }, criarModelo: async () => modelo,
    contextoSeguro: true, quadro: cb => { callback = cb; return 1; }, cancelar: () => { callback = null; }, relogio: () => agora,
    aoEstado: (...args) => estados.push(args), aoGesto: gesto => acoes.push(gesto), ...opcoes });
  return { camera, video, stream, modelo, estados, acoes, get paradas() { return paradas; }, get fechamentos() { return fechamentos; },
    frame(t) { agora = t; video.currentTime = t / 1000; callback?.(); } };
}

test("câmera usa getUserMedia, reconhece com modelo e encerra tracks/modelo/loop", async () => {
  const a = await ambienteCamera();
  await a.camera.iniciar();
  assert.deepEqual(a.acoes, []);
  for (let t = 100; t <= 1000; t += 100) a.frame(t);
  assert.deepEqual(a.acoes, ["START"]);
  a.camera.parar();
  a.frame(2000);
  assert.equal(a.paradas, 1);
  assert.equal(a.fechamentos, 1);
  assert.equal(a.video.srcObject, null);
  assert.equal(a.camera.ativa, false);
});

test("permissão negada, câmera ausente/ocupada e contexto inseguro têm erro claro", async () => {
  for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError"]) {
    const a = await ambienteCamera({ mediaDevices: { getUserMedia: async () => { throw { name }; } } });
    await a.camera.iniciar();
    assert.equal(a.estados.at(-1)[0], "erro");
    assert.equal(a.camera.ativa, false);
    assert.ok(a.estados.at(-1)[1].length > 30);
  }
  const a = await ambienteCamera({ contextoSeguro: false });
  await a.camera.iniciar();
  assert.match(a.estados.at(-1)[1], /HTTPS/);
});

test("falha do MediaPipe libera câmera e permite nova tentativa", async () => {
  const a = await ambienteCamera({ criarModelo: async () => { throw new Error("Falha MediaPipe"); } });
  await a.camera.iniciar();
  assert.equal(a.paradas, 1);
  assert.equal(a.camera.preparando, false);
  a.camera.criarModelo = async () => a.modelo;
  await a.camera.iniciar();
  assert.equal(a.camera.ativa, true);
  a.modelo.recognizeForVideo = () => { throw new Error("inferência"); };
  a.frame(100);
  assert.equal(a.camera.ativa, false);
  assert.equal(a.paradas, 2);
});

test("permissão tardia depois de sair não reabre câmera; modelo tardio é fechado", async () => {
  let resolver;
  const a = await ambienteCamera({ mediaDevices: { getUserMedia: () => new Promise(r => { resolver = r; }) } });
  const inicio = a.camera.iniciar();
  a.camera.parar();
  resolver(a.stream);
  await inicio;
  assert.equal(a.paradas, 1);
  assert.equal(a.camera.ativa, false);
  let pronto;
  a.camera.mediaDevices = { getUserMedia: async () => a.stream };
  a.camera.criarModelo = () => new Promise(r => { pronto = r; });
  const segundo = a.camera.iniciar();
  await new Promise(r => setImmediate(r));
  a.camera.parar();
  pronto(a.modelo);
  await segundo;
  assert.equal(a.fechamentos, 1);
  assert.equal(a.video.srcObject, null);
});

test("alternância encerra câmera anterior; reativação exige neutro antes de novo gesto", async () => {
  const a = await ambienteCamera();
  await a.camera.iniciar();
  await a.camera.alternar();
  assert.equal(a.camera.lado, "environment");
  assert.equal(a.paradas, 1);
  for (let t = 100; t <= 3000; t += 100) a.frame(t);
  assert.deepEqual(a.acoes, []);
  a.camera.parar();
});

test("botão tradicional conserva handler, fila e destino; botão da câmera é adjacente", async () => {
  const js = fs.readFileSync(path.join(__dirname, "../iniciar-producao/iniciarproducao.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../iniciar-producao/iniciarproducao.html"), "utf8");
  const trecho = js.slice(js.indexOf("async function iniciarProducao()"), js.indexOf("async function carregarProducaoDia()"));
  const escritos = new Map();
  const janela = { buscarProducaoAtualFirebase: async () => null, location: {} };
  const contextoTeste = vm.createContext({ window: janela, fila: [selecao], localStorage: { setItem: (k,v) => escritos.set(k,v), removeItem() {} },
    statusProducao: {}, kpiStatus: {}, setTimeout: fn => fn(), alert: () => assert.fail("alert inesperado"), console });
  vm.runInContext(trecho, contextoTeste);
  await contextoTeste.iniciarProducao();
  assert.equal(janela.location.href, "../new-program/novoprograma.html");
  assert.deepEqual(JSON.parse(escritos.get("filaProducao")), [selecao]);
  assert.match(html, /class="opcoes-inicio">\s*<button\s+id="btnIniciar"[\s\S]*?<\/button>\s*<button id="btnVisao"/);
  assert.match(js, /\.addEventListener\("click", iniciarProducao\)/);
});
