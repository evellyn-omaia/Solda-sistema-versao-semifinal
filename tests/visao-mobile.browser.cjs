// Executar separadamente com Playwright instalado. Firebase e vídeo são falsos;
// nunca abre conta, câmera física, broker ou CLP. MediaPipe real tem smoke opcional.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const raiz = path.resolve(__dirname, "..");
const programa = { solda01: { nome: "Soldagem 01", versaoFormato: 3, pontos: [{ zMm: 10, anguloMesaGraus: 0 }] } };
const firebase = `
window.obterContextoVisaoFirebase = async () => ({uid: 'operador-a', empresaId: 'empresa-a'});
window.listarProgramasFirebase = async () => (${JSON.stringify(programa)});
window.buscarProducaoAtualFirebase = async () => null;
window.buscarProducaoDiaFirebase = async () => ({totalPecas: 0});
`;
const identidade = `
export const obterContexto = async () => ({uid: 'operador-a', empresaId: 'empresa-a'});
export const listarProgramas = async () => (${JSON.stringify(programa)});
export const observarUsuario = callback => { window.__trocarUsuario = callback; callback('operador-a'); return () => {}; };
`;
const modelo = `
export const FilesetResolver = { forVisionTasks: async () => ({}) };
export const GestureRecognizer = { createFromOptions: async () => ({
 recognizeForVideo() { const nome = window.__gesto; return nome ? {landmarks:[[]], gestures:[[{categoryName:nome,score:.99}]]} : {landmarks:[],gestures:[]}; },
 close() {}
}) };
`;

test("navegação mobile e ciclo da câmera no navegador, sem equipamento", { timeout: 120000 }, async t => {
  const servidor = http.createServer(async (req, res) => {
    try {
      const arquivo = path.resolve(raiz, `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`);
      if (!arquivo.startsWith(raiz + path.sep)) { res.writeHead(403).end(); return; }
      const tipo = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css" }[path.extname(arquivo)] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": `${tipo}; charset=utf-8` });
      res.end(await fs.readFile(arquivo));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera"] });
  const page = await context.newPage();
  const erros = [], sockets = [], posts = [];
  page.on("pageerror", e => erros.push(e.message));
  page.on("websocket", socket => sockets.push(socket.url()));
  page.on("request", req => { if (req.method() === "POST") posts.push(req.url()); });
  await page.route("**/new-program/firebase-programas.js", route => route.fulfill({ contentType: "text/javascript", body: firebase }));
  await page.route("**/new-program/visao-identidade.js", route => route.fulfill({ contentType: "text/javascript", body: identidade }));
  await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "text/javascript", body: modelo }));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const abrirConfiguracao = async () => {
    await page.goto(`${base}/iniciar-producao/iniciarproducao.html`);
    await page.waitForFunction(() => !document.getElementById("selectPrograma").disabled);
  };
  const configurar = async () => {
    await page.selectOption("#selectPrograma", "solda01");
    await page.fill("#quantidade", "10");
  };
  const esperarCamera = () => page.waitForFunction(() => document.getElementById("estadoCamera").textContent.startsWith("Câmera ativa"));
  const esperarResultado = texto => page.waitForFunction(texto => document.getElementById("resultado").textContent.startsWith(texto), texto);

  await t.test("botões lado a lado e sem rolagem horizontal em 320/390/768/1280 px", async () => {
    await abrirConfiguracao();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const iniciar = await page.locator("#btnIniciar").boundingBox();
      const visao = await page.locator("#btnVisao").boundingBox();
      assert.ok(iniciar.height >= 44 && visao.height >= 44);
      if (width >= 390) assert.equal(iniciar.y, visao.y);
      else assert.ok(visao.y > iniciar.y);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await t.test("quantidade inválida bloqueia navegação; válida preserva programa sem iniciar", async () => {
    await configurar();
    await page.fill("#quantidade", "0");
    await page.click("#btnVisao");
    await page.waitForFunction(() => document.getElementById("statusProducao").textContent.includes("inteira"));
    assert.match(page.url(), /iniciarproducao.html$/);
    await page.fill("#quantidade", "10");
    await page.click("#btnVisao");
    await page.waitForURL("**/camera.html");
    await esperarCamera();
    assert.match(await page.locator("#programas").innerText(), /Soldagem 01.*10/);
    assert.equal(await page.locator("#quantidade").innerText(), "10 peça(s)");
    assert.equal(await page.locator("#producao").innerText(), "Não iniciada");
    assert.equal(await page.evaluate(() => localStorage.getItem("filaProducao")), null);
  });

  await t.test("START e PAUSA mostram intenção; desconhecido e ausência não acionam produção", async () => {
    await page.evaluate(() => { window.__gesto = "Open_Palm"; });
    await esperarResultado("START reconhecido");
    await page.evaluate(() => { window.__gesto = "Closed_Fist"; });
    await esperarResultado("PAUSA reconhecido");
    await page.evaluate(() => { window.__gesto = "Victory"; });
    await page.waitForFunction(() => document.getElementById("deteccao").textContent.includes("desconhecido"));
    await page.evaluate(() => { window.__gesto = null; });
    await page.waitForFunction(() => document.getElementById("deteccao").textContent.includes("Nenhuma"));
    assert.match(await page.locator("#producao").innerText(), /Não iniciada/);
    assert.deepEqual(sockets, []);
    assert.deepEqual(posts, []);
  });

  await t.test("câmera responsiva, screenshot e encerramento liberam tracks", async () => {
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(os.tmpdir(), "soldatouch-camera-mobile.png"), fullPage: true });
    await page.evaluate(() => { window.__tracks = document.getElementById("video").srcObject.getTracks(); });
    await page.click("#encerrar");
    assert.equal(await page.evaluate(() => window.__tracks.every(t => t.readyState === "ended")), true);
    assert.equal(await page.locator("#ativar").isEnabled(), true);
  });

  await t.test("retorno restaura configuração e fila sem disparar botão tradicional", async () => {
    await page.click("#voltar");
    await page.waitForURL("**/iniciarproducao.html");
    await page.waitForFunction(() => document.getElementById("selectPrograma").value === "solda01");
    assert.equal(await page.inputValue("#quantidade"), "10");
    await page.click("#btnAdicionar");
    await page.click("#btnVisao");
    await page.waitForURL("**/camera.html");
    await esperarCamera();
    assert.equal(await page.locator("#quantidade").innerText(), "10 peça(s)");
  });

  await t.test("falha de conexão interrompe câmera e reconexão não repete START", async () => {
    await context.setOffline(true);
    await page.waitForFunction(() => document.getElementById("conexao").textContent === "Desconectado");
    assert.equal(await page.evaluate(() => document.getElementById("video").srcObject), null);
    await context.setOffline(false);
    await page.click("#revalidar");
    await page.waitForFunction(() => !document.getElementById("ativar").disabled);
    await page.evaluate(() => { window.__gesto = "Open_Palm"; });
    await page.click("#ativar");
    await esperarCamera();
    await page.waitForTimeout(2200);
    assert.equal(await page.locator("#resultado").innerText(), "Nenhuma solicitação enviada.");
  });

  await t.test("troca de conta encerra câmera e remove configuração", async () => {
    await page.evaluate(() => window.__trocarUsuario("outro-operador"));
    assert.equal(await page.locator("#conexao").innerText(), "Desconectado");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("soldatouch.visao.v1")), null);
    assert.equal(await page.evaluate(() => document.getElementById("video").srcObject), null);
  });

  await t.test("acesso direto sem configuração permanece bloqueado", async () => {
    await page.reload();
    await page.waitForFunction(() => document.getElementById("conexao").textContent === "Desconectado");
    assert.equal(await page.locator("#ativar").isDisabled(), true);
    assert.deepEqual(erros, []);
  });

  if (process.env.TESTAR_MEDIAPIPE_REAL === "1") {
    await t.test("MediaPipe real carrega WASM/modelo e processa vídeo sintético sem mão", { timeout: 60000 }, async () => {
      await page.unroute("https://cdn.jsdelivr.net/**");
      // Novo contexto evita cache ESM do modelo falso.
      const real = await browser.newContext({ permissions: ["camera"] });
      const paginaReal = await real.newPage();
      try {
        await paginaReal.route("**/new-program/visao-identidade.js", route => route.fulfill({ contentType: "text/javascript", body: identidade }));
        await paginaReal.goto(`${base}/new-program/camera.html`);
        const resultado = await paginaReal.evaluate(async () => {
          const { criarReconhecedor } = await import("./visao-camera.mjs");
          const reconhecedor = await criarReconhecedor();
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 640; canvas.height = 480;
            canvas.getContext("2d").fillRect(0, 0, 640, 480);
            return reconhecedor.recognizeForVideo(canvas, performance.now()).landmarks.length;
          } finally { reconhecedor.close(); }
        });
        assert.equal(resultado, 0);
      } finally { await real.close(); }
    });
  }
});
