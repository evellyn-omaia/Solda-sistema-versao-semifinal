# Homologação SoldaTech — 13/10/2026

**Resultado: NÃO HOMOLOGADO PARA PUBLICAÇÃO.** A versão local foi corrigida e testada; o site atual não corresponde a ela. Não houve commit, push, alteração de configuração remota ou deploy nesta etapa. O usuário informou que só poderá disponibilizar os acessos mais tarde.

## Resultado por requisito

O status considera o requisito completo, inclusive o ambiente publicado quando aplicável. Um teste com persistência simulada não equivale a Firebase real.

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 1 | Repositório e branch de publicação | APROVADO | `origin`: esterv-dev/Solda-sistema-versao-semifinal; branch local `backup-visao-computacional`, HEAD `e7740cd`; Pages remoto usa `main:/`. A branch local não constava em `git ls-remote --heads origin`. Consulta em `external-status.json`. |
| 2 | Script de build e inclusão dos arquivos | APROVADO | Corrigida limpeza de saída antiga; links simbólicos bloqueados. 56 arquivos, 95 referências locais válidas, modelo GLB e módulos de câmera incluídos. `validate-pages.txt`, `build-manifest.json`. |
| 3 | Workflow e permissões | APROVADO | YAML local válido: contents=read, pages=write, id-token=write, ambiente github-pages, upload/deploy oficiais; validação do pacote adicionada antes do upload. `workflow.json`. O arquivo ainda não está no GitHub; execução remota desse workflow não testada. |
| 4 | Pages por GitHub Actions | REPROVADO | API retorna `build_type: legacy`, `source.branch: main`. A credencial tem push=false/admin=false; não foi possível alterar para Actions. |
| 5 | Build, JavaScript e caminhos | REPROVADO | Local: 22 scripts passam na checagem de sintaxe, 95 referências resolvidas, teste estático sem erros de página/HTTP. Publicado: câmera e módulo integrado retornam 404. `test-pages-final.txt`, `external-status.json`. |
| 6 | Authentication, Realtime Database e regras no domínio | NÃO TESTADO | SDK carrega; leitura anônima da raiz retorna 401. Não havia conta de homologação autenticada nem acesso ao console Firebase. Isso não comprova login, gravação, regras implantadas ou domínios autorizados. Regras locais corrigidas e condições testadas com snapshots simulados; emulador não executado, Java indisponível. |
| 7 | Modelo 3D, MediaPipe e WASM por HTTPS | APROVADO | Modelo publicado: HTTP 200, MIME model/gltf-binary e canvas criado. MediaPipe 0.10.21, modelo e WASM reais baixados por HTTPS e inferência em quadro sintético concluída no teste de navegador. Reconhecimento em celular e integração da câmera no domínio publicado permanecem pendentes; a página publicada de câmera está ausente. |
| 8 | Simulação pública sem infraestrutura industrial | REPROVADO | Pacote local executa 5×4 com zero WebSockets, servido apenas como arquivos estáticos. Versão publicada tenta HiveMQ WSS; conexões foram interceptadas/bloqueadas no smoke test. `published-browser.json`. |
| 9 | Produção de 5 peças × 4 pontos, pausa, retomada e histórico | NÃO TESTADO | Fluxo local APROVADO: 20 pontos, pausa estável, retomada, confirmação das peças, 100%, um histórico idempotente e remoção da produção ativa. Persistência substituída por adaptador de teste; gravação real no site publicado não testada. `test-pages-final.txt`. |
| 10 | Execução e painel em duas abas | NÃO TESTADO | Duas abas reais locais passaram: Pausado → Executando → sem produção ativa, total de 5 peças atualizado sem reload. Adaptador simula notificações do banco via storage. Firebase real, múltiplos dispositivos e painel de administrador não homologados. |
| 11 | Ausência de credenciais e serviços industriais expostos | REPROVADO | Pacote local: inspeção e varredura sem senha MQTT literal/chave privada/token administrativo, sem pastas de servidor. Site atual: usuário e senha literais no mqtt-maquina.js público, endpoint HiveMQ e tentativas de conexão. `published-security.json` registra somente indicadores, sem valores. A validade da senha não foi testada. |
| 12 | Testes automatizados e resultados registrados | APROVADO | Node: 79/79; Python: 10/10; navegador: 20/20 com MediaPipe real; pacote Pages: 2/2 (teste pai + fluxo). Todos os resultados finais sem falhas. Ver logs abaixo. |
| 13 | Publicação e URL HTTPS final | REPROVADO | URL atual responde 200, mas não contém as correções e continua com credenciais MQTT. Sem permissões de escrita/admin, não foi possível publicar a versão corrigida. |
| 14 | Preparação do teste manual em celular | APROVADO | Roteiro abaixo preparado. Execução física NÃO TESTADA; nenhum gesto real foi aprovado automaticamente. |
| 15 | Documentação dos itens não automatizados | APROVADO | Pendências e roteiro registrados neste documento. |

## Correções desta etapa

- Build limpo e determinístico quanto ao conjunto de arquivos, bloqueio de symlinks e validador de referências, sintaxe e padrões de segredo. Manifesto SHA-256 do pacote gerado.
- Workflow executa o validador antes do upload.
- Modo público deixa de exibir que aguarda o simulador Node-RED.
- Painel do operador recarrega histórico e KPIs quando a produção ativa é removida após conclusão. Antes da correção, o teste de duas abas falhou esperando o total de 5 peças; depois passou.
- Regras locais restringem autocadastro a `empresa_<uid>` e perfil admin da própria empresa; impedem transferência de operador entre empresas, elevação de perfil pelo próprio operador, exclusão integral da empresa e troca de proprietário pelo membro. Estas mudanças não foram implantadas.
- Novos testes do pacote estático e das condições de autorização. Os testes de regras usam snapshots simulados e NÃO validam compilação, herança ou comportamento real do emulador. Referência: https://firebase.google.com/docs/database/security/rules-conditions .

## Evidências e limites

- `test-node-final.txt`: suite Node final, incluindo condições de regras.
- `test-python.txt`: 10 testes; `OK`. A apresentação de stderr pelo PowerShell inclui NativeCommandError, mas o processo terminou com código 0.
- `test-browser.txt`: 20 testes; inclui integração local Node-RED/MQTT/Modbus simulado e MediaPipe real. Equipamento físico não utilizado.
- `test-pages-final.txt`: execução isolada de dist-pages com prefixo `/Solda-sistema-versao-semifinal`, sem servidor de aplicação industrial, 5×4 e duas abas. Servidor HTTP usado apenas para entregar arquivos, como uma hospedagem estática.
- `test-pages-browser.txt`: falha intermediária que comprovou o histórico desatualizado no painel, antes da correção. Não representa o resultado final.
- `validate-pages.txt`, `workflow.json`, `build-manifest.json`: verificações finais de empacotamento.
- `external-status.json`, `published-browser.json`, `published-security.json`: evidências públicas/remotas. O smoke test interceptou TODOS os WebSockets, sem usar as credenciais publicadas nem comandar o broker.
- `diff-check.txt`: verificação sem erros de whitespace; avisos de conversão LF/CRLF do Git.

A chave de configuração web do Firebase permanece no pacote: ela não é uma credencial administrativa. A proteção efetiva depende de Authentication e das regras implantadas. A varredura de segredos é baseada em padrões e inspeção dos arquivos de configuração, não uma garantia absoluta sobre qualquer formato de segredo.

## Acesso necessário para concluir

1. Conta com **write** no repositório e **admin** para Settings → Pages. URL: https://github.com/esterv-dev/Solda-sistema-versao-semifinal/settings/pages . Confirmar a branch que receberá o conjunto de alterações locais, revisar/commit/push, configurar Source=GitHub Actions e executar `.github/workflows/pages.yml` na revisão escolhida. `workflow_dispatch` precisa estar disponível na branch padrão para acionamento normal pela interface.
2. Administrador do HiveMQ deve revogar/rotacionar a credencial atualmente exposta. Substituir o site não revoga uma senha já publicada. Não reutilizar essa senha no frontend.
3. Acesso ao projeto Firebase `projeto-solda` para conferir provedor Email/Password, domínio autorizado `esterv-dev.github.io`, regras ativas e identidade/empresa de homologação. Não abrir o banco publicamente para fazer o teste passar.
4. Compilar e testar as regras no Emulator Suite, incluindo cadastro atômico, CRUD, isolamento entre empresas, leitura/escrita sem login, operador, admin, alteração de perfil e troca/exclusão de empresa. Instalar Java compatível com a versão do emulador antes disso. Fazer revisão das permissões de operação dentro da empresa antes de implantar.
5. Com conta de teste, executar login/logout e CRUD de programa de quatro pontos na URL HTTPS; recarregar para comprovar persistência; iniciar cinco peças, pausar/retomar e confirmar as peças seguintes; conferir 20 pontos, um histórico e cinco peças no painel em outra aba. Repetir no perfil admin e entre dispositivos. Conferir RTDB diretamente e ausência de erros/403/404 no navegador.
6. Verificar que o deploy contém os hashes/arquivos esperados, que câmera e módulo integrado retornam 200, que não há senha MQTT, endpoints industriais em uso ou dependência de localhost. Repetir os testes no domínio final sem mocks.

URL atual (acessível, mas **não homologada**): https://esterv-dev.github.io/Solda-sistema-versao-semifinal/ .

## Roteiro manual — celular real

Executar somente após publicação corrigida, com conta de homologação e programa de quatro pontos. Registrar modelo do aparelho, sistema, navegador/versão, data, revisão implantada, resultados e capturas sem dados pessoais/credenciais.

1. Abrir a URL HTTPS no celular, fazer login, configurar cinco peças e abrir Visão Computacional. Autorizar câmera; verificar vídeo ao vivo, orientação/retrato/paisagem e indicação de câmera ativa. Abrir o Painel de Produção em outro dispositivo/aba com a identidade adequada.
2. Abrir a simulação virtual e aguardar programa/modelo carregados. Nenhuma produção deve começar só por abrir a câmera.
3. Mostrar **mão aberta** bem iluminada e completamente enquadrada, mantendo-a até reconhecer **START**. Confirmar EXECUTANDO, movimento 3D e atualização do painel. Manter o gesto: não deve duplicar início.
4. Retirar a mão/voltar a posição neutra. Mostrar **punho fechado** até reconhecer **PAUSA**. Confirmar PAUSADO nas duas telas; esperar pelo menos três segundos e verificar que ponto/posição não avançam.
5. Voltar a neutro e mostrar mão aberta para retomar. Confirmar retomada do ponto/peça correto, sem reiniciar ou duplicar produção.
6. Confirmar posicionamento entre peças conforme a interface. Completar cinco peças; conferir 20 pontos, 100%, cinco peças no painel, um registro no histórico e produção ativa encerrada. Atualizar a página e verificar persistência no Firebase.
7. Testar mão fora do quadro, gesto desconhecido, pouca luz e duas mãos: nenhum início involuntário. Registrar falsos positivos/negativos e tempo de resposta.
8. Bloquear tela/trocar aplicativo e retornar; verificar liberação da câmera e ausência de reinício automático. Testar negar permissão, desconectar/reconectar rede e encerrar câmera. Confirmar ausência de START repetido após reconexão.
9. Repetir em Android/Chrome e iPhone/Safari disponíveis. Não substituir teste físico por vídeo sintético ou por injeção da categoria do gesto.

**Encerramento:** há requisitos obrigatórios reprovados e dependências externas pendentes. Sucesso de Actions, quando houver, não basta para mudar este resultado.
