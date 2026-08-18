# 2. Arquitetura geral

## Estrutura de diretórios

```
ScrollScape/
├── server.js                  # entry point: configura store, monta rotas, arranca Express
├── server/
│   ├── routes/                 # um ficheiro por área de API (~22 ficheiros)
│   │   └── bootstrap.js        # registerAppRoutes(app) — chama TODOS os register*(app)
│   ├── modules/                # lógica de negócio, organizada por domínio (~26 pastas)
│   │   └── <dominio>/service.js
│   ├── middleware/              # security.js (CSP/helmet), auth-gate.js, validation.js
│   ├── config/                  # limits.js (timeouts, rate limits, caps)
│   ├── store.js                 # singleton readStore/writeStore
│   └── sourceLoader.js          # facade para carregar sources
├── data/
│   ├── sources/                 # *.js — um ficheiro por source instalado
│   ├── local/                   # ficheiros importados localmente (EPUB/PDF/CBZ), 1 pasta por manga
│   ├── theme-presets/
│   ├── cache/                   # caches em disco (ComicVine, LOCG, etc.)
│   └── store.json               # TODO o estado persistente da aplicação
├── public/
│   ├── index.html                # ~59 <script defer> tags, ordem de dependência
│   ├── modules/                  # ~51 ficheiros .js do frontend
│   └── css-modules/
├── tools/                        # Node portátil + FlareSolverr, para o executável standalone
└── Launch-ScrollScape.bat        # launcher para utilizadores Windows sem terminal
```

## O ciclo de vida de um pedido tipico

Para entender como as peças se encaixam, segue-se o percurso completo de uma pesquisa de
manga, do clique do utilizador até à renderização:

1. **Frontend dispara o pedido** — um handler em `public/modules/ui-search.js` chama
   `api('/api/source/mangapill/search', { method: 'POST', body: JSON.stringify({ query }) })`.
   `api()` (`public/modules/api.js`) é um wrapper fino sobre `fetch()` que define
   `Content-Type: application/json`, faz parse defensivo da resposta, e lança `Error` em
   qualquer status não-2xx.
2. **Express recebe o pedido** — `server.js` já tem `app.use('/api', rateLimiter(...))` e
   `app.use(express.json())` montados antes de qualquer rota (ver capítulo 11). A rota
   `POST /api/source/:id/:method` (`server/routes/sources.js`) é a única que trata
   *qualquer* combinação de source+método — não há uma rota `/search` separada de
   `/mangaDetails`.
3. **Validação de identidade** — o middleware `requireValidIdParam('id')` corre `safeId()`
   sobre o parâmetro `:id` da URL (regex `^[a-z0-9_-]{1,80}$/i`) antes de chegar ao handler.
4. **Dispatch** — `server/modules/sources/dispatch-service.js` valida `method` contra uma
   whitelist (`search, mangaDetails, chapters, pages, trending, ...`) e chama
   `loadSourceFromFile(id)` para obter o módulo do source.
5. **Carregamento do source** — `server/modules/source-loader/core.js` verifica primeiro
   uma cache em memória (`Map`); se não estiver lá, faz `require()` do ficheiro em
   `data/sources/<id>.js`, valida que exporta as 4 funções obrigatórias, e guarda em cache.
6. **Execução do source** — o módulo faz o scraping real (fetch HTTP ao site de destino,
   parsing de HTML com `cheerio`, etc.), com um timeout global de 30s aplicado por
   `withTimeout()` no dispatcher.
7. **Resposta desce a mesma escada** — o array de resultados normalizado volta ao
   dispatcher, à rota, ao Express, ao `fetch()` do frontend.
8. **Renderização** — `ui-search.js` recebe o JSON, normaliza cada resultado (títulos,
   capas — muitas vezes reescrevendo URLs de imagem para passar por
   `/api/proxy-image?url=...`, ver capítulo 11) e gera HTML diretamente via template strings
   (não há motor de templates nem virtual DOM).

Este percurso — pedido → validação de ID → dispatch genérico → módulo plugável → resposta —
repete-se, com variações, para quase todas as features do projeto. A lição de arquitetura
principal é: **uma única rota genérica + um dispatcher validado** é mais fácil de manter
seguro do que dez rotas específicas, uma por source.

## Separação rotas vs. serviços (services)

Uma convenção consistente em todo o `server/`: **as rotas não têm lógica de negócio**.
Uma rota típica (`server/routes/library.js`) faz três coisas: obter dependências via
`require()`, instanciar um serviço com essas dependências injetadas, e mapear
`router.post('/api/algo', asyncHandler(async (req, res) => { res.json(await service.algo(req.body)) }))`.
Toda a lógica real vive em `server/modules/<dominio>/service.js`, exportado como uma
factory `createXService({ readStore, writeStore, ... })` que recebe as suas dependências
como parâmetros em vez de as importar diretamente.

Isto tem uma vantagem concreta e verificável neste projeto: os testes de unidade em
`tests/unit/` conseguem instanciar um serviço com um `readStore`/`writeStore` falso (um
objeto em memória), sem precisar de um servidor Express a correr nem de um `store.json`
real em disco. Ver capítulo 14 para exemplos reais deste padrão a apanhar bugs.

## O único ponto de estado partilhado: `server/store.js`

Ao contrário da injeção de dependências "pura" (onde cada módulo recebe as suas
dependências de fora, sem saber de onde vêm), o acesso ao store faz-se sempre da mesma
forma, em qualquer rota: `const { readStore, writeStore } = require('../store');` no topo
do ficheiro de rota, seguido de passar essas duas funções para a factory do serviço. Por
trás, `server/store.js` é um singleton (`class StorageService`, uma única instância
`module.exports`) — todas as rotas partilham a mesma cópia em memória do store, o que é o
que torna o padrão de leitura-modificação-escrita seguro dentro de um único processo Node
(ver capítulo 3 para o mecanismo de escrita em si).
