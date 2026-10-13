# Acessos e rotação — 13/10/2026

## MQTT: localização e contenção

O site anterior distribui credenciais em `new-program/mqtt-maquina.js`. A auditoria `retomada-remoto.json` registra somente caminhos, linhas e indicadores. Não testa essas credenciais. O commit de backup também tem candidatos literais nas linhas 557 e 559 desse arquivo. Referências ao HiveMQ em README, tutoriais e comentários não comprovam uso de credenciais.

No código corrigido, `new-program/mqtt-maquina.js` recebe username/password de `SoldaTechMQTTConfig` apenas no modo privado. O build substitui a configuração por `{publico:true}` imutável, remove o SDK MQTT dos HTMLs e bloqueia a conexão. Não coloque credenciais novas em `mqtt-config.js`, JavaScript público ou variáveis de build do Pages.

`visao-python/visao.py` usa `MQTT_USER` e `MQTT_PASS` (ou `MQTT_PASSWORD`) do processo. O broker local usa `MQTT_USERS_FILE` com hashes e permanece em loopback. O fluxo Node-RED utiliza broker local; credenciais privadas eventualmente salvas no editor devem ser verificadas pelo responsável no ambiente privado. Nenhum desses serviços integra o artefato Pages. A demonstração pública não necessita substituição de credenciais MQTT.

Procedimento para o administrador autorizado do HiveMQ:

1. Entrar em https://console.hivemq.cloud/ e selecionar o cluster do endpoint antigo. Comparar o usuário exposto **privadamente**, sem copiar valores para tickets, commits ou este relatório.
2. Abrir **Access Management → Access Credentials** (em algumas versões, Authentication → Credentials → Edit). Excluir a credencial comprometida. Registrar apenas data, responsável e identificador interno do incidente.
3. Encerrar também as conexões existentes dessa identidade pelo Control Center/API disponível no plano. A exclusão não desconecta clientes já conectados; o cache pode levar até um minuto. Se o plano não permitir encerrar sessões, solicitar ao suporte do HiveMQ a invalidação das sessões comprometidas. Não declarar revogação concluída apenas por remover o JavaScript do site.
4. Se um serviço privado ainda precisar de MQTT, criar identidade distinta por serviço com senha aleatória em cofre privado e ACL mínima. A identidade da visão só precisa publicar o tópico de gestos aprovado; não conceder comandos ao CLP nem usar a permissão geral Allow All. A troca no cliente ocorre exclusivamente em configuração privada/variáveis do processo. Para a demonstração pública, manter MQTT desativado.
5. O administrador deve conferir logs e comprovar a rejeição da identidade antiga em uma tentativa controlada de autenticação, sem publicar mensagens. Não realizar testes de atuação. Registrar a evidência sem usuário, senha ou token. Procurar reutilização em outros serviços e rotacionar cada ocorrência.
6. O histórico Git e caches podem conservar a credencial antiga. A revogação é obrigatória; limpeza de histórico requer plano separado coordenado com colaboradores, sem force-push nesta integração.

Fonte oficial: [HiveMQ Authentication and Authorization](https://docs.hivemq.com/hivemq-cloud/authn-authz.html). Revogação e substituição reais: **NÃO TESTADO**, sem sessão administrativa HiveMQ disponível.

## GitHub e Pages

A API do repositório antigo redireciona para `evellyn-omaia/Solda-sistema-versao-semifinal`. A credencial do gerenciador Git local possui push/admin; seu valor não foi exibido. Não é necessário novo login GitHub nesta rodada.

Se outro operador não tiver acesso: entrar no GitHub com conta autorizada; abrir [Settings → Pages](https://github.com/evellyn-omaia/Solda-sistema-versao-semifinal/settings/pages); em **Build and deployment → Source**, selecionar **GitHub Actions**. Se o campo estiver indisponível, solicitar ao administrador ou mantenedor essa alteração. Depois abrir Actions → Publicar demonstração SoldaTech → Run workflow → main. O workflow compila `dist-pages`, valida antes do upload e publica exclusivamente esse diretório, com permissões contents:read/pages:write/id-token:write e ambiente github-pages. Execução fora de main é bloqueada.

Fonte oficial: [Configurar a origem do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Firebase: conta autorizada e teste real

Não foi localizada conta de teste disponível, variável de autenticação Firebase/Google ou sessão de navegador acessível. A configuração web do SDK não concede acesso administrativo. Não extrair credenciais de perfis do navegador nem criar acesso público ao banco.

1. O responsável deve abrir https://console.firebase.google.com/ e entrar com a conta autorizada ao projeto `projeto-solda`. Em Authentication → Sign-in method, conferir Email/Password; em Settings → Authorized domains, conferir **evellyn-omaia.github.io** (o domínio anterior não basta).
2. Preferir uma conta de teste existente, vinculada exclusivamente à empresa de homologação. Se não existir, o administrador pode criar um usuário em Authentication → Users → Add user, usando endereço de teste controlado pela equipe e senha exclusiva mantida em cofre. Não usar identidade pessoal nem reutilizar senha industrial.
3. No Realtime Database, criar o vínculo conforme o esquema da aplicação: `usuarios/<uid>` com nome fictício, `empresaId: empresa_<uid>` e `tipoUsuario: admin`; `empresas/empresa_<uid>` com nome de homologação, `adminUid: <uid>` e `criadoEm` numérico. Conferir o esquema em `solda-login/criarConta.js`. Usar somente dados sintéticos; não alterar empresas existentes. Criar também operador de teste vinculado à mesma empresa para validar perfis. Alternativamente, usar Criar conta na aplicação após revisar as regras implantadas.
4. Conferir as regras efetivamente implantadas. As regras locais não foram publicadas automaticamente. Validar isolamento entre empresas e negação sem login antes de usar dados reais; não colocar `.read/.write: true` na raiz.
5. Abrir a URL publicada, entrar pela tela de login com a conta de teste e manter a sessão. A ferramenta atual não enxerga sessões do navegador; o login por si só não garante que a automação possa acessá-la. Registrar manualmente o resultado ou disponibilizar sessão por ferramenta autorizada, sem mandar senha pelo chat.
6. Criar programa de quatro pontos com solda física desativada; salvar e recarregar; executar cinco peças, pausar/retomar e confirmar cada próxima peça. Em outra aba autenticada, abrir o painel. Conferir 20 pontos, 100%, cinco peças, histórico único e remoção da produção ativa, com persistência após reload. Conferir os registros reais no RTDB e repetir login/logout, CRUD e isolamento em outra empresa. Não confundir o adaptador de teste com Firebase real.

Para câmera no celular, seguir o roteiro de `RELATORIO_FINAL.md` usando o domínio atual. A câmera requer HTTPS e consentimento no dispositivo. Não inserir um programa de produção real nem habilitar o modo físico.

Referências Firebase: [Email/Password](https://firebase.google.com/docs/auth/web/password-auth) e [domínios autorizados](https://firebase.google.com/docs/auth/web/passing-state-in-email-actions). O domínio autorizado é especialmente necessário nos fluxos OAuth e links de ações; conferir essa lista não substitui testar o login Email/Password utilizado pela aplicação.
