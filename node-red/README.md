# SoldaTech — ponte Node-RED entre o app e o CLP

Esta pasta contém um flow do Node-RED (`flows.json`) que liga o app web (o
"gêmeo digital" em `new-program/novoprograma.html`) à máquina real através de
um CLP, usando **Modbus TCP**. Ele assina os mesmos tópicos MQTT que o
navegador já usa (`new-program/mqtt-maquina.js`), então **nada muda no
frontend** além de ligar o checkbox "Controlar a máquina real (CLP)" na tela
de produção quando tudo estiver testado.

```
Navegador (novoprograma.js)
      │  MQTT (wss://.../mqtt)
      ▼
Broker MQTT (HiveMQ Cloud)
      │  MQTT (mqtts://.../1883 ou 8883)
      ▼
Node-RED (este flow)
      │  Modbus TCP
      ▼
CLP  →  motores / relés / sensores da máquina real
```

## 1. Instalar o Node-RED

No PC que fica na mesma rede do CLP:

1. Instale o [Node.js LTS](https://nodejs.org/).
2. Instale o Node-RED globalmente:
   ```bash
   npm install -g --unsafe-perm node-red
   ```
3. Rode uma vez para criar a pasta de usuário (`~/.node-red` no Linux/Mac,
   `%USERPROFILE%\.node-red` no Windows):
   ```bash
   node-red
   ```
   Deixe rodando e abra `http://localhost:1880` no navegador para confirmar
   que abriu. Depois pode fechar com Ctrl+C.

## 2. Instalar a dependência Modbus

Este flow fala Modbus TCP usando o pacote `modbus-serial` (não é um node
visual do Node-RED, é uma biblioteca chamada de dentro de um node Function —
isso evita depender de um node-contrib de terceiros com esquema de
configuração instável).

Dentro da pasta de usuário do Node-RED:

```bash
cd ~/.node-red        # ou %USERPROFILE%\.node-red no Windows
npm install modbus-serial
```

Depois edite `~/.node-red/settings.js` e adicione o módulo ao
`functionGlobalContext` (procure esse bloco no arquivo, geralmente já existe
comentado):

```js
functionGlobalContext: {
    modbusSerial: require('modbus-serial'),
},
```

Reinicie o Node-RED depois de salvar o `settings.js`.

## 3. Importar o flow

1. Abra `http://localhost:1880`.
2. Menu (☰) → **Import** → cole o conteúdo de `flows.json` (ou arraste o
   arquivo) → **Import**.
3. Ainda não clique em **Deploy**. Primeiro faça os ajustes do passo 4.

## 4. Ajustar para o seu CLP

Tudo que precisa mudar está em **dois lugares**:

### 4.1. Node "Conectar ao CLP (on start)"

Clique duas vezes nele e edite:

- `clpConfig.ip` / `clpConfig.port` / `clpConfig.unitId` — endereço do CLP na
  rede e o unit id/estação Modbus configurado nele.
- `clpRegs` — o mapa de coils e registradores. Os números que estão lá
  (`0, 1, 2, 3...`) são **placeholders**: substitua pelos endereços reais que
  o programa do seu CLP usa para:
  - `coils.jogCima` / `jogBaixo` — sobe/desce o eixo Z manualmente.
  - `coils.mesaStart` — liga/desliga o giro contínuo da mesa.
  - `coils.soldaOn` — liga/desliga a solda/indutor.
  - `coils.emergencia` — aciona parada de emergência.
  - `holdingRegisters.zAlvoDecimm` — posição Z alvo enviada pelo app durante
    a execução automática de um programa (**em décimos de mm**, ex.: 15.5 mm
    vira `155`, porque registradores Modbus são inteiros).
  - `holdingRegisters.mesaAlvoDecigraus` — reservado para ângulo alvo da
    mesa, se seu CLP suportar posicionamento (hoje o app só usa
    start/stop contínuo pela `MESA_START`/`MESA_STOP`).
  - `inputRegisters.zAtualDecimm` / `mesaAtualDecigraus` — leitura da posição
    **real** (é isso que faz o gêmeo digital seguir a máquina de verdade).
  - `discreteInputs.executando/mesaPronta/soldaAtiva/emergenciaAtiva/movimentoConcluido`
    — 5 bits lidos em sequência a partir do endereço de `executando`. Ajuste
    para bater com a lógica do seu CLP (esses bits são o "aperto de mão"
    entre o CLP e o Node-RED: o CLP avisa quando terminou de girar a mesa ou
    de chegar no ponto Z pedido).

Fale com quem programou/vai programar o CLP (a lógica ladder/estruturada)
para decidir esses endereços — este flow só define **o contrato do lado do
Node-RED**, a lógica de movimento em si (rampas de aceleração, fins de
curso, intertravamentos de segurança) continua sendo responsabilidade do
programa do CLP, como em qualquer máquina industrial.

### 4.2. Node MQTT "SoldaTech HiveMQ" (config, clique no ícone de broker)

Preencha usuário/senha na aba **Segurança**. Veja a nota de segurança
abaixo antes de usar as mesmas credenciais do navegador.

## 5. Testar sem arriscar a máquina

Antes de ligar em um CLP de verdade, vale validar a lógica com um simulador
Modbus TCP (ex.: `diagslave`, `ModbusPal`, ou até outra instância do
`modbus-serial` rodando um servidor de teste). Aponte `clpConfig.ip/port`
para o simulador, dê Deploy, e use o botão de teste MQTT do app
(`window.testarMQTT()` no console do navegador, ou o próprio app) para
conferir se comando → resposta funciona antes de tocar em motores reais.

**Nunca** teste o jog/solda pela primeira vez com o CLP já ligado aos
motores/indutor de verdade sem supervisão e sem confirmar que a parada de
emergência (`coils.emergencia`) está funcionando.

## 6. Ligar o modo "máquina real" no app

Com o Node-RED conectado e publicando `STATUS` (você verá o `statusClp`
mudar para "CONECTADO" no painel do app), abra a tela de produção
(`novoprograma.html`) e marque o checkbox **"Controlar a máquina real
(CLP)"** no painel do canto superior direito. A partir daí:

- Segurar os botões de subir/descer o indutor (ou as setas do teclado) envia
  `JOG_CIMA`/`JOG_BAIXO`/`JOG_PARAR` para o CLP em vez de só mover a cena 3D.
- Ligar a solda envia `SOLDA_ON`/`SOLDA_OFF`.
- Girar a mesa envia `MESA_START`/`MESA_STOP`.
- A execução automática de um programa envia `MOVER_PONTO` para cada ponto
  e espera a confirmação `PONTO_ATINGIDO` do CLP (via este flow).
- A posição do modelo 3D deixa de ser assumida e passa a refletir a posição
  **real** informada pelo CLP (mensagens `STATUS`).

O checkbox fica **desligado por padrão** (modo simulação) e a preferência é
salva por navegador — assim ninguém liga sem querer o controle de uma
máquina real.

## Nota de segurança

Hoje o broker HiveMQ do app usa uma credencial fixa, visível em texto puro
no código do navegador (`new-program/mqtt-maquina.js`). Qualquer pessoa que
abrir o DevTools do navegador consegue ler usuário/senha e, em tese, publicar
mensagens em `soldatech/maquina/status` fingindo ser o CLP, ou mandar
comandos direto para o tópico de comando. Antes de ligar isso em uma máquina
com motores/indutor de verdade, recomendo:

1. Criar uma credencial **separada** para o Node-RED (feito acima).
2. Configurar ACLs no HiveMQ Cloud para que o usuário do navegador
   (`soldatech-web`) só possa **publicar** em `soldatech/maquina/comando` e
   **assinar** `status`/`resposta`/`erro` — nunca publicar nesses três
   últimos. Só o Node-RED deveria conseguir publicar `status`/`resposta`/
   `erro`.
