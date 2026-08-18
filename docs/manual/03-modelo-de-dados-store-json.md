# 3. O modelo de dados: `store.json`

## Visão geral

Todo o estado persistente e partilhado da aplicação (biblioteca, progresso de leitura,
listas, conquistas, configurações...) vive num único objeto JSON, guardado em
`data/store.json`. Não há schema formal (nada de JSON Schema, Zod, etc.) — a "validação"
é feita de forma defensiva, função a função, sempre que o store é lido.

Uma instalação real em uso tem **555 KB** e as seguintes chaves de topo:

```
repos, installedSources, history, readingStatus, reviews, customLists,
analytics, achievements, favorites, anilistSync, coverOverrides, settings,
ap, purchasedThemes, activeTheme, mangaTags
```

Com, por exemplo: 255 entradas em `favorites`, 257 em `readingStatus`, 32 em `history`,
3 `customLists`, 29 `achievements` desbloqueados, 10 `installedSources`,
`analytics.totalChaptersRead = 556`.

## `normaliseStore()` — a única forma de "validação de schema"

`server/modules/store/schema.js` exporta `normaliseStore(store)`, chamada sempre que o
store é lido do disco (`readStore()`) ou inicializado. É uma função síncrona que modifica
o objeto **in-place**, e a estratégia é sempre a mesma para cada campo: "se não existir ou
não tiver o tipo esperado, cria um valor default vazio":

```js
store.mangaTags = (store.mangaTags && typeof store.mangaTags === 'object') ? store.mangaTags : {};
store.achievements = Array.isArray(store.achievements) ? store.achievements : [];
store.ap = store.ap && typeof store.ap === 'object' ? store.ap : {};
```

Isto substitui completamente qualquer sistema formal de "migrations" — não há versão de
schema, não há histórico de migrações aplicadas. Um `store.json` antigo, de uma versão
anterior do projeto sem o campo `achievements`, ganha esse campo vazio na primeira leitura
depois do upgrade, sem qualquer passo manual. O backfill mais elaborado que existe hoje é o
de `analytics.dailyChapterCounts` — reconstruído a partir de `readingSessions` já
existentes, para popular o heatmap de atividade em instalações que nunca tiveram esse
campo.

**Armadilha real encontrada neste projeto**: `coverOverrides` (o dicionário de capas
personalizadas — ver capítulo 5) existe e é usado ativamente por vários módulos, mas
**não é normalizado em `schema.js`**. Cada módulo que o usa faz a sua própria verificação
defensiva (`store.coverOverrides || {}`) no ponto de uso, em vez de confiar que já existe.
Funciona, mas é inconsistente com o resto do ficheiro — uma lição prática: se adicionares
um campo novo ao store, adiciona-o também a `normaliseStore()`, mesmo que "funcione sem
isso" no imediato.

## Persistência: debounce + escrita atómica

`server/modules/store/persistence.js` exporta `createStorePersistence({ fs, fsp, delayMs = 300 })`.
Há dois caminhos de escrita:

**Caminho normal (assíncrono, com debounce de 300ms)** — chamado sempre que uma rota faz
`await writeStore(store)`. Em vez de escrever imediatamente, `queueDebouncedFlush()` cancela
qualquer `setTimeout` pendente e agenda um novo. Se dez pedidos chegarem em rajada
(ex. um import de 251 mangas do AniList, um por um), só a última escrita depois de 300ms de
silêncio é que efetivamente toca o disco — as escritas intermédias ficam só em memória.

**Caminho de shutdown (síncrono, sem debounce)** — `flushStoreSync()`, chamado pelos
handlers de `SIGINT`/`SIGTERM`. Regista-se assim, dentro do próprio `server/store.js`
(não em `server.js`), no momento em que o módulo é `require`ado por qualquer rota:

```js
process.on('SIGINT', storageService.handleTermination);
process.on('SIGTERM', storageService.handleTermination);
```

Isto significa que fechar o processo com `Ctrl+C` ou um `kill` normal **força um flush
síncrono imediato**, mesmo que o debounce de 300ms ainda não tenha disparado — sem isto,
um shutdown na janela desses 300ms perderia a última escrita silenciosamente.

Ambos os caminhos escrevem de forma **atómica**, via ficheiro temporário + rename:

```js
const tmpPath = `${storePath}.tmp`;
await fsp.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
await fsp.rename(tmpPath, storePath);
```

Porque isto importa: `fs.rename` (ou `fsp.rename`) é atómico ao nível do sistema de
ficheiros na maioria dos casos — nunca existe um momento em que `store.json` está
parcialmente escrito no disco. Escrever diretamente para `store.json` sem o ficheiro
temporário arriscaria corrupção total do ficheiro se o processo morresse a meio da escrita
(ex. quedas de energia, `kill -9`).

Há ainda um terceiro método, `flushNow()`, usado deliberadamente fora do fluxo normal —
por exemplo, o import de backup (capítulo 10) chama-o explicitamente depois de escrever,
para garantir que o utilizador vê o resultado imediatamente em vez de esperar o debounce.

## Como outros módulos acedem ao store

`server/store.js` expõe um singleton — uma única instância de `StorageService` por
processo, com `readStore`/`writeStore` pré-associados (`.bind()`) e exportados como
funções soltas:

```js
module.exports = {
  readStore: storageService.readStore.bind(storageService),
  writeStore: storageService.writeStore.bind(storageService),
  ...
};
```

Cada ficheiro de rota faz `require('../store')` diretamente (confirmado em 18+ ficheiros
de rota) e passa essas duas funções como dependências para a factory do serviço
correspondente:

```js
// server/routes/library.js
const { readStore, writeStore } = require('../store');
const libraryService = createLibraryService({ readStore, writeStore, safeManga, isSafeUrl, ... });
```

Isto é um padrão híbrido: o `require('../store')` em si não é "injeção de dependências"
pura (é um singleton importado diretamente), mas o passo seguinte — passar essas funções
como parâmetros para `createLibraryService` em vez de a própria service fazer
`require('../store')` a si mesma — é o que torna os serviços testáveis com um store falso
em memória (ver capítulo 14).

## O padrão de "sidecar dict"

Um padrão que se repete em várias features (capas personalizadas, tags, e outros): em vez
de guardar um campo extra diretamente num objeto `favorite`, guarda-se num dicionário
**separado**, com uma chave composta `"mangaId:sourceId"`:

```js
function sanitizeCompositePart(v) {
  return String(v || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);
}
function coverOverrideKey(mangaId, sourceId) {
  return `${sanitizeCompositePart(mangaId)}:${sanitizeCompositePart(sourceId || 'unknown')}`;
}
```

**Porque não guardar direto no objeto favorito?** Porque `safeManga()` (a função que
sanitiza qualquer objeto manga antes de o guardar) usa uma allow-list fixa de campos
(`id, title, cover, author, description, status, url, genres, type`). Qualquer campo fora
desta lista é silenciosamente descartado **sempre que um favorito é reconstruído** — e
isso acontece com frequência (ao adicionar aos favoritos, ao migrar de source, ao importar
do AniList, todos fazem `{...safeManga(x), ...outrosCampos}`). Um campo customizado
guardado diretamente no objeto sobreviveria só até à próxima operação que passasse por
`safeManga()`.

A solução — um dicionário sidecar, indexado pela mesma chave composta `mangaId:sourceId`
usada em `readingStatus` — sobrevive a qualquer reconstrução do objeto favorito, porque
vive fisicamente fora dele. `mangaTags` e `coverOverrides` usam exatamente este padrão;
`readingStatus` já o usava desde o início, e serviu de modelo.

## Não há base de dados nenhuma

Vale a pena ser explícito: procurando no `package.json` por dependências de base de dados
(`sqlite3`, `mongoose`, `pg`, `sequelize`), não há nenhuma. As únicas dependências
relevantes para persistência são as nativas do Node (`fs`). O único outro armazenamento
persistente no projeto é `data/local/` — mas esse é **completamente separado** de
`store.json`: cada manga importado localmente (EPUB/PDF/CBZ) ganha a sua própria pasta
(`data/local/local-<hash>/`) com um `meta.json` próprio e os ficheiros de média. O
`store.json` só referencia esses itens indiretamente (ex. uma entrada em `coverOverrides`
com `sourceId: 'local'`) — os metadados completos vivem no `meta.json` da pasta, não no
store central. Ver capítulo 7 para os detalhes deste segundo armazenamento.
