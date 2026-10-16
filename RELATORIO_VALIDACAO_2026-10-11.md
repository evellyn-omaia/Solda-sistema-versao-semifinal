# SoldaTech — correções e validação de 11/10/2026

As correções foram aplicadas incrementalmente sobre o projeto existente. As alterações anteriores do usuário foram preservadas. Não foram alterados o modelo GLB, os contratos MQTT, o broker, os flows Node-RED, o simulador Modbus ou as regras do Firebase nesta intervenção.

## Causas confirmadas

**Firebase:** `scripts/soldatech.cjs` lia `novoprograma.html` e removia expressamente a tag `<script type="module" src="./firebase-programas.js"></script>` antes de responder. Isso explica o arquivo disponível por URL, nenhuma requisição a ele durante a navegação e as funções globais ausentes. O servidor agora preserva essa tag. O teste de navegador usou o servidor integrado, executou o SDK Firebase real e confirmou as seis funções solicitadas. Portanto, a comprovação vai além de HTTP 200.

Foi adicionada uma ponte de inicialização para as seis funções: chamadas precoces aguardam o import real. Falhas de importação informam URL e erro original, e a tentativa de salvar mostra a mensagem recebida, inclusive falhas de autenticação/permissão. Foram testados import lento e import bloqueado. A configuração Firebase e sua autenticação compartilhada permanecem no módulo existente `solda-login/firebase.js`.

**Imagens:** os seis cartões existem em `images`, mas essa pasta não estava na lista de diretórios públicos do servidor. Agora está autorizada. Além disso, `logosoldatech.png` não existe no repositório, e Carregar Programa apontava para a pasta inexistente `imagens`. As duas referências agora usam um SVG textual SoldaTech incluído nesta correção. Esse SVG é uma alternativa textual, não a recuperação do logotipo original ausente.

Os dois problemas principais estavam no servidor, mas em mecanismos distintos: remoção do script e bloqueio de diretório. Não eram falhas do SDK ou dos arquivos PNG. O servidor mantém `no-store`, `nosniff`, verificação de origem/host e restrições de caminhos. Foram acrescentados MIME types para JPEG, WebP, WASM e JSON, além de charset UTF-8 nos arquivos textuais.

## Gestos e reprodução virtual

- O código encontrado já usava confiança de classificação 0,65 e limites de detecção/presença/rastreamento 0,5, diferentes dos valores antigos citados na solicitação. Esses valores foram preservados.
- As duas interfaces de câmera mostram quantidade de mãos, categoria e confiança. A mensagem de falha do MediaPipe preserva a causa original.
- O filtro mantém confirmação por 600 ms, cooldown e bloqueio de repetição do gesto contínuo. Seu intervalo tolerado agora acompanha o tempo de inferência em CPU lenta, com limite, evitando reinícios permanentes da confirmação quando os frames demoram.
- Na câmera integrada de Novo Programa, Open_Palm chama a reprodução singular existente; Closed_Fist pausa a reprodução existente, preservando ponto e posição. Não são publicados comandos MQTT por essa entrada.
- Na página `camera.html`, a opção **Preparar simulação 3D** permite selecionar um dos programas da configuração autenticada. O modelo existente é aberto em um iframe da mesma origem, consulta seus pontos pelo Firebase e aguarda o gesto. Não inicia automaticamente a fila nem altera quantidades de produção.
- Sem preparar a simulação nessa página, o modo anterior de demonstração continua informando apenas intenções. Essa distinção é explícita na interface.
- START é recusado sem pontos válidos, sem modelo pronto, durante outra execução, durante seleção manual pendente, no modo físico, após cancelamento/emergência ou enquanto a tela acompanha a mesa simulada. Nesse último caso, use **Voltar à edição local**.
- START não retoma pausas. A retomada é manual. PAUSA exige reprodução virtual em andamento. Emergência trava a reprodução e impede retomada pelo botão ou por gesto; não há retomada automática quando chegam novos status normais.
- Os controles manuais, a geometria, as coordenadas e o motor de animação foram reutilizados.

## Testes e evidências

| Execução | Resultado |
| --- | --- |
| `node --test --test-reporter=spec ./tests/*.test.cjs` | 74 aprovados, 0 falhas |
| `node --test --test-reporter=spec tests/simulacao.browser.cjs` | 8 aprovados, 0 falhas |
| `TESTAR_MEDIAPIPE_REAL=1` com `tests/visao-mobile.browser.cjs` | 10 aprovados, 0 falhas |
| `python -m unittest discover -s tests -p test_visao.py` | 10 aprovados |
| Parar e iniciar pelos scripts PowerShell | Serviços encerrados e reiniciados com sucesso |

O navegador de teste foi Chrome/Playwright em contexto isolado. Foram verificados:

- SDK Firebase real executado e as seis funções disponíveis; acesso sem login recusado.
- Importação atrasada e falha de rede de importação, com chamadas aguardando ou recebendo erro.
- CRUD e integridade dos pontos entre dois contextos de teste usando **adaptador de banco em memória apenas no teste**. Isso não comprova persistência no Firebase de produção e não introduz armazenamento alternativo na aplicação.
- Imagens referenciadas pelo painel baixadas e decodificadas pelo navegador, incluindo o SVG textual.
- HTMLs e recursos locais declarados por script/img/link das páginas principais acessíveis pelo servidor; MIME de módulos e GLB; arquivos privados inacessíveis e parada sem token recusada.
- Modelo 3D carregado, botões da ponte/mesa operantes e status retornando pelo Node-RED/Modbus real em loopback.
- Câmera sintética e categorias injetadas gerando START/PAUSA no motor 3D, posição estável durante a pausa, nenhuma chamada de comando MQTT e bloqueio após emergência.
- Página de câmera preparando e controlando o iframe 3D com identidade e respostas de banco simuladas, explicitamente separadas do teste do SDK real.
- MediaPipe real: download/importação de WASM/modelo e inferência sobre quadro sintético sem mão.
- Navegação e responsividade de visão em 320/390/768/1280 px, encerramento de câmera, troca de conta, perda de conexão e revalidação.
- Matriz MQTT TCP/WebSocket, autenticação e ACL, reconexões do broker/Node-RED/Modbus, expiração de status e bloqueio de comandos físicos não homologados.

## Limitações de verificação

Não houve uma conta autenticada disponibilizada no contexto isolado de teste. Portanto, **não foi comprovado salvar/listar/recarregar/excluir um programa no Firebase de produção**, nem persistência após login real ou permissões efetivamente implantadas no serviço. As regras locais foram lidas e não foram alteradas: não há acesso público, e o vínculo de empresa é exigido. O teste de CRUD usa um adaptador; o teste do SDK real confirma execução e recusa por ausência de login.

Não foi usada uma mão diante de uma webcam física. O modelo real carregou e executou, mas a precisão para mãos reais, iluminação e posicionamento ainda exige validação presencial. Os testes de START/PAUSA usam categorias injetadas e não devem ser apresentados como comprovação da precisão do classificador.

O painel autenticado completo e a persistência da sessão entre login/painel/programas ainda precisam de verificação com a conta do usuário. Use a mesma origem durante todo o fluxo, por exemplo `http://127.0.0.1:8080`; `localhost` é uma origem diferente para o armazenamento do navegador.

## Arquivos desta intervenção

- `scripts/soldatech.cjs`
- `new-program/firebase-loader.js` (novo)
- `new-program/novoprograma.html`
- `new-program/novoprograma.js`
- `new-program/simulacao-integrada.mjs`
- `new-program/camera.html`
- `new-program/camera.js`
- `new-program/visao-core.mjs`
- `new-program/visao-camera.mjs`
- `images/logosoldatech.svg` (novo)
- `solda-system/index.html`
- `carregar-programa/carregarprograma.html`
- `iniciar-soldatech.ps1`
- `verificar-soldatech.ps1`
- `tests/firebase-programas.test.cjs`
- `tests/gestos-simulacao.test.cjs` (novo)
- `tests/simulacao.browser.cjs`
- Este relatório.

`firebase-programas.js` e `solda-login/firebase.js` foram inspecionados e executados, mas não precisaram ser modificados nesta intervenção. O repositório já tinha outras alterações, que não devem ser atribuídas a esta entrega.

## Iniciar e repetir os testes

Na pasta `C:\Users\Evellyn\Documents\Projeto-Integrador\Solda-sistema-versao-semifinal`:

```powershell
.\iniciar-soldatech.ps1
.\verificar-soldatech.ps1
node --test --test-reporter=spec .\tests\*.test.cjs
node --test --test-reporter=spec .\tests\simulacao.browser.cjs
$env:TESTAR_MEDIAPIPE_REAL = '1'
node --test --test-reporter=spec .\tests\visao-mobile.browser.cjs
python -m unittest discover -s tests -p test_visao.py
```

Para encerrar: `.\parar-soldatech.ps1`. Os testes de navegador usam Chrome no caminho padrão ou `CHROME_PATH`. A inicialização e a verificação distinguem serviços e recursos estáticos de autenticação/Firebase operacional.

O serviço foi deixado ativo em `http://127.0.0.1:8080`, com MQTT TCP 1883, WebSocket 8888, Node-RED 1880 e Modbus simulado 1502. Para validar a pendência real, abra `/solda-login/login.html`, entre com sua conta, salve um programa de teste, atualize a página e confira seus pontos na listagem/carregamento. Depois teste a mão aberta e o punho fechado na câmera com o programa preparado.
