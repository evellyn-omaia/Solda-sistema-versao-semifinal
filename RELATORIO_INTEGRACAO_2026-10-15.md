# Integração automática de produção — 15/10/2026

## Escopo e preservação

O repositório já continha numerosas alterações e arquivos não rastreados. Foram inspecionados antes da edição e preservados. Nenhum commit ou publicação foi realizado. Backup anterior à edição: `C:\Users\Evellyn\AppData\Local\Temp\soldatouch-integracao-20261015-191100`.

Arquivos alterados nesta tarefa:

- `new-program/novoprograma.js`: início virtual independente do MQTT; bloqueio de START físico repetido; payload com identificação, nome, materiais, ordem, coordenadas e parâmetros originais; pausa por gesto delegada ao controle central; mensagem de prontidão no lugar de autorização genérica.
- `new-program/producao-mqtt.js`: INICIAR permitido apenas após planejamento recebido, impedindo repetição em AGUARDANDO_CLP/AGUARDANDO_INICIO.
- `new-program/mqtt-maquina.js`: revisão incluída na correlação de respostas e erros, além de ID do comando, comando e ID da produção.
- `tests/gestos-simulacao.test.cjs`, `tests/mqtt-maquina.test.cjs`, `tests/producao-mqtt.test.cjs`, `tests/simulacao.browser.cjs`: cobertura de retomada, correlação e controles; expectativas antigas atualizadas para permitir PING diagnóstico e verificar o bloqueio real de posicionamento.
- `tests/inicio-producao.test.cjs`: novo teste integrado das funções de controle, planejamento real e bloco manual Node-RED em ambiente isolado.
- `INSTRUCOES_NODE_RED_MANUAL.md`: localização do nó, orientação para não duplicar o bloco já instalado e matriz dos sinais pendentes.
- Este relatório.

Não foram editados HTML/CSS, Firebase, modelo 3D, dependências, configuração do broker ou CLP. Dez arquivos protegidos de visão/câmera e fluxo foram comparados por SHA-256 com a cópia inicial, sem divergências, incluindo `simulacao-integrada.mjs`, `visao-camera.mjs`, `visao-core.mjs`, `camera.js` e `node-red/flows.json`. Alterações anteriores nesses arquivos permanecem intactas.

## Fluxo implementado

Botão de início e gesto START de uma fila chamam `confirmarInicioCiclo`. Em modo físico: consulta dos programas no Firebase → planejamento completo → CARREGAR_PRODUCAO → ACK correlacionado RECEBIDA_NAO_EXECUTADA → INICIAR_PRODUCAO automático → estado retornado pelo coordenador. ENVIAR FILA não é obrigatório. O bloqueio de operação simultânea impede clique/gesto concorrentes. START repetido após AGUARDANDO_CLP não reenvia INICIAR.

Pausa por botão/gesto e retomada por CONTINUAR/START convergem em `alternarMovimento`. Em modo físico, somente estados confirmados permitem os comandos; confirmação do CLP é necessária para PAUSADO/EXECUTANDO. O bloco preparatório do Node-RED ainda rejeita pausa/retomada físicas por falta de homologação. Testes dessas transições usam respostas controladas, sem máquina.

Em modo virtual, o início executa o motor existente sem publicar fila automaticamente ou aguardar Node-RED/CLP. Pausa e retomada preservam o ponto. O botão opcional de envio da fila continua disponível para diagnóstico. Uma produção física pendente continua exigindo reconciliação antes de trocar de modo.

Timeout, desconexão ou ACK incompatível não iniciam a máquina e exigem CONSULTAR. Reconectar não publica início/retomada automaticamente. CONSULTAR apenas reconcilia; não dispara movimento. AGUARDANDO_CLP não significa execução iniciada, nem distingue por si só falta de homologação de indisponibilidade do transporte.

## Validação

- Suíte Node: 92 testes aprovados, zero falhas. Log: `%TEMP%\soldatouch-final-tests.txt`.
- Navegador: 19 testes aprovados, com câmera sintética/classificação injetada, visão móvel, ciclo 4 peças × 5 pontos, pausa/retomada, histórico e viewports de celular/desktop. Log: `%TEMP%\soldatouch-browser-final.txt`.
- Python: 10 testes de visão aprovados.
- Bloco manual Node-RED executado isoladamente: planejamento recebido, início AGUARDANDO_CLP, consulta sem execução, pausa/retomada rejeitadas, cancelamento pré-execução e passagem de PING ao roteador existente. Nenhum acesso Modbus permitido nesse teste.
- `git diff --check` sem erros de whitespace.

A suíte inicial tinha 83 aprovações e uma falha por contar PING como movimento. A primeira execução de navegador revelou expectativas antigas sobre checkbox desabilitado e ausência de PING; foram substituídas por verificações do bloqueio de posicionamento e ausência de comandos operacionais. Não se alterou a visão para fazer testes passarem.

Os testes de câmera não comprovam reconhecimento em câmera física real. Não houve acesso ao HiveMQ ativo nem acionamento da máquina. A integração local usa broker e Modbus simulados. Acesso remoto pelo celular/GitHub Pages não foi publicado ou homologado nesta tarefa.

## Node-RED e homologação

Nenhuma alteração manual adicional é necessária se o bloco preparatório do manual já estiver instalado conforme informado. Não cole outra cópia. O JavaScript completo permanece no manual, no nó Rotear comando -> Modbus, antes de `const client = global.get('clpClient');`, preservando o roteador posterior. A aba local é SoldaTech - Ponte MQTT <-> CLP; conferir o nome no ambiente ativo.

O sequenciador físico não foi liberado. Faltam sinais homologados de posição Z/angular, solda concluída/falha, peça fixada/trocada, intertravamentos, parada e retomada segura, além de recuperação do cursor persistente. O manual descreve a sequência e os dados a identificar. Foram preservadas as referências `%M10`, `%M11`, `%M12`, `%M3`, `%MW0`, `%MW1` e `%MD100`, sem inventar endereços, escalas ou confirmações.
