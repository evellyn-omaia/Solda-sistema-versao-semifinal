// Credenciais de desenvolvimento ficam apenas no arquivo local ignorado pelo Git.
window.SoldaTechMQTTConfig = Object.assign({
  publico: false, simulacao: false,
  url: "wss://d86f195585704b50bc165c7872060e82.s1.eu.hivemq.cloud:8884/mqtt"
}, window.SoldaTechMQTTConfig || {});
