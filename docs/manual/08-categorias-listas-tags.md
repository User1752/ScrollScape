# 8. Categorias, listas inteligentes e tags

## Listas customizadas: manuais vs. "inteligentes"

`server/modules/lists/service.js` guarda `store.customLists`, um array de
`{ id, name, description, mangaItems, isDynamic, filterQuery, createdAt }`. Há dois modos:

- **Lista manual** (`isDynamic: false`) — `mangaItems` é uma lista explícita de
  referências a manga, mantida por `addMangaToList`/`removeMangaFromList`.
- **Lista inteligente / dinâmica** (`isDynamic: true`) — em vez de uma lista de membros
  fixa, guarda uma `filterQuery` — um objeto plano `{ status, sourceId, genre, ratingMin }`,
  **sem linguagem de queries aninhada**. A pertença de um manga a esta lista não é guardada
  em lado nenhum; é **calculada no momento**, no cliente, comparando cada favorito contra
  este filtro sempre que a lista é renderizada (`ui-library.js`).

A escolha de manter `filterQuery` como um objeto plano e achatado (em vez de, por exemplo,
uma árvore de condições AND/OR) é deliberada — o comentário no código explica que assim a
lista "sobrevive à exportação/importação do backup sem qualquer plumbing extra": um objeto
plano serializa e desserializa em JSON sem qualquer lógica especial, ao contrário de uma
árvore de condições que precisaria da sua própria validação de estrutura ao reimportar.

**Armadilha real**: alternar `isDynamic` para `true` numa lista existente **apaga
silenciosamente `mangaItems`** — não há aviso, porque do ponto de vista do modelo de dados
os dois modos são mutuamente exclusivos (uma lista dinâmica não tem membros próprios, só
tem filtro). Se estiveres a construir algo parecido, vale a pena decidir explicitamente se
uma transição de "manual" para "dinâmica" deve ser silenciosa (como aqui) ou pedir
confirmação ao utilizador, já que é uma perda de dados irreversível do ponto de vista do
utilizador, mesmo sendo "consistente" do ponto de vista do modelo.

Um segundo detalhe: o ID de lista `'manga-categories'` é uma string mágica reservada,
usada como um identificador de rota, não uma lista real — `updateList()` rejeita
explicitamente qualquer tentativa de a tratar como uma lista normal. Strings mágicas deste
tipo são um sinal de que, em retrospetiva, um namespace separado (ex. um prefixo
`__system_` nos IDs reservados) teria evitado a necessidade desta verificação especial —
mas funciona, e é um exemplo real de uma decisão pragmática tomada sob a pressão de manter
a mesma rota/estrutura de dados para dois conceitos ligeiramente diferentes.

## Tags: outro sidecar dict, com namespace

`mangaTags` segue exatamente o mesmo padrão de `coverOverrides` (capítulo 3) — chave
composta `"mangaId:sourceId"`, valor um array de strings. A convenção de conteúdo usada
para as próprias tags é "namespaced": `"artist:oda"`, `"genre:shounen"`, em vez de tags
livres sem estrutura — isto permite à interface agrupar/filtrar por namespace (todas as
tags que começam por `artist:`) sem precisar de uma segunda estrutura de dados só para
categorizar as tags em si.

## Ações em lote e o "Find Dupes"

A funcionalidade de deteção de duplicados (`public/modules/ui-duplicates.js`) usa uma
função de pontuação de semelhança de títulos (`_titleSimilarity`) que combina:

1. Igualdade exata depois de normalizar (minúsculas, remover acentos/pontuação).
2. Uma string conter a outra por completo (substring) — pontuação alta mas não máxima.
3. Sobreposição de palavras (número de palavras em comum a dividir pelo maior dos dois
   conjuntos de palavras).

Esta MESMA função (com um limiar mais alto, 0.8 em vez de 0.6 — precisamente porque o merge
do AniList é automático, sem confirmação humana, e por isso precisa de mais confiança antes
de fundir dois registos) foi reaproveitada no capítulo 6 para a deduplicação do import do
AniList. **Lição de reutilização**: uma função de "semelhança de título" não é específica
de uma feature — é uma primitiva genérica útil em qualquer sítio onde dois textos
diferentes possam referir-se à mesma entidade (títulos com romanizações diferentes,
subtítulos incluídos ou não, pontuação diferente). Vale a pena isolá-la como uma função
independente desde o início, em vez de a reescrever cada vez que aparece uma necessidade
parecida — o ScrollScape acabou com duas cópias quase idênticas desta lógica (uma no
frontend para o "Find Dupes" manual, outra no backend para o merge automático do AniList)
precisamente porque nasceram em momentos diferentes do projeto.
