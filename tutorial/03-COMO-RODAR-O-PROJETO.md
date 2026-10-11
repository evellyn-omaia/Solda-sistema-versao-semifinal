# Como rodar o projeto (comandos do terminal)

Pra tudo funcionar (site + máquina real), são **3 coisas rodando ao
mesmo tempo**, cada uma no seu próprio terminal (PowerShell ou
Prompt de Comando):

1. **Broker MQTT local** — o "correio" entre o navegador e o Node-RED.
2. **Node-RED** — a ponte que fala Modbus TCP com o CLP.
3. **Servidor do site** — serve os arquivos HTML/CSS/JS pro navegador.

Se qualquer um dos três não estiver rodando, alguma parte para de
funcionar: sem o broker ou o Node-RED, o site abre normalmente mas a
máquina real não responde; sem o servidor do site, nem a página abre.

Abra **3 janelas de terminal** (uma pra cada) e rode um comando em
cada uma. Deixe as 3 abertas — fechar a janela derruba aquele serviço.

---

## Terminal 1 — Broker MQTT

```
cd C:\Users\Aluno\Documents\SoldaAuto\mqtt-broker
node server.js
```

Sinal de que deu certo:

```
[MQTT TCP] ouvindo em mqtt://localhost:1883 (uso: Node-RED)
[MQTT WS]  ouvindo em ws://localhost:8888 (uso: navegador)
```

## Terminal 2 — Node-RED

```
node-red
```

(Não precisa `cd` em lugar nenhum — o Node-RED já guarda o flow
importado na pasta de usuário dele, `%USERPROFILE%\.node-red`.)

Sinal de que deu certo (demora uns 15-20 segundos pra aparecer):

```
Server now running at http://127.0.0.1:1880/
Started flows
[mqtt-broker:SoldaTech Local] Connected to broker: ...
[function:Conectar ao CLP (on start) - AJUSTAR] Conectado ao CLP via Modbus TCP em 10.200.7.254:502
```

Se a última linha não aparecer ou disser erro de conexão, o CLP não
foi encontrado na rede — confira se o PC está na mesma rede do CLP e
se o IP/porta em `node-red/flows.json` ainda são `10.200.7.254:502`.

## Terminal 3 — Servidor do site

```
cd C:\Users\Aluno\Documents\SoldaAuto
python -m http.server 5500
```

Sinal de que deu certo: a janela fica "parada" mostrando as
requisições conforme o navegador acessa (não precisa aparecer nada
antes disso, só não fechar a janela).

---

## Abrir o site

- **Neste PC**: `http://localhost:5500/index.html`
- **Novo Programa direto**: `http://localhost:5500/new-program/novoprograma.html`
- **Em outro aparelho na mesma rede (ex.: celular)**: troque
  `localhost` pelo IP deste PC na rede, por exemplo
  `http://10.200.6.254:5500/index.html`

Pra descobrir o IP deste PC na rede, rode num dos terminais:

```
ipconfig
```

e procure a linha `Endereço IPv4` da rede que estiver conectada
(Wi-Fi ou Ethernet).

## Para parar tudo

Clique em cada uma das 3 janelas de terminal e aperte `Ctrl+C`.

## Se for rodar pela primeira vez num PC novo

As 3 dependências já vêm prontas neste repositório
(`mqtt-broker/node_modules`), exceto o Node-RED em si e o pacote
Modbus dele, que são instalados **no próprio PC**, não no projeto —
siga o passo a passo em `node-red/README.md` antes de tentar o
Terminal 2 pela primeira vez.
