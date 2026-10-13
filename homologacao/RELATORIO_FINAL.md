# Homologação SoldaTech — 13/10/2026, retomada

**Resultado global: REPROVADO — NÃO HOMOLOGADO.** A versão corrigida foi integrada, publicada com acesso autorizado e validada por HTTPS. Permanecem sem validação a autenticação e persistência com conta Firebase real, a sincronização real entre abas/dispositivos, a revogação das credenciais MQTT anteriormente expostas e a câmera em celular físico.

**URL atual:** https://evellyn-omaia.github.io/Solda-sistema-versao-semifinal/

**Revisão publicada e verificada:** `677152bd837085287fa0e53980d975af8c151e7c`.
**Actions:** [execução 38407583390, success](https://github.com/evellyn-omaia/Solda-sistema-versao-semifinal/actions/runs/38407583390).

O repositório antigo redireciona para `evellyn-omaia/Solda-sistema-versao-semifinal`. A URL Pages antiga retornou 404 nesta rodada. O relatório anterior está preservado em `RELATORIO_ANTERIOR.md`; seus bloqueios de acesso e URLs não descrevem mais o estado atual.

## Resultados por prioridade solicitada

| # | Requisito | Status | Evidência e limites |
|---|---|---|---|
| 1 | Comparar backup, main local e remoto | APROVADO | Antes: origin/main `c3bd0a2`; main local `ec9ff31`, cinco commits adiante; backup `e7740cd`, contendo main e mais dois commits. `integracao-commits.txt`, `integracao-pendente.txt`, `integracao-preparada.json`. |
| 2 | Integrar sem sobrescrever trabalho | APROVADO | Snapshot revisado `b5ef6d9`, pai `ec9ff31`, seguido de `677152b`; main avançou por fast-forward. Push normal, sem força. Worktree original e backup preservados. O commit antigo de backup com credenciais não foi acrescentado à ancestralidade remota. |
| 3 | Ausência de segredos/configuração privada no pacote | APROVADO | Inspeção e validador; 57 arquivos HTTPS com SHA-256 idênticos ao artefato local. Nenhum indicador de HiveMQ, senha MQTT literal, chave privada ou token administrativo identificado. Seis caminhos privados retornam 404. `security-scan-atual.json`, `history-scan-atual.json`, `published-verification-atual.json`. Varredura por padrões não é garantia universal. |
| 4 | Mapear uso e documentar revogação/substituição MQTT | APROVADO | `ACESSOS_E_ROTACAO.md` descreve arquivos, consumidores, exclusão da credencial, encerramento de sessões, ACL e substituição somente privada, sem valores secretos. Revogação efetiva: NÃO TESTADO. Remover do site não revoga credenciais já expostas. |
| 5 | Workflow publica resultado do build | APROVADO | Actions executou build, validador, upload de dist-pages e deploy; 57 hashes conferidos. Workflow restrito a main, permissões mínimas e ambiente github-pages. `github-status.json`, `build-manifest-atual.json`. |
| 6 | Pages configurado para Actions | APROVADO | Credencial Git local autorizada, com push/admin; API confirmou build_type=workflow. `github-configure.json`. Alternativa manual no roteiro de acessos. |
| 7 | Simulação pública sem HiveMQ/MQTT/Node-RED | APROVADO | Configuração pública imutável e SDK MQTT removido no build. Smoke HTTPS real: zero tentativas de WebSocket. Fluxo publicado 5 × 4 executado sem infraestrutura industrial, com adaptador de persistência. `published-smoke-atual.json`, `test-pages-publicado.txt`. |
| 8 | Câmera e módulos sem 404 | APROVADO | Câmera, visao-camera.mjs, simulacao-integrada.mjs e demais arquivos do manifesto respondem 200. Login, câmera e programa abertos em navegador HTTPS sem erros de página/HTTP. 95 referências locais válidas. |
| 9 | Firebase Authentication/RTDB com conta autorizada | NÃO TESTADO | Não localizada conta/sessão disponível. Sem variáveis de autenticação Firebase/Google, arquivos usuais CLI/ADC ou navegador conectado à ferramenta. SDK carrega; leitura anônima real do RTDB retorna 401. Isso não comprova login, escrita, regras ou domínio autorizado. |
| 10 | Cinco peças × quatro pontos e duas abas com Firebase real | NÃO TESTADO | No site publicado: 20 pontos, pausa/retomada, 100%, histórico único, cinco peças no painel e remoção da produção ativa passaram com adaptador de teste. Firebase autenticado e persistência real pendentes. |
| 11 | Publicar com autorização após verificação de segurança | APROVADO | Permissões confirmadas; inspeção do artefato e histórico novo antes do push; Actions concluído. Nenhuma credencial foi usada contra HiveMQ. |
| 12 | Validar HTTPS e preparar celular | APROVADO | HTTPS, hashes, modelo 3D e contexto seguro confirmados. Viewport 390 × 844 sem início inadvertido da câmera. Roteiro abaixo preparado. Câmera física e gestos reais: NÃO TESTADO. |
| 13 | Registrar resultados/evidências | APROVADO | Este relatório distingue ambiente real, artefato, banco simulado e pendências. |

## Integração e estado preservado

Os cinco commits locais de main foram preservados. As mudanças do backup e as correções sem commit foram integradas como snapshot de conteúdo sobre main, sem importar o commit de backup com credenciais literais. `history-scan-atual.json` encontrou no histórico novo apenas duas senhas fictícias de testes; esses testes não integram o Pages.

A pasta original permanece na branch `integracao/homologacao-pages-20261013`, com índice e alterações preservados. Os arquivos avulsos `tatus`, `novoprograma-backup.js` e relatórios antigos da raiz não foram incluídos na publicação. A main foi integrada no worktree irmão `../SoldaTech-release-main`. As evidências atuais são sincronizadas para a pasta original. Commits posteriores somente de documentação/ferramentas de auditoria não alteram a revisão publicada; conferir `release.json` na URL pública.

## Testes desta rodada

- **Node: 79/79**, `test-node-atual.txt`.
- **Python: 10/10**, `test-python-atual.txt`, exit 0. O PowerShell apresenta stderr como NativeCommandError, mas unittest terminou OK.
- **Navegador local: 19/19**, `test-browser-atual.txt`. Não repetir a contagem anterior de 20 como resultado desta rodada. Inclui simuladores locais; nenhum CLP físico.
- **Pages local: 2/2**, `test-pages-atual.txt`; pacote no worktree da release também 2/2, `test-pages-release.txt`.
- **Pages HTTPS: 2/2**, `test-pages-publicado.txt`. Código e recursos publicados reais, persistência substituída por adaptador de teste. Todos os WebSockets interceptados preventivamente; zero tentativas.
- **Smoke HTTPS sem mock Firebase:** login, câmera e programa HTTP 200, contexto seguro, zero erros/HTTP falhos e zero WebSockets; modelo 3D carregado. RTDB anônimo negado com 401. `published-smoke-atual.json`.
- **Publicação:** 57/57 hashes correspondentes; `.env`, `.soldatech/runtime.json`, `node-red/flows.json`, `mqtt-broker/server.js`, `database-rules.json` e script administrativo retornam 404. `published-verification-atual.json`.

O build normaliza LF/CRLF para produzir conteúdo textual idêntico em Windows e Actions/Linux. `release.json` identifica a revisão. O workflow publica somente dist-pages. A configuração web Firebase é intencionalmente pública e não equivale a credencial administrativa.

## Pendências para homologação

1. Administrador HiveMQ: revogar credencial exposta **e encerrar sessões existentes**, verificar reutilizações e registrar evidência sem valores. Seguir `ACESSOS_E_ROTACAO.md`; não habilitar comandos físicos.
2. Responsável Firebase: entrar no console do projeto projeto-solda, conferir Email/Password, domínio **evellyn-omaia.github.io**, regras implantadas e conta/empresa de homologação. O roteiro explica a criação segura de conta de teste. As regras locais não foram implantadas; Emulator Suite continua NÃO TESTADO.
3. Com conta autorizada, testar login/logout, CRUD, reload, isolamento entre empresas, cinco peças de quatro pontos e duas abas com RTDB real; repetir admin/operador. Conferir registros reais no banco, sem abrir permissões para fazer testes passarem.
4. Executar câmera no celular e registrar dispositivo, navegador, revisão publicada e resultado por passo. Só então reavaliar a homologação global.

## Roteiro de câmera no celular real

Usar a URL atual em Android/Chrome e iPhone/Safari disponíveis, com conta de homologação. Registrar modelo, sistema, versão, data e revisão 677152b (ou revisão posteriormente validada).

1. Fazer login, salvar programa de quatro pontos sem solda física e configurar cinco peças. Abrir visão pela interface; acesso direto à câmera sem configuração deve permanecer bloqueado, sem iniciar produção.
2. Autorizar câmera; conferir vídeo ao vivo, retrato/paisagem e indicador de captura. Abrir painel em outra aba/dispositivo autenticado. Abrir câmera não pode iniciar produção sozinho.
3. Com modelo/programa carregados, mostrar mão aberta até START. Conferir execução e painel; gesto mantido não deve repetir início.
4. Voltar a neutro, mostrar punho fechado até PAUSA; conferir parada nas duas telas e ponto estável por três segundos. Voltar a neutro e mão aberta para retomar do ponto correto.
5. Confirmar posicionamento entre peças. Completar cinco e conferir 20 pontos, 100%, cinco peças no painel, histórico único, produção ativa removida e persistência após reload.
6. Testar mão fora do quadro, gesto desconhecido, pouca luz e duas mãos; nenhum início involuntário. Registrar falsos positivos/negativos e latência.
7. Negar permissão, perder/reconectar rede, bloquear tela/trocar aplicativo e retornar, trocar conta e encerrar câmera. Confirmar liberação dos tracks e ausência de reinício/START automático.

**Proibição mantida:** não expor serviços industriais, não usar a credencial vazada para conectar ao HiveMQ e não habilitar atuação no CLP. Resultado sintético não substitui teste real pendente.
