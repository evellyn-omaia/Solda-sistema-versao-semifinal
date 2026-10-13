// Executado no On Start da Function fnConectarModbus.
// Nenhuma variável de ambiente autoriza equipamento físico nesta distribuição.
global.set('clpClient', null);
global.set('clpEstado', { conectado: false });
global.set('clpControleManualHomologado', false);
global.set('clpSimulacao', false);
const simulador = global.get('soldatechSimulador');
if (!simulador) {
    node.warn('CLP físico bloqueado. Inicie pelo iniciar-soldatech.ps1 para usar o simulador.');
    return;
}
const ModbusRTU = global.get('modbusSerial');
const client = new ModbusRTU();
client.setTimeout(1500);
client.setID(1);
global.set('clpClient', client);
global.set('clpRegs', simulador.mapa);
global.set('clpSimulacao', true);
global.set('clpControleManualHomologado', true); // Somente o servidor fictício loopback.
let fechando = false, conectando = false, timer;
function agendar() {
    if (fechando || timer) return;
    timer = setTimeout(() => { timer = null; conectar(); }, 1000);
}
async function conectar() {
    if (fechando || conectando) return;
    conectando = true;
    try {
        await client.connectTCP('127.0.0.1', { port: simulador.port });
        if (fechando) { client.close(); return; }
        global.set('clpEstado', { conectado: true });
    } catch {
        global.set('clpEstado', { conectado: false }); agendar();
    } finally { conectando = false; }
}
client.on('close', () => {
    global.set('clpEstado', { conectado: false });
    global.set('clpUltimoStatus', null); agendar();
});
client.on('error', () => {
    global.set('clpEstado', { conectado: false }); client.close(); agendar();
});
global.set('clpEncerrar', () => { fechando = true; clearTimeout(timer); client.close(); });
conectar();
