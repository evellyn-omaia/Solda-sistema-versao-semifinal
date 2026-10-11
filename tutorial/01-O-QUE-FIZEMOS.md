# O que foi feito nesta etapa do projeto

Este documento resume, em ordem, tudo que foi construído e corrigido
no SoldaTech durante as sessões de integração com o CLP real. Serve
como "diário de bordo" — se você (ou outra pessoa) voltar a este
projeto depois de um tempo, comece por aqui pra entender o que já
existe antes de mexer em qualquer coisa.

O outro arquivo desta pasta (`02-GUIA-CLP-NODE-RED-E-ENCODER.md`)
explica **como** cada parte funciona por dentro e o que fazer quando
o encoder chegar. Este aqui é só o resumo do **o quê** e **por quê**.

---

## 1. Integração com o CLP real (Node-RED + Modbus TCP)

Antes desta etapa, o "gêmeo digital" (a máquina 3D no navegador) era
uma simulação pura — nada se comunicava com uma máquina de verdade.

O que foi construído:

- Um **broker MQTT local** (pasta `mqtt-broker/`), rodando no mesmo PC
  do Node-RED, sem depender de nenhum serviço de nuvem. Antes disso o
  projeto usava um broker na nuvem (HiveMQ) com uma senha exposta em
  texto puro no código do navegador — o broker local resolve isso e
  também tira a dependência de internet para o CLP e o navegador se
  falarem, já que os dois estão na mesma rede.
- Um **flow do Node-RED** (pasta `node-red/`) que faz a ponte: assina
  os comandos que o navegador publica via MQTT, traduz pra escrita
  Modbus TCP no CLP, e publica de volta o status/confirmação/erro nos
  mesmos tópicos que o navegador já esperava (o app não precisou ser
  redesenhado pra isso).
- O CLP real identificado e usado nos testes: um **Schneider Modicon
  M221 (referência TM221C16R)**, no IP `10.200.7.254`, acessado via
  Modbus TCP na porta 502 (padrão).
- O **mapa de memória do CLP foi descoberto empiricamente**, não por
  chute: lemos a documentação genérica do fabricante, ela não bateu, e
  então usamos o próprio EcoStruxure Machine Expert Basic (o programa
  onde o CLP foi programado) pra **forçar bits manualmente e escanear
  o Modbus** até achar a correspondência real. O método está detalhado
  no outro arquivo desta pasta, porque é reaproveitável pra qualquer
  sinal novo que precisar ser mapeado no futuro (como o encoder).
- Adicionamos **3 bits novos no programa do CLP** (`%M10`, `%M11`,
  `%M12`), em paralelo com os bits que os botões físicos já usavam
  (Rung0/Rung1/Rung2), sem remover nem substituir a lógica existente —
  então os botões físicos da máquina continuam funcionando exatamente
  como antes, e agora o Node-RED também consegue acionar os mesmos
  movimentos remotamente, respeitando as mesmas travas de segurança
  (fins de curso, emergência) que já existiam.

## 2. O que o CLP real consegue fazer hoje

- **Jog manual** (segurar botão sobe/desce no navegador → motor real
  sobe/desce) — funciona, com dois modos:
  - **Toque rápido**: manda um pulso de duração fixa (calibrado em
    mm por pulso, medido na máquina real).
  - **Segurar**: jog contínuo (velocidade também calibrada a partir
    de testes reais).
- **Girar mesa** (start/stop contínuo) — funciona.
- **Emergência, fins de curso** — já existiam no programa do CLP,
  não foram alterados nem contornados.

## 3. O que o CLP real **ainda não** consegue fazer

- **Ir sozinho até uma posição Z específica e parar** (ex.: durante a
  reprodução automática de um programa salvo). Isso exigiria o CLP
  saber comparar a posição atual real com um alvo — e isso não é
  possível sem um **sensor de posição (encoder)** no eixo Z, que
  ainda não está cabeado (só existe hoje o fim de curso, que só diz
  "cheguei no limite", não "estou em tal altura").
- **Girar a mesa até um ângulo específico.** Além de também precisar
  de um sensor de posição na mesa (que não existe), o CLP hoje só tem
  **uma saída** pra mesa (gira sempre no mesmo sentido) — não tem
  como reverter o giro pra "voltar" a um ângulo mais perto.
- Por isso, a **reprodução automática de um programa (pontos
  salvos) hoje só acontece no gêmeo digital (software)** — a máquina
  real não se move sozinha nesse modo, só quando você usa o jog manual.

## 4. Correções feitas no gêmeo digital (software 3D)

- Trocado o modelo 3D por uma versão mais detalhada e recalibrado o
  curso do eixo Z (`Z_MIN_MM`/`Z_MAX_MM`) pra bater com onde os fins
  de curso reais realmente travam.
- Corrigido um arquivo do modelo 3D que tinha 2 texturas quebradas
  (marcadas como PNG mas eram na verdade DDS, formato que navegador
  nenhum decodifica) — isso travava o carregamento do modelo inteiro.
- Identificada a peça certa da mesa giratória no modelo novo
  (`Base Motor Gira-1`) e aplicada uma textura simples (gerada por
  código, sem precisar de arquivo de imagem) pra dar pra enxergar o
  giro, já que a peça é um disco liso/simétrico.
- Corrigida a velocidade de animação (estava calibrada pro curso
  antigo, bem maior, e ficou "supersônica" depois de reduzir o curso).
- Reativada a lógica de **execução ponto a ponto** (a mesa vai até o
  ângulo salvo de cada ponto e para lá, não fica só girando contínuo
  ignorando o ângulo — esse era o comportamento antigo, trocado a
  pedido).

## 5. Fluxo novo de reprodução de programas (Play)

Antes, carregar um programa salvo **iniciava a execução sozinho**,
usando um sistema antigo e complexo de fila de produção (pensado pra
fabricar várias peças em lote, com quantidade/Firebase). Isso causava
travamentos quando usado fora desse contexto.

Agora existe um fluxo **separado e mais simples**:

1. Fazer pontos manualmente (jog + "SALVAR PONTO" a cada posição).
2. "SALVAR PROGRAMA" (pede um nome, salva no Firebase).
3. Carregar o programa salvo (tela "Carregar Programa") — isso só
   **carrega os pontos**, não inicia nada sozinho.
4. Botão **"▶ INICIAR REPRODUÇÃO"** — pergunta o modo:
   - **Sequencial**: ao terminar o último ponto, volta pro primeiro e
     continua (loop infinito até pausar).
   - **Singular**: ao terminar o último ponto, para e espera um novo
     clique em play.

Esse fluxo novo não usa a fila/Firebase de produção antiga — é
independente, então não deve mais travar por causa daquele sistema.

## 6. Coisas conhecidas que ainda precisam de atenção

- Os fins de curso do eixo Z estão **invertidos** no Rung0/Rung1 do
  CLP (o rung de SUBIR trava com o fim de curso de baixo, e o de
  DESCER trava com o de cima) — ainda não corrigido no ladder.
- A calibração de velocidade/pulso do jog (tanto Z quanto mesa) foi
  feita com medições reais, mas pode precisar de ajuste fino se a
  máquina mudar de comportamento (motor trocado, atrito diferente,
  etc.) — o processo de recalibrar está no outro arquivo desta pasta.
- Encoder do eixo Z e da mesa: **ainda não existem fisicamente**. O
  guia de como adaptar o código quando chegarem está no arquivo
  `02-GUIA-CLP-NODE-RED-E-ENCODER.md`.
