// Configuração pública: somente endpoint e preferências, nunca senhas permanentes.
// Em HTTPS, defina url como wss://SEU-ENDPOINT/mqtt depois de configurar TLS/ACL.
// Credenciais temporárias podem ser fornecidas em memória antes de mqtt-maquina.js.
window.SoldaTechMQTTConfig = window.SoldaTechMQTTConfig || {};

window.SoldaTechMQTTConfig.publico = !window.SoldaTechMQTTConfig.simulacao && !window.SoldaTechMQTTConfig.url;
