# Auditoria e correções do SoldaTouch — 10/10/2026

**Conclusão: software parcialmente estabilizado e testável; produção automática física NÃO homologada.** Foi reproduzido avanço de ponto e solicitação de solda antes de confirmação física. A correção desse caminho exige autorização, conforme a instrução mais recente. Não foi alterado o flow, o ladder, o mapa Modbus ou o equipamento.

Este documento complementa e atualiza `RELATORIO_CORRECOES_SOLDATECH.md`, preservado como registro da primeira etapa da mesma tarefa. Nenhum teste aciona equipamento.

## A. Estado atual

- Branch: `backup-visao-computacional`. Merge preexistente ainda pendente (`MERGE_HEAD` presente); `new-program/novoprograma.js` permanece `UU` no índice. O arquivo de trabalho não contém marcadores de conflito e passa na sintaxe. Não houve `git add`, commit, merge, rebase, push ou troca de branch.
- Preservadas alterações anteriores em `.gitignore`, GLB, imagem SENAI, HTML/CSS, broker, MQTT, Node-RED e tutoriais. O arquivo não rastreado `tatus`, surgido durante a tarefa, não foi alterado.
- Estrutura: páginas estáticas HTML/CSS/JS; Firebase modular 10.12.2; Three.js r128/modelo GLB; MQTT.js via CDN; broker Aedes com TCP/WS; flow Node-RED com `modbus-serial`; visão OpenCV/MediaPipe/Paho; testes Node e unittest Python.
- Broker: `npm start` em `mqtt-broker`; site: servidor HTTP estático; visão: `.venv/Scripts/python.exe visao-python/visao.py`. Não existe execução automática conjunta dos componentes.
- Ambiente Python verificado: MediaPipe 0.10.21, OpenCV Python 4.10.0.84 e Paho MQTT 2.1.0. Imports e `pip check` aprovados. O classificador existente foi preservado.
- Verificados com mocks: contratos MQTT, estados/gestos, recuperação Firebase/CRUD, comandos e respostas das funções do Node-RED, cooldown, falha de câmera e liberação de recursos. Broker TCP/WS foi executado em instância isolada com portas temporárias.
- Não verificados ao vivo: login/cadastro/logout Firebase, regras em emulador, telas/Three.js/WebGL/Android, reconhecimento com câmera, status elétricos, Node-RED operacional, CLP, motores e solda. GLB tem cabeçalho/tamanho/JSON consistentes, 375 nós e 324 meshes; isso não comprova renderização correta.

## B. Problemas confirmados e evidências

Linhas referem-se à versão final local. Em `flows.json`, o código das funções está armazenado em strings JSON; informar o ID do nó identifica precisamente o trecho.

| ID | Gravidade | Arquivo/linha | Evidência e consequência | Situação/solução |
|---|---|---|---|---|
| P01 | Crítica | `new-program/novoprograma.js:2751`, `:2889` | `void enviarPontoParaMaquina(...)` ignora a Promise. `animate()` avança e chama solda quando coordenadas virtuais chegam ao alvo. Teste com confirmação eternamente pendente observa índice 1 e solda `true`. | **Não corrigido por afetar execução física.** Proposta abaixo. |
| P02 | Crítica | `tutorial/01-O-QUE-FIZEMOS.md:122` | Documentação afirma fins de curso superior/inferior invertidos em Rung0/Rung1. Nenhum ladder foi encontrado para conferir a situação atual. | Pendência histórica documentada, não prova do estado elétrico atual. Verificação técnica presencial necessária. |
| P03 | Crítica | `node-red/flows.json:55` e `:188` | Encoders descritos como não cabeados; leitura de posição omitida. Alvos e ângulos virtuais não comprovam posição física. | Posicionamento automático preciso não homologado; bloqueio proposto em P01. |
| P04 | Crítica | `node-red/flows.json`, `fnProcessarComando` | `EMERGENCIA` escreve coil 4, que o próprio mapa diz não usar; emergência descrita como entrada I0.4. | Não alterado. Retirar a dependência desse comando e validar circuito físico/contrato com responsável técnico. |
| P05 | Alta | `node-red/flows.json`, `fnConectarModbus`, `fnProcessarComando` | Falha de reset não impede declarar conexão; sem watchdog validado, deduplicação por ID ou fila que priorize paradas. JOG_PULSO não desativa direção oposta. | Propor correções após confirmar contrato físico; não aplicar automaticamente. |
| P06 | Crítica | `database-rules.json:14` | Criação do próprio cadastro admite `!data.exists()` sem restringir vínculo/papel. Interface pode ser dispensada por outro cliente. | Proposta de regras abaixo; nenhuma regra de produção alterada. |
| P07 | Alta | `database-rules.json:22` | Escrita no nó inteiro da empresa é permitida ao usuário vinculado. | Definir matriz operador/admin e testar regras por coleção. |
| P08 | Alta | `mqtt-broker/server.js:37`; tópicos MQTT | Broker sem autenticação/ACL/TLS; tópicos globais. Firebase não autoriza MQTT. | Configuração operacional pendente; não houve exposição adicional de rede. |
| P09 | Alta | `visao-python/visao.py:282`; `new-program/mqtt-maquina.js:641` | Retain é rejeitado, mas payload de gesto não tem ID/idade/sessão; QoS 1 pode retransmitir pacote que já estava em voo. | Controlador descarta gesto ainda não enviado após reconexão, mas não resolve replay de pacote em voo. Propor contrato com validade/ID antes de alterar ação física. |
| P10 | Alta | `new-program/novoprograma.js:879` | Modo real é restaurado de localStorage; usuário pode retornar com seleção antiga. Não existe trava global de produção por perda de comunicação. | Propor exigir seleção por sessão e pausar execução física ao perder status; aguarda autorização. |
| C01 | Alta | `new-program/mqtt-maquina.js:48`, `:968` | Teste original falhava: adaptador registrado era confundido com capacidade disponível após reconexão. | Corrigido na primeira etapa: status recente e estado permitido; controles de parada preservados. |
| C02 | Alta | `new-program/novoprograma.js:2131` | Função compartilhada podia publicar mesmo no modo simulação. | Corrigido na primeira etapa; teste comprova ausência de publicação neste caminho. Não confundir com aprovação de toda UI. |
| C03 | Média | `visao-python/visao.py:228`, `:539`; `controle_gestos.py:5` | Último gesto era atualizado mesmo se cooldown impedisse envio. Gesto mantido ficava perdido. | Corrigido com controle de entrega, estabilidade e testes. |
| C04 | Média | `visao-python/visao.py:56` | Exceção depois de inicializar recursos podia impedir cleanup final. | Encerramento idempotente registrado em atexit; uma falha não impede liberar os demais recursos. |
| C05 | Alta | `new-program/firebase-programas.js:373`, `:445` | Nome/chave vazio podia atingir nó de coleção; demais operações dependiam só da sessão. | Validação e recuperação de empresa aplicadas ao CRUD, testadas com mocks. |
| C06 | Alta | `solda-system/operadores.js:218` | Nome/email interpolados em innerHTML. | Renderização por nós de texto; preservado conteúdo exibido. |
| C07 | Média | `new-program/novoprograma.js:3283` | Clique/gesto concorrentes podiam iniciar duas chamadas. | Trava de chamada pendente, teste aprovado. |
| C08 | Alta | `mqtt-broker/package.json:15` | Auditoria inicial identificou dois alertas altos na cadeia ws. | Override para patch 5.2.5 e lockfile; transporte retestado. Restam três moderados. |
| P11 | Média | `mqtt-broker/package-lock.json` | `npm audit` ainda aponta Aedes/hyperid/uuid; solução indicada muda versão principal do Aedes. | Atualização maior planejada; nenhum `audit fix --force`. |
| P12 | Baixa | `carregar-programa/carregarprograma.html`, `solda-system/index.html` | Dois caminhos de logo não existem. | Aguardar arquivos corretos; não substituir marca por outra imagem. |

### Proposta P01 — não aplicada

Arquivos: `new-program/novoprograma.js`, contrato de status de `new-program/mqtt-maquina.js` e, após homologação, `node-red/flows.json`.

1. Bloquear **apenas produção automática física** enquanto não existir capacidade explícita de posicionamento validada para Z e mesa. Preservar simulação e controle manual homologado.
2. Em modo real, enviar um ponto, aguardar `PONTO_ATINGIDO` com o mesmo ID e confirmar ambas as posições antes de avançar ou solicitar solda. O flow atual avisa que ângulo da mesa não está implementado: ACK do Z sozinho não basta.
3. Rejeição/timeout/perda de status deve levar ao estado de falha/pausa e não avançar nem retomar automaticamente. Não criar um segundo motor de execução.
4. Validar com Modbus falso: ACK ausente, incorreto, duplicado, tardio, emergência e perda de rede. Depois validar em simulador isolado. Teste físico somente supervisionado, com sensores, mapa e circuito de segurança confirmados.

Risco: alterar sequenciamento e critérios de avanço da máquina. **Nenhuma dessas mudanças foi aplicada nesta etapa**, obedecendo à proibição expressa de alterar comportamento físico sem autorização. O requisito de manter produção precisa bloqueada ainda não está atendido no código atual; não usar esse modo até resolver P01/P03.

### Proposta P06/P07 — não publicada nem aplicada

Substituir a criação irrestrita do próprio perfil por regra de bootstrap vinculada ao UID: novo administrador somente com `empresaId == 'empresa_' + auth.uid`, papel `admin`, empresa correspondente ainda inexistente; manter criação de operadores exclusivamente por administrador da mesma empresa. Campos de empresa/papel devem continuar imutáveis para o próprio usuário em atualizações comuns. Reavaliar permissões por coleção em `empresas` em vez de escrita irrestrita no pai.

Validar no emulador o update atômico existente de `criarConta.js` (empresa + perfil), cadastro de operador via auth secundário, edição legítima, tentativa de autocadastro em outra empresa e tentativa de promoção de papel. O ID derivado de UID acima segue o cadastro existente; não é um identificador fixo. Risco: regras incompatíveis podem bloquear cadastros legítimos ou acesso legado. Homologar antes de publicar.

## C. Problemas históricos já resolvidos

- Marcadores de conflito no arquivo de trabalho: já ausentes no início; não foram recriados. A pendência do índice Git é diferente e permanece.
- Recuperação de empresa para salvar programas/consultar produção já existia e foi preservada; apenas estendida ao CRUD nesta tarefa.
- Broker local TCP 1883/WS 8888 já existia. Não foi substituído por outra arquitetura.
- Gestos já chegavam ao listener e usavam `confirmarInicioCiclo()`/`alternarMovimento()`. Estados continuam bloqueando START durante execução e PAUSA fora dela; PAUSA não retoma uma pausa.
- A espera fixa de 1000 ms já era exclusiva da simulação em `aguardarMesaPronta()`. Em modo real essa função aguarda MESA_READY. **A função não é chamada no caminho ponto a ponto atual**; corrigir um delay ali não resolveria P01.
- `MOVER_PONTO` não fabrica `PONTO_ATINGIDO` por temporizador no flow: usa borda do bit de conclusão. Falta validar o significado físico desse bit e aguardar a Promise no consumidor.
- Python não escreve Modbus nem tópicos de comando da máquina. Isso foi preservado.

Estados encontrados: PARADA, AGUARDANDO_INICIO, AGUARDANDO_PECA, PREPARANDO, EXECUTANDO, PAUSADO, FINALIZADO, CANCELADO e EMERGENCIA. Não há estado FALHA independente; erros usam caminhos de pausa/parada. A visão não criou outra máquina de estados.

## D. Correções implementadas e impactos

| Arquivos/funções | Justificativa e testes | Impacto |
|---|---|---|
| `visao-python/controle_gestos.py` — ControleGestos.atualizar; `visao.py` — enviar_gesto, callbacks, loop | Corrigir gesto perdido: cooldown retorna None; só confirmação de envio consome gesto. Estabilidade 200 ms, sem repetir gesto mantido; candidato antigo é descartado. Mudança de geração MQTT exige neutro e novo gesto, mesmo se reconexão ocorrer entre frames. | Pequena latência de estabilidade; falha de transporte ambígua exige neutro/novo gesto, evitando retries de resultado desconhecido. Visão continua comando operacional, nunca emergência. |
| `visao.py` — encerrar_recursos | Cleanup em falha de câmera/frame/exceção; encerramento idempotente. Teste executa corpo real do script com câmera e MQTT falsos. | Atexit não cobre encerramento forçado do processo; não promete garantia física. |
| `visao.py` — configuração | Broker local por padrão; TLS e credenciais por ambiente; alias antigo `MQTT_PASSWORD` preservado junto com `MQTT_PASS`. Logs deixam de chamar todo broker de HiveMQ. | Instalação antiga em nuvem deve manter host/porta/TLS explícitos e credenciais fora do código. |
| `mqtt-maquina.js` — permiteAtivacao, reconexão, configuração | Correções da primeira etapa testadas: sem ativação com estado ausente/antigo/emergência; sem fila offline; reassinatura explícita; retained ignorado; PING compatível. | Homologar estados reais antes de operação; registro de adaptador sozinho não significa disponibilidade. |
| `novoprograma.js` — solicitarComandoMaquina, confirmarInicioCiclo, pagehide | Isolamento da simulação, trava contra chamadas concorrentes, eliminação da parada duplicada em beforeunload. | Sem alteração do sequenciamento físico P01 na etapa complementar. Parada de página é best-effort. |
| `firebase-programas.js` — salvar/carregar/listar/excluir, validarChavePrograma | Preservação do helper autenticado e validação de chaves; 5 testes Firebase com múltiplos cenários. | Regras e projeto Firebase preservados; chaves inválidas deixam de ser aceitas. |
| `solda-system/operadores.js` — carregarOperadores | Dados exibidos como texto, sem injeção HTML. | Layout e dados preservados. |
| `mqtt-broker/server.js`, `package.json`, `package-lock.json` | Portas/bind por ambiente, erro de bind tratado, patch ws. Teste real TCP/WS isolado. | Padrões 1883/8888 e bind anterior preservados; não instalou ACL/TLS automaticamente. |

Testes criados/alterados: `tests/mqtt-maquina.test.cjs`, `tests/firebase-programas.test.cjs`, `tests/novoprograma.test.cjs`, `tests/broker.test.cjs`, `tests/node-red.test.cjs`, `tests/test_visao.py`. Documentos gerados: este relatório e `RELATORIO_CORRECOES_SOLDATECH.md`.

Nenhuma alteração local no `node-red/flows.json` além do conteúdo já preparado pelo usuário antes da tarefa. Controle manual foi validado somente por contratos com mocks, não fisicamente.

## E. Pendências separadas

**Software:** P01; tratamento global de perda de comunicação; matriz de estados/falhas; recuperação de sessão em telas que ainda leem apenas sessionStorage; cadastro sem empresa no login; logout principal não encontrado; duas imagens ausentes. Callback de execução ainda pode rejeitar sem tratamento local. Frontend recebe campos de posição real quando presentes, mas flow não os publica; animação continua estimativa (Z a 1 mm/s no programa, mesa a 45°/s; jog/calibração têm parâmetros próprios).

**Configuração:** um único broker por ambiente; frontend usa host do site, Python/Node-RED localhost apenas se instalados junto ao broker. HTTPS requer WSS com TLS real/proxy; escolher wss não instala certificado. URLs CDN sem versão fixa ainda exigem homologação. Broker desligado na inicialização faz Python encerrar; reconexão automática cobre conexão previamente estabelecida.

**Hardware:** encoder de Z/mesa, capacidade de posicionamento, mapa de coils/registers, fins de curso, solda e emergência. IP preservado `10.200.7.254:502`, unit ID 1. Coils 10/11/12 são descritos como medidos, mas não foram confirmados aqui. Solda coil 3 está documentada como não ligada. Não inferir segurança do bit lógico recebido por MQTT.

**Segurança:** P04–P11. Credenciais removidas na primeira etapa precisam de rotação; cópias antigas podem permanecer no índice/histórico. Não foram reproduzidas neste relatório. Busca heurística no código de trabalho não encontrou outros segredos literais, mas isso não é auditoria exaustiva do histórico. Autenticação e ACL do broker, segmentação empresa/máquina e regras Firebase precisam de validação. Filtro de retained não impede replay de mensagens atrasadas sem ID/idade.

**Testes físicos:** revisar Rung0/Rung1 com técnico autorizado: qual sensor e polaridade representam limite superior/inferior, qual contato bloqueia cada sentido, continuidade do retorno seguro, prioridade da emergência e exclusão mútua das saídas. Conferir o programa efetivamente carregado no M221, não só o tutorial. Não corrigir a suspeita invertendo fios/coils no frontend. Antes de testes supervisionados, isolar atuadores, validar parada física e definir procedimento de perda de rede. Não houve teste elétrico ou movimento nesta tarefa.

## F. Testes executados e limites

| Teste | Resultado | Observação |
|---|---|---|
| Sintaxe JavaScript | Aprovada | 15 arquivos JS; 5 blocos Function/initialize/finalize Node-RED compilados sem execução |
| Testes JavaScript | 20 aprovados; 1 TODO com asserção falhando | P01 é defeito reproduzido, **não um teste aprovado**. Node retorna código 0 para TODO; não interpretar isso como homologação. |
| Testes Python | 10 aprovados | Configuração, alias de senha, payload, cooldown, estabilidade, gesto mantido, falha ambígua, reconexão, classificador e câmera/cleanup falsos |
| MQTT simulado | Aprovado nos cenários da suíte | Parser, correlação, timeout, desconexão/reconexão, estado expirado, mensagens retidas, estados de ativação e gestos |
| Broker real isolado | Aprovado | Processo em 127.0.0.1 com portas aleatórias, TCP → WS no tópico `soldatech/test/isolado`, encerrado após teste |
| Node-RED simulado | 4 testes aprovados | Funções reais do JSON com cliente Modbus falso; nenhum initialize executado e nenhum runtime Node-RED iniciado |
| Firebase | 5 testes com mocks aprovados | Não conectado a projeto real; regras não emuladas |
| Dependências Python | Imports e pip check aprovados | Não equivale a validar detecção/câmera |
| Dependências Node | 3 alertas moderados restantes | npm audit retorna código 1; 2 altos corrigidos com patch ws |
| GLB | Estrutura válida | Não renderizado |
| Git/formatos | Sem marcadores de código; diff check aprovado | Merge no índice continua pendente |
| Integração real com CLP | **Não executada** | Requer autorização e validação técnica |

Falhas encontradas durante testes: capacidade MQTT original (corrigida no código), extrator de teste que não normalizava CRLF (corrigido no harness, sem enfraquecer asserções) e P01 (mantido TODO explícito). P01 está em `tests/novoprograma.test.cjs`: esperado `{ponto: 0, soldas: []}`, obtido `{ponto: 1, soldas: [true]}` com confirmação ainda pendente. Nenhum mock foi apresentado como movimento real.

## G. Próximos passos e comandos PowerShell

### 1. Reproduzir testes sem máquina

```powershell
Set-Location 'C:\Users\Evellyn\Documents\Projeto-Integrador\Solda-sistema-versao-semifinal'
npm ci --ignore-scripts --prefix mqtt-broker
node --test tests/*.test.cjs
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
.\.venv\Scripts\python.exe -m py_compile visao-python/visao.py visao-python/controle_gestos.py
.\.venv\Scripts\python.exe -m pip check
npm audit --omit=dev --prefix mqtt-broker
git diff --check
git status --short
```

Esperar o TODO P01 e os três alertas de auditoria, sem tratá-los como aprovação. Para a sintaxe de um arquivo: `node --check new-program/novoprograma.js`.

### 2. Corrigir pendências antes de integrar equipamento

Prioridade: autorizar e implementar proposta P01 com testes; homologar posição/mesa e mapa/ladder; corrigir regras em emulador; preparar credenciais/ACL e validade de eventos MQTT; atualizar Aedes com compatibilidade. Revisar a operação Git preexistente manualmente. Não fazer merge com main automaticamente.

### 3. Ambiente isolado para testes de interface/câmera

Em terminal dedicado, sem Node-RED conectado a este broker:

```powershell
$env:MQTT_BIND_HOST = '127.0.0.1'
$env:MQTT_TCP_PORT = '18883'
$env:MQTT_WS_PORT = '18888'
node .\mqtt-broker\server.js
```

Para a interface usar esse ambiente, definir antes de carregar `mqtt-maquina.js`:

```javascript
window.SoldaTechMQTTConfig = { url: 'ws://127.0.0.1:18888' };
```

Essa configuração é apenas para navegador no computador de teste; não aponta para o broker operacional. Sem esse override a página continuará tentando a porta padrão 8888. Manter o modo simulação selecionado. Nenhum override foi implantado automaticamente.

Em outro terminal na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m http.server 5500 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:5500/new-program/novoprograma.html`. Para validar câmera, somente após conferir o isolamento e o modo simulação, em terceiro terminal:

```powershell
$env:MQTT_HOST = '127.0.0.1'
$env:MQTT_PORT = '18883'
$env:MQTT_TLS = 'false'
# Em terminal de teste, remover apenas credenciais herdadas do processo:
Remove-Item Env:MQTT_USER, Env:MQTT_PASS, Env:MQTT_PASSWORD -ErrorAction SilentlyContinue
.\.venv\Scripts\python.exe .\visao-python\visao.py
```

Sair da câmera com Q/Esc; encerrar servidores com Ctrl+C. As variáveis acima afetam apenas esses terminais. Não iniciar o flow operacional para testes: seu initialize conecta e escreve coils automaticamente. Para Node-RED/Modbus, usar primeiro os testes com mocks fornecidos, depois simulador isolado configurado por técnico; não foi fornecido comando de deploy físico.

No Android, repetir homologação em rede de testes isolada, usando IP confirmado do computador em vez de localhost; requer configuração deliberada do bind/firewall e WS/WSS. Não abrir portas para a Internet. Operação padrão continua TCP 1883/WS 8888 quando o responsável homologar o ambiente.

### Contratos preservados

- `soldatech/maquina/comando`: `{idComando, comando, dados, origem, timestamp}`; comandos JOG_CIMA/JOG_BAIXO/JOG_PARAR/JOG_PULSO, MESA_START/MESA_STOP, SOLDA_ON/SOLDA_OFF, MOVER_PONTO e PING preservados.
- Status/resposta/erro: tópicos `soldatech/maquina/status`, `/resposta`, `/erro`; confirmação correlacionada por idComando quando aplicável. MESA_READY não carrega correlação de comando no flow atual.
- `soldatech/visao/gesto`: `{tipo: 'GESTO_VISAO', gesto: 'START' | 'PAUSA'}`. Sem comando Modbus direto. Classificador permanece palma/punho por landmarks; falsos positivos em condições reais ainda não medidos.
- Frontend: client ID aleatório, reconexão 3 s, timeout de comando padrão 8 s e validade de status 10 s. Python: client ID único, backoff de reconexão 1–30 s; credenciais por MQTT_USER + MQTT_PASS ou MQTT_PASSWORD, TLS configurável. Node-RED client ID fixo precisa ser único por instância.

**Aceitação pendente:** controle manual somente testado por mocks; posicionamento/avanço físico, replay de eventos em voo, segurança e regressão completa de interface/serviços ainda exigem trabalho. Arquitetura e funcionalidades foram preservadas; não houve atuação física, deploy, alteração de ladder, merge novo, commit ou push.
