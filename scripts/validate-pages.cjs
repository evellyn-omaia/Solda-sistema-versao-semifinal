const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist-pages');
const files = fs.readdirSync(root, { recursive: true }).filter(f => fs.statSync(path.join(root, f)).isFile());
let refs = 0, scripts = 0;
for (const file of files) {
  assert.ok(!/(^|[/\\])(node_modules|node-red|mqtt-broker|scripts|\.git|\.soldatech)([/\\]|$)/.test(file), file);
  assert.ok(!/(?:^|[/\\])(?:\.env.*|.*\.(?:pem|key|p12|pfx)|.*(?:service[-_]?account|credentials|private[-_]?config).*)$/i.test(file), `Arquivo privado: ${file}`);
  if (!/\.(html|css|m?js|json|svg)$/.test(file)) continue;
  const body = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!/hivemq|https:\/\/unpkg\.com\/mqtt@|https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(body), `Dependência industrial no pacote: ${file}`);
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"private_key"\s*:|\bgh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(body), `Possível segredo: ${file}`);
  assert.ok(!/\b(?:password|MQTT_PASSWORD|MQTT_PASS)\s*[:=]\s*["'][^"']+["']/.test(body), `Senha literal no pacote: ${file}`);
  assert.ok(!/\b(?:adminToken|client_secret|access_token|refresh_token)\b["']?\s*[:=]\s*["'][^"']+["']|"type"\s*:\s*"service_account"/i.test(body), `Token privado no pacote: ${file}`);
  if (/\.m?js$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: body, encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`); scripts++;
  }
  const patterns = /\.html$/.test(file) ? [/(?:src|href)\s*=\s*["']([^"']+)["']/g] : /\.css$/.test(file) ? [/url\(\s*["']?([^\s"')]+)["']?\s*\)/g] : [/(?:from\s*|import\s*\(?\s*)["'](\.[^"']+)["']/g, /["']([^"']+\.glb)["']/g];
  for (const pattern of patterns) for (const match of body.matchAll(pattern)) {
    const ref = match[1];
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    assert.ok(!ref.startsWith('/'), `Caminho absoluto incompatível com Pages: ${file}: ${ref}`);
    const target = path.resolve(path.dirname(path.join(root, file)), decodeURIComponent(ref.split(/[?#]/)[0]));
    assert.ok(target.startsWith(root + path.sep) && fs.existsSync(target), `Arquivo ausente: ${file}: ${ref}`); refs++;
  }
}
for (const file of ['index.html', '.nojekyll', 'assets/models/montagem_victor_final.glb', 'new-program/visao-camera.mjs', 'new-program/simulacao-integrada.mjs']) assert.ok(files.includes(file) || files.includes(file.replaceAll('/', path.sep)), file);
console.log(JSON.stringify({ files: files.length, scripts, localReferences: refs, result: 'PASS', secretScan: 'patterns only; Firebase public config is expected' }, null, 2));
