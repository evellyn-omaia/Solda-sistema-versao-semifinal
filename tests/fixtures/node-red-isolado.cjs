// Runtime real, com Functions/MQTT do flow original e adaptador Modbus sem rede.
const RED = require("node-red");
const http = require("node:http");
const path = require("node:path");
const server = http.createServer();
RED.init(server, {
  userDir: process.argv[2], flowFile: "flows.json", credentialSecret: false,
  httpAdminRoot: false, httpNodeRoot: false,
  nodesDir: path.resolve(__dirname, "../../node_modules/@node-red/nodes"),
  functionGlobalContext: process.env.TEST_MODBUS_PORT ? {
    modbusSerial: require('modbus-serial'),
    soldatechSimulador: { port: Number(process.env.TEST_MODBUS_PORT),
      mapa: require('../../scripts/simulador.cjs').mapa, snapshot: () => ({}) },
  } : {},
  logging: { console: { level: "info", metrics: false, audit: false } },
});
RED.start().catch(error => { console.error(error.message); process.exit(1); });
process.on("SIGTERM", () => RED.stop().then(() => process.exit(0)));
