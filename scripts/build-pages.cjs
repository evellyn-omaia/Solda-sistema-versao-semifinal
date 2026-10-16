const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist-pages');
// A saída é exclusivamente gerada; não reutilizar arquivos de builds anteriores.
if (path.dirname(out) !== root || path.basename(out) !== 'dist-pages') throw new Error('Destino de build inválido');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const dirs = ['solda-login', 'solda-system', 'new-program', 'carregar-programa', 'iniciar-producao', 'modo-ensino', 'painel-producao', 'configuracoes', 'alarmes', 'shared', 'images', 'assets'];
const extensions = new Set(['.html', '.css', '.js', '.mjs', '.glb', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.wasm', '.task']);
function copyAsset(source, target) {
  if (/\.(?:html|css|m?js|svg)$/.test(source)) {
    fs.writeFileSync(target, fs.readFileSync(source, 'utf8').replace(/\r\n/g, '\n'));
  } else fs.copyFileSync(source, target);
}
function copy(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const source = path.join(src, entry.name), target = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${source}`);
    if (entry.name.startsWith('.') || entry.name === 'mqtt-config.local.js') continue;
    if (entry.isDirectory()) { fs.mkdirSync(target, { recursive: true }); copy(source, target); }
    else if (extensions.has(path.extname(entry.name))) copyAsset(source, target);
  }
}
for (const dir of dirs) {
  if (!fs.existsSync(path.join(root, dir))) continue;
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  copy(path.join(root, dir), path.join(out, dir));
}
for (const file of ['index.html', 'shared-responsive.css']) copyAsset(path.join(root, file), path.join(out, file));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  publicSimulation: false
}, null, 2));
// Pages usa HiveMQ por WSS, sem credencial permanente no artefato.
const authUrl = process.env.SOLDATECH_MQTT_AUTH_URL || '';
if (authUrl && new URL(authUrl).protocol !== 'https:') throw new Error('Emissor MQTT precisa de HTTPS.');
fs.writeFileSync(path.join(out, 'new-program/mqtt-config.js'),
  'window.SoldaTechMQTTConfig = ' + JSON.stringify({ publico: false, simulacao: false,
    exigirAutenticacaoTemporaria: true, authUrl,
    url: 'wss://d86f195585704b50bc165c7872060e82.s1.eu.hivemq.cloud:8884/mqtt' }) + ';\n');
for (const file of fs.readdirSync(out, { recursive: true })) {
  if (!file.endsWith('.html')) continue;
  const target = path.join(out, file);
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\s*<script\s+src="mqtt-config\.local\.js"><\/script>/g, ''));
}
console.log('Site estático preparado em dist-pages; nenhum serviço ou credencial local incluído.');
