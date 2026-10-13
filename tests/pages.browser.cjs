// dist-pages only, served under a GitHub project prefix. Firebase is mocked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
test('public package without Node-RED or MQTT', {timeout:120000}, async t => {
 const root=path.resolve(__dirname,'../dist-pages');
 const prefix='/Solda-sistema-versao-semifinal';
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(prefix+'/')) return res.writeHead(404).end();
  const file=path.resolve(root,'.'+pathname.slice(prefix.length));
  if(!file.startsWith(root+path.sep)) return res.writeHead(403).end();
  try {const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const base=process.env.PAGES_BASE_URL || `http://127.0.0.1:${server.address().port}${prefix}`;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 t.after(()=>browser.close());
  await t.test('produção 4 × 5: gesto, pausa, retomada, 20 pontos e histórico idempotente (banco de teste)', async () => {
    const isolated = await browser.newContext();
    const p = await isolated.newPage();
    const reached = [];
    const sockets = [], errors = [], missing = [];
    await isolated.routeWebSocket('**/*', socket => { sockets.push('blocked'); socket.close(); });
    p.on('websocket', s => sockets.push(s.url()));
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => { if(r.status() >= 400) missing.push(r.url()); });
    p.on('console', message => { if (/^P\d+ alcançado/.test(message.text())) reached.push(message.text()); });
    p.on('dialog', dialog => dialog.dismiss());
    await isolated.route('**/new-program/firebase-programas.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.__db = { active: null, history: {}, writes: [] };
      window.__program = { nome:'Quatro pontos', versaoFormato:3, pontos: [1,2,3,4].map((n)=>({ordem:n,zMm:53.2+n*.4,anguloMesaGraus:n*2,solda:{ativar:false}})) };
      window.carregarProgramaFirebase=async()=>window.__program;
      window.listarProgramasFirebase=async()=>({teste:window.__program});
      window.salvarProgramaFirebase=async()=>{}; window.excluirProgramaFirebase=async()=>{};
      const read=()=>JSON.parse(localStorage.getItem('test-active')||'null');
      const broadcast=d=>localStorage.setItem('test-active',JSON.stringify(d));
      window.buscarProducaoAtualFirebase=async()=>read();
      window.buscarHistoricoProducaoFirebase=async()=>JSON.parse(localStorage.getItem('test-history')||'[]');
      window.buscarHistoricoDiarioFirebase=async()=>[];
      window.observarProducaoAtualFirebase=async callback=>{window.__observing=true;callback(read());const listener=e=>{if(e.key==='test-active')callback(read())};addEventListener('storage',listener);return()=>removeEventListener('storage',listener)};
      window.salvarProducaoAtualFirebase=async d=>{window.__db.active=structuredClone(d);window.__db.writes.push(structuredClone(d));broadcast(d);};
      window.removerProducaoAtualFirebase=async()=>{window.__db.active=null;broadcast(null)};
      window.salvarHistoricoProducaoFirebase=async d=>{window.__db.history[d.producaoId]=structuredClone(d);localStorage.setItem('test-history',JSON.stringify(Object.values(window.__db.history)))};
      window.salvarProducaoDiaFirebase=async()=>{};
      window.iniciarPausaFirebase=async()=>({id:'pausa-teste',inicioTimestamp:Date.now()});
      window.finalizarPausaFirebase=async()=>({duracaoSegundos:1});
      window.atualizarMotivoPausaFirebase=async()=>{};
    ` }));
    const panel=await isolated.newPage();
    panel.on('pageerror',e=>errors.push(e.message));
    await panel.goto(base+'/painel-producao/painelproducao.html');
    await panel.waitForFunction(()=>window.__observing);
    try {
      await p.goto(base + '/new-program/novoprograma.html?programaVisao=teste&quantidade=5');
      await p.waitForFunction(() => mesaReal && conjuntoMovel && estadoExecucao === EstadoExecucao.AGUARDANDO_INICIO);
      await p.evaluate(async () => { await window.controlarSimulacaoPorGesto('START'); await window.controlarSimulacaoPorGesto('PAUSA'); });
      assert.equal(await p.evaluate(() => estadoExecucao), 'PAUSADO');
      await panel.waitForFunction(()=>document.getElementById('tempoAtual').textContent.toUpperCase().includes('PAUSADO'));
      const point = await p.evaluate(() => indicePontoAtual);
      await p.waitForTimeout(100);
      assert.equal(await p.evaluate(() => indicePontoAtual), point);
      await p.evaluate(() => alternarMovimento());
      await panel.waitForFunction(()=>document.getElementById('tempoAtual').textContent.toUpperCase().includes('EXECUTANDO'));
      for (let piece = 1; piece <= 5; piece++) {
        await p.waitForFunction(() => estadoExecucao === EstadoExecucao.AGUARDANDO_PECA || estadoExecucao === EstadoExecucao.FINALIZADO);
        if (piece < 5) {
          assert.equal(await p.evaluate(() => repeticaoAtual), piece);
          await p.evaluate(() => confirmarPecaPosicionada());
        }
      }
      await p.waitForFunction(() => Object.keys(window.__db.history).length === 1 && window.__db.active === null);
      assert.equal(reached.length, 20);
      await panel.waitForFunction(()=>producaoAtualGlobal===null);
      await panel.waitForFunction(()=>document.getElementById('totalProduzido').textContent==='5');
      const result = await p.evaluate(() => ({ history: Object.values(window.__db.history), progress: document.getElementById('textoProgresso').innerText, writes: window.__db.writes }));
      assert.equal(result.history[0].quantidade, 5);
      assert.equal(result.progress, '100%');
      assert.ok(result.history[0].fimTimestamp >= result.history[0].inicioTimestamp);
      assert.ok(result.writes.some(d => d.status === 'PAUSADO'));
      assert.ok(result.writes.some(d => d.pontosExecutados === 20));
      await p.evaluate(() => concluirProgramaAtual());
      assert.equal(await p.evaluate(() => Object.keys(window.__db.history).length), 1);
      assert.deepEqual(sockets, [], 'No industrial WebSockets');
      assert.deepEqual(errors, []);
      assert.deepEqual(missing, []);
    } finally { await isolated.close(); }
  });
});

