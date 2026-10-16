const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const mqtt = require('mqtt');
function limit(promise, ms = 4000) {
  let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MQTT timeout')), ms); })]).finally(() => clearTimeout(timer));
}
test('MQTT autenticado: matriz TCP/WS, QoS 0/1 e ACL', { timeout: 40000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soldatech-acl-'));
  const accounts = ['bridge', 'observer', 'operator'].map(role => ({ username: role, role, salt: role,
    hash: crypto.scryptSync('test-only', role, 32).toString('hex') }));
  accounts.push({ username: 'expired', role: 'operator', salt: 'expired', hash: crypto.scryptSync('test-only', 'expired', 32).toString('hex'), expiresAt: Date.now() - 1000 });
  const file = path.join(dir, 'users.json'); fs.writeFileSync(file, JSON.stringify(accounts));
  const clients = [];
  const child = spawn(process.execPath, [path.join(__dirname, '../mqtt-broker/server.js')], {
    windowsHide: true, env: { ...process.env, MQTT_USERS_FILE: file, MQTT_TCP_PORT: '0', MQTT_WS_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    await Promise.all(clients.map(c => c.endAsync(true)));
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const ports = await limit(new Promise((resolve, reject) => {
    let out = ''; child.once('error', reject);
    child.stdout.on('data', chunk => { out += chunk; const tcp = out.match(/mqtt:\/\/127\.0\.0\.1:(\d+)/), ws = out.match(/ws:\/\/127\.0\.0\.1:(\d+)/); if (tcp && ws) resolve({ tcp: +tcp[1], ws: +ws[1] }); });
  }));
  const make = (transport, role, password = 'test-only') => {
    const c = mqtt.connect(`${transport === 'tcp' ? 'mqtt' : 'ws'}://127.0.0.1:${ports[transport]}`, { username: role, password, reconnectPeriod: 0, connectTimeout: 2000 });
    c.on('error', () => {}); clients.push(c); return c;
  };
  for (const from of ['tcp', 'ws']) for (const to of ['tcp', 'ws']) for (const pubQos of [0, 1]) for (const subQos of [0, 1]) {
    await t.test(`${from} → ${to}, publicação QoS ${pubQos}, assinatura QoS ${subQos}`, async () => {
      const sender = make(from, 'bridge'), receiver = make(to, 'observer');
      await limit(Promise.all([once(sender, 'connect'), once(receiver, 'connect')]));
      const granted = await receiver.subscribeAsync('soldatech/maquina/status', { qos: subQos });
      assert.equal(granted[0].qos, subQos);
      const received = limit(once(receiver, 'message')); received.catch(() => {});
      await sender.publishAsync('soldatech/maquina/status', 'payload-verificavel', { qos: pubQos });
      const [topic, payload, packet] = await received;
      assert.equal(topic, 'soldatech/maquina/status'); assert.equal(payload.toString(), 'payload-verificavel');
      assert.equal(packet.qos, Math.min(pubQos, subQos));
      await Promise.all([sender.endAsync(), receiver.endAsync()]);
    });
  }
  await t.test('senha incorreta, conta vencida e usuário anônimo recusados', async () => {
    for (const [role, password] of [['operator', 'wrong'], ['expired', 'test-only'], ['', '']]) {
      const c = make('tcp', role, password); const [error] = await limit(once(c, 'error')); assert.match(error.message, /refused|authorized/i);
    }
  });
  await t.test('assinatura proibida retorna SUBACK 128', async () => {
    const c = make('ws', 'observer'); await limit(once(c, 'connect'));
    await assert.rejects(c.subscribeAsync('soldatech/maquina/comando'), /128|Subscribe error/);
  });
  for (const [role, topic, payload, retain] of [
    ['observer', 'soldatech/maquina/status', '{}', false],
    ['observer', 'soldatech/maquina/comando', '{"comando":"MESA_START"}', false],
    ['operator', 'soldatech/maquina/comando', '{"comando":"SOLDA_ON"}', false],
    ['bridge', 'soldatech/maquina/status', '{}', true],
    ['bridge', 'soldatech/maquina/status', 'x'.repeat(16385), false],
  ]) await t.test(`publicação bloqueada: ${role}, ${topic}, retain=${retain}, bytes=${payload.length}`, async () => {
    const c = make('tcp', role); await limit(once(c, 'connect'));
    const closed = limit(once(c, 'close'));
    c.publish(topic, payload, { retain, qos: 0 }); await closed;
    assert.equal(c.connected, false);
  });
});
