# 4. O sistema de sources (plugins de scraping)

Este é o mecanismo de extensibilidade central do ScrollScape, e provavelmente a parte mais
importante deste manual se estiveres a construir algo semelhante.

## O contrato: 4 funções obrigatórias

Qualquer ficheiro `.js` dentro de `data/sources/` é um "source" válido se exportar um
objeto `meta` com pelo menos `id`, e quatro funções `async`:

```js
async search(query, page = 1, orderBy = '', filters = {}) { ... }  // → { results, hasNextPage }
async mangaDetails(mangaId) { ... }
async chapters(mangaId) { ... }                                     // → { chapters: [...] }
async pages(chapterId) { ... }                                      // → { pages: [...] }
```

(assinaturas reais tiradas de `data/sources/mangapill.js`). `search()` devolve
`{ results, hasNextPage }`, em que cada resultado tem a forma
`{ id, title, cover, url, genres, status, author, format? }`. `chapters()` devolve
`{ chapters: [{ id, name, title, chapter, url, publishAt, pages: [] }] }`, ordenado do
capítulo mais recente para o mais antigo. `pages()` devolve `{ pages: [{ index, img }] }`,
onde `img` é sempre reescrito para passar por `/api/proxy-image?url=...` — nunca uma URL
remota exposta diretamente ao browser (capítulo 11 explica porquê).

Este contrato é validado ativamente ao carregar o módulo (`server/modules/source-loader/core.js`):

```js
if (!mod?.meta?.id) throw new Error('Invalid source: missing meta.id');
if (typeof mod.search !== 'function') throw new Error('Source missing search()');
if (typeof mod.mangaDetails !== 'function') throw new Error('Source missing mangaDetails()');
if (typeof mod.chapters !== 'function') throw new Error('Source missing chapters()');
if (typeof mod.pages !== 'function') throw new Error('Source missing pages()');
```

Um source que falhe esta validação nunca chega a ser exposto a nenhuma rota — falha logo
no carregamento, com um erro claro. Além das 4 obrigatórias, um source pode
opcionalmente implementar `healthCheck`, `trending`, `popularAllTime`, `recentlyAdded`,
`latestUpdates`, `byGenres`, `authorSearch` — o `GET /api/state` deteta dinamicamente
quais destas cada source implementa (`typeof mod[metodo] === 'function'`) e devolve isso
como um objeto `capabilities`, que o frontend usa para decidir que botões mostrar (ex. só
mostrar "Trending" para sources que implementam `trending`).

## Carregamento: facade + implementação, cache, sem sandbox

`server/sourceLoader.js` é uma **facade fina** — documenta a API pública e delega tudo para
`server/modules/source-loader/core.js`, onde vive a implementação real
(`createSourceLoaderCore()`), com dois `Map` em memória: `sourceCache` (módulos já
carregados) e `reposCache` (manifests de repositórios de sources instaláveis).

Pontos importantes:

- **Não há sandbox nem isolamento de processo.** `loadSourceFromFile(id)` faz
  literalmente `require(path)` — o código do source corre no mesmo processo Node, com o
  mesmo acesso a `fs`, rede, etc. que o resto da aplicação. Isto é aceitável no contexto de
  "eu escrevo os meus próprios sources, para uso pessoal" — seria uma escolha perigosa se
  o ScrollScape aceitasse sources de terceiros não confiáveis sem revisão.
- **Cache com invalidação explícita, não hot-reload automático.** A primeira vez que um
  `id` é pedido, o código faz `delete require.cache[require.resolve(p)]` antes do
  `require()` — isto garante que, se o ficheiro tiver sido substituído em disco desde o
  arranque do servidor, a versão nova é carregada. Mas isto só acontece **na primeira
  chamada por id**; depois disso, o módulo fica no `sourceCache` e chamadas seguintes
  devolvem a cópia em memória sem voltar a olhar para o disco. Para forçar um reload
  genuíno, é preciso chamar `clearSourceCache(id)` explicitamente.
- **Confinamento contra path traversal.** `sourcePath(id)` resolve o caminho absoluto e
  verifica `resolvedUser.startsWith(path.resolve(SOURCES_DIR) + path.sep)` antes de
  devolver — um `id` malicioso como `../../server` nunca escapa da pasta de sources.
- **Auto-instalação por ficheiro.** `autoInstallLocalSources()` corre a cada
  `GET /api/state` e regista no store qualquer ficheiro `.js` em `data/sources/` que ainda
  não esteja em `store.installedSources`. **Não existe um mecanismo de "desativar" um
  source** — a única forma de o remover é desinstalá-lo (apagar o ficheiro + a entrada no
  store), via `server/modules/sources/lifecycle.js`.

## Dispatch: uma única rota genérica

Não há uma rota `/api/source/:id/search`, outra `/mangaDetails`, etc. Há **uma única
rota**:

```
POST /api/source/:id/:method
```

tratada por `server/routes/sources.js`, que valida `:id` com `safeId()` via middleware
(`requireValidIdParam`) e depois delega a `server/modules/sources/dispatch-service.js`,
que revalida o `id` (defesa em profundidade) e verifica `method` contra uma whitelist:

```js
const ALLOWED_METHODS = ['search', 'mangaDetails', 'chapters', 'pages',
  'trending', 'recentlyAdded', 'latestUpdates', 'byGenres', 'authorSearch'];
```

Qualquer método fora desta lista devolve HTTP 400. Cada chamada corre dentro de
`withTimeout(chamada, 30000, ...)` — um `Promise.race` contra um timer, para garantir que
um source lento ou preso (ex. um site que nunca responde) não bloqueia o pedido
indefinidamente.

**Um detalhe que uma implementação nova provavelmente vai apanhar mal**: `mangaId`,
`chapterId` e `query`, vindos do corpo do pedido, **não passam por nenhuma sanitização
central** antes de chegar ao módulo do source. `safeId()` só se aplica ao parâmetro `:id`
da URL (o nome do source) — o resto é responsabilidade de cada source individualmente.
Isto é deliberado: `mangaId`/`chapterId` são strings opacas, específicas de cada site, e
frequentemente contêm caracteres que uma validação genérica (`safeId`, pensada para slugs
alfanuméricos) rejeitaria — por exemplo, um `mangaId` real do MangaPill observado em
produção é literalmente `"8/kingdom"` (contém uma barra). Tentar validar isto com uma
regex genérica de "slug seguro" quebraria o source. A abordagem correta é tratar estes IDs
como dados opacos: nunca os re-interpretar como caminho de ficheiro ou comando de shell
sem `encodeURIComponent`, mas também nunca lhes aplicar uma whitelist de caracteres pensada
para outro tipo de identificador.

**Outra armadilha real, encontrada neste projeto**: o dispatcher chama sempre
`mod.pages(chapterId)` com um único argumento posicional. A maioria dos sources assina
`pages(chapterId)`, mas alguns (`batcave.js`, `kingofshojo.js`, `vortexscans.js`) assinam
`pages(mangaId, chapterId)` e lidam com isto internamente lendo
`const rawId = chapterId || mangaId` — porque, vindo de um único argumento posicional do
dispatcher, o valor de `chapterId` cai sempre no primeiro parâmetro da função,
independentemente do nome que lhe deram. Lição: se o teu dispatcher genérico passa
argumentos posicionalmente, todo o teu ecossistema de plugins tem de assinar funções com a
**mesma ordem de parâmetros**, sem excepção — nomear parâmetros diferente não protege
nada.

## Helpers partilhados: `server/modules/network/fetch-utils.js`

Nenhum destes helpers é obrigatório — um source pode implementar o seu próprio `fetch()`
com retries do zero (como faz `mangapill.js`) — mas quem os usa ganha, de fábrica:

- **`fetchJson(url)` / `fetchText(url)`** — protegidos contra SSRF via `isSafeUrl()` antes
  de qualquer pedido (bloqueia IPs privados/localhost — capítulo 11), com backoff
  exponencial (`1500ms * 2^tentativa`).
- **Deteção de desafio Cloudflare/anti-bot** — `fetchText()` reconhece páginas de desafio
  (marcadores como `cdp_flags`, `powNonce`, ou o texto "Just a moment...") e, quando
  detetado, tenta resolver automaticamente através do **FlareSolverr** (um proxy que
  resolve desafios JS/Cloudflare usando um browser real headless).
- **Sessões de domínio em cache** — depois de resolver um desafio uma vez para um domínio,
  os cookies/User-Agent resultantes ficam guardados num `Map` em memória
  (`domainSessions`), e pedidos seguintes ao mesmo domínio reutilizam essa sessão em vez de
  voltar a resolver o desafio a cada pedido.
- **`withFsLock(domain, fn)`** — de-duplicação "single-flight" por domínio: se chegarem
  vários pedidos concorrentes ao mesmo domínio protegido por Cloudflare ao mesmo tempo, só
  o primeiro dispara uma resolução via FlareSolverr; os outros esperam pela mesma promise
  em vez de disparar N resoluções em paralelo (o que sobrecarregaria o FlareSolverr e
  provavelmente levaria a mais desafios, não menos).
- **`DEFAULT_USER_AGENT`** — uma única string de User-Agent exportada, em vez de cada
  source (e mais uma dúzia de outros módulos: `proxy/service.js`, `cover-search/index.js`,
  `library/ap-hiatus.js`...) manter a sua própria cópia hardcoded. Trocar o User-Agent do
  projeto inteiro passou a ser uma alteração num só sítio.
- **`configure({ readStore })`** — este módulo lê `readStore` (para saber se as sessões de
  domínio devem persistir em disco) através de um `require('../../store')` direto por
  omissão, mas aceita opcionalmente um `readStore` injetado. O padrão: uma variável de
  módulo `let _readStore = null`, e um fallback lento (`if (!_readStore) _readStore =
  require(...)`) só resolvido na primeira chamada real, nunca no carregamento do módulo.
  Isto mantém 100% de compatibilidade para quem nunca chama `configure()` (o `require`
  direto continua lá como default), mas permite injetar um `readStore` falso em testes, ou
  reutilizar este módulo fora do contexto do `store.json` do ScrollScape — sem precisar de
  reescrever a assinatura de nenhuma função exportada.

Nota prática: nesta instalação, de 10 sources instalados, apenas o **BatCave** depende de
facto do FlareSolverr — os outros nove não estão atrás de Cloudflare (o MangaDex, por
exemplo, tem uma API pública sem qualquer proteção). Isto explica por que só esse source
específico falha quando o FlareSolverr não está a correr, e é uma boa demonstração de como
isolar esta dependência por source, em vez de a tornar um requisito global, poupa
complexidade para quem instala sources que não precisam dela.

## Outros helpers partilhados em `server/modules/common/`

Além do `fetch-utils.js`, há três problemas pequenos que se repetiam, quase palavra por
palavra, em vários ficheiros de `data/sources/` — cada um acabou por virar o seu próprio
módulo minúsculo e sem estado, importado apenas pelos sources que precisam dele:

- **`paginate-stitch.js` — "colar" páginas nativas numa página da app.** A maioria dos
  sites não tem um `limit=` configurável (ou finge tê-lo e ignora-o); a app mostra sempre
  50 resultados por página, mas o site pode devolver 20, 30 ou 36 por pedido. Sete sources
  resolviam isto com uma cópia quase idêntica de um algoritmo de "avança página nativa a
  página nativa até teres o suficiente, depois corta ao tamanho certo" — cinco delas eram
  **byte a byte idênticas**. `fetchStitchedPage(fetchNativePage, appPage, options)` é agora
  a implementação única, com `options` a cobrir as duas variações reais que existiam
  (BatCave precisa de propagar um sinal de "site temporariamente em baixo" em vez de tratar
  isso como "zero resultados"; KingOfShojo precisa do total de páginas nativas convertido
  para o total de páginas da app):
  ```js
  async function fetchStitchedPage(fetchNativePage, appPage, options = {}) {
    const {
      appPageSize = 50,
      nativePageSize = 20,
      propagateTemporarilyUnavailable = false,
      trackTotalPages = false,
    } = options;
    // ...
  }
  ```
  Verificado por equivalência comportamental antes de substituir as sete cópias: as três
  variantes (simples, com propagação de erro, com contagem de páginas) foram comparadas
  contra a implementação nova em mais de 150 combinações de tamanho de catálogo/página, e
  depois contra os sites reais em produção.
- **`slugify.js` — nome de género → segmento de URL.** `slugifyGenre('Shoujo Ai')` →
  `'shoujo-ai'`. Duplicado, byte a byte, em `asurascans.js` e `comichubfree.js`.
- **`manga-status.js` — normalizar texto livre de estado de publicação.** Três sources
  (`mangakatana.js`, `mangapill.js`, `allmanga.js`) tinham cada um o seu próprio
  `normalizeStatus()`, parecidos mas não idênticos — o de `allmanga.js`, por exemplo, nunca
  reconhecia "hiatus" nem "cancelled", caindo sempre no texto em bruto para esses dois
  casos. `mangadex.js` nunca precisou disto: já recebe um enum limpo diretamente da API do
  MangaDex, texto livre scraped de HTML é que precisa de normalização. A versão partilhada
  usa o conjunto mais amplo de palavras-chave das três, reconhece os quatro estados, e
  **mantém o texto original como fallback em vez de o descartar para `"unknown"`** — esse
  texto de fallback chega mesmo a um badge visível em `ui-search.js`, por isso descartá-lo
  seria perder informação real, não só "limpar" o código.

O padrão a reter: quando um comportamento pequeno se repete em vários sources com apenas
pequenas variações, vale a pena consolidar num módulo que aceita essas variações como
parâmetros explícitos — não escolher arbitrariamente uma das cópias como "a certa" e
descartar o comportamento das outras sem primeiro perceber *porque* eram diferentes.

## Guia prático: passo a passo para adicionar um novo source

O resto deste capítulo explica o *porquê* da arquitetura. Esta secção é o *como* — o
percurso real seguido para cada um dos 10 sources instalados, na ordem em que as decisões
têm de ser tomadas.

### 1. Inspecionar o site alvo antes de escrever uma única linha

Três perguntas, respondidas contra o site real (não assumidas):

- **API pública ou HTML scraping?** O MangaDex tem uma API JSON documentada — nesse caso
  não há `cheerio` nenhum no ficheiro, só `fetch()` + `JSON.parse`. A maioria dos outros
  sites não tem API, por isso o padrão é `cheerio.load(html)` sobre a página real.
- **Está atrás de Cloudflare?** Faz um pedido real (`curl` ou `fetch()`) à página de
  pesquisa do site. Se vier uma página com "Just a moment...", `cdp_flags` ou `powNonce` no
  HTML, ou um 403/503 persistente, o site precisa de FlareSolverr — usa `fetchText()` de
  `fetch-utils.js` (deteção automática) em vez de implementares o teu próprio `fetch()`. Se
  o pedido devolve o HTML esperado diretamente, um `fetch()` simples com
  `DEFAULT_USER_AGENT` chega (é o caso de 9 dos 10 sources instalados — só o BatCave precisa
  mesmo de FlareSolverr).
- **Qual é a paginação nativa?** A app mostra sempre 50 resultados por página; confirma
  quantos o site devolve por pedido nativo (20? 30? 36?) e se esse número é configurável via
  query param ou fixo — isto decide se vais precisar de `paginate-stitch.js` (secção acima).

### 2. Esqueleto do ficheiro

```js
'use strict';
const cheerio = require('cheerio'); // omite esta linha se for API JSON pura, como o mangadex.js
const { DEFAULT_USER_AGENT } = require('../../server/modules/network/fetch-utils');

const BASE = 'https://exemplo.com';

module.exports = {
  meta: {
    id: 'exemplo',           // estável — usado em URLs, no store, e como chave de cache
    name: 'Exemplo',
    version: '1.0.0',
    author: 'o-teu-nome',
    supportsTrending: true,       // só declara o que realmente implementaste (secção do contrato, acima)
    supportsPopularAllTime: false,
    beta: true,               // esconde o source atrás do toggle "Show beta sources" até
  },                           // teres confiança suficiente com uso real (ver ui-state.js)

  async search(query, page = 1, orderBy = '', filters = {}) { /* ... */ },
  async mangaDetails(mangaId) { /* ... */ },
  async chapters(mangaId) { /* ... */ },
  async pages(chapterId) { /* ... */ },
};
```

`'use strict'` no topo não é opcional por convenção deste projeto — todos os 10 sources
instalados têm essa linha. `beta: true` é a rede de segurança certa para um source recém-
escrito: fica instalável e testável, mas não aparece nas listas de sources por omissão até
alguém (tu, primeiro) confirmar que aguenta uso real.

### 3. Implementar os 4 métodos — pela ordem que dá para testar

Não escrevas os 4 de uma vez às cegas; cada um só é testável depois do anterior devolver
algo real:

1. **`search()`** primeiro — é o único ponto de entrada sem depender de um `mangaId` real
   ainda por descobrir. Mapeia os resultados reais do site para
   `{ id, title, cover, url, genres, status, author, format? }` (forma exata na secção do
   contrato, acima). Se o site pagina de forma diferente de 50/página, envolve o teu
   `fetchNativePage` com `fetchStitchedPage` aqui.
2. Corre `search()` sozinho (um script Node pontual que faz `require()` do ficheiro e chama
   `search('algo')`) e confirma que `id`/`url` batem certo com o site real — vais precisar
   de um `id` real do resultado para os passos seguintes.
3. **`mangaDetails(mangaId)`** — usa um `id` real do passo anterior. Devolve pelo menos
   `{ id, title, cover, description, status, genres, author, url }`.
4. **`chapters(mangaId)`** — devolve `{ chapters: [...] }`, **nunca um array solto** (um
   engano fácil de cometer, e que quebra silenciosamente todo o resto da app à espera de
   `result.chapters`). Cada capítulo usa `publishAt` para a data — não `date`; dos 10
   sources instalados, 9 usam `publishAt` e só um usava `date` até este ser corrigido para
   bater certo com os outros (capítulo 10 explica o efeito real disto no calendário de
   lançamentos e no OPDS). Lista ordenada do capítulo mais recente para o mais antigo.
5. **`pages(chapterId)`** — devolve `{ pages: [{ index, img }] }`. O `index` é obrigatório
   (usado para nomear ficheiros ao gerar um CBZ — ver `cbz-builder.js`). `img` tem de passar
   por `/api/proxy-image?url=${encodeURIComponent(urlReal)}&ref=${encodeURIComponent(referer)}`
   — nunca a URL remota diretamente; muitos sites bloqueiam o carregamento da imagem sem um
   `Referer` válido, e o proxy é onde esse cabeçalho é injetado (capítulo 11 explica o resto
   da razão de segurança).

### 4. Reutilizar os helpers partilhados — não copiar-colar de outro source

Antes de escreveres lógica nova, confirma se já não existe:

| Precisas de... | Usa | Não escrevas a tua própria versão de |
|---|---|---|
| Paginação quando o site não bate com 50/página | `paginate-stitch.js` → `fetchStitchedPage` | o loop "busca até teres 50, corta" |
| Slug de género para URL (`"Shoujo Ai"` → `"shoujo-ai"`) | `slugify.js` → `slugifyGenre` | uma regex `.replace(/\s+/g,'-')` só a apanhar espaços |
| Normalizar texto de estado (`"On Hiatus"` → `"hiatus"`) | `manga-status.js` → `normalizeStatus` | um `if/else` que só reconhece ongoing/completed |
| Cabeçalho User-Agent | `fetch-utils.js` → `DEFAULT_USER_AGENT` | uma string `Mozilla/5.0...` hardcoded |
| `fetch()` com retry/SSRF-guard/Cloudflare | `fetch-utils.js` → `fetchJson`/`fetchText` | o teu próprio `fetch` + retry do zero (só faz isto se tiveres uma razão específica, como `mangapill.js`) |

A exceção real a esta tabela: se o teu site expõe o estado de publicação só dentro do HTML
completo da página (não numa label extraída, tipo `vortexscans.js`), **não** passes esse
HTML inteiro para `normalizeStatus()` — o fallback dela devolve o texto original quando
nada bate, e isso seria a página toda, não um estado. Nesse caso mantém a tua própria
verificação `htmlLower.includes('cancel')` etc., só com os 4 estados cobertos.

### 5. Testar contra o site real — nunca contra suposições

A lição mais repetida ao longo deste projeto (capítulo 14): um source "parece" correto
lendo o código, mas só um pedido real ao site confirma os seletores/URLs. Antes de dares
o source como pronto:

- Corre `search()`, `mangaDetails()`, `chapters()` e `pages()` cada um contra o site real,
  não só contra HTML copiado uma vez para um teste — sites mudam de estrutura sem aviso.
- Confirma o formato real do `mangaId`/`chapterId` que o teu source produz — se contiver
  barras ou outros caracteres não-alfanuméricos, confirma que sobrevivem a
  `encodeURIComponent()` nos pontos onde são usados em URLs (nunca precisam de bater com
  `safeId()` — secção do dispatch, acima).
- Se o site tiver alguma paginação/filtro que não consigas verificar sem dados reais
  suficientes (ex. um género raro, uma pesquisa sem resultados), testa esses casos-limite
  também — não só o caminho feliz com um termo de pesquisa popular.

### Checklist final

- [ ] `'use strict'` na primeira linha
- [ ] `meta.id` estável, `beta: true` até ter confiança
- [ ] `search()`/`mangaDetails()`/`chapters()`/`pages()` com assinaturas **posicionais**, não `({query, page})`
- [ ] `chapters()` devolve `{ chapters: [...] }`, nunca um array solto
- [ ] Cada capítulo usa `publishAt`, não `date`
- [ ] `pages()` devolve `{ pages: [{ index, img }] }` com `index` presente
- [ ] `img` passa por `/api/proxy-image?url=...&ref=...`
- [ ] Género/estado/User-Agent reutilizam os helpers partilhados, não cópias locais
- [ ] Testado contra o site real, não só contra HTML estático guardado uma vez
