const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const test = require('node:test');

const mqtt = require('mqtt');

function deadline(promise, label, ms = 4000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout na etapa: ${label}`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function connect(url, clientId) {
  const client = mqtt.connect(url, {
    clientId, protocolVersion: 4, clean: true,
    reconnectPeriod: 0, connectTimeout: 3000,
  });
  return { client, ready: deadline(Promise.race([
    once(client, 'connect'),
    once(client, 'error').then(([error]) => Promise.reject(error)),
  ]), `conexão ${clientId}`) };
}

test('broker isolado entrega mensagem MQTT de TCP para WebSocket', { timeout: 15000 }, async (t) => {
  const pasta = path.join(__dirname, '..', 'mqtt-broker');
  const broker = spawn(process.execPath, [path.join(pasta, 'server.js')], {
    cwd: pasta,
    env: { ...process.env, MQTT_BIND_HOST: '127.0.0.1', MQTT_TCP_PORT: '0', MQTT_WS_PORT: '0', MQTT_USERS_FILE: '' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const clients = [];
  let logs = '';
  broker.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  broker.stderr.on('data', (chunk) => { logs += chunk.toString(); });
  t.after(() => {
    for (const client of clients) client.end(true);
    broker.kill();
  });

  try {
    const ports = await deadline(new Promise((resolve, reject) => {
      let stdout = '';
      broker.once('error', reject);
      broker.once('exit', (code) => reject(new Error(`Broker encerrou: ${code}`)));
      broker.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        const tcp = stdout.match(/mqtt:\/\/127\.0\.0\.1:(\d+)/);
        const ws = stdout.match(/ws:\/\/127\.0\.0\.1:(\d+)/);
        if (tcp && ws) resolve({ tcp: Number(tcp[1]), ws: Number(ws[1]) });
      });
    }), 'inicialização do broker', 5000);

    console.log('[ETAPA 1] Broker iniciado', ports);
    const receiver = connect(`ws://127.0.0.1:${ports.ws}`, 'teste-ws-receptor');
    clients.push(receiver.client);
    await receiver.ready;
    console.log('[ETAPA 2] WebSocket conectado');

    const topic = 'soldatech/test/isolado';
    const received = deadline(new Promise((resolve, reject) => {
      receiver.client.once('message', (actualTopic, payload) => resolve({ actualTopic, payload: payload.toString() }));
      receiver.client.once('error', reject);
    }), 'recebimento WebSocket');
    // Evita rejeição não tratada se uma etapa anterior falhar.
    received.catch(() => {});

    const granted = await deadline(new Promise((resolve, reject) => {
      receiver.client.subscribe(topic, { qos: 1 }, (err, subscriptions) => err ? reject(err) : resolve(subscriptions));
    }), 'SUBACK WebSocket');
    assert.equal(granted[0].topic, topic);
    assert.notEqual(granted[0].qos, 128, 'Broker recusou a assinatura');
    console.log('[ETAPA 3] Assinatura confirmada', granted);

    const sender = connect(`mqtt://127.0.0.1:${ports.tcp}`, 'teste-tcp-emissor');
    clients.push(sender.client);
    await sender.ready;
    console.log('[ETAPA 4] TCP conectado');

    await deadline(new Promise((resolve, reject) => {
      sender.client.publish(topic, '{"teste":true}', { qos: 1 }, (err) => err ? reject(err) : resolve());
    }), 'PUBACK TCP');
    console.log('[ETAPA 5] Publicação confirmada');

    const message = await received;
    assert.equal(message.actualTopic, topic);
    assert.equal(message.payload, '{"teste":true}');
    console.log('[ETAPA 6] Mensagem recebida via WebSocket');
  } catch (error) {
    console.error('[DIAGNÓSTICO] Saída do broker:\n' + logs);
    throw error;
  }
});
