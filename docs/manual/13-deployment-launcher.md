# 13. Empacotamento e arranque

## Público-alvo: alguém sem terminal

O ScrollScape é pensado para correr na máquina pessoal de alguém que pode não ter Node.js
instalado, nem à vontade com uma linha de comandos. Duas peças resolvem isto:

- **`tools/node/node.exe`** — uma cópia portátil do runtime Node incluída no próprio
  repositório/distribuição, para quem não tem Node instalado globalmente.
- **`Launch-ScrollScape.bat`** — um script batch que faz tudo por duplo-clique: procura um
  runtime Node (primeiro `tools\node\node.exe`, depois `node` no PATH do sistema como
  fallback), verifica se a porta do servidor já está ocupada (e mata um processo `node.exe`
  parado nela, se encontrar), arranca o FlareSolverr (capítulo 4) e o servidor principal, e
  abre o browser.

## `pkg`: empacotar o servidor num único executável

Para distribuição sem exigir sequer o Node portátil, `package.json` define scripts
`build:win`/`build:linux`/`build:mac`/`build:exe` que usam `@yao-pkg/pkg` para compilar
`server.js` (mais os ficheiros de `public/` como assets estáticos) num único binário
standalone. Importante clarificar o que isto empacota e o que não: **empacota o processo
Node do servidor**, incluindo o interpretador JS embutido — não faz nenhuma transformação
ao JavaScript do frontend (capítulo 12), que continua a ser servido tal como escrito.

Uma consequência prática desta abordagem de empacotamento, visível no código do
`source-loader` (capítulo 4): dentro de um executável `pkg`, os ficheiros originais do
projeto ficam "congelados" dentro de um snapshot só de leitura embutido no próprio binário
(`SNAP_SOURCES_DIR`) — para permitir que o utilizador continue a poder instalar/atualizar
sources depois de já ter o executável, o carregador de sources copia o ficheiro do
snapshot para uma pasta gravável em disco na primeira utilização, e é essa cópia gravável
que passa a ser usada e atualizada a partir daí.

## FlareSolverr: um processo externo, com verificação de arranque

O FlareSolverr (usado só pelo BatCave, capítulo 4) corre como um **processo separado**,
não como parte do processo Node do ScrollScape — é ele próprio um executável, arrancado
pelo `.bat` via `Start-Process`. Uma armadilha real e instrutiva aconteceu aqui: a versão
inicial do script arrancava este processo mas **nunca verificava se ele realmente chegou a
ficar à escuta na porta esperada** — se falhasse a arrancar (por qualquer motivo), o script
continuava em frente e reportava "tudo OK" de qualquer forma, deixando o utilizador a
descobrir o problema só mais tarde, ao tentar usar o BatCave e ver erros sem contexto.

A correção reutilizou uma subrotina já existente no mesmo script (`:wait_port`, já usada
para confirmar que o servidor principal do ScrollScape tinha realmente arrancado na porta
4000) para também esperar e confirmar a porta 8191 do FlareSolverr, imprimindo uma linha
clara `[ OK ]`/`[ ERR ]`. **Lição geral de scripts de arranque**: "arranquei um processo"
e "o processo está a funcionar" são duas afirmações diferentes — um script de deployment
que confunde as duas dá falsos positivos de sucesso exatamente nos casos em que mais
importaria saber que algo falhou.

## Um cliente à parte: `tools/dashboard/` (Python + Textual)

Nem toda a ferramenta auxiliar em `tools/` precisa de partilhar linguagem com o resto do
projeto. `tools/dashboard/` é uma pequena consola de monitorização em modo terminal — saúde
das sources, resumo da biblioteca, downloads em massa em curso — escrita em Python com
[Textual](https://github.com/Textualize/textual), completamente separada do processo Node.
Fala com o ScrollScape **só através da API REST já existente** (`GET /api/system/health`,
`GET /api/library`, `GET /api/download/bulk/jobs`, etc.) — não importa nenhum módulo do
servidor, não toca no `store.json`, corre como um processo cliente independente que podia
estar a apontar para uma instância na mesma máquina ou noutra da rede local.

Esta escolha (Python/Textual, não algo em JavaScript a correr dentro do próprio processo
Node) foi deliberada, e vale a pena explicar o raciocínio porque não era a opção óbvia à
partida: a alternativa JavaScript mais próxima da stack existente (OpenTUI, TypeScript com
um núcleo nativo em Zig) depende de `bun:ffi` para o rendering nativo — funciona bem em
Bun, mas em Node só com `--experimental-ffi` numa versão muito recente e ainda instável.
Introduzir Bun como segundo runtime só para uma consola de monitorização opcional, ou
depender de uma flag experimental do Node, contradiz a filosofia do projeto inteiro
(capítulo 1): manter o mínimo de dependências de runtime possível para continuar fácil de
correr para alguém não-técnico. Python, apesar de ser tecnicamente "mais uma linguagem" no
repositório, evita os dois problemas por completo — e por ser um cliente HTTP totalmente
independente do processo do servidor, ninguém que não use esta ferramenta específica
precisa de ter Python instalado.

**Uma limitação honesta, não escondida**: o pipeline de importação do AniList (capítulo 6)
corre inteiramente no browser, não no servidor — por isso não existe, hoje, nenhum estado
do lado do servidor que este dashboard possa consultar para mostrar progresso *ao vivo*
desse import específico. O que é mostrado é o resumo da última sincronização já concluída
(`GET /api/anilist/sync-meta`), não uma barra de progresso em tempo real. Documentar esta
lacuna explicitamente no README da ferramenta, em vez de fingir que "quase funciona", é
consistente com a metodologia do capítulo 14: nunca afirmar mais do que aquilo que foi de
facto verificado.

## Uma armadilha real e discreta do `.bat`: parênteses literais dentro de blocos `if/else`

Ainda dentro deste mesmo script, um segundo bug real e bastante instrutivo sobre os
limites do `cmd.exe`: um bloco `if (...) else (...)` no Batch do Windows é interpretado
pelo `cmd.exe` através de uma contagem simples de parênteses de abertura/fecho — **não** um
parser que entende que um parêntese dentro de uma string entre aspas não faz parte da
estrutura do bloco. Uma mensagem de erro que continha, dentro de uma string entre aspas
passada como argumento a uma sub-rotina, um parêntese literal (por exemplo, `"(e.g.
BatCave)"`) **quebrava silenciosamente** todo o bloco `if/else` que a envolvia — nem o
ramo de sucesso, nem o ramo de erro, chegavam a executar; o script simplesmente saltava
para a linha seguinte, sem qualquer mensagem de erro do próprio `cmd.exe` a apontar para a
causa.

A correção foi simplesmente reescrever a mensagem para evitar parênteses literais dentro
da string ("such as BatCave" em vez de "(e.g. BatCave)"). **Lição**: em scripts Batch,
qualquer string usada dentro de um bloco `if (...) else (...)` de múltiplas linhas deve
ser tratada como parte da contagem de parênteses do próprio `cmd.exe` — um parêntese dentro
de uma string não tem imunidade nenhuma, e o sintoma de o quebrar não é um erro explícito,
é simplesmente "nada do que esperava aconteceu, sem pista nenhuma do porquê" — um dos casos
onde vale mais a pena testar o script linha a linha manualmente do que confiar que a
sintaxe "parece certa".

## Ordem de arranque e porque importa

O `.bat` segue uma ordem deliberada: (1) localizar o runtime Node, (2) limpar qualquer
processo preso na porta do servidor de uma execução anterior mal terminada, (3) instalar
dependências se `node_modules` não existir, (4) arrancar o FlareSolverr e confirmar que
subiu, (5) arrancar o servidor principal e confirmar que subiu, (6) abrir o browser. Cada
passo confirma explicitamente sucesso antes de avançar para o seguinte — a lição de fundo,
que atravessa este capítulo inteiro: um script de arranque para um utilizador não-técnico
tem de assumir que **qualquer passo pode falhar silenciosamente**, e reportar isso de forma
clara é tão importante como o próprio passo em si, porque é o único sinal que esse
utilizador vai ter para saber o que fazer a seguir (ex. "o FlareSolverr não arrancou, tenta
correr `tools\flaresolverr\flaresolverr.exe` diretamente para ver porquê").
