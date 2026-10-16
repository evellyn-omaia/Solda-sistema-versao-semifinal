const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function port() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
test('navegador → MQTT WS → Node-RED → Modbus TCP simulado → interface', { timeout: 90000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soldatech-browser-'));
  const vars = ['MQTT_TCP_PORT', 'MQTT_WS_PORT', 'SOLDATECH_WEB_PORT', 'SOLDATECH_RED_PORT', 'SOLDATECH_MODBUS_PORT'];
  const env = { ...process.env, SOLDATECH_STATE_DIR: dir };
  for (const name of vars) env[name] = String(await port());
  const runtime = spawn(process.execPath, [path.join(__dirname, '../scripts/soldatech.cjs')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; runtime.stdout.on('data', b => { logs += b; }); runtime.stderr.on('data', b => { logs += b; });
  const base = `http://127.0.0.1:${env.SOLDATECH_WEB_PORT}`;
  let browser;
  t.after(async () => {
    await browser?.close();
    try {
      const state = JSON.parse(fs.readFileSync(path.join(dir, 'runtime.json')));
      const exited = once(runtime, 'exit');
      await fetch(base + '/__stop', { method: 'POST', headers: { Authorization: `Bearer ${state.token}` } });
      await exited;
    } catch { runtime.kill(); }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { const h = await (await fetch(base + '/health')).json(); if (h.clp === 'SIMULACAO') { ready = true; break; } } catch {}
    if (runtime.exitCode !== null) break;
    await delay(100);
  }
  assert.ok(ready, logs);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const context = await browser.newContext({ permissions: ['camera'] });
  const page = await context.newPage();
  const errors = [], missing = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) missing.push(r.url()); });
  await page.goto(base);
  await page.waitForFunction(() => document.getElementById('statusClp').textContent.includes('SIMULAÇÃO'));
  await t.test('tela começa em simulação e bloqueia posicionamento físico não homologado', async () => {
    assert.equal(await page.locator('#chkMaquinaReal').isChecked(), false);
    assert.match(await page.evaluate(async () => {
      window.definirModoIntegracaoMaquina('CLP_CONFIRMADO');
      try { await solicitarComandoMaquina('MOVER_PONTO', {}, { aguardarConfirmacao: true }); return 'liberado'; }
      catch (erro) { return erro.message; }
      finally { window.definirModoIntegracaoMaquina('SIMULACAO'); }
    }), /não homologada/);
    assert.match(await page.locator('#statusNodeRed').innerText(), /ONLINE/);
    await page.waitForFunction(() => document.querySelector('canvas'));
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  });
  await t.test('botões confirmam comandos e atualizam estado após leitura Modbus', async () => {
    await page.getByRole('button', { name: 'Testar ponte' }).click();
    await page.waitForFunction(() => document.getElementById('resultadoSimulacao').textContent.includes('pong'));
    await page.getByRole('button', { name: 'Girar mesa simulada' }).click();
    await page.waitForFunction(() => document.getElementById('statusMaquinaReal').textContent === 'EXECUTANDO');
    await page.getByRole('button', { name: 'Parar mesa simulada' }).click();
    await page.waitForFunction(() => document.getElementById('statusMaquinaReal').textContent === 'PARADA');
  });
  await t.test('Firebase real executa e CRUD sem login é recusado; imagens são decodificadas', async () => {
    await page.evaluate(() => window.firebaseProgramasPronto);
    assert.equal(await page.evaluate(() => window.SoldaTechFirebase.estado), 'pronto');
    for (const nome of ['salvarProgramaFirebase', 'carregarProgramaFirebase', 'listarProgramasFirebase', 'excluirProgramaFirebase', 'salvarProducaoAtualFirebase', 'buscarProducaoAtualFirebase'])
      assert.equal(await page.evaluate(nome => typeof window[nome], nome), 'function');
    assert.match(await page.evaluate(async () => {
      try { await window.listarProgramasFirebase(); return 'acesso indevido'; }
      catch (erro) { return String(erro.message || erro); }
    }), /logado/);
    const html = await (await fetch(base + '/solda-system/index.html')).text();
    const imagens = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => new URL(m[1], base + '/solda-system/index.html').href);
    for (const src of imagens) {
      assert.equal((await fetch(src)).status, 200);
      assert.ok(await page.evaluate(async src => { const img = new Image(); img.src = src; await img.decode(); return img.naturalWidth > 0; }, src));
    }
  });
  await t.test('câmera sintética + classificação injetada inicia e pausa o motor 3D sem publicar comandos', async () => {
    await page.getByRole('button', { name: 'Voltar à edição local' }).click();
    await page.waitForFunction(() => window.acompanharSimulador === false);
    await page.waitForFunction(() => mesaReal && conjuntoMovel);
    await page.evaluate(() => {
      pontos = [{ id: 'teste-1', ordem: 1, zMm: Z_MAX_MM, anguloMesaGraus: 180, solda: { ativar: false } },
        { id: 'teste-2', ordem: 2, zMm: Z_MIN_MM, anguloMesaGraus: 0, solda: { ativar: false } }];
      window.__comandosGesto = [];
      const original = window.enviarComandoComConfirmacao;
      window.enviarComandoComConfirmacao = (...args) => { window.__comandosGesto.push(args); return original(...args); };
    });
    await page.route('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@*/vision_bundle.mjs', route => route.fulfill({ contentType: 'text/javascript', body: `
      export const FilesetResolver={forVisionTasks:async()=>({})};
      export const GestureRecognizer={createFromOptions:async()=>({recognizeForVideo(){return window.__gesto ? {landmarks:[[]],gestures:[[{categoryName:window.__gesto,score:.99}]]}:{landmarks:[],gestures:[]}},close(){}})};` }));
    const cameraDetails = page.locator('.simulacao-integrada details');
    if (!(await cameraDetails.evaluate(details => details.open))) {
      await page.locator('.simulacao-integrada summary').click();
    }
    await page.getByRole('button', { name: 'Ativar câmera', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('estadoCameraIntegrada').textContent.startsWith('Câmera ativa'));
    for (const [name, event] of [['Open_Palm', 'START'], ['Closed_Fist', 'PAUSA']]) {
      await page.evaluate(name => { window.__gesto = name; }, name);
      await page.waitForFunction(event => document.getElementById('resultadoSimulacao').textContent.includes(event === 'START' ? 'EXECUTANDO' : 'PAUSADO'), event);
    }
    const pausado = await page.evaluate(() => ({ indicePontoAtual, z: estadoMaquina.posicaoZMm, angulo: obterAnguloMesaGraus() }));
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => ({ indicePontoAtual, z: estadoMaquina.posicaoZMm, angulo: obterAnguloMesaGraus() })), pausado);
    assert.deepEqual(await page.evaluate(() => window.__comandosGesto.filter(([comando]) => comando !== 'PING')), []);
    await page.evaluate(async () => {
      window.dispatchEvent(new CustomEvent('soldatouch:maquina-evento', { detail: { dados: { estado: 'EMERGENCIA', emergencia: true } } }));
      await alternarMovimento();
    });
    assert.equal(await page.evaluate(() => estadoExecucao), 'EMERGENCIA');
    assert.match(await page.evaluate(async () => {
      try { await window.controlarSimulacaoPorGesto('START'); return 'iniciou'; }
      catch (erro) { return erro.message; }
    }), /interrompida/);
    await page.getByRole('button', { name: 'Desativar câmera' }).click();
    assert.equal(await page.locator('#videoIntegrado').evaluate(v => v.srcObject), null);
  });
  await t.test('servidor não publica arquivos privados ou aceita parada sem token', async () => {
    for (const dir of ['solda-login', 'solda-system', 'new-program', 'carregar-programa', 'iniciar-producao', 'modo-ensino', 'painel-producao', 'teste-esp32']) {
      for (const file of fs.readdirSync(path.join(__dirname, '..', dir)).filter(f => f.endsWith('.html'))) {
        const url = `${base}/${dir}/${file}`;
        const response = await fetch(url);
        assert.equal(response.status, 200, url);
        const html = await response.text();
        for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*?(?:src|href)\s*=\s*"([^"]+)"/g)) {
          const asset = new URL(match[1], url);
          if (asset.origin === base) assert.equal((await fetch(asset)).status, 200, asset.href);
        }
      }
    }
    assert.match((await fetch(base + '/new-program/visao-core.mjs')).headers.get('content-type'), /javascript/);
    assert.match((await fetch(base + '/assets/models/montagem_victor_final.glb')).headers.get('content-type'), /model\/gltf-binary/);
    for (const route of ['/.soldatech/runtime.json', '/node-red/flows.json', '/scripts/soldatech.cjs', '/package.json']) assert.equal((await fetch(base + route)).status, 404);
    assert.equal((await fetch(base + '/__stop', { method: 'POST' })).status, 403);
  });
  await t.test('carregamento lento aguarda o módulo e falha de importação informa a causa', async () => {
    for (const falhar of [false, true]) {
      const isolado = await browser.newContext();
      try {
        await isolado.route('**/new-program/firebase-programas.js', async route => {
          await delay(400);
          if (falhar) return route.abort('failed');
          await route.fulfill({ contentType: 'text/javascript', body: `
            for (const nome of ['salvarProgramaFirebase','carregarProgramaFirebase','listarProgramasFirebase','excluirProgramaFirebase','salvarProducaoAtualFirebase','buscarProducaoAtualFirebase']) window[nome] = async () => 'modulo-executado';` });
        });
        const p = await isolado.newPage();
        await p.goto(base + '/solda-login/login.html');
        const resultado = await p.evaluate(async () => {
          const script = document.createElement('script');
          script.src = '/new-program/firebase-loader.js';
          await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.append(script); });
          try { return await window.listarProgramasFirebase(); }
          catch (erro) { return erro.message; }
        });
        if (falhar) assert.match(resultado, /Falha ao carregar Firebase.*firebase-programas/);
        else assert.equal(resultado, 'modulo-executado');
      } finally { await isolado.close(); }
    }
  });
  await t.test('página de câmera prepara programa validado e controla iframe 3D (identidade/banco simulados)', async () => {
    const isolado = await browser.newContext({ permissions: ['camera'] });
    const programa = await page.evaluate(() => ({ versaoFormato: 3, nome: 'Teste virtual', pontos: [
      { ordem: 1, zMm: Z_MAX_MM, anguloMesaGraus: 180, solda: { ativar: false } },
      { ordem: 2, zMm: Z_MIN_MM, anguloMesaGraus: 0, solda: { ativar: false } },
    ] }));
    try {
      await isolado.route('**/new-program/visao-identidade.js', route => route.fulfill({ contentType: 'text/javascript', body: `
        export const obterContexto=async()=>({uid:'teste',empresaId:'teste'});
        export const listarProgramas=async()=>({teste:${JSON.stringify(programa)}});
        export const observarUsuario=cb=>{cb('teste');return ()=>{}};` }));
      await isolado.route('**/new-program/firebase-programas.js', route => route.fulfill({ contentType: 'text/javascript', body: `
        for(const nome of ['salvarProgramaFirebase','carregarProgramaFirebase','listarProgramasFirebase','excluirProgramaFirebase','salvarProducaoAtualFirebase','buscarProducaoAtualFirebase']) window[nome]=async()=>null;
        window.carregarProgramaFirebase=async()=>(${JSON.stringify(programa)});` }));
      await isolado.route('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@*/vision_bundle.mjs', route => route.fulfill({ contentType: 'text/javascript', body: `
        export const FilesetResolver={forVisionTasks:async()=>({})};
        export const GestureRecognizer={createFromOptions:async()=>({recognizeForVideo(){return window.__gesto?{landmarks:[[]],gestures:[[{categoryName:window.__gesto,score:.99}]]}:{landmarks:[]}},close(){}})};` }));
      const p = await isolado.newPage();
      await p.goto(base + '/new-program/camera.html');
      await p.evaluate(async programa => {
        const { criarSessao, CHAVE_SESSAO } = await import('./visao-core.mjs');
        sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(criarSessao({ contexto: { uid: 'teste', empresaId: 'teste' }, programas: { teste: programa }, fila: [], selecao: { programa: 'teste', quantidade: 1 } })));
      }, programa);
      await p.reload();
      await p.locator('#abrirSimulacao').click();
      const frame = await p.locator('#simulacaoVirtual').contentFrame();
      await frame.locator('#statusPrograma').filter({ hasText: 'Programa pronto' }).waitFor();
      await p.waitForFunction(() => document.getElementById('estadoCamera').textContent.startsWith('Câmera ativa'));
      await p.waitForTimeout(800);
      await p.evaluate(() => { window.__gesto = 'Open_Palm'; });
      await p.waitForFunction(() => document.getElementById('producao').textContent.startsWith('EXECUTANDO'));
      await p.evaluate(() => { window.__gesto = 'Closed_Fist'; });
      await p.waitForFunction(() => document.getElementById('producao').textContent.startsWith('PAUSADO'));
      assert.match(await frame.locator('#statusPrograma').innerText(), /PAUSADO/);
    } finally { await isolado.close(); }
  });
  await t.test('fila local inicia pelo botão; produção física pendente pode ser simulada isoladamente', async () => {
    const isolado = await browser.newContext();
    const programa = { nome: 'Programa da fila', versaoFormato: 3, pontos: [
      { id: 'pt-original-7', ordem: 7, zMm: 54, anguloMesaGraus: 22, solda: { ativar: false } },
      { id: 'pt-original-9', ordem: 9, zMm: 54.5, anguloMesaGraus: 44, solda: { ativar: true } },
    ] };
    try {
      await isolado.route('**/new-program/firebase-programas.js', route => route.fulfill({ contentType: 'text/javascript', body: `
        window.__db={active:null,writes:[]};
        window.carregarProgramaFirebase=async id=>id==='programa-a'?(${JSON.stringify(programa)}):({...${JSON.stringify(programa)},nome:'Outro programa'});
        window.buscarProducaoAtualFirebase=async()=>window.__db.active;
        window.salvarProducaoAtualFirebase=async d=>{window.__db.active=structuredClone(d);window.__db.writes.push(structuredClone(d));};
        window.salvarProgramaFirebase=async()=>{};window.listarProgramasFirebase=async()=>({});window.excluirProgramaFirebase=async()=>{};
        window.salvarHistoricoProducaoFirebase=async()=>{};window.salvarProducaoDiaFirebase=async()=>{};
        window.iniciarPausaFirebase=async()=>({id:'pausa'});window.finalizarPausaFirebase=async()=>({});window.atualizarMotivoPausaFirebase=async()=>{};
      ` }));
      const p = await isolado.newPage();
      await p.addInitScript(() => localStorage.setItem('filaProducao', JSON.stringify([
        { programa:'programa-a', nome:'Programa da fila', quantidade:2 },
        { programa:'programa-b', nome:'Outro programa', quantidade:3 },
      ])));
      await p.goto(base + '/new-program/novoprograma.html');
      await p.waitForFunction(() => mesaReal && estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO && pontos.length === 2);
      assert.match(await p.locator('#programaAtualExecucao').innerText(), /Programa da fila.*1\/2.*2 peça/);
      assert.equal(await p.locator('#listaPontos').isVisible(), true);
      const points = await p.locator('#listaPontos').innerText();
      assert.match(points, /P7 · pt-original-7/); assert.match(points, /P9 · pt-original-9/);
      assert.match(points, /Soldagem: Ativa/);
      await p.locator('#btnIniciarCiclo').click();
      await p.waitForFunction(() => estadoExecucao === EstadoExecucao.EXECUTANDO);
      await p.close();

      const fisico = await isolado.newPage();
      await fisico.addInitScript(() => {
        localStorage.setItem('filaProducao', JSON.stringify([
          { programa:'programa-a', nome:'Fila local antiga', quantidade:9 },
        ]));
        localStorage.setItem('soldatouch.producao.mqtt', JSON.stringify({producaoId:'fisica-pendente',revisao:'rev-fisica',modo:'FISICO'}));
      });
      await isolado.route('**/new-program/firebase-programas.js', route => route.fulfill({ contentType: 'text/javascript', body: `
        window.__db={active:{simulacao:false,status:'EXECUTANDO',indiceFila:0,quantidadeTotal:2,quantidadeConcluida:1,fila:[{programa:'programa-a',nome:'Programa da fila',quantidade:2}]},writes:[]};
        window.carregarProgramaFirebase=async()=>(${JSON.stringify(programa)});
        window.buscarProducaoAtualFirebase=async()=>window.__db.active;
        window.salvarProducaoAtualFirebase=async d=>{window.__db.writes.push(structuredClone(d));};
        window.salvarProgramaFirebase=async()=>{};window.listarProgramasFirebase=async()=>({});window.excluirProgramaFirebase=async()=>{};
        window.salvarHistoricoProducaoFirebase=async()=>{};window.salvarProducaoDiaFirebase=async()=>{};
        window.iniciarPausaFirebase=async()=>({id:'pausa'});window.finalizarPausaFirebase=async()=>({});window.atualizarMotivoPausaFirebase=async()=>{};
      ` }));
      await fisico.goto(base + '/new-program/novoprograma.html');
      await fisico.waitForFunction(() => pontos.length === 2 && document.getElementById('programaAtualExecucao').textContent.includes('Plano físico pendente'));
      assert.match(await fisico.locator('#execucaoAtual').innerText(), /1\/2 peças.*2 pontos/);
      assert.equal(await fisico.locator('#btnIniciarCiclo').isVisible(), false);
      await assert.rejects(fisico.evaluate(() => window.controlarSimulacaoPorGesto('START')), /AGUARDANDO_CLP/);
      assert.equal(await fisico.evaluate(() => estadoExecucao), 'PARADA');
      assert.match(await fisico.locator('#statusEnvioFilaMqtt').innerText(), /AGUARDANDO_CLP.*nenhum movimento/i);
      await fisico.locator('#chkMaquinaReal').uncheck();
      assert.equal(await fisico.evaluate(() => estadoExecucao), 'AGUARDANDO_INICIO');
      assert.equal(await fisico.evaluate(() => simulacaoVirtualIsolada), true);
      await fisico.locator('#btnIniciarCiclo').click();
      await fisico.waitForFunction(() => estadoExecucao === EstadoExecucao.EXECUTANDO);
      await fisico.waitForFunction(() => indicePontoAtual > 0);
      await fisico.evaluate(() => window.controlarSimulacaoPorGesto('PAUSA'));
      assert.equal(await fisico.evaluate(() => estadoExecucao), 'PAUSADO');
      await fisico.evaluate(() => window.controlarSimulacaoPorGesto('START'));
      assert.equal(await fisico.evaluate(() => estadoExecucao), 'EXECUTANDO');
      assert.equal(await fisico.evaluate(() => window.producaoMQTT.estado), 'AGUARDANDO_CLP');
      assert.equal(await fisico.evaluate(() => window.localStorage.getItem('soldatouch.producao.mqtt')), JSON.stringify({producaoId:'fisica-pendente',revisao:'rev-fisica',modo:'FISICO'}));
      assert.equal(await fisico.evaluate(() => JSON.parse(localStorage.getItem('filaProducao'))[0].quantidade), 9);
      assert.equal(await fisico.evaluate(() => window.__db.writes.length), 0);
      await fisico.close();
    } finally { await isolado.close(); }
  });
  await t.test('produção 4 × 5: gesto, pausa, retomada, 20 pontos e histórico idempotente (banco de teste)', async () => {
    const isolated = await browser.newContext();
    const p = await isolated.newPage();
    const reached = [];
    p.on('console', message => { if (/^P\d+ alcançado/.test(message.text())) reached.push(message.text()); });
    p.on('dialog', dialog => dialog.dismiss());
    await isolated.route('**/new-program/firebase-programas.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.__db = { active: null, history: {}, writes: [] };
      window.__program = { nome:'Quatro pontos', versaoFormato:3, pontos: [1,2,3,4].map((n)=>({ordem:n,zMm:53.2+n*.4,anguloMesaGraus:n*2,solda:{ativar:false}})) };
      window.carregarProgramaFirebase=async()=>window.__program;
      window.listarProgramasFirebase=async()=>({teste:window.__program});
      window.salvarProgramaFirebase=async()=>{}; window.excluirProgramaFirebase=async()=>{};
      window.buscarProducaoAtualFirebase=async()=>window.__db.active;
      window.salvarProducaoAtualFirebase=async d=>{window.__db.active=structuredClone(d);window.__db.writes.push(structuredClone(d));};
      window.removerProducaoAtualFirebase=async()=>{window.__db.active=null};
      window.salvarHistoricoProducaoFirebase=async d=>{window.__db.history[d.producaoId]=structuredClone(d)};
      window.salvarProducaoDiaFirebase=async()=>{};
      window.iniciarPausaFirebase=async()=>({id:'pausa-teste',inicioTimestamp:Date.now()});
      window.finalizarPausaFirebase=async()=>({duracaoSegundos:1});
      window.atualizarMotivoPausaFirebase=async()=>{};
    ` }));
    try {
      await p.goto(base + '/new-program/novoprograma.html?programaVisao=teste&quantidade=5');
      await p.waitForFunction(() => mesaReal && conjuntoMovel && estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO);
      await p.locator('#btnIniciarCiclo').click();
      await p.waitForFunction(() => estadoExecucao === EstadoExecucao.EXECUTANDO);
      await p.evaluate(() => window.controlarSimulacaoPorGesto('PAUSA'));
      assert.equal(await p.evaluate(() => estadoExecucao), 'PAUSADO');
      const point = await p.evaluate(() => indicePontoAtual);
      await p.waitForTimeout(100);
      assert.equal(await p.evaluate(() => indicePontoAtual), point);
      await p.evaluate(() => alternarMovimento());
      for (let piece = 1; piece <= 5; piece++) {
        await p.waitForFunction(() => estadoExecucao === EstadoExecucao.AGUARDANDO_PECA || estadoExecucao === EstadoExecucao.FINALIZADO);
        if (piece < 5) {
          assert.equal(await p.evaluate(() => repeticaoAtual), piece);
          await p.evaluate(() => confirmarPecaPosicionada());
        }
      }
      await p.waitForFunction(() => Object.keys(window.__db.history).length === 1 && window.__db.active === null);
      assert.equal(reached.length, 20);
      const result = await p.evaluate(() => ({ history: Object.values(window.__db.history), progress: document.getElementById('textoProgresso').innerText, writes: window.__db.writes }));
      assert.equal(result.history[0].quantidade, 5);
      assert.equal(result.progress, '100%');
      assert.ok(result.history[0].fimTimestamp >= result.history[0].inicioTimestamp);
      assert.ok(result.writes.some(d => d.status === 'PAUSADO'));
      assert.ok(result.writes.some(d => d.pontosExecutados === 20));
      await p.evaluate(() => concluirProgramaAtual());
      assert.equal(await p.evaluate(() => Object.keys(window.__db.history).length), 1);
    } finally { await isolated.close(); }
  });
  await t.test('viewport 3D separado dos painéis em 375/390/440/768/1366 px', async () => {
    for (const width of [375,390,440,768,1366]) {
      await page.setViewportSize({width,height:900});
      await page.waitForTimeout(100);
      const boxes = await page.evaluate(() => {
        const box = selector => { const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
        return { canvas:box('body > canvas'), controls:box('body > .painel'), clp:box('#painelConexao'), overflow:document.documentElement.scrollWidth > innerWidth };
      });
      const overlaps = (a,b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      assert.equal(boxes.overflow,false,JSON.stringify(boxes));
      assert.equal(overlaps(boxes.canvas,boxes.clp),false);
      assert.equal(overlaps(boxes.canvas,boxes.controls),false);
    }
  });
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
});
