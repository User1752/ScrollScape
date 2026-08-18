# 5. Biblioteca, favoritos e progresso de leitura

## Identidade de um manga: `id` + `sourceId`

Nenhum manga tem um identificador global único no ScrollScape. A identidade é sempre o
**par** `(mangaId, sourceId)` — o mesmo manga presente em dois sources diferentes (ex.
"One Piece" no MangaDex e no MangaPill) é tratado como duas entidades completamente
distintas, com progresso de leitura, capa e estado independentes, a menos que sejam
explicitamente fundidas (ver capítulo 6, sobre a deduplicação do import do AniList).

Esta chave composta aparece em toda a aplicação, sempre sanitizada da mesma forma:

```js
function sanitizeCompositePart(v) {
  return String(v || '').replace(/[^a-z0-9:_-]/gi, '_').slice(0, 300);
}
function safeStatusKey(mangaId, sourceId) {
  return `${sanitizeCompositePart(mangaId)}:${sanitizeCompositePart(sourceId || 'unknown')}`;
}
```

`readingStatus`, `coverOverrides` e `mangaTags` usam todos esta mesma função de chave.

## `favorites` vs. `history` vs. `readingStatus`

Três estruturas diferentes no store, com propósitos que se sobrepõem parcialmente e por
isso vale a pena distinguir com cuidado:

- **`favorites`** — a lista "biblioteca pessoal": mangas que o utilizador decidiu seguir.
  Cada entrada é um objeto manga sanitizado por `safeManga()` (campos: `id, title, cover,
  author, description, status, url, genres, type`), mais campos adicionados por cima
  (`sourceId`, `addedAt`, e por vezes `anilistId` — ver capítulo 6).
- **`history`** — um registo de "onde estive recentemente", usado para a secção "Continue
  Reading" da home page. Cada entrada é também um snapshot de manga, mas com `chapterId`,
  `chapterName` e `readAt`. **É um snapshot congelado no momento em que foi lido**, não uma
  referência viva ao favorito — se a capa do favorito mudar depois, a entrada do histórico
  não atualiza automaticamente a menos que algo a atualize explicitamente (uma armadilha
  real, documentada no capítulo 14).
- **`readingStatus`** — um dicionário `"mangaId:sourceId" → { status, updatedAt, manga }`,
  onde `status` é um de `reading|completed|on_hold|dropped|plan_to_read`. Também guarda um
  snapshot do manga (`manga: {...}`), pela mesma razão que `history` — para renderizar a
  biblioteca sem ter de voltar a pedir dados ao source.

A repetição do snapshot de manga em três sítios diferentes (`favorites`, `history.manga`,
`readingStatus[key].manga`) é uma escolha deliberada de **desnormalização** — o custo é
"quando algo muda (ex. a capa), tens de te lembrar de atualizar todos os sítios onde esse
manga aparece" (e o capítulo 14 documenta um caso real onde isto foi esquecido), mas o
benefício é que renderizar qualquer uma destas três vistas nunca precisa de um pedido de
rede adicional para "ir buscar os dados atuais do manga" — tudo o que é preciso já está no
próprio registo.

## `content-service.js` — o núcleo da biblioteca

`server/modules/library/content-service.js` centraliza as operações sobre favoritos:
adicionar/remover (`toggleFavorite`), mudar estado de leitura (`setUserStatus`), mudar capa
(`updateLibraryCover`), etc. Um padrão que se repete em quase todas estas funções: sempre
que um favorito é reescrito, aplica-se `applyCoverOverride()`:

```js
function applyCoverOverride(store, manga, sourceId) {
  const override = getCoverOverride(store, manga?.id, sourceId || manga?.sourceId);
  return override ? { ...manga, cover: override } : manga;
}
```

Isto garante que uma capa personalizada (guardada no dicionário sidecar `coverOverrides`
— capítulo 3) sobrevive a qualquer reconstrução do objeto favorito, sem ter de ser
"lembrada" manualmente em cada função que cria/atualiza um favorito.

## Mudar a capa de um manga: o cuidado com a origem da imagem

`updateLibraryCover()` só aceita URLs que passem `isAllowedCoverUrl()`:

```js
function isAllowedCoverUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return false;
  if (isSafeUrl(value)) return true;
  try {
    const u = new URL(value, 'http://localhost');
    if (u.pathname !== '/api/proxy-image') return false;
    const inner = u.searchParams.get('url');
    return !!inner && isSafeUrl(inner);
  } catch { return false; }
}
```

Ou seja: aceita uma URL pública HTTP(S) direta, **ou** uma URL já embrulhada em
`/api/proxy-image?url=...` cujo parâmetro interno também seja seguro. Uma URL relativa como
`/local-media/abc/cover.jpg` (o caminho de um manga importado localmente) **não passa** por
nenhum destes dois casos — e isto não é um acidente, é o sintoma de que os mangas
importados localmente (capítulo 7) **não vivem no mesmo sistema de capas** que os
favoritos ligados a um source online. Uma implementação nova deste tipo de sistema deve
decidir, desde o início, se quer um único mecanismo de "capa personalizada" para todos os
tipos de manga (online e local), ou dois mecanismos separados como o ScrollScape acabou por
ter (um baseado em URL para favoritos online, outro baseado em upload de bytes para
ficheiros locais, resolvido no capítulo 14 como uma lição aprendida).

## Migração entre sources

Quando um utilizador muda a fonte de um manga já na biblioteca (ex. "esta cópia no
MangaPill está parada, vou seguir a versão no MangaDex a partir daqui"), a operação de
migração tem de mover **três coisas em sincronia**: a entrada em `favorites`, o estado em
`readingStatus`, e os dicionários sidecar (`coverOverrides`, `mangaTags`). O padrão usado
(`server/modules/library/service.js`):

```js
if (store.coverOverrides?.[oldCompositeKey] && !store.coverOverrides[newKey]) {
  store.coverOverrides[newKey] = store.coverOverrides[oldCompositeKey];
}
if (store.coverOverrides) delete store.coverOverrides[oldCompositeKey];
```

— copia o valor para a chave nova só se ainda não existir lá nada (evita apagar uma capa
personalizada já definida para o destino), depois apaga a chave antiga. Este padrão
"copiar-se-vazio, depois apagar a origem" repete-se para cada dicionário sidecar que
existe — é o preço de ter vários dicionários independentes em vez de um único registo por
manga: cada operação que "move" um manga tem de saber explicitamente de todos eles.

## Ações em lote: um único mecanismo de seleção, reaproveitado por tudo

A biblioteca suporta selecionar vários mangas e aplicar a mesma ação a todos de uma vez
(remover, mudar estado de leitura, mudar categorias, mudar estado no AniList — capítulo 6).
Em vez de cada uma destas ações ter a sua própria lógica de "quais mangas estão
selecionados", existe **um único ponto de entrada** que todas partilham
(`public/modules/ui-library.js`):

```js
function _getLibraryActionTargets(clickedManga) {
  const clickedKey = _libMangaKey(clickedManga?.id, clickedManga?.sourceId);
  if (_librarySelectedKeys.size > 1 && _librarySelectedKeys.has(clickedKey)) {
    const selected = (state.favorites || []).filter(m => _librarySelectedKeys.has(_libMangaKey(m.id, m.sourceId)));
    if (selected.length) return selected;
  }
  return clickedManga ? [clickedManga] : [];
}
```

O gesto de seleção em si é `Ctrl + clique` num cartão (`_toggleLibraryCardSelection`, que
mantém um `Set` de chaves `"mangaId::sourceId"` selecionadas e alterna uma classe CSS de
destaque visual no cartão). Ao clicar com o botão direito para abrir o menu de contexto,
`_getLibraryActionTargets(manga)` decide sozinho se o clique foi sobre um cartão que faz
parte de uma seleção múltipla (devolve todos os selecionados) ou sobre um cartão isolado
(devolve só esse). Todas as ações do menu de contexto — remover da biblioteca, descarregar
capítulos, mudar categorias, mudar estado local, mudar estado no AniList — recebem sempre
o mesmo array `actionMangas`, e uma flag `isBulk = actionMangas.length > 1` que só serve
para ajustar o texto dos botões (`"Mark as Completed"` vs. `"Mark Selected as Completed
(3)"`) — a lógica de cada ação em si nunca precisa de saber se está a tratar 1 ou N itens,
porque itera sempre sobre `actionMangas`, mesmo quando esse array só tem um elemento.

**Lição de design**: quando uma aplicação vai ter várias ações que precisam de funcionar
tanto para "um item" como para "vários itens selecionados", vale a pena resolver a
pergunta "sobre quais itens estou a atuar?" **uma única vez**, num único sítio, e fazer
com que toda a lógica de ação a jusante trabalhe sempre sobre uma lista — mesmo no caso de
um único item. A alternativa (cada ação ter o seu próprio `if (isBulk) {...} else {...}`)
duplica a mesma decisão tantas vezes quantas as ações existirem, e cada nova ação bulk
adicionada arrisca esquecer-se de replicar a lógica corretamente.

**Uma limitação real e conhecida**: o gesto `Ctrl + clique` só existe no ramo de eventos de
rato do desktop — o equivalente em touch (pressão longa) abre sempre o menu de contexto de
um único item, sem qualquer forma de entrar em modo de seleção múltipla. Em ecrãs
touch/mobile, todas as ações em lote descritas aqui são, na prática, inacessíveis.
