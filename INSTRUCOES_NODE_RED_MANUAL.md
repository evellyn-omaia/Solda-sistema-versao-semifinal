# Integração manual do Node-RED — SoldaTouch

Nenhum fluxo foi alterado ou implantado. O arquivo local `flows.json` contém um roteador de simulação e não contém os acréscimos relatados no ambiente ativo (`CARREGAR_PRODUCAO`, `CALIBRAR_ENCODER_Z`). Preserve esses acréscimos e os comandos manuais existentes. Faça exportação de backup do fluxo ativo antes da edição manual.

## Alteração no nó existente

Aba local: **SoldaTech - Ponte MQTT <-> CLP** (`tabSoldaTech`). No ambiente ativo, confirme pelo nome do nó abaixo, pois o fluxo foi atualizado manualmente. Se o bloco `const producaoTratada = ...` já foi instalado, não cole uma segunda cópia: o bloco existente continua compatível e não exige alteração nesta entrega.

Nó **Rotear comando -> Modbus**, id local `fnProcessarComando`, duas saídas: primeira para respostas, segunda para erros. Cole o bloco abaixo **no início do campo Function, antes de `const client = global.get('clpClient');`**. Mantenha integralmente o código que vem depois. O bloco intercepta somente os seis comandos de produção; PING, calibração e todos os comandos manuais continuam no roteador original. Se já houver um tratamento manual de CARREGAR_PRODUCAO mais abaixo, ele ficará inacessível para esse comando; retire somente esse tratamento antigo após conferir a equivalência dos dados.

O bloco é deliberadamente preparatório: armazena e consulta planejamento, mas não escreve Modbus. INICIAR_PRODUCAO retorna AGUARDANDO_CLP mesmo com transporte conectado, porque os sinais de conclusão e o sequenciador físico não estão homologados. Não substitua essa condição por um temporizador ou uma flag de autorização. Nenhum nó adicional é necessário para essa etapa.

```javascript
const producaoTratada = (() => {
  const c = msg.payload;
  const nomes = ['CARREGAR_PRODUCAO','INICIAR_PRODUCAO','PAUSAR_PRODUCAO',
    'RETOMAR_PRODUCAO','CANCELAR_PRODUCAO','CONSULTAR_PRODUCAO'];
  if (!c || !nomes.includes(c.comando)) return false;
  const d = c.dados;
  function enviar(erro, extra = {}) {
    const payload = { tipo: erro ? 'COMANDO_ERRO' : 'COMANDO_OK', comando: c.comando,
      idComando: c.idComando, producaoId: d?.producaoId, revisao: d?.revisao,
      timestamp: Date.now(), ...extra };
    const saida = { topic: 'soldatech/maquina/' + (erro ? 'erro' : 'resposta'), payload };
    node.send(erro ? [null, saida] : [saida, null]);
    return payload;
  }
  function falhar(mensagem, codigo = 'PRODUCAO_INVALIDA') { enviar(true, { mensagem, codigo }); }
  if (typeof c.idComando !== 'string' || !c.idComando || c.idComando.length > 128 ||
      !d || typeof d !== 'object' || Array.isArray(d) ||
      typeof d.producaoId !== 'string' || !d.producaoId || d.producaoId.length > 128 ||
      typeof d.revisao !== 'string' || !d.revisao || d.revisao.length > 128 ||
      !Number.isFinite(c.timestamp) || Date.now() - c.timestamp > 15000 ||
      c.timestamp > Date.now() + 2000 || msg.retain) {
    falhar('Envelope inválido, retido ou expirado.'); return true;
  }
  // Cache de respostas: repetição do mesmo envelope nunca repete uma transição.
  const cache = context.get('producaoRespostasV1') || [];
  const assinatura = JSON.stringify({ comando: c.comando, dados: d });
  const anterior = cache.find(x => x.id === c.idComando);
  if (anterior) {
    if (anterior.assinatura !== assinatura) falhar('ID reutilizado com outro conteúdo.');
    else enviar(anterior.payload.tipo === 'COMANDO_ERRO', anterior.payload);
    return true;
  }
  let p = flow.get('soldatouchProducaoV1');
  function concluir(extra) {
    const payload = enviar(false, extra);
    cache.push({ id: c.idComando, assinatura, payload });
    context.set('producaoRespostasV1', cache.slice(-1000));
  }
  if (c.comando === 'CARREGAR_PRODUCAO') {
    if (!['FISICO','VIRTUAL'].includes(d.modo) || d.versaoContrato !== 1 ||
        !Array.isArray(d.fila) || !d.fila.length || d.fila.length > 100) {
      falhar('Fila, modo ou versão inválida.'); return true;
    }
    let total = 0;
    for (let i = 0; i < d.fila.length; i++) {
      const item = d.fila[i];
      if (!item || item.ordem !== i + 1 || typeof item.programa !== 'string' || !item.programa ||
          !Number.isSafeInteger(item.quantidade) || item.quantidade < 1 ||
          !Array.isArray(item.pontos) || !item.pontos.length || item.pontos.length > 10000) {
        falhar('Programa ou quantidade inválida.'); return true;
      }
      let ordemAnterior = 0;
      for (const ponto of item.pontos) {
        if (!ponto || !Number.isSafeInteger(ponto.ordem) || ponto.ordem <= ordemAnterior ||
            typeof ponto.id !== 'string' || !ponto.id || !Number.isFinite(ponto.zMm) ||
            !Number.isFinite(ponto.anguloMesaGraus) || typeof ponto.solda !== 'boolean') {
          falhar('Ponto inválido ou fora da ordem cadastrada.'); return true;
        }
        ordemAnterior = ponto.ordem;
      }
      total += item.quantidade;
    }
    if (!Number.isSafeInteger(total) || total !== d.totalPecas) {
      falhar('Total de peças inconsistente.'); return true;
    }
    if (p && p.plano.producaoId === d.producaoId &&
        (p.plano.revisao !== d.revisao || JSON.stringify(p.plano) !== JSON.stringify(d))) {
      falhar('Produção já registrada com outro planejamento.'); return true;
    }
    if (p && p.plano.modo === 'FISICO' && p.plano.producaoId !== d.producaoId &&
        !['CANCELADO','FINALIZADO'].includes(p.estado)) {
      falhar('Existe uma produção física pendente.'); return true;
    }
    if (!p || p.plano.producaoId !== d.producaoId) {
      p = { plano: d, estado: 'RECEBIDA_NAO_EXECUTADA', execucaoIniciada: false };
      flow.set('soldatouchProducaoV1', p);
    }
    if (p.execucaoIniciada || ['CANCELADO','FINALIZADO'].includes(p.estado)) {
      falhar('Produção já iniciada ou encerrada; consulte o estado.'); return true;
    }
    concluir({ estado: 'RECEBIDA_NAO_EXECUTADA', totalPecas: total, totalProgramas: d.fila.length });
    return true;
  }
  if (!p || p.plano.producaoId !== d.producaoId || p.plano.revisao !== d.revisao) {
    falhar('Planejamento ausente ou revisão diferente. Não reinicie automaticamente.', 'RECONCILIACAO_NECESSARIA');
    return true;
  }
  if (c.comando === 'CONSULTAR_PRODUCAO') {
    concluir({ estado: p.estado, execucaoIniciada: p.execucaoIniciada,
      confirmacaoClp: false, mensagem: 'Estado do coordenador; nenhuma conclusão física presumida.' });
    return true;
  }
  if (c.comando === 'CANCELAR_PRODUCAO' && !p.execucaoIniciada) {
    p.estado = 'CANCELADO'; flow.set('soldatouchProducaoV1', p);
    concluir({ estado: p.estado, execucaoIniciada: false, confirmacaoClp: false,
      mensagem: 'Planejamento cancelado antes de qualquer execução física.' });
    return true;
  }
  if (c.comando === 'INICIAR_PRODUCAO' && p.plano.modo === 'FISICO' &&
      ['RECEBIDA_NAO_EXECUTADA','AGUARDANDO_CLP'].includes(p.estado) && !p.execucaoIniciada) {
    p.estado = 'AGUARDANDO_CLP'; flow.set('soldatouchProducaoV1', p);
    concluir({ estado: p.estado, confirmacaoClp: false,
      mensagem: 'Sequenciador e confirmações físicas pendentes de homologação. Nenhum movimento solicitado.' });
    return true;
  }
  falhar('Transição física indisponível: faltam contrato e confirmações do CLP.', 'NAO_HOMOLOGADO');
  return true;
})();
if (producaoTratada) return null;
```

## Contrato e operação

Entrada: tópico `soldatech/maquina/comando`, JSON `{idComando, comando, origem, timestamp, dados}`. `dados` contém `producaoId`, `revisao` (SHA-256 do conteúdo da fila), `versaoContrato:1`, `modo`, `totalPecas`, `fila`. Cada item contém programa, ordem, quantidade, materiais e pontos. Cada ponto contém id, ordem, zMm, anguloMesaGraus, solda e soldagem (parâmetros cadastrados). As repetições são representadas por quantidade; não duplique pontos por peça.

Saídas usam os tópicos atuais `resposta` e `erro`. Toda resposta, inclusive erro, deve ecoar `idComando`, `comando`, `producaoId` e `revisao`. O site não aceita o ACK legado sem essa correlação. `COMANDO_OK` de carregamento significa somente `RECEBIDA_NAO_EXECUTADA`.

INICIAR é separado de CARREGAR. PAUSAR, RETOMAR e CANCELAR físico precisam aguardar o CLP; o bloco acima rejeita essas transições enquanto não houver sequenciador homologado. CONSULTAR é somente leitura e nunca retoma. Cancelar um planejamento que nunca executou dispensa confirmação física e declara explicitamente `execucaoIniciada:false`.

Não usar mensagens MQTT retidas para comandos. A conexão do navegador já usa QoS 0, clean session e queueQoSZero:false. A perda de ACK exige CONSULTAR, não reenvio automático. O cache de IDs é limitado; os estados da produção também impedem reinício. Se o Node-RED reiniciar com armazenamento em memória, responder planejamento ausente e reconciliar manualmente. Para continuidade entre reinícios, o responsável deve configurar contextStorage persistente e, ainda assim, reconciliar com o estado real antes de qualquer ação.

## Sequenciador físico pendente

O botão de início e START chamam `confirmarInicioCiclo`: em modo físico, carregam a fila completa, aguardam o ACK correlacionado e solicitam INICIAR sem segundo clique. `AGUARDANDO_CLP` não libera novo START: use CONSULTAR. Timeout/desconexão exigem reconciliação, sem reenvio automático. No modo virtual, o início não depende de MQTT nem publica planejamento automaticamente. O botão ENVIAR FILA permanece opcional para diagnóstico.

Antes de implementar o sequenciador, registrar com o responsável para cada sinal: endereço real, tipo, unidade/escala, polaridade, condição de validade, identificação da operação e comportamento após falha/reinício. Pendências específicas:

| Etapa | Confirmação a identificar e homologar |
| --- | --- |
| Preparação | Máquina em automático, peça presente/fixada, intertravamentos e emergência liberados |
| Z | Posição atual do encoder, referência concluída, limites, tolerância e movimento concluído |
| Mesa | Posição angular medida, referência, tolerância e fim do posicionamento |
| Soldagem | Semântica real de `%M3`, parâmetros suportados, início aceito, solda concluída e falha |
| Pausa/retomada | Parada operacional confirmada e ponto/etapa seguros para continuar sem repetir solda |
| Peça seguinte | Troca e fixação confirmadas; autorização para novo ciclo |
| Recuperação | Cursor persistente, operação em curso/concluída e reconciliação após perda de comunicação |

Conectividade Modbus sozinha não supre essas confirmações. Não há endereços de retorno homologados suficientes no repositório para liberar movimentos automáticos.

Não existem no material disponível confirmações homologadas suficientes para escrever um sequenciador físico pronto para uso. Não há código seguro de movimentação automática a colar nesta etapa. O bloco preparatório acima é completo e utilizável sem máquina; a execução física permanece bloqueada.

Quando o CLP estiver acessível, implementar no lado Node-RED/CLP uma única máquina de estados com cursor `{indiceFila, indicePeca, indicePonto, etapa, idOperacao}` persistido. A ordem é a salva; nunca ordenar por Z, ângulo ou texto do identificador. Cada transição deve confirmar a mesma operação e rejeitar eventos antigos/duplicados:

1. Preparar → confirmar peça disponível e intertravamentos.
2. Solicitar posicionamento → aguardar confirmação real de posição Z e angular.
3. Solicitar operação autorizada → aguardar conclusão real da soldagem quando prevista.
4. Persistir conclusão da operação antes de avançar o cursor.
5. Após o último ponto, aguardar troca/posicionamento confirmado da próxima peça.
6. Após a quantidade do programa, avançar ao programa seguinte.
7. FINALIZADO apenas com todas as operações fisicamente confirmadas.

PAUSANDO impede novos passos imediatamente; PAUSADO só após confirmação de parada operacional. RETOMANDO preserva cursor e operações concluídas. CANCELAR e EMERGENCIA não equivalem a conclusão. Desconexão, reinício e timeout deixam estado desconhecido/AGUARDANDO_CLP; não presumir parada física nem retomar automaticamente. O watchdog e a emergência física permanecem independentes do navegador.

Preservar `%M10`, `%M11`, `%M12`, `%M3`, `%MW0`, `%MW1`, `%MD100`. Confirmar com o responsável unidades, escala, tolerâncias, permissões e sinais reais de posição, mesa, solda e peça. Não inventar endereços de retorno. A configuração do broker e os nós de conexão/leitura existentes não são modificados por estas instruções.

## Verificação sem acionar a máquina

Com a saída Modbus desabilitada pelo responsável no ambiente de bancada, aplicar somente este bloco e testar PING e CARREGAR_PRODUCAO de uma fila real pelo site. Verificar dados, ordem e totais no Debug. Repetir o mesmo id: não deve haver nova transição. Alterar o conteúdo mantendo id: deve retornar erro. Testar CONSULTAR e CANCELAR antes da execução. INICIAR deve retornar AGUARDANDO_CLP e não escrever registradores. Desconectar o navegador e reconectar: nenhum início deve ser reenviado. Esta entrega não executou esses testes no seu broker/Node-RED ativo.

## Credenciais e implantação

O endpoint HiveMQ foi preservado. Para desenvolvimento local, as credenciais preexistentes foram transferidas para `new-program/mqtt-config.local.js`, ignorado pelo Git. O build público exclui esse arquivo e sua tag HTML. Não hospedar a pasta de trabalho diretamente na internet: qualquer credencial carregada pelo navegador é visível ao operador. Em produção, usar autenticação do operador e um serviço que emita credenciais MQTT temporárias com ACL por empresa/máquina, ou uma ponte autenticada no servidor. Credenciais anteriormente expostas precisam ser rotacionadas pelo responsável no HiveMQ. Não foram alteradas credenciais remotas nesta tarefa.
