// O emissor é um backend HTTPS autenticado, nunca o painel web do HiveMQ.
export async function obterCredencialTemporaria({ authUrl, obterToken, fetchImpl = fetch }) {
  if (!authUrl || new URL(authUrl).protocol !== 'https:')
    throw new Error('Autenticação MQTT não configurada. Configure o emissor HTTPS para operar pelo celular.');
  const token = await obterToken();
  const response = await fetchImpl(authUrl, { method: 'POST', redirect: 'error', cache: 'no-store',
    credentials: 'omit', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recurso: 'soldatouch' }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Autenticação MQTT recusada (${response.status}).`);
  const credencial = await response.json();
  if (token !== await obterToken()) throw new Error('O login mudou durante a autenticação. Tente novamente.');
  return credencial;
}
if (typeof document !== 'undefined' && window.SoldaTechMQTTConfig?.exigirAutenticacaoTemporaria) {
  const painel = document.getElementById('painelConexao');
  const botao = document.createElement('button');
  botao.type = 'button'; botao.textContent = 'Conectar ao HiveMQ';
  const estado = document.createElement('p'); estado.setAttribute('role', 'status');
  estado.textContent = window.SoldaTechMQTTConfig.authUrl ? 'Entre na conta e conecte para operar.' :
    'Emissor de credenciais temporárias ainda não configurado.';
  painel?.append(botao, estado);
  botao.onclick = async () => {
    botao.disabled = true;
    try {
      estado.textContent = 'Autenticando operador...';
      const credencial = await obterCredencialTemporaria({ authUrl: window.SoldaTechMQTTConfig.authUrl,
        obterToken: () => {
          if (!window.obterTokenOperadorMQTT) throw new Error('Aguarde o login Firebase carregar.');
          return window.obterTokenOperadorMQTT();
        } });
      await window.autenticarSessaoMQTT(credencial);
      estado.textContent = 'Conexão solicitada. Confira MQTT, Node-RED e CLP separadamente.';
    } catch (erro) { estado.textContent = erro.message; }
    finally { botao.disabled = false; }
  };
}
