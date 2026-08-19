# 7. Importação de ficheiros locais (EPUB, PDF, CBZ/CBR)

## Um "source virtual", separado do store principal

Ficheiros importados manualmente (EPUB, PDF, CBZ, CBR, ZIP) não vivem no `store.json` —
vivem em `data/local/`, uma pasta por manga (`data/local/local-<hash>/`), cada uma com o
seu próprio `meta.json` e os ficheiros de média extraídos. Do ponto de vista do resto da
aplicação, este armazenamento comporta-se como **mais um source** — com `sourceId: 'local'`
— exposto através das mesmas rotas genéricas `/api/source/local/{search,mangaDetails,
chapters,pages}` que qualquer source real usa, mas implementado por
`server/modules/local/service.js` em vez de fazer scraping a um site externo.

`local/service.js` é hoje um orquestrador fino (~230 linhas) que compõe dois módulos
vizinhos com uma responsabilidade cada: `archive-import.js` (a extração de CBZ/CBR/PDF/EPUB
descrita a seguir) e `offline-downloads.js` (guardar capítulos descarregados de **outros**
sources para leitura offline, incluindo a fila de download em massa e o fallback
"synthetic" que `routes/sources.js`/`routes/opds.js` usam quando o source real de um manga
está inacessível mas existe uma cópia offline). `createLocalService(...)` continua a
devolver exatamente o mesmo objeto público de sempre — nenhum ponto de chamada mudou.

Esta escolha de design — tratar "os meus ficheiros importados" como só mais um source, em
vez de um conceito totalmente separado no frontend — poupa duplicação: o leitor, a
navegação entre capítulos, a lista de biblioteca, tudo o que já sabe lidar com "um manga
de um source" continua a funcionar sem alterações para ficheiros locais. O preço é que
qualquer feature que assuma implicitamente "todo manga tem um source real com API remota"
(como o sistema de capas personalizadas do capítulo 5) precisa de um caso especial
explícito para `sourceId === 'local'` — e esquecer esse caso especial é exatamente o que
causou o bug descrito a seguir.

## Geração de capa: PDF vs. EPUB

Nenhum destes dois formatos garante uma imagem de capa fácil de extrair sem processamento:

- **PDF**: não há conceito de "capa" nativo. A abordagem é renderizar a primeira página
  com `pdf.js` para um `<canvas>` e converter esse canvas para JPEG
  (`canvas.toBlob(resolve, 'image/jpeg', 0.88)`).
- **EPUB**: o formato pode declarar uma imagem de capa no seu manifesto OPF, acedida via
  `book.coverUrl()` da biblioteca `epub.js` — mas nem todo EPUB declara uma, e a promessa
  pode nunca resolver nem rejeitar se o livro estiver malformado, por isso é envolvida num
  `Promise.race` com um timeout de 8 segundos.

Em ambos os casos, o resultado (um `Blob`) é enviado para
`POST /api/local/:mangaId/cover`, que espera **bytes de imagem em bruto** — a rota usa
`express.raw({ type: 'image/*', limit: '5mb' })`, não JSON:

```js
router.post('/api/local/:mangaId/cover',
  requireValidIdParam('mangaId'),
  express.raw({ type: 'image/*', limit: '5mb' }),
  asyncHandler(async (req, res) => {
    res.json(await localService.updateLocalCover(req.params.mangaId, req.body));
  })
);
```

`updateLocalCover()` escreve os bytes para `cover.jpg` dentro da pasta do manga e atualiza
o campo `cover` no `meta.json` desse manga para `/local-media/<id>/cover.jpg`.

## O bug real: o sistema genérico de capas ignorava este caminho

O picker de "mudar capa" (capítulo 5) foi construído a pensar em favoritos ligados a um
source online — a função `persistMangaCover()` chamava sempre
`POST /api/library/cover`, que escreve num dicionário sidecar `coverOverrides` no
`store.json`. Para um manga local, isto tinha duas falhas sobrepostas:

1. `coverOverrides` é lido pelas rotas de biblioteca (`server/modules/library/`), mas a
   biblioteca de ficheiros locais é **servida por rotas completamente diferentes**
   (`server/modules/local/`) que nunca consultam `coverOverrides` — leem sempre
   `meta.json` diretamente. Escrever no dicionário sidecar não tinha efeito nenhum na
   forma como um manga local é realmente renderizado.
2. `isAllowedCoverUrl()` (a validação usada por essa rota) só aceita URLs públicas HTTP(S)
   ou já embrulhadas em `/api/proxy-image` — um caminho relativo como
   `/local-media/<id>/cover.jpg` (o formato real de uma capa local) nem passaria essa
   validação, mesmo que o resto do fluxo estivesse correto.

O resultado observável era exatamente "mudo a capa, parece funcionar por um instante, mas
ao recarregar volta sempre à capa extraída do ficheiro" — porque a única cópia de dados que
qualquer ecrã realmente lê (`meta.json`) nunca era tocada.

A correção teve de agir em dois níveis:

- **No cliente**: quando `sourceId === 'local'`, `persistMangaCover()` passa a fazer o
  download da imagem escolhida (via `fetch`, encaminhado por `/api/proxy-image` se for uma
  URL externa, para evitar problemas de CORS) e envia os bytes resultantes para
  `POST /api/local/:mangaId/cover` — o mesmo endpoint que a geração automática de capa já
  usava — em vez de `/api/library/cover`.
- **No servidor**: `updateLocalCover()` passou também a atualizar quaisquer entradas em
  `store.favorites`, `store.history` e `store.readingStatus` que referenciem este manga
  local (pela mesma razão do capítulo 5 — esses snapshots desnormalizados não se atualizam
  sozinhos), o que exigiu injetar `readStore`/`writeStore` no serviço local, que até então
  era puramente baseado em sistema de ficheiros, sem qualquer dependência do store
  principal.

**Lição geral**: sempre que um sistema tem dois "modos" de dados que parecem semelhantes à
superfície (aqui, "manga de um source online" vs. "manga importado localmente"), qualquer
feature nova construída a pensar só num dos modos tem de ser explicitamente testada contra
o outro antes de se assumir completa — a ausência de um erro não significa que funcionou;
pode simplesmente significar que a escrita foi para um sítio que nada lê.

## A armadilha do `blob:` URL com o epub.js

Um segundo bug real, anterior ao das capas, no mesmo subsistema: ao abrir um EPUB no
leitor, a implementação inicial criava uma `blob:` URL (`URL.createObjectURL(file)`) e
passava essa **string** para `ePub(url)`. O resultado era a aplicação ficar
indefinidamente presa em "Generating cover..." — sem erro, sem timeout, sem nada.

A causa: `epub.js`, quando recebe uma **string**, tenta adivinhar o tipo de input pela
extensão do ficheiro na própria string. Uma `blob:` URL não tem extensão
(`blob:http://host/<uuid>`) — o resultado é que a biblioteca a classifica como
`INPUT_TYPE.DIRECTORY` (um EPUB já descomprimido em disco) em vez de um ficheiro binário
único, e fica à espera de encontrar um `container.xml` que nunca vai existir, numa promessa
que nunca resolve nem rejeita.

A correção é passar `await file.arrayBuffer()` em vez da `blob:` URL — quando o input não é
uma string (`typeof input != "string"`), o epub.js segue o caminho `INPUT_TYPE.BINARY`,
correto para um ficheiro carregado diretamente. **Lição geral**: ao integrar uma biblioteca
de terceiros que aceita "um input polimórfico" (string, buffer, blob, etc.), vale a pena
ler a lógica de deteção de tipo dessa biblioteca antes de assumir que qualquer
representação do mesmo ficheiro é intercambiável — uma `blob:` URL e os bytes reais do
ficheiro representam o mesmo conteúdo para um humano, mas não para uma função que decide o
comportamento com base no formato textual da própria referência.

## Progresso de leitura em EPUB: paginação sem páginas fixas

Um EPUB não tem "páginas" no sentido de um PDF — o texto reflui de acordo com o tamanho do
ecrã/fonte. Para mostrar uma percentagem de progresso de leitura, `epub.js` precisa de
gerar "locations" (pontos de referência ao longo do texto) explicitamente:

```js
_epubBook.locations.generate(1024).then(() => _epubRendition?.reportLocation());
```

Isto corre em background, depois da renderização inicial, para não bloquear a abertura do
livro — gerar locations para um livro grande pode demorar alguns segundos, e não há razão
para o utilizador esperar por isso antes de começar a ler.
