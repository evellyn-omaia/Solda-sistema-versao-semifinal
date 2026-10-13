# Visão computacional no SoldaTouch mobile

Implementação e verificações locais: 10/10/2026.

**Disponível nesta entrega: câmera e reconhecimento no próprio navegador, integrados à configuração da produção, em modo demonstração. Nenhum gesto desta página inicia ou pausa equipamento físico.** A produção 3D também não é iniciada por esta página. P01 e as condições de autorização operacional continuam pendentes.

## Como usar no celular

1. Abra o SoldaTouch por HTTPS e entre na sua conta normalmente.
2. Abra a Central de Produção (`iniciar-producao/iniciarproducao.html`).
3. Selecione o programa, materiais e quantidade inteira de peças. Também é possível preparar uma fila pelo botão existente **Adicionar à Fila**.
4. Escolha **Visão Computacional**, ao lado de **Iniciar Produção**. A visão usa a fila mais a seleção ainda preenchida; o resumo na câmera mostra todos os itens. O botão tradicional conserva seu fluxo anterior, que exige adicionar programas à fila.
5. A configuração é validada e a câmera abre na mesma aba. Autorize seu uso. Se o navegador exigir interação adicional, toque em **Ativar câmera**.
6. Mostre somente uma mão, bem iluminada, inteira dentro da imagem. Mantenha a palma aberta por pelo menos 0,6 segundo: aparecerá **MÃO ABERTA — START** e, após estabilidade, o resultado da intenção em demonstração.
7. Feche a mão: aparecerá **MÃO FECHADA — PAUSA**. Entre solicitações há cooldown de 1,8 segundo. Um gesto mantido não gera repetições; retire a mão por pelo menos 0,6 segundo para repetir o mesmo gesto.
8. Confira programa, quantidade, comunicação, gesto e resultado. A produção permanece **Não iniciada**; peças produzidas e progresso aparecem como indisponíveis, sem contadores inventados.
9. Toque em **Encerrar câmera** ou **Voltar**. A fila, a seleção, os materiais e a quantidade são restaurados quando a sessão ainda é válida e os programas continuam disponíveis.

O botão **Alternar câmera** aparece quando o navegador informa pelo menos duas câmeras após a permissão. A frontal é preferida, com prévia espelhada. A solicitação de câmera traseira é uma preferência do navegador; a escolha efetiva precisa ser conferida no aparelho.

Sair da aba, bloquear o aparelho, perder conexão ou mudar de conta encerra a captura. Ao retornar, valide a configuração, ative a câmera e primeiro retire a mão do enquadramento. Não há retomada ou reenvio automático de START. PAUSA por gesto não substitui parada de emergência.

## O que foi encontrado no projeto

Todos os arquivos citados no pedido existem. A seleção e a quantidade estão na **Central de Produção**, não em `novoprograma.html`.

| Função existente | Local / comportamento preservado |
|---|---|
| Seleção e quantidade | `iniciar-producao/iniciarproducao.html`: `selectPrograma`, `quantidade` |
| Botão tradicional | `btnIniciar` chama `iniciarProducao()` em `iniciarproducao.js` |
| Transferência tradicional | Verifica produção pendente, grava `filaProducao` em localStorage e abre `new-program/novoprograma.html` |
| Motor de execução | `new-program/novoprograma.js`: `estadoExecucao`, `filaProducao`, `iniciarSistema()`, `confirmarInicioCiclo()` e `iniciarExecucaoPrograma()` |
| Pausa existente | `alternarMovimento()`; listener de visão só solicita pausa em EXECUTANDO |
| MQTT | `new-program/mqtt-maquina.js`; broker Aedes em `mqtt-broker/server.js` |
| Visão Python | `visao-python/visao.py` e `controle_gestos.py`; tópico `soldatech/visao/gesto`, envelope `GESTO_VISAO` com START/PAUSA |
| Autenticação | Firebase Auth em `solda-login/firebase.js`; vínculo de empresa conferido por `obterEmpresaId()` em `firebase-programas.js` |
| Hospedagem | HTML/CSS/JS estáticos, sem pipeline de Pages encontrado no checkout; configuração remota de hospedagem não foi consultada |

O classificador Python usa quatro dedos estendidos para PALMA e nenhum para PUNHO, com filtro de estabilidade. A versão mobile usa as categorias treinadas `Open_Palm` e `Closed_Fist` do MediaPipe, conservando START/PAUSA. Os classificadores não são idênticos: confiança mínima de 0,85, uma única mão aceita, estabilidade contínua de 600 ms, cooldown de 1800 ms e descarte de candidatos após intervalo de frames superior a 400 ms. Gestos desconhecidos e ausência de mão não enviam intenções.

A implementação usa MediaPipe Tasks Vision **0.10.21** e modelo `gesture_recognizer/float16/1`, carregados por HTTPS. Processamento local por `recognizeForVideo`, no máximo aproximadamente 10 inferências por segundo, com redução adaptativa em aparelhos lentos. O loop ignora frames repetidos. O processamento síncrono ainda pode afetar celulares modestos; avaliar worker se a medição real justificar. Consulte a [documentação oficial do MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js).

## Dados e isolamento

- `sessionStorage` mantém a configuração na aba, com UID, empresa, ID aleatório, revisão dos programas e validade de 30 minutos. Não utiliza a fila global de localStorage nem grava produção Firebase.
- UID e vínculo de empresa vêm dos helpers autenticados existentes. Na entrada da câmera, os programas são relidos e comparados com a revisão selecionada; mudança de conta, revisão, exclusão, expiração ou dados inválidos bloqueiam a página.
- O retorno consome o rascunho. Abrir `camera.html` diretamente, sem configuração válida, mostra erro e mantém a câmera desativada.
- Esses dados locais **não são uma credencial nem autorização industrial**. Um usuário pode manipular o próprio navegador. A ausência de qualquer transporte/atuador operacional na página é o bloqueio físico desta entrega, inclusive se alguém alterar o campo de modo.
- Uma aba duplicada pode receber uma cópia inicial de sessionStorage pelo navegador. Isso não permite controle cruzado porque nenhum comando sai da demonstração. Para um futuro modo operacional, a exclusividade da sessão deverá ser imposta no backend.
- Nenhuma imagem é gravada, armazenada ou enviada. Há requisições para autenticação/dados Firebase e download do JS/WASM/modelo; não há upload de vídeo.

## Comunicação e pendências operacionais

Nesta versão a página conversa com o SoldaTouch pelos helpers Firebase existentes para **leitura e validação da configuração**. Os gestos são intenções locais: `solicitarGestoDemonstracao()` retorna `tipo: GESTO_VISAO`, `gesto`, `sessaoId`, `enviado: false` e `executado: false` para apresentação na interface. Não publica o envelope em MQTT, não conecta broker e não despacha o evento global legado.

Não foi conectado o motor 3D porque sua inicialização recupera produção/fila e pode persistir produção e restaurar modo real; não há sandbox autenticado e independente já homologado para reutilizá-lo nesta página. Criar um segundo motor contrariaria o requisito. A alternativa segura prevista no pedido foi aplicada: demonstração restrita ao reconhecimento.

Para habilitar execução futuramente, falta:

1. Resolver e homologar **P01/P03**: confirmação física de posicionamento antes de avançar/soldar. O teste TODO continua reproduzindo o defeito. Não basta alterar uma flag no navegador.
2. Backend que autentique o usuário, valide vínculo/papel, programa e quantidade, crie sessão de produção e reserve a máquina. Firebase Auth sozinho não autentica MQTT.
3. Intenções com identificador único, validade curta, sessão/produção/máquina/empresa e autorização server-side; rejeição de replay, retenção e sessão incorreta. Sem fila offline; reconexão deve exigir nova intenção.
4. Broker acessível por **WSS**, TLS válido, credenciais temporárias e ACL por identidade/sessão. O Aedes atual não fornece autenticação/ACL/TLS. GitHub Pages não hospeda esse serviço. Não expor CLP, não publicar credenciais fixas e não criar túnel público.
5. Um adaptador autorizado que solicite as mesmas funções/regras do motor existente (`confirmarInicioCiclo()` e a pausa existente), sem duplicar execução. Estado e confirmação de execução precisam vir da sessão correta; publicação não significa execução.
6. Telemetria correlacionada e homologada para exibir contagem/progresso reais. Não ler indiscriminadamente uma produção global por apenas nome do programa.

O fluxo Python, os tópicos existentes, o motor 3D e os controles manuais não foram alterados nesta entrega. Isso preserva compatibilidade, **não corrige os riscos industriais e de autorização preexistentes** descritos em `RELATORIO_AUDITORIA_SOLDATOUCH.md`.

## Serviços necessários

| Modo | Dependências |
|---|---|
| Demonstração mobile entregue | Site HTTPS, conta Firebase existente, programa salvo válido, acesso ao Firebase/CDNs, navegador com câmera/WASM |
| Testes automatizados de fluxo | Node.js, Playwright e Chrome; servidor loopback e Firebase/vídeo/modelo falsos criados pelos testes |
| Smoke do MediaPipe real | Dependências do teste de navegador e internet para baixar JS/WASM/modelo; imagem sintética, sem câmera física |
| Simulação 3D tradicional | Fluxo anterior do projeto; não integrado à câmera nesta entrega |
| Operação física por visão mobile | **Indisponível** até as homologações e o backend seguro acima |

Python, broker e Node-RED não precisam estar ligados para a demonstração mobile.

## Testar localmente e publicar

Para ver a interface no computador, a partir da raiz do repositório:

```powershell
# Servidor estático opcional; não processa imagens nem executa visao.py.
.\.venv\Scripts\python.exe -m http.server 8080 --bind 127.0.0.1
```

Abra `http://localhost:8080`, autentique-se e siga o fluxo. Para o celular, utilize a publicação HTTPS; `http://IP-DO-PC:8080` normalmente não permite getUserMedia e não é a solução proposta. A câmera não exige esse servidor Python quando hospedada no Pages.

Após revisão do código e resolução do merge pelo responsável, publique a raiz do repositório que contém `index.html`. No GitHub, em **Settings → Pages → Build and deployment**, escolha a branch aprovada e `/(root)` em **Deploy from a branch**. Preserve as pastas relativas. Não publique apenas `camera.html`; ela depende dos módulos e da navegação da Central. Veja a [configuração oficial da origem do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Ative **Enforce HTTPS**, se disponível, e use a URL exibida pelo GitHub. Confira também o domínio autorizado no projeto Firebase e as permissões de leitura da conta. Veja [HTTPS no GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https). Nenhuma publicação, configuração remota, commit ou push foi feita nesta tarefa.

## Testes e resultados

Comandos executados (PowerShell na raiz do repositório):

```powershell
node --test tests/*.test.cjs
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
git diff --check

# Ferramenta de teste instalada fora do projeto, sem mudar package.json/lockfile.
npm install --prefix "$env:TEMP/soldatouch-visao-tests" --no-audit --no-fund --ignore-scripts playwright@1.64.0
$env:NODE_PATH = "$env:TEMP/soldatouch-visao-tests/node_modules"
$env:TESTAR_MEDIAPIPE_REAL = '1'
node --test tests/visao-mobile.browser.cjs
# Se necessário, defina CHROME_PATH para o executável local do Chrome.
```

Resultados: suíte Node anterior **20 aprovados + 1 TODO com asserção falhando (P01)**; **16 novos testes unitários aprovados**; suíte Python **10 aprovados**; navegador **9 cenários aprovados** (o runner contabiliza 10 incluindo o teste pai). O smoke real carregou MediaPipe/WASM/modelo e retornou nenhuma mão para imagem sintética. Sintaxe dos arquivos novos/modificados e `git diff --check` aprovados. Nenhum teste antigo foi alterado.

| Requisitos do pedido | Cobertura automatizada |
|---|---|
| 1–2: botão anterior e botão adjacente | Handler real tradicional executado em VM; layout/browser em 320, 390, 768 e 1280 px |
| 3–6: quantidade, navegação, programa e quantidade preservados | Unidade + ida/volta no browser; quantidade inválida bloqueada |
| 7–10: START, PAUSA, ausência e desconhecido | Resultados MediaPipe falsos, confiança/duas mãos e fluxo visual; smoke real apenas sem mão |
| 11–12: cooldown e duplicatas | Relógio controlado, gesto mantido, instabilidade e lacunas de frames |
| 13–14: falha e reconexão | Câmera encerra offline; reconexão exige validação e neutro; nenhum replay |
| 15–17: permissão, indisponibilidade, encerramento | getUserMedia falso com erros, tracks/modelo liberados, permissões/modelos tardios descartados; tracks encerradas no browser |
| 18–19: retorno e demonstração | Rascunho restaurado, zero WebSockets/POSTs de comando no fluxo, produção não iniciada |
| 20–21: sessões e bloqueio físico | UID/empresa/expiração/mode adulterado rejeitados; troca de conta interrompe captura; acesso direto bloqueado |
| 22: compatibilidade | Testes anteriores executados, código do botão tradicional preservado; MQTT/broker testados isoladamente pela suíte anterior |

O broker de teste usa loopback e portas aleatórias, apenas tópico de teste. Node-RED e Modbus são mocks. Não houve conexão ao CLP, teste elétrico, soldagem ou movimento físico.

## Checklist manual no celular real

- Validar login/Firebase e programas autorizados no ambiente de publicação; essa integração foi simulada nos testes.
- Conferir Android/Chrome e iPhone/Safari disponíveis, orientação vertical/horizontal, toque e ausência de cortes.
- Permitir, negar e revogar câmera; testar câmera ocupada, frontal/traseira e bloqueio/desbloqueio da tela.
- Testar palma/punho reais, mão esquerda/direita, iluminação, distância, duas mãos, ausência e gesto desconhecido. Precisão, falsos positivos e latência não foram medidos em pessoas reais.
- Manter gesto por vários segundos, retirar/reapresentar, alternar rápido e confirmar ausência de repetição.
- Cortar Wi-Fi/dados e reconectar com a mão ainda aberta: não deve aparecer nova solicitação até validação, ativação e neutro.
- Conferir consumo de bateria/temperatura, cancelamento durante carregamento do modelo e fechamento da aba.
- Voltar/recarregar/duplicar aba, expirar 30 minutos, mudar de conta e editar/excluir programa; confirmar bloqueios e restauração coerente.
- Acompanhar as requisições de rede para confirmar que não há imagens ou comandos industriais transmitidos.

## Arquivos desta entrega e estado Git

Modificados: `iniciar-producao/iniciarproducao.html`, `.css`, `.js` e `new-program/firebase-programas.js` (somente helper de identidade adicionado nesta tarefa).

Criados: `new-program/camera.html`, `camera.css`, `camera.js`, `visao-core.mjs`, `visao-camera.mjs`, `visao-identidade.js`, `tests/visao-mobile.test.cjs`, `tests/visao-mobile.browser.cjs` e este tutorial.

A branch permaneceu `backup-visao-computacional`. As mudanças anteriores e o merge pendente foram preservados. `new-program/novoprograma.js` já estava `UU`, sem marcadores no arquivo de trabalho; não foi editado nesta entrega nem marcado como resolvido. Nenhum ladder, mapa Modbus, intertravamento, flow, broker ou arquivo Python foi alterado nesta tarefa.
