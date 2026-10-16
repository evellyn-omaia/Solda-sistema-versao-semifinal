# Relatório de correções do SoldaTech

> Registro da primeira etapa. A auditoria complementar de 10/10/2026, os resultados finais e a falha crítica de avanço sem confirmação estão em [RELATORIO_AUDITORIA_SOLDATOUCH.md](RELATORIO_AUDITORIA_SOLDATOUCH.md). Os números de testes abaixo são históricos dessa primeira etapa.

Data: 09/10/2026. Branch: `backup-visao-computacional`.

**Resultado:** correções locais verificadas; integração física e validação completa em navegador/Firebase continuam pendentes. Não é uma liberação para operar a máquina.

## A. Diagnóstico e problemas encontrados

### Estado inicial do Git

- `git status --short` mostrou alterações previamente preparadas no índice, inclusive modelo GLB, imagens, broker, HTML/CSS, MQTT, Node-RED e tutoriais.
- `new-program/novoprograma.js` estava `UU`; `git ls-files -u` confirmou três estágios e `git rev-parse -q --verify MERGE_HEAD` confirmou uma operação de merge já pendente.
- O arquivo de trabalho já estava sem marcadores de conflito ao começar esta tarefa. Continha o listener de gestos e a função de parada ao sair. Ambos foram preservados.
- Nenhuma operação de merge, rebase, troca de branch, add, commit, push, reset ou clean foi executada. O índice não foi resolvido automaticamente: `UU` e o merge pendente permanecem para revisão do responsável.
- Não foi feita integração com `main`, nem leitura de código de outra branch para incorporar funcionalidades.

### Problemas de software

| Gravidade | Problema | Local |
|---|---|---|
| Alta | Capacidade física anunciada sem status do CLP; teste original falhava em `movimentoManual` | `new-program/mqtt-maquina.js` |
| Alta | Função compartilhada podia publicar comandos mesmo em simulação | `new-program/novoprograma.js` |
| Alta | Credenciais MQTT literais no navegador; broker local sem autenticação | MQTT e broker |
| Alta | Nome/chave vazio podia atingir a coleção de programas; recuperação de empresa faltava no restante do CRUD | `new-program/firebase-programas.js` |
| Média | Clique e gesto simultâneos podiam iniciar duas chamadas assíncronas de ciclo | `new-program/novoprograma.js` |
| Média | `beforeunload` e `pagehide` repetiam o mesmo conjunto de paradas | `new-program/novoprograma.js` |
| Média | Python e demais componentes usavam brokers padrão diferentes | `visao-python/visao.py` |
| Média | `localhost` no navegador apontava para o próprio Android, não para o computador do broker | `new-program/mqtt-maquina.js` |
| Média | `testarMQTT()` usava `TESTE`, mas o flow implementa `PING` | MQTT/Node-RED |
| Média | Confirmação de publicação Python não era verificada após a espera | `visao-python/visao.py` |
| Alta | Dados de operadores inseridos por `innerHTML` permitiam interpretação de marcação | `solda-system/operadores.js` |
| Alta | Duas entradas de vulnerabilidade alta na cadeia `websocket-stream`/`ws` | dependências do broker |

Dependências foram examinadas antes das edições: HTML carrega MQTT antes de `novoprograma.js`; o programa usa a API global de MQTT e os adaptadores físicos; os testes MQTT executam esse script com cliente falso; Firebase compartilha `auth`/`db` do login; Python publica gestos consumidos pelo listener MQTT; o broker atende TCP e WebSocket; o flow converte comandos para Modbus.

## B. Correções realizadas

1. Capacidades físicas e comandos de ativação exigem status recente do CLP (até 10 segundos), estado reconhecido e ausência de emergência. Jog é bloqueado enquanto o CLP declara execução. Comandos de parada continuam permitidos com MQTT conectado.
2. Texto legado permanece reconhecido, mas não habilita movimento. Mensagens MQTT retidas são ignoradas para evitar reutilização de status e gestos anteriores à conexão.
3. `offline`, `close` e `reconnect` invalidam o estado conhecido; comandos com confirmação são rejeitados na desconexão. A reconexão exige novo status. Desabilitadas fila QoS 0 offline e reassinatura automática paralela à assinatura já feita no evento `connect`.
4. Simulação retorna antes de acessar o transporte físico. Início de ciclo tem trava contra chamadas simultâneas. Preservados os gestos START/PAUSA e a parada best-effort via `pagehide`; removido o envio duplicado por `beforeunload`.
5. Frontend usa o host da página por padrão; aceita `window.SoldaTechMQTTConfig` antes do carregamento do script. Credenciais literais foram removidas. `testarMQTT()` envia `PING`.
6. Python usa broker local TCP por padrão e mantém host, porta, TLS e credenciais por ambiente. Identificador de cliente é único por processo/inicialização. Mantida a classificação de gestos. Acrescentadas reconexão progressiva e verificação efetiva da confirmação de publicação.
7. Broker aceita endereço de bind e portas por ambiente, valida portas e encerra com erro explícito caso não consiga escutar. Os padrões operacionais existentes foram preservados.
8. Fixada a dependência transitiva `ws` em `5.2.5`, dentro da mesma versão principal. Atualizado o lockfile; transporte TCP/WS retestado. Não foi executado `npm audit fix --force`.
9. Recuperação autenticada de empresa estendida a carregar, listar e excluir programas. Nome vazio, chave inválida e estrutura básica inválida de programa são rejeitados antes da escrita. Nenhum identificador de empresa fixo foi introduzido.
10. Nome/email de operadores são inseridos como texto, sem interpretar HTML.

## C. Arquivos alterados nesta tarefa

- `new-program/mqtt-maquina.js`
- `new-program/novoprograma.js` — somente correções pontuais no arquivo de trabalho; índice continua não resolvido.
- `new-program/firebase-programas.js`
- `solda-system/operadores.js`
- `visao-python/visao.py`
- `mqtt-broker/server.js`
- `mqtt-broker/package.json`
- `mqtt-broker/package-lock.json`
- `tests/mqtt-maquina.test.cjs`
- `tests/firebase-programas.test.cjs`
- `tests/novoprograma.test.cjs` — novo.
- `tests/broker.test.cjs` — novo.
- `tests/test_visao.py` — novo.
- `RELATORIO_CORRECOES_SOLDATECH.md` — este relatório.

Dependências do broker foram instaladas em `node_modules`, já ignorado pelo Git. Alterações anteriores em `.gitignore`, modelo, imagens, CSS/HTML, tutoriais e flow foram preservadas.

## D. Funcionalidades preservadas

- Programação, simulação e modelo 3D; carregamento/armazenamento de programas; telas de produção e indicadores; modo ensino.
- Autenticação/cadastro existentes e isolamento baseado no cadastro Firebase; regras não alteradas nem publicadas.
- API MQTT, correlação por `idComando`, confirmações, timeouts, adaptadores físicos e reconexão.
- Reconhecimento de palma/punho, payload de gestos e ações START/PAUSA.
- Caminhos de compatibilidade da produção no Firebase.
- Fluxo Node-RED e mapa Modbus foram preservados integralmente. Preservar código não significa validar a sua segurança física.

## E. Testes e verificações realmente executados

Comandos relativos à raiz do projeto, salvo indicação:

| Comando/verificação | Resultado |
|---|---|
| `node --test tests/*.test.cjs` inicial | 4 aprovados e 1 reprovado: capacidade manual anunciada sem CLP |
| `node --test tests/*.test.cjs` final | 14 aprovados, 0 reprovados, 0 ignorados |
| `python -m unittest discover -s tests -p test_*.py` | 2 aprovados |
| `python -m py_compile visao-python/visao.py` | Aprovado; não inicia câmera/MQTT |
| `node --check` em cada um dos 15 arquivos `.js` do projeto, excluindo dependências | Sem erros |
| Extração JSON e `node --check` nos 5 blocos Function/initialize/finalize do flow | Sem erros de sintaxe; nenhum bloco executado |
| `npm ci --ignore-scripts --no-fund`, em `mqtt-broker` | Instalação concluída; auditoria inicial: 3 moderados e 2 altos |
| `npm install --ignore-scripts --no-fund`, após override de `ws` | Lockfile atualizado e instalação concluída |
| `npm audit --omit=dev --prefix mqtt-broker` | Restam 3 alertas moderados; saída não zero esperada |
| `.venv/Scripts/python.exe -m pip check` | Sem requisitos quebrados |
| Importação de `cv2`, `mediapipe`, `paho.mqtt.client` no `.venv` | Aprovada; `solutions.hands` e Callback API v2 disponíveis |
| `git diff --check` | Sem erros ao término |
| Busca ancorada por marcadores de conflito nos arquivos de código | Nenhum marcador encontrado |
| Inspeção binária/JSON do GLB | glTF 2, tamanho consistente, 375 nós e 324 meshes |
| Inspeção de referências locais dos HTML | Dois recursos de logo ausentes; detalhes abaixo |

Os testes usam mocks para Firebase/MQTT e funções de programação. O teste de broker inicia processo real exclusivamente em `127.0.0.1`, com portas aleatórias e tópico `soldatech/test/isolado`; encerra o processo depois. Não publica em tópico de comando, não utiliza o broker operacional e não acessa CLP.

Cobertura: sessão vazia/divergente, cadastro/empresa ausentes, permissão negada, troca de autenticação, CRUD e nomes vazios; conexão/reconexão/timeout, estado expirado, emergência/jog, mensagens inválidas/retidas, gestos, transporte TCP/WS, simulação sem publicação e início duplicado de ciclo. Python testa configuração local/TLS e payload/resultado da publicação sem abrir câmera.

Uma execução intermediária do teste de ciclo falhou porque o extrator de trecho não normalizava CRLF; corrigido o harness, mantendo a asserção comportamental. Uma inspeção inicial dos nomes do GLB encontrou limitação de codificação do terminal; repetida com serialização ASCII. Não eram falhas da aplicação.

Não executados: login/cadastro/logout reais, banco Firebase real/emulador de regras, renderização WebGL, uso completo das interfaces, câmera/reconhecimento ao vivo, Node-RED operacional, Modbus, Android e movimentos/soldagem físicos. Importar bibliotecas ou validar sintaxe não equivale a validar essas funcionalidades.

## F. Pendências e riscos

### Software e autorização

- **Crítico: revisar regras Firebase com emulador.** A permissão de criação do próprio cadastro (`!data.exists()`) não restringe empresa/papel inicial. Um cliente que dispense a interface pode tentar cadastrar vínculo a empresa existente. A interface não é fronteira de autorização. É necessário desenhar/testar bootstrap e provisionamento antes de publicar regras corrigidas; o cadastro atual cria empresa/admin atomicamente e não deve ser quebrado por uma alteração não validada.
- Permissão de escrita na empresa é ampla para qualquer usuário vinculado. Restrições admin/operador precisam ser formalizadas e testadas no servidor.
- O login ainda pode registrar empresa vazia se o cadastro estiver incompleto. O helper dos programas bloqueia esse caso; outras telas ainda usam `sessionStorage` diretamente. Recuperação de sessão não foi generalizada indiscriminadamente.
- Não foi encontrado fluxo de logout do usuário principal; há `signOut` da autenticação secundária ao cadastrar operador. Não foi criada nova funcionalidade de logout.
- Helpers de produção legada, indicadores, modo ensino e retomada exigem regressão com dados reais de teste. A leitura de existência da empresa no helper consulta o nó inteiro: monitorar custo/tamanho antes de otimizar.
- Permanecem 3 alertas moderados na cadeia Aedes/hyperid/uuid. A correção sugerida pelo npm migra Aedes para versão principal diferente; precisa de teste de compatibilidade e atualização planejada.
- URLs CDN sem versão fixa, como a biblioteca MQTT no HTML, impedem reprodução exata do frontend; selecionar uma versão homologada antes de fixá-la.
- Logos ausentes: `carregar-programa/carregarprograma.html` referencia `../imagens/logosoldatech.png`; `solda-system/index.html` referencia `../images/logosoldatech.png`. Nenhum logo equivalente foi inventado/substituído.

### Configuração e rede

- Broker local continua sem autenticação/ACL/TLS, escutando todas as interfaces por padrão, como antes. Restringir rede/firewall e preparar autenticação/ACL antes de operação. `MQTT_BIND_HOST=127.0.0.1` restringe testes ao computador, mas impede Android/hosts remotos: não foi ativado como padrão operacional.
- Credenciais anteriormente embutidas devem ser revogadas/rotacionadas pelo responsável. Remover do arquivo de trabalho não remove do histórico nem do índice previamente preparado.
- Tópicos são globais, sem segmentação por máquina/empresa. Firebase não autoriza comandos MQTT. É necessária política de acesso no broker/ponte para impedir publicações não autorizadas.
- O broker incluído atende WS/TCP sem TLS. Uma página HTTPS requer WSS com certificado/proxy configurado; selecionar `wss` no frontend não instala TLS no servidor.
- O README do Node-RED tem instruções antigas de HiveMQ e tutoriais mencionam dependências já incluídas. Para esta branch, considerar o contrato da seção G e executar `npm ci` no broker.

### Hardware e fluxo Node-RED

- Configuração preservada: Modbus TCP `10.200.7.254:502`, unit ID 1. Comentários declaram coils 10/11/12 medidos, mas não foram confirmados nesta tarefa.
- Coil de solda 3 está documentado como não conectado. Coil de emergência 4 está marcado como **não usar**, porém o roteador ainda o escreve para `EMERGENCIA`. Não usar esse comando como parada de emergência; revisão técnica obrigatória antes de ativar o flow.
- Holding registers, inputs e interpretação dos cinco bits de status permanecem dependentes do mapa real. Não foram inventados nem alterados endereços.
- Encoders não cabeados conforme comentários; estimativa visual não é feedback de posição real. Giro para ângulo específico não está implementado/calibrado no flow.
- Reset remoto ocorre ao conectar; falha no reset apenas gera aviso e ainda permite declarar conexão. Isso não garante parada em perda de rede durante movimento.
- Flow não possui autorização robusta, deduplicação persistente de `idComando`, serialização de movimentos concorrentes ou watchdog de comando validado. Pulso não desativa explicitamente a direção oposta. Confirmação de ponto depende de borda de bit e pode ficar pendente se não houver transição.
- Essas alterações na ponte podem mudar comportamento físico; código preservado e riscos registrados. Não iniciar/deployar o flow para testar software: seu initialize conecta e escreve coils automaticamente.
- Emergência real deve depender de circuito físico adequado; intertravamentos, watchdog e limites devem ser validados no CLP com supervisão. `pagehide`, MQTT e reset de conexão não são dispositivos de segurança.

## G. Contrato e configuração MQTT

Arquitetura padrão: navegador → WS `:8888` → broker local ← TCP `:1883` ← Python/Node-RED → Modbus TCP → CLP.

| Componente | Padrão | Configuração por ambiente |
|---|---|---|
| Navegador | `ws://<host-da-página>:8888`; HTTPS seleciona `wss` | Definir `window.SoldaTechMQTTConfig = { url, username, password }` antes de `mqtt-maquina.js`, omitindo credenciais quando não aplicáveis. Não versionar segredos. |
| Broker | TCP 1883, WS 8888, bind `0.0.0.0` | `MQTT_TCP_PORT`, `MQTT_WS_PORT`, `MQTT_BIND_HOST` |
| Python | `localhost:1883`, sem TLS/credenciais | `MQTT_HOST`, `MQTT_PORT`, `MQTT_TLS`, `MQTT_USER`, `MQTT_PASS`. Porta 8883 ativa TLS por padrão, salvo override explícito. Usuário/senha devem ser fornecidos juntos. |
| Node-RED | `localhost:1883`, client ID `soldatech-nodered` | Configurar nó de broker para o host real se estiver em outro computador; duplicações de instância precisam de client IDs próprios. |

No Android, o host da URL do site deve ser o computador que hospeda o broker; caso serviços estejam separados, usar override explícito. Não usar `localhost` para apontar ao computador a partir do telefone.

| Tópico | Produtor → consumidor | Payload |
|---|---|---|
| `soldatech/maquina/comando` | Frontend → Node-RED | `{ "idComando": "<único>", "comando": "PING", "dados": {}, "origem": "SoldaTouch", "timestamp": 0 }` (timestamp real gerado no envio) |
| `soldatech/maquina/status` | Node-RED → frontend | Objeto `tipo: STATUS`, `estado`, `mesaPronta`, `soldaAtiva`, `emergencia`, `timestamp` |
| `soldatech/maquina/resposta` | Node-RED → frontend | `tipo: COMANDO_OK / MESA_READY / PONTO_ATINGIDO`, `idComando` quando correlacionável |
| `soldatech/maquina/erro` | Node-RED → frontend | `tipo: COMANDO_ERRO`, `idComando`, `codigo`, `mensagem` |
| `soldatech/visao/gesto` | Python → frontend | `{ "tipo": "GESTO_VISAO", "gesto": "START" }` ou `PAUSA` |

Comandos do navegador: QoS 0, sem retain, sem fila offline. Gestos Python: QoS 1, sem retain; assinatura frontend existente QoS 0. Python mantém cooldown de 2 segundos. Não há promessa de execução exatamente uma vez na ponte física.

## H. Próximos passos por prioridade

1. Responsável pelo repositório deve revisar a operação Git já pendente e as alterações de arquivo. Não concluir automaticamente o merge nem integrar visão com `main`.
2. Corrigir/homologar regras Firebase em emulador; rotacionar credenciais antigas; definir autenticação/ACLs e segmentação MQTT. Planejar atualização maior do Aedes.
3. Validar todo o flow em simulador Modbus isolado, sem acesso ao equipamento; resolver comando de emergência inconsistente, reset, concorrência, deduplicação, confirmações e watchdog antes de deploy operacional.
4. Homologar login, cadastro, sessão, CRUD, ensino e produção com contas/dados de teste. Testar nome vazio, sessão vazia e tentativa de acesso de outra empresa. Restaurar os logos corretos.
5. Validar Three.js/modelo/controles no computador e Android, em simulação e com transporte físico isolado. Confirmar cache atualizado e URLs WS/WSS. Verificar câmera e gestos inicialmente com interface em simulação.
6. Somente depois: teste supervisionado do mapa Modbus, fins de curso, emergência física, realimentação/encoders e parada em perda de rede. Começar com atuadores isolados e autorização do responsável técnico. Nenhum movimento foi executado nesta tarefa.

### Critérios de conclusão

Código de trabalho sem marcadores, sintaxe válida, testes relevantes executados, problemas corrigidos ou documentados e relatório gerado. Funcionalidades existentes foram mantidas no código. Permanecem pendentes o estado de merge no índice (intencionalmente preservado), regressão completa das interfaces/serviços e homologação física. Não houve commit, push, merge novo ou comando físico.
