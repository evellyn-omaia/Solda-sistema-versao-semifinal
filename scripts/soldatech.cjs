const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const RED = require('node-red');
const mqtt = require('mqtt');
const { criarSimulador } = require('./simulador.cjs');
const raiz = path.resolve(__dirname, '..');
const stateDir = process.env.SOLDATECH_STATE_DIR || path.join(raiz, '.soldatech');
const ports = { tcp: +(process.env.MQTT_TCP_PORT || 1883), ws: +(process.env.MQTT_WS_PORT || 8888),
  web: +(process.env.SOLDATECH_WEB_PORT || 8080), red: +(process.env.SOLDATECH_RED_PORT || 1880), modbus: +(process.env.SOLDATECH_MODBUS_PORT || 1502) };
let broker, simulator, monitor, server, redServer, userDir, closing = false, redStarted = false;
let lastStatus = null;
const token = crypto.randomBytes(32).toString('hex');
const stateFile = path.join(stateDir, 'runtime.json');
function conta(role) {
  const password = crypto.randomBytes(32).toString('hex'), salt = crypto.randomBytes(16).toString('hex');
  return { public: { username: role, password }, stored: { username: role, role, salt,
    hash: crypto.scryptSync(password, salt, 32).toString('hex') } };
}
const bridge = conta('bridge'), operator = conta('operator');
async function available(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta inválida: ' + port);
  await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', () => reject(new Error(`Porta ${port} ocupada. Nenhum processo externo foi encerrado.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
async function stop(code = 0) {
  if (closing) return; closing = true;
  const timeout = setTimeout(() => process.exit(1), 7000); timeout.unref();
  monitor?.end(true);
  if (redStarted) await RED.stop().catch(() => {});
  simulator?.close();
  if (broker && broker.exitCode === null) {
    await new Promise(resolve => { broker.once('exit', resolve); broker.kill(); });
  }
  server?.close(); redServer?.close();
  if (fs.existsSync(stateFile)) {
    try { if (JSON.parse(fs.readFileSync(stateFile)).pid === process.pid) fs.unlinkSync(stateFile); } catch {}
  }
  if (userDir) fs.rmSync(userDir, { recursive: true, force: true });
  console.log('[SoldaTech] Serviços encerrados.');
  process.exit(code);
}
async function main() {
  if (new Set(Object.values(ports)).size !== 5) throw new Error('Cada serviço precisa de uma porta diferente.');
  for (const port of Object.values(ports)) await available(port);
  userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soldatech-runtime-'));
  const users = path.join(userDir, 'users.json');
  fs.writeFileSync(users, JSON.stringify([bridge.stored, operator.stored]), { mode: 0o600 });
  broker = spawn(process.execPath, [path.join(raiz, 'mqtt-broker/server.js')], { windowsHide: true,
    env: { ...process.env, MQTT_TCP_PORT: String(ports.tcp), MQTT_WS_PORT: String(ports.ws), MQTT_BIND_HOST: '127.0.0.1', MQTT_USERS_FILE: users }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let output = ''; const timeout = setTimeout(() => reject(new Error('Broker não iniciou.')), 8000);
    broker.once('error', reject); broker.once('exit', () => { clearTimeout(timeout); reject(new Error('Broker encerrou durante início.')); });
    broker.stdout.on('data', chunk => {
      process.stdout.write(chunk); output += chunk;
      if (output.includes('[MQTT TCP]') && output.includes('[MQTT WS]')) { clearTimeout(timeout); resolve(); }
    });
    broker.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  broker.once('exit', () => { if (!closing) { console.error('Broker encerrou; encerrando sessão.'); void stop(1); } });
  simulator = criarSimulador(ports.modbus);
  simulator.server.on('error', error => { console.error('Simulador:', error.message); void stop(1); });
  const flow = JSON.parse(fs.readFileSync(path.join(raiz, 'node-red/flows.json')));
  flow.find(n => n.id === 'brokerSoldaTech').port = String(ports.tcp);
  fs.writeFileSync(path.join(userDir, 'flows.json'), JSON.stringify(flow));
  fs.writeFileSync(path.join(userDir, 'flows_cred.json'), JSON.stringify({ brokerSoldaTech: { user: bridge.public.username, password: bridge.public.password } }), { mode: 0o600 });
  redServer = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ service: 'Node-RED', simulacao: true })); });
  RED.init(redServer, { userDir, flowFile: 'flows.json', credentialSecret: false,
    httpAdminRoot: false, httpNodeRoot: false, disableEditor: true,
    nodesDir: path.join(raiz, 'node_modules/@node-red/nodes'),
    functionGlobalContext: { modbusSerial: require('modbus-serial'), soldatechSimulador: { ...simulator, port: ports.modbus } },
    logging: { console: { level: 'warn', metrics: false, audit: false } }, mqttReconnectTime: 1000 });
  redStarted = true; await RED.start();
  redServer.listen(ports.red, '127.0.0.1');
  monitor = mqtt.connect(`mqtt://127.0.0.1:${ports.tcp}`, { ...operator.public, reconnectPeriod: 1000 });
  monitor.on('connect', () => monitor.subscribe('soldatech/maquina/status'));
  monitor.on('message', (_, payload) => { try { lastStatus = { ...JSON.parse(payload), receivedAt: Date.now() }; } catch {} });
  monitor.on('error', () => {});
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm', '.json': 'application/json' };
  const publicDirs = new Set(['shared', 'configuracoes', 'alarmes', 'images', 'new-program', 'assets', 'solda-system', 'solda-login', 'iniciar-producao', 'carregar-programa', 'modo-ensino', 'painel-producao', 'teste-esp32']);
  server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (![ `127.0.0.1:${ports.web}`, `localhost:${ports.web}` ].includes(host)) { res.writeHead(403).end(); return; }
      if (req.headers.origin && ![`http://127.0.0.1:${ports.web}`, `http://localhost:${ports.web}`].includes(req.headers.origin)) { res.writeHead(403).end(); return; }
      const url = new URL(req.url, `http://${host}`);
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
      if (url.pathname === '/__stop' && req.method === 'POST') {
        if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403).end(); return; }
        res.end('Encerrando'); setImmediate(() => void stop()); return;
      }
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      if (url.pathname === '/') { res.writeHead(302, { Location: '/new-program/novoprograma.html' }).end(); return; }
      if (url.pathname === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ mode: 'simulacao', ports, mqtt: monitor.connected,
          nodeRed: !!lastStatus && Date.now() - lastStatus.receivedAt < 4000,
          clp: lastStatus?.clpConectado && Date.now() - lastStatus.receivedAt < 4000 ? 'SIMULACAO' : 'INDISPONIVEL' })); return;
      }
      if (url.pathname === '/new-program/mqtt-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(`window.SoldaTechMQTTConfig = ${JSON.stringify({ url: `ws://127.0.0.1:${ports.ws}`, ...operator.public, simulacao: true })};`); return;
      }
      if (url.pathname === '/vendor/mqtt.min.js') {
        res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.promises.readFile(path.join(raiz, 'node_modules/mqtt/dist/mqtt.min.js'))); return;
      }
      const pathname = decodeURIComponent(url.pathname === '/' ? '/new-program/novoprograma.html' : url.pathname);
      const relative = pathname.slice(1);
      if ((!publicDirs.has(relative.split('/')[0]) && !['index.html', 'shared-responsive.css'].includes(relative)) || relative.includes('\\')) { res.writeHead(404).end(); return; }
      const file = path.resolve(raiz, relative);
      if (!file.startsWith(raiz + path.sep) || !mime[path.extname(file)]) { res.writeHead(404).end(); return; }
      let content = await fs.promises.readFile(file);
      if (file.endsWith('novoprograma.html')) {
        content = content.toString().replace('https://unpkg.com/mqtt@5.16.0/dist/mqtt.min.js', '/vendor/mqtt.min.js');
      }
      res.setHeader('Content-Type', mime[path.extname(file)]); res.end(content);
    } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(ports.web, '127.0.0.1', resolve); });
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ pid: process.pid, token, ports }), { mode: 0o600 });
  console.log(`[SoldaTech] Simulação: http://127.0.0.1:${ports.web} | Node-RED ${ports.red} | Modbus fictício ${ports.modbus}`);
}
process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
main().catch(error => { console.error('[SoldaTech]', error.message); void stop(1); });
