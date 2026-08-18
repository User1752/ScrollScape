# 6. Integração com o AniList

O AniList é um tracker de manga/anime com uma API GraphQL pública. A integração do
ScrollScape com ele tem duas partes bem distintas: autenticação (OAuth implícito) e
importação de biblioteca (a parte mais complexa e mais rica em lições deste capítulo).

## Autenticação: OAuth implícito, sem client secret no browser

O AniList suporta o fluxo OAuth 2.0 "implicit grant" — pensado exatamente para aplicações
que correm inteiramente no browser, sem backend próprio capaz de guardar um client secret
em segurança. O utilizador:

1. Regista uma app em `anilist.co/settings/developer`, com um **Redirect URI** que tem de
   corresponder exatamente a `window.location.origin` da instância (ex.
   `http://localhost:4000` — **não** `:3000` nem qualquer outra porta, é uma comparação
   exata).
2. Cola o **Client ID** nas definições do ScrollScape — não é preciso Client Secret, porque
   o fluxo implícito nunca troca um código de autorização no servidor; o token de acesso
   vem diretamente na fragment da URL de redirect.
3. O ScrollScape guarda esse token em `localStorage` (não no `store.json` do servidor) —
   é dados sensíveis específicos do browser/utilizador, não estado partilhado da
   aplicação.

Uma armadilha real que aconteceu durante o desenvolvimento: se a aplicação for aberta em
modo `--app=` do Chrome (usado pelo launcher para abrir o ScrollScape como se fosse uma
app desktop), esse modo pode acabar a correr num **perfil de Chrome diferente** do perfil
de navegação normal do utilizador — por isso uma janela de login do AniList aberta a
partir daí não partilha sessão/cookies com o Chrome "normal", mesmo que o utilizador já
esteja autenticado no AniList nesse outro perfil.

## O pipeline de importação: 5 fases

`anilistImportLibrary(opts)` (`public/modules/anilist.js`) corre inteiramente no browser
(não há um endpoint único "importa tudo" no servidor) e avança por 5 fases sequenciais:

1. **Fetch da lista completa do AniList** via GraphQL (`Page.media` paginado).
2. **Merge/aplicação no store local** — `POST /api/anilist/import-apply`, que corre
   `importAniListLibrary()` no servidor (secção seguinte — é aqui que estava o bug de
   deduplicação).
3. **Resolução de source** — para cada entrada ainda sem uma fonte real associada,
   pesquisa automaticamente em todos os sources instalados e propõe candidatos (secção
   "Resolução de sources").
4. **Escolha manual do utilizador** — um modal (`_showAnilistSourcePicker`) mostra os
   candidatos encontrados, com o de mais capítulos pré-selecionado; o utilizador confirma
   ou ajusta.
5. **Sincronização de progresso** — aplica o número de capítulos lidos no AniList como
   histórico de leitura local.

## Fase 2: merge — a lógica de deduplicação (e o bug real que existiu aqui)

Quando uma entrada do AniList chega, `importAniListLibrary()`
(`server/modules/library/service.js`) tem de decidir: "este manga já existe na minha
biblioteca sob outro source, ou é mesmo novo?" A resposta usa **três níveis de
correspondência**, em ordem de confiança decrescente:

```js
// Nível 1 — já explicitamente ligado a este anilistId (favorito REAL, não placeholder)
let favIdx = store.favorites.findIndex(m => m.sourceId !== 'anilist' && m.anilistId === alId);

// Nível 2 — título normalizado idêntico, contra um favorito real
if (favIdx < 0 && nt) {
  favIdx = store.favorites.findIndex(m => m.sourceId !== 'anilist' && normTitle(m.title) === nt);
}

// Nível 3 — título parecido (fuzzy, overlap de palavras / substring), limiar 0.8
if (favIdx < 0 && entry.title) {
  // ...pontuação por sobreposição de palavras, ver função titleSimilarity()
}

// Nível 4 (último recurso) — um placeholder "anilist" já criado por um import anterior
if (favIdx < 0) {
  favIdx = store.favorites.findIndex(m => m.id === alId && m.sourceId === 'anilist');
}
```

**O bug que existiu aqui, e a razão por que é uma lição valiosa**: a versão inicial desta
função combinava os níveis 1 e 4 num único `||`:

```js
// versão COM BUG
let favIdx = store.favorites.findIndex(
  m => (m.id === alId && m.sourceId === 'anilist') || m.anilistId === alId
);
```

Isto parece razoável isoladamente, mas tem uma consequência silenciosa e cumulativa: se um
import anterior (por exemplo, interrompido por um rate limit) já tinha criado um
placeholder "anilist" órfão para este `anilistId` — sem nunca o ligar a um favorito
real — então **todo import seguinte** encontra esse placeholder primeiro (é uma
correspondência de `id`+`sourceId` exata, o primeiro termo do `||`), e nunca chega a
comparar títulos com o favorito real que já existia sob outro source. O resultado
observável: dois cartões do mesmo manga na biblioteca, lado a lado, para sempre — um
resolvido corretamente (ex. "Hajime no Ippo" no MangaPill), outro parado como placeholder
"AniList", sem que nenhum reimport subsequente os juntasse.

A correção separa os dois níveis e **inverte a prioridade**: título real (níveis 1-3)
sempre ganha sobre um placeholder órfão (nível 4), e quando o nível 1-3 encontra o
favorito real, o código procura ativamente por um placeholder órfão remanescente e
remove-o:

```js
if (favIdx >= 0 && store.favorites[favIdx].sourceId !== 'anilist') {
  const staleIdx = store.favorites.findIndex(
    (m, idx) => idx !== favIdx && m.id === alId && m.sourceId === 'anilist'
  );
  if (staleIdx >= 0) {
    store.favorites.splice(staleIdx, 1);
    delete store.readingStatus[`${alId}:anilist`];
    if (staleIdx < favIdx) favIdx--; // o splice desloca os índices seguintes
  }
}
```

**Lição geral, não específica ao AniList**: sempre que uma lógica de "encontra ou cria"
combina múltiplos critérios com `||`/`OR`, verifica se algum desses critérios pode ter sido
satisfeito por **dados inválidos criados por uma execução anterior falhada** — porque, se
sim, esses dados inválidos vão ganhar prioridade sobre a correspondência correta em
qualquer execução futura, criando um estado permanentemente errado que parece "resolver-se
sozinho" mas na realidade nunca resolve.

## Fase 3: resolução de sources — o segundo bug real, sobre progresso

`_resolveAnilistSources(entries, opts)` (`public/modules/anilist.js`) está deliberadamente
limitado a **80 entradas por execução** (`resolveEntriesMax: 80`), porque para cada
entrada faz várias pesquisas (uma por source instalado) mais uma consulta de contagem de
capítulos por candidato encontrado — em bibliotecas grandes, processar tudo de uma vez
seria demasiado lento e arriscaria atingir limites de taxa do próprio AniList.

**O bug**: a função original recebia sempre a lista **completa e não filtrada** de
entradas (`entries`, na ordem em que o AniList as devolve) e cortava-a com
`entries.slice(0, 80)`. Isto significa que, numa biblioteca com 250+ entradas, **todas as
execuções seguintes voltam a processar exatamente as mesmas primeiras 80** — nunca avançam
para a 81.ª em diante, por mais vezes que o utilizador repita a importação.

A correção filtra a lista **antes** de cortar aos 80, excluindo qualquer entrada que já
tenha um favorito real associado (verificado através do `state.favorites` atualizado, que
já reflete o merge da fase 2 desta mesma execução):

```js
const alreadyResolvedIds = new Set(
  (state.favorites || [])
    .filter(m => m.sourceId !== 'anilist' && m.anilistId)
    .map(m => String(m.anilistId))
);
const unresolvedEntries = entries.filter(e => !alreadyResolvedIds.has(String(e.anilistId)));
// _resolveAnilistSources(unresolvedEntries, ...) em vez de _resolveAnilistSources(entries, ...)
```

Com isto, cada execução avança pelo backlog em vez de ficar presa no início. Uma segunda
limitação foi identificada mais tarde e também corrigida: dentro do lote de 80 "ainda não
resolvidos", uma entrada que **falhou a resolver** (nenhum candidato encontrado nessa
tentativa) continuava a competir com uma entrada **nunca tentada** pela mesma vaga, na
execução seguinte — porque ambas apareciam como "não resolvidas" e a ordem preservada era a
ordem original do AniList, sem distinguir as duas. A correção guarda, em `localStorage`
(`_alGetAttempted`/`_alMarkAttempted`, ao lado do cache `_alGetLink`/`_alSetLink` já
existente), quais `anilistId` já tiveram pelo menos uma tentativa real de resolução — não
se tiveram sucesso, só se chegaram a ser processados. Antes de aplicar o corte de 80,
`unresolvedEntries` é ordenado (`Array.prototype.sort`, que em JavaScript é estável) para
que as entradas nunca tentadas fiquem sempre à frente das já tentadas-mas-falhadas, mantendo
a ordem relativa original dentro de cada um dos dois grupos. Isto é uma distinção
deliberadamente diferente de `_alGetLink`, que só regista ligações **bem-sucedidas** — o
registo de "tentativas" cobre também o caso "tentei e não encontrei nada", que de outra
forma seria indistinguível de "nunca tentei".

Vale notar também que candidatos só contam se tiverem uma contagem de capítulos real maior
que zero — se a consulta de capítulos falhar transitoriamente (rede, timeout) para todos
os candidatos de uma entrada nessa execução em particular, essa entrada fica sem opções e
**desaparece silenciosamente do modal de escolha**, sem qualquer indicação ao utilizador
de que foi tentada e falhou por acaso, vs. simplesmente não existir em nenhum source
instalado. A correção para esta falta de visibilidade foi adicionar uma contagem explícita
no resumo final da importação ("N manga sem candidato encontrado em nenhum source
instalado"), para que o utilizador saiba distinguir "ainda não tentei" de "tentei e não
encontrei nada" — sem isso, os dois casos são indistinguíveis do ponto de vista do
utilizador, mas exigem ações diferentes (repetir a importação vs. aceitar que aquele manga
nunca vai resolver automaticamente).

## Preferência de capa: AniList vs. fonte resolvida

Por padrão, quando uma entrada é ligada a um source real, a capa usada é a do **source**
(mais consistente com o resto da biblioteca, que vem todo de sources). Um toggle
("Keep AniList cover") inverte esta preferência, tanto no merge automático (fase 2) como na
resolução manual (fase 4) — implementado passando uma flag `keepCover` desde a UI de
definições até às duas funções do servidor (`importAniListLibrary`, `resolveAniListLibrary`),
cada uma decidindo, no momento de escrever o campo `cover`, qual das duas fontes de capa
usar. A lição de design aqui: quando um pipeline tem múltiplas fases que escrevem o mesmo
campo, uma preferência do utilizador desse tipo tem de ser passada explicitamente por
**todas** as fases que tocam esse campo — passá-la só à primeira fase e assumir que "fica
guardada" não funciona, porque cada fase re-escreve o objeto a partir dos seus próprios
dados de entrada.

## Mudar o estado no AniList a partir da app: modo individual e modo em lote

Além do pipeline de importação (secções acima), a app permite mudar o estado de leitura de
um manga **diretamente no AniList** (não só localmente), em dois sítios diferentes que
partilham a mesma peça central: um cache de ligação `mangaId → id do AniList`, guardado em
`localStorage` (`_alGetLink`/`_alSetLink`, `public/modules/anilist.js`) — assim que um manga
é ligado uma vez (manualmente ou por correspondência automática), qualquer funcionalidade
seguinte que precise de saber "qual é o `mediaId` do AniList para este manga" reutiliza essa
ligação, em vez de voltar a pesquisar.

**Modo individual** — `showTrackerModal(manga)`: abre um modal completo (progresso,
pontuação, datas de início/fim, remover da lista), com um seletor manual de resultados de
pesquisa caso o manga ainda não esteja ligado. Ao gravar
(`SaveMediaListEntry(mediaId, status, progress, score, startedAt, completedAt)`), grava
também a ligação (`_alSetLink`) e espelha o estado localmente via `POST /api/user/status`,
usando o mesmo mapa `AniList status → estado local` (`CURRENT→reading`,
`COMPLETED→completed`, etc.) que o pipeline de importação usa.

**Modo em lote** — `anilistBulkSetStatus(mangaList, status)`, ligado ao menu de contexto da
biblioteca (secção "Ações em lote" do capítulo 5): aplica **um único estado escolhido** a
todos os mangas selecionados de uma vez, sem abrir um formulário por manga. Diferenças
deliberadas em relação ao modo individual, por ser pensado para vários itens ao mesmo
tempo:

- **Sem formulário de progresso/pontuação/datas** — só o campo `status`, porque pedir ao
  utilizador para preencher progresso e datas individualmente para, por exemplo, 5 mangas
  ao mesmo tempo anularia o ganho de ser uma ação em lote.
- **Correspondência automática, sem escolha manual**: para um manga ainda sem ligação ao
  AniList, a função pesquisa pelo título e só aceita o resultado automaticamente se a
  pontuação de semelhança (a mesma função `_titleScore` já usada no picker de capas, ver
  capítulo 8) for suficientemente alta (≥ 0.6). Um manga sem correspondência confiante fica
  contado como `unmatched`, **distinto de `fail`** — um erro de rede é "tenta outra vez",
  um `unmatched` é "não existe correspondência clara, talvez nem exista no AniList", e
  confundir os dois no resumo final tornaria impossível ao utilizador saber qual dos dois
  aconteceu.
- **Uma pequena pausa (250ms) entre cada manga processado** — o mesmo cuidado do pipeline
  de importação em massa (capítulo 6, fase 3): mesmo sendo tipicamente poucos itens (uma
  seleção manual, não a biblioteca inteira), continua a ser tráfego real contra a API do
  AniList, e não há razão para o disparar todo em simultâneo.

**Lição de reutilização**: as duas funcionalidades (modal individual, ação em lote) nunca
duplicam a lógica de "gravar no AniList e espelhar localmente" — partilham o mesmo cache de
ligação e o mesmo mapa de tradução de estados, só divergem na quantidade de campos que
pedem ao utilizador e em como resolvem o `mediaId` quando ainda não existe uma ligação
guardada. Construir a versão em lote a copiar-colar a lógica do modal individual, em vez de
extrair só o que era realmente necessário partilhar, teria duplicado exatamente o tipo de
lógica (o mapa de estados, a chamada à mutação GraphQL) que já se sabia, de outras partes
deste projeto, ser propensa a ficar desincronizada entre cópias ao longo do tempo.
