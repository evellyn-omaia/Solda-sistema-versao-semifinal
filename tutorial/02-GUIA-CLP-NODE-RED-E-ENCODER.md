# Guia: como funciona a comunicação com o CLP, e o que fazer quando o encoder chegar

Este documento explica o **funcionamento** por trás da integração
com a máquina real, sem entrar em código — a ideia é que você entenda
o suficiente pra manter, recalibrar ou estender isso sozinho(a) no
futuro. Sempre que possível, aponta pro arquivo/pasta exata onde a
coisa realmente vive, caso precise abrir e olhar.

---

## Parte 1 — Como as peças se encaixam

Pense em 4 "estações" que precisam conversar entre si:

```
[Navegador]  <--MQTT-->  [Broker MQTT local]  <--MQTT-->  [Node-RED]  <--Modbus TCP-->  [CLP real]
 (o app 3D)                (mqtt-broker/)                (node-red/)                  (motores de verdade)
```

- **Navegador**: onde você vê o modelo 3D e aperta os botões. Ele
  nunca fala direto com o CLP — só publica "comandos" (tipo "quero
  subir") e escuta "respostas"/"status" via MQTT.
- **Broker MQTT local**: um "correio" que só entrega mensagens entre
  quem está inscrito nos mesmos assuntos (tópicos). Não entende nada
  de solda ou CLP, só repassa mensagens. Fica no arquivo
  `mqtt-broker/server.js`.
- **Node-RED**: é o "tradutor". Ele escuta os comandos que chegam do
  navegador via MQTT, e os transforma em leitura/escrita Modbus TCP no
  CLP (que é a língua que o CLP fala). E faz o caminho inverso também:
  lê o estado do CLP e publica como MQTT pro navegador entender.
  Fica na pasta `node-red/` (o arquivo `flows.json` é o "programa" do
  Node-RED, e pode ser reaberto/editado visualmente em
  `http://localhost:1880`).
- **CLP real**: a máquina de verdade, com o programa ladder (feito no
  EcoStruxure Machine Expert Basic) que decide o que cada saída faz.

**Por que essa ponte, e não o navegador falar direto com o CLP?**
Porque navegadores não conseguem falar Modbus TCP diretamente (é um
protocolo "baixo nível", pensado pra redes industriais, não pra web).
O Node-RED existe justamente pra fazer essa tradução.

---

## Parte 2 — Como o CLP entende o que o Node-RED manda

O CLP não sabe o que é "subir o indutor" ou "girar mesa" — ele só
entende bits de memória ligados/desligados, e o programa ladder (que
já existia antes desta integração) é que decide o que cada bit faz.

**A técnica usada**: em vez de reescrever a lógica existente do CLP
(arriscado, pode quebrar os botões físicos), adicionamos **bits novos
em paralelo** com os bits que os botões físicos já ligavam. Por
exemplo, o botão físico "sobe" liga um bit (`%M1`); criamos um bit novo
(`%M10`) que, quando ligado pelo Node-RED, tem exatamente o mesmo
efeito — como se fosse "mais um dedo apertando o mesmo botão". Isso
significa que **as travas de segurança que já existiam (fim de curso,
emergência) continuam valendo** também pro controle remoto, porque
elas ficam "depois" desse OU lógico, não são contornadas.

Essa técnica (adicionar em paralelo, nunca substituir) é a forma mais
segura de estender um programa de CLP que já está em uso — vale a
pena repetir sempre que for adicionar um controle remoto novo.

## Parte 3 — Como descobrimos os endereços Modbus certos

Isso é importante entender porque **vai precisar ser refeito** sempre
que um bit/registrador novo for exposto (como vai acontecer com o
encoder).

O problema: saber que existe um bit `%M10` no programa do CLP não diz
automaticamente **qual número de endereço Modbus** corresponde a ele
— cada fabricante/versão de firmware pode mapear isso de um jeito
diferente, e a documentação genérica nem sempre bate com a realidade
do equipamento específico.

**O método que funcionou** (repita esse passo a passo pra qualquer
sinal novo):

1. Com o CLP online no EcoStruxure Machine Expert Basic, vá em
   **Ferramentas → Objetos da memória → Bits de memória**. Essa tabela
   mostra todos os `%M0, %M1, %M2...` que existem.
2. **Force** o bit que você quer identificar pra `1` diretamente por
   ali (botão direito em cima do bit na tela de programação, ou usando
   a tabela — o EcoStruxure tem uma opção de "forçar valor" quando
   está online).
3. Enquanto o bit está forçado, rode uma leitura Modbus **varrendo uma
   faixa grande de endereços** (por exemplo, coils de 0 a 500) a
   partir de outro computador/script na mesma rede. O endereço que
   aparecer "ligado" durante o teste é a correspondência real.
4. Solte o forçamento assim que confirmar (nunca deixe algo forçado
   "de propósito" ligado depois do teste).

Foi assim que descobrimos, por exemplo, que `%M10` correspondia
exatamente ao endereço Modbus `10` (ou seja, `%Mn` = endereço `n`,
sem nenhum deslocamento — mas **isso não é garantido pra outro CLP ou
outro tipo de sinal**, tem que testar de novo sempre).

**Por que não confiar só na documentação do fabricante?** Porque
testamos primeiro seguindo uma regra encontrada na documentação/fórum
("%M1 = endereço 0") e ela **não bateu** com a realidade deste CLP
específico. Só o teste direto (forçar + escanear) deu certeza.

## Parte 4 — Os "comandos" que já existem hoje

O navegador manda comandos MQTT com nomes como `JOG_CIMA`,
`JOG_BAIXO`, `JOG_PARAR`, `JOG_PULSO`, `MESA_START`, `MESA_STOP`,
`SOLDA_ON`, `SOLDA_OFF`, `MOVER_PONTO`, `PING`. Cada um vira uma
escrita Modbus específica no Node-RED (dentro do node de função
"Rotear comando -> Modbus", em `node-red/flows.json`).

Dois detalhes importantes desse desenho, pra manter no futuro:

- **`JOG_PULSO`** existe separado de `JOG_CIMA`/`JOG_PARAR` porque um
  toque rápido no navegador precisa mover uma distância **previsível**
  — se dependesse só de "quanto tempo o dedo ficou no botão", cada
  toque moveria uma quantidade diferente (o tempo de um clique humano
  varia). Por isso o pulso tem uma duração **fixa, controlada pelo
  Node-RED**, não pelo navegador.
- **`MOVER_PONTO`** hoje só escreve um registrador com a posição alvo
  — mas **nada no CLP lê esse registrador ainda**. É só uma "gaveta"
  preparada pro futuro. Isso é o que precisa mudar quando o encoder
  chegar (próxima seção).

## Parte 5 — Quando o encoder chegar: o que fazer

Isso é um roteiro conceitual, sem código — o objetivo é você entender
a ordem certa das coisas antes de começar a mexer.

### Passo 1 — Entender o que o encoder entrega

Um encoder de posição normalmente entrega um **pulso** (ou uma
contagem) proporcional ao quanto o eixo se moveu — não uma "altura em
mm" pronta. Vai ser preciso, no programa do CLP, converter essa
contagem em uma unidade útil (mm), da mesma forma que hoje o fim de
curso só diz "cheguei no limite" (um bit), não "estou a X mm".

### Passo 2 — Expor a posição real como um registrador Modbus

No programa ladder do CLP, crie um registrador (`%MW`, palavra de
memória) que guarde a posição atual convertida pra décimos de mm (o
mesmo padrão que os outros registradores deste projeto já usam, pra
manter consistência). Depois, repita o **método da Parte 3** (forçar
um valor conhecido nesse registrador e escanear) pra descobrir o
endereço Modbus real dele.

### Passo 3 — Ligar esse registrador no Node-RED

No arquivo `node-red/flows.json`, o node "Conectar ao CLP (on start)"
já tem um lugar reservado pra isso
(`inputRegisters.zAtualDecimm`) — hoje ele é só um número
placeholder. Troque pelo endereço real que você descobriu no Passo 2.

O node "Ler CLP -> montar STATUS" já está preparado pra usar esse
valor assim que ele existir de verdade — hoje ele está comentado/
desativado justamente porque não tínhamos um valor real pra mostrar
(mostrar um número inventado seria pior que não mostrar nada). Quando
o registrador for real, é só reativar essa leitura ali.

### Passo 4 — O navegador já está pronto pro lado dele

Essa é a parte boa: o **gêmeo digital já tem o código pronto** pra
receber a posição real e corrigir a estimativa visual automaticamente
(a função se chama `aplicarPosicaoZReal`, dentro de
`new-program/novoprograma.js`) — ela é chamada toda vez que uma
mensagem de status chega com uma posição real. Você não precisa
escrever isso de novo, só precisa garantir que o Node-RED comece a
mandar o número de verdade (Passo 3).

### Passo 5 — Agora sim, dá pra fazer "ir até um ponto e parar sozinho"

Com a posição real disponível, o **próximo projeto** (não é só ligar
um fio) é: no programa ladder do CLP, criar uma lógica que compare a
posição atual (do encoder) com um alvo (escrito pelo Node-RED via
`MOVER_PONTO`), e mantenha o motor ligado (usando os mesmos bits de
jog que já existem) até a diferença ficar pequena o suficiente, aí
desligar sozinho. Isso é chamado de "malha fechada" (closed loop) —
hoje o sistema é "malha aberta" (o CLP liga o motor e não sabe quando
parar sozinho, só quando bate no fim de curso físico).

**Ordem recomendada**: primeiro valide a leitura da posição (Passos
1-4, sem tentar controlar nada ainda — só observar o número mudando
corretamente enquanto o eixo se move via jog manual). Só depois de
confirmar que a leitura está confiável e estável, parta pra lógica de
malha fechada (Passo 5). Tentar fazer os dois ao mesmo tempo dificulta
achar onde está o problema se algo não funcionar.

### E a mesa giratória?

O mesmo raciocínio vale pra mesa, com uma dificuldade a mais: hoje o
CLP só tem **uma saída** pra girar a mesa (sempre no mesmo sentido).
Se um dia for necessário girar pra um ângulo específico (não só
continuamente), vai ser preciso decidir entre:

- Aceitar girar sempre **pra frente** até completar a diferença
  angular (nunca "voltar" pelo caminho mais curto) — mais simples,
  não precisa de peça nova.
- Adicionar uma saída nova no CLP pra reversão de sentido — precisa de
  fiação/relé novo, mais trabalho de hardware.

Essa decisão depende do que a aplicação realmente precisa (o processo
de solda exige ir pro caminho mais curto, ou girar sempre pra frente
é aceitável?) — vale conversar com quem entende o processo de solda
antes de escolher.

## Parte 6 — Recalibrando velocidades (se o comportamento mudar)

Sempre que a velocidade real do motor mudar (motor trocado, atrito
diferente, etc.), ou se o curso físico mudar (fim de curso reposicionado):

1. **Curso (Z_MIN/Z_MAX)**: segure subir até bater no fim de curso de
   cima, veja o que o software mostra (`Z: ___ mm`) — esse é o novo
   `Z_MAX_MM`. Repita descendo pro `Z_MIN_MM`. Os dois números ficam
   em `new-program/novoprograma.js`.
2. **Velocidade do jog contínuo**: segure o botão por um tempo
   conhecido (ex.: 3 segundos), meça quantos mm o eixo real andou de
   verdade (régua/paquímetro), e ajuste a constante correspondente
   proporcionalmente.
3. **Distância do pulso (toque rápido)**: dê um toque rápido só, meça
   quantos mm moveu de verdade, e ajuste a constante do pulso pra
   bater com essa medição.

Essas constantes ficam todas comentadas no topo da seção de controle
manual em `new-program/novoprograma.js`, com uma explicação de qual
medição gerou aquele valor — mantenha esse hábito de comentar a
origem de cada número calibrado, ajuda muito quem for mexer depois.
