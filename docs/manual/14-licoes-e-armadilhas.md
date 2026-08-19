# 14. Lições e armadilhas reais

Este capítulo final reúne, num único sítio, os bugs reais mais instrutivos encontrados e
corrigidos ao longo do desenvolvimento deste projeto — cada um já descrito em detalhe no
capítulo correspondente, mas agrupados aqui por **categoria de erro**, porque a mesma
categoria tende a repetir-se em contextos completamente diferentes. Se estiveres a
construir um projeto parecido, esta lista é provavelmente mais útil lida de uma vez, antes
de escrever código, do que descoberta bug a bug em produção.

## Categoria: lógica de "encontra ou cria" com prioridade errada

**Onde apareceu**: deduplicação do import do AniList (capítulo 6).

Combinar vários critérios de correspondência com `||`/OR é perigoso quando um desses
critérios pode ser satisfeito por **dados inválidos criados por uma execução anterior
falhada**. Nesse caso, um placeholder órfão de um import interrompido passava a ganhar
prioridade sobre a correspondência de título correta, para sempre, em qualquer execução
futura — porque o critério "já existe algo com este ID exato" era avaliado antes do
critério "existe algo com este título". A correção foi separar os critérios e ordená-los
explicitamente por confiança (ligação explícita > título exato > título aproximado >
placeholder órfão como último recurso).

**Como evitar isto ao construir algo novo**: sempre que escreveres uma função de
"encontra-ou-cria", pergunta explicitamente: *que critério de correspondência eu confio
mais? E se o critério menos confiável for satisfeito por lixo deixado por uma execução
anterior falhada — o que acontece?* Ordena os critérios por confiança decrescente, nunca
por conveniência de escrita.

## Categoria: um limite (cap) que nunca avança

**Onde apareceu**: resolução de sources em massa no import do AniList (capítulo 6).

Um `array.slice(0, N)` aplicado sempre à **mesma lista completa**, sem primeiro remover o
que já foi processado, produz um comportamento enganador: parece estar a "processar 80 de
cada vez", mas na realidade processa **os mesmos primeiros 80** indefinidamente. A app
parece estar a fazer progresso (mostra uma barra de progresso, mostra `80/80`), mas o
estado real da aplicação nunca avança para além desse primeiro lote.

**Como evitar isto**: qualquer operação em lote, limitada por um cap, e destinada a ser
repetida várias vezes (por retomar, por rate limit, por escolha do utilizador) tem de
filtrar primeiro o que **já está feito**, antes de aplicar o corte ao lote seguinte. Um cap
sem essa filtragem prévia não é "processamento incremental" — é "processamento do mesmo
início, sempre".

## Categoria: strings polimórficas que representam "a mesma coisa" mas não são intercambiáveis

**Onde apareceu**: `blob:` URL vs. `ArrayBuffer` para o `epub.js` (capítulo 7); nome do
source vs. ID opaco de manga na validação de identidade (capítulo 11).

Duas representações diferentes do "mesmo" dado (os bytes de um ficheiro, através de uma
`blob:` URL ou de um `ArrayBuffer`; um identificador, através de um slug interno ou de uma
string opaca de terceiros) podem parecer intercambiáveis a um humano a ler o código, mas
não o são para uma função que decide comportamento com base na **forma textual** da
própria referência (ex. sniffing de extensão de ficheiro numa string) ou num conjunto fixo
de caracteres permitidos.

**Como evitar isto**: antes de assumir que "passar X em vez de Y devia dar no mesmo",
confirma explicitamente como a função recetora decide o que fazer com o valor — lê a
lógica de deteção de tipo/validação dela, não só a assinatura.

## Categoria: dados desnormalizados que não se atualizam sozinhos

**Onde apareceu**: `history`/`readingStatus` a manterem uma capa antiga depois de a capa
"oficial" mudar (capítulos 5 e 7).

Guardar o mesmo dado em vários sítios (por performance, para evitar um pedido de rede
extra em cada renderização) tem um custo que é fácil de esquecer: **qualquer operação que
mude esse dado tem de saber, explicitamente, de todos os sítios onde ele está copiado**.
Não há nenhum mecanismo automático (sem uma camada de reatividade real, capítulo 12) que
propague a mudança sozinho.

**Como evitar isto**: ao desnormalizar um dado por performance, escreve numa lista (mesmo
que seja só num comentário) todos os sítios onde esse dado é copiado — e sempre que
escreveres uma função que muda o "original", volta a essa lista e confirma que atualizaste
todas as cópias.

## Categoria: uma feature nova só testada contra um dos "modos" de dados existentes

**Onde apareceu**: capas personalizadas a funcionar para favoritos online mas não para
mangas importados localmente (capítulo 7).

Quando um sistema tem dois conceitos que parecem semelhantes à superfície mas têm
implementações de armazenamento diferentes por baixo (favoritos online vs. ficheiros
locais, no caso do ScrollScape), uma feature nova construída e testada só contra um deles
pode compilar, correr sem erros, e ainda assim não fazer nada útil no outro — porque a
escrita foi para um sítio que nada lê.

**Como evitar isto**: sempre que um sistema tiver esta dualidade, qualquer feature nova
tem de ser explicitamente testada contra **ambos** os modos antes de ser considerada
completa. A ausência de erro não é prova de que funcionou.

## Categoria: `try/catch` genérico a esconder um erro de programação

**Onde apareceu**: o identificador `limits` não definido na resolução de datas do
calendário via MangaDex (capítulo 10).

Um `try/catch` que trata qualquer excepção da mesma forma (ex. "falhou, usa o fallback")
não distingue um erro de rede esperado (o site está em baixo) de um erro de programação
(uma variável nunca foi importada). O sintoma observável — "esta funcionalidade nunca
funciona, mas nunca dá erro nenhum visível" — é indistinguível de uma limitação de design
deliberada, o que faz este tipo de bug durar muito mais tempo sem ser detectado.

**Como evitar isto**: em desenvolvimento, regista sempre o tipo e a mensagem da excepção
capturada por um `catch` largo, mesmo que a decisão final seja "ignorar e seguir para o
fallback" — a diferença entre `ReferenceError: limits is not defined` e
`FetchError: ECONNREFUSED` no log é a diferença entre encontrar este bug em cinco minutos
ou nunca.

## Categoria: cache de módulos (`require`) que esconde alterações de código

**Onde apareceu**: qualquer alteração a um ficheiro dentro de `server/modules/` só tem
efeito depois de reiniciar o processo Node — o `require()` do Node.js guarda cada módulo
em cache na primeira vez que é carregado, e não volta a ler o ficheiro do disco a menos que
esse cache seja explicitamente invalidado (o próprio carregador de sources, capítulo 4,
tem de fazer isto manualmente com `delete require.cache[...]`).

**Como evitar confusão sobre isto**: ao testar uma correção do lado do servidor, confirma
sempre que o processo Node foi reiniciado antes de concluir "a correção não funcionou" — é
uma das causas mais comuns e mais fáceis de descartar erradamente de "o bug continua lá"
quando, na realidade, o código antigo é que ainda está a correr em memória.

## Categoria: "código morto" que só parece morto porque a pesquisa não viu tudo

**Onde apareceu**: `server/modules/errors/error-registry.js`, apagado durante uma
auditoria de limpeza de código, com base numa pesquisa (`grep`) que não encontrou nenhum
`require()` dele em ficheiro nenhum sob controlo de versão.

O módulo era, de facto, usado — só que pelos oito pontos de chamada que viviam dentro de
`data/sources/*.js`, uma pasta marcada como `gitignored` neste projeto (os sources
instalados são geridos como plugins, não como código do repositório principal). Uma
pesquisa que só cobre ficheiros rastreados pelo Git simplesmente nunca viu esses oito
`require()`, cada um dentro de um `try/catch` que engolia silenciosamente o
`MODULE_NOT_FOUND` resultante — o sintoma não foi um crash, foi um logging de "erro
conhecido" que silenciosamente deixou de acontecer para três sources, sem nenhum sinal
visível de que algo tinha partido.

**Como evitar isto**: antes de apagar algo com base em "não encontrei nenhuma referência",
confirma explicitamente que a tua pesquisa cobriu **todos** os sítios onde o código corre
em produção — não só os que o teu sistema de controlo de versão rastreia. Num projeto com
qualquer pasta gitignored que contenha código executável (plugins, configuração gerada,
scripts descarregados), isso significa procurar aí também, explicitamente, sempre que a
pergunta for "isto está morto?" em vez de confiar só num `git grep`.

## Categoria: normalizar dados a descartar informação que, a jusante, é mesmo mostrada

**Onde apareceu**: três implementações near-duplicadas de `normalizeStatus()` nos sources
(capítulo 4) — uma delas devolvia sempre `"unknown"` para qualquer texto de estado não
reconhecido, em vez de preservar o texto original como as outras duas faziam.

À primeira vista, parecia a versão "mais limpa": descartar texto scraped não reconhecido
para um valor genérico soa como boa higiene de dados. Só ao verificar onde `status` era
efetivamente consumido é que ficou claro que esse texto de fallback chega literalmente a
um badge visível na interface (`ui-search.js`) — um site com um estado invulgar (ex. "Not
Yet Licensed") mostrava essa frase real ao utilizador nas outras duas versões, e mostraria
só "unknown" na versão "mais limpa". Unificar as três às cegas pela versão que "parecia"
mais correta teria sido uma regressão visível, não uma melhoria.

**Como evitar isto**: antes de escolher qual das várias implementações near-duplicadas vira
a versão canónica, confirma **onde o valor de saída de cada uma é consumido a jusante** —
não assumas que a diferença de comportamento entre elas é irrelevante só porque parece um
detalhe de "estilo" ao ler o código isoladamente.

## Metodologia: verificar contra código e dados reais, nunca assumir

A disciplina mais valiosa aplicada ao longo de todo o desenvolvimento deste projeto não é
uma técnica específica — é um hábito: **antes de afirmar que algo está corrigido, verificar
contra o código real, não contra a memória do que o código "deveria" fazer**. Na prática,
isto tomou três formas concretas, todas reutilizáveis em qualquer projeto:

1. **Scripts de teste isolados contra os módulos de serviço reais**, com um
   `readStore`/`writeStore` falso em memória em vez de um `store.json` real em disco —
   permite reproduzir um cenário exato (ex. "um placeholder órfão já existe, mais um
   favorito real com o mesmo título") e confirmar programaticamente, com `assert`, que o
   comportamento corrigido é o esperado, sem depender de testar manualmente através da
   interface.
2. **Inspecionar os dados reais em disco** (`data/store.json`) antes de diagnosticar um
   problema relatado pelo utilizador, em vez de assumir a causa a partir da descrição —
   contar exatamente quantas entradas estavam em cada estado revelou que o problema era
   mais profundo (só 133 de 250 resolvidas) do que uma leitura só da descrição sugeria.
3. **Fazer o pedido real** (uma pesquisa contra um source instalado, por exemplo) para
   confirmar se um caso reportado como "falhado" era estruturalmente impossível de resolver
   (o manga não existe em nenhum source instalado) ou apenas ainda não tinha sido tentado —
   a resposta a esta pergunta muda completamente que correção fazer.

Este hábito é lento comparado a "parece que devia funcionar assim, vou assumir que sim" —
mas é precisamente a diferença entre uma correção que resolve o problema relatado e uma
que só resolve a versão do problema que existia na tua cabeça.
