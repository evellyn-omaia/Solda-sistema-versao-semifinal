// Mapa EXCLUSIVO do simulador. Não corresponde ao Schneider M221.
const Modbus = require('modbus-serial');
const mapa = Object.freeze({ coils: { jogCima: 101, jogBaixo: 102, mesaStart: 103 }, discreteInputs: { executando: 301 } });
function criarSimulador(port = 1502) {
  const coils = new Map([[101, false], [102, false], [103, false]]);
  let z = 0, angulo = 0, ultimaEscrita = Date.now();
  const vector = {
    getCoil(address) { if (!coils.has(address)) throw { modbusErrorCode: 2 }; return coils.get(address); },
    setCoil(address, value) {
      if (!coils.has(address)) throw { modbusErrorCode: 2 };
      coils.set(address, Boolean(value)); ultimaEscrita = Date.now();
    },
    getDiscreteInput(address) {
      const bits = [coils.get(103), coils.get(103), false, false, false];
      if (address < 301 || address > 305) throw { modbusErrorCode: 2 };
      return bits[address - 301];
    },
  };
  const server = new Modbus.ServerTCP(vector, { host: '127.0.0.1', port, unitID: 1 });
  const timer = setInterval(() => {
    // Watchdog apenas do simulador; não é um intertravamento industrial.
    if (Date.now() - ultimaEscrita > 15000) for (const key of coils.keys()) coils.set(key, false);
    z = Math.max(0, Math.min(200, z + (Number(coils.get(101)) - Number(coils.get(102))) * 0.2));
    if (coils.get(103)) angulo = (angulo + 1) % 360;
  }, 100);
  timer.unref();
  return { server, mapa, snapshot: () => ({ posicaoZMm: z, anguloMesaGraus: angulo }),
    close: () => { clearInterval(timer); server.close(); } };
}
module.exports = { criarSimulador, mapa };
