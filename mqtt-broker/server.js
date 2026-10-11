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

const PORTA_MQTT_TCP = 1883;
const PORTA_MQTT_WS = 8888;

const servidorTcp = net.createServer(aedes.handle);

servidorTcp.listen(PORTA_MQTT_TCP, () => {
  console.log(`[MQTT TCP] ouvindo em mqtt://localhost:${PORTA_MQTT_TCP} (uso: Node-RED)`);
});

const servidorHttp = http.createServer();

websocketStream.createServer({ server: servidorHttp }, aedes.handle);

servidorHttp.listen(PORTA_MQTT_WS, () => {
  console.log(`[MQTT WS]  ouvindo em ws://localhost:${PORTA_MQTT_WS} (uso: navegador)`);
});

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
    console.log(`[msg] ${cliente.id} -> ${pacote.topic}: ${pacote.payload.toString()}`);
  }
});

process.on("SIGINT", () => {
  console.log("\nEncerrando broker...");
  servidorTcp.close();
  servidorHttp.close();
  process.exit(0);
});
