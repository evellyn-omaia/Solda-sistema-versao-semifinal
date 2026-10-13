/*
=====================================
BROKER MQTT LOCAL - SOLDATECH
=====================================

Substitui a dependência de um broker
na nuvem (HiveMQ Cloud). Roda no
mesmo PC que o Node-RED e, se estiver
na mesma rede do CLP, isso é tudo que
o "gêmeo digital" precisa.

Duas portas:
- 1883 (TCP)       -> usada pelo Node-RED
- 8888 (WebSocket) -> usada pelo navegador (mqtt.js)

Sem autenticação: pensado para uso
local/rede interna. Se este PC for
expor essas portas para fora da sua
rede local, adicione autenticação
(aedes.authenticate) antes disso.
*/

const aedes = require("aedes")();
const net = require("net");
const http = require("http");
const websocketStream = require("websocket-stream");

const PORTA_MQTT_TCP = Number(process.env.MQTT_TCP_PORT ?? 1883);
const PORTA_MQTT_WS = Number(process.env.MQTT_WS_PORT ?? 8888);
const MQTT_BIND_HOST = process.env.MQTT_BIND_HOST || "127.0.0.1";
const fs = require("node:fs");
const crypto = require("node:crypto");
// Arquivo privado fora do diretório publicado. Nunca imprimir seu conteúdo.
const contas = process.env.MQTT_USERS_FILE
  ? JSON.parse(fs.readFileSync(process.env.MQTT_USERS_FILE, "utf8")) : [];
if (!["127.0.0.1", "::1", "localhost"].includes(MQTT_BIND_HOST)) {
  throw new Error("Broker restrito a loopback. Acesso remoto exige proxy WSS autenticado e rede privada.");
}
if (!Array.isArray(contas) || contas.some(c => !c.username || !c.salt ||
    !/^[a-f0-9]{64}$/i.test(c.hash || "") || !["bridge", "observer", "operator"].includes(c.role))) {
  throw new Error("Configuração de contas MQTT inválida.");
}
const statusTopics = ["soldatech/maquina/status", "soldatech/maquina/resposta", "soldatech/maquina/erro"];
const permitido = (cliente) => cliente?.conta &&
  (!cliente.conta.expiresAt || Date.now() < cliente.conta.expiresAt);
aedes.authenticate = (cliente, username, password, callback) => {
  if (!contas.length) { cliente.localDevelopment = true; callback(null, true); return; }
  const conta = contas.find(c => c.username === username);
  const ok = conta && (!conta.expiresAt || Date.now() < conta.expiresAt) &&
    crypto.timingSafeEqual(crypto.scryptSync(password || "", conta.salt, 32), Buffer.from(conta.hash, "hex"));
  if (ok) cliente.conta = conta;
  callback(null, Boolean(ok));
};
aedes.authorizePublish = (cliente, pacote, callback) => {
  const negar = () => callback(new Error("Publicação não autorizada"));
  if (pacote.payload.length > 16384 || pacote.retain) return negar();
  if (cliente?.localDevelopment) {
    // Desenvolvimento anônimo não dá acesso a comandos industriais.
    if (pacote.topic === "soldatech/maquina/comando") {
      try { if (JSON.parse(pacote.payload).comando !== "PING") return negar(); } catch { return negar(); }
    }
    return callback(null);
  }
  if (!permitido(cliente)) return negar();
  const role = cliente.conta.role;
  if (role === "operator" && pacote.topic === "soldatech/visao/gesto") {
    try {
      const gesto = JSON.parse(pacote.payload);
      if (["START", "PAUSA"].includes(gesto.gesto) && gesto.simulacao === true &&
          Number.isFinite(gesto.timestamp) && Math.abs(Date.now() - gesto.timestamp) <= 5000) return callback(null);
    } catch { /* negar */ }
    return negar();
  }
  if (role === "bridge" && statusTopics.includes(pacote.topic)) return callback(null);
  if (pacote.topic === "soldatech/maquina/comando" && ["observer", "operator"].includes(role)) {
    try {
      const comando = JSON.parse(pacote.payload).comando;
      if (comando === "PING" || (role === "operator" &&
          ["JOG_CIMA", "JOG_BAIXO", "JOG_PARAR", "JOG_PULSO", "MESA_START", "MESA_STOP", "SOLDA_OFF"].includes(comando))) return callback(null);
    } catch { /* negar */ }
  }
  return negar();
};
aedes.authorizeSubscribe = (cliente, subscription, callback) => {
  const role = cliente?.conta?.role;
  const ok = cliente?.localDevelopment || (permitido(cliente) &&
    (role === "bridge" ? ["soldatech/maquina/comando", "soldatech/visao/gesto"].includes(subscription.topic) :
      [...statusTopics, "soldatech/visao/gesto"].includes(subscription.topic)));
  callback(null, ok ? subscription : null);
};
aedes.authorizeForward = (cliente, pacote) => {
  // Aedes 0.51.3: lib/client.js chama authorizeForward(cliente, pacote).
  const autorizado =
    Boolean(cliente.localDevelopment) ||
    Boolean(permitido(cliente));

  if (!autorizado) {
    console.warn(
      "[MQTT] Encaminhamento negado:",
      cliente.id || "desconhecido",
      pacote?.topic || "sem tópico"
    );

    return null;
  }

  return pacote;
};
const expirar = setInterval(() => {
  for (const cliente of Object.values(aedes.clients)) {
    if (cliente.conta && !permitido(cliente)) cliente.close();
  }
}, 1000);
expirar.unref();

for (const porta of [PORTA_MQTT_TCP, PORTA_MQTT_WS]) {
  if (!Number.isInteger(porta) || porta < 0 || porta > 65535) {
    throw new Error("Porta MQTT inválida.");
  }
}

const servidorTcp = net.createServer(aedes.handle);

servidorTcp.listen(PORTA_MQTT_TCP, MQTT_BIND_HOST, () => {
  console.log(`[MQTT TCP] ouvindo em mqtt://${MQTT_BIND_HOST}:${servidorTcp.address().port} (uso: Node-RED)`);
});

const servidorHttp = http.createServer((req, res) => { res.writeHead(404); res.end(); });

websocketStream.createServer({ server: servidorHttp }, aedes.handle);

servidorHttp.listen(PORTA_MQTT_WS, MQTT_BIND_HOST, () => {
  console.log(`[MQTT WS]  ouvindo em ws://${MQTT_BIND_HOST}:${servidorHttp.address().port} (uso: navegador)`);
});

for (const servidor of [servidorTcp, servidorHttp]) {
  servidor.on("error", (erro) => {
    console.error("Falha ao iniciar broker:", erro.code);
    process.exit(1);
  });
}

aedes.on("client", (cliente) => {
  console.log(`[+] cliente conectado: ${cliente.id}`);
});

aedes.on("clientDisconnect", (cliente) => {
  console.log(`[-] cliente desconectado: ${cliente.id}`);
});

aedes.on("publish", (pacote, cliente) => {
  if (!cliente) {
    return;
  }

  if (pacote.topic.startsWith("soldatech/")) {
    console.log(`[msg] ${pacote.topic} (${pacote.payload.length} bytes)`);
  }
});

let encerrando = false;
function encerrar() {
  if (encerrando) return;
  encerrando = true;
  console.log("\nEncerrando broker...");
  clearInterval(expirar);
  const limite = setTimeout(() => process.exit(1), 3000);
  limite.unref();
  servidorTcp.close();
  servidorHttp.close();
  aedes.close(() => { clearTimeout(limite); process.exit(0); });
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
aedes.on("clientError", (cliente, erro) => {
  console.error(
    "[MQTT] Erro no cliente:",
    cliente?.id || "desconhecido",
    erro?.message || erro
  );
});

aedes.on("connectionError", (cliente, erro) => {
  console.error(
    "[MQTT] Erro de conexão:",
    cliente?.id || "desconhecido",
    erro?.message || erro
  );
});
