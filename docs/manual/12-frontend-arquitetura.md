# 12. Arquitetura do frontend (vanilla JS, sem build step)

## Carregamento: `<script defer>`, sem módulos ES, sem bundler

`public/index.html` tem cerca de 62 tags `<script src="..." defer>` — nenhuma com
`type="module"`. Não há `import`/`export` em lado nenhum do frontend; tudo cai no escopo
global (`window`). A ordem das tags está deliberadamente organizada por dependência, com um
comentário explícito no próprio HTML a documentar isto:

```html
<!-- ScrollScape modules — loaded in dependency order, all before app.js -->
<script src="./modules/debug.js" defer></script>
<script src="./modules/api.js" defer></script>
<script src="./modules/i18n/locales/en-GB.js" defer></script>
<script src="./modules/i18n/locales/pt-PT.js" defer></script>
<script src="./modules/i18n/index.js" defer></script>
<script src="./modules/state.js?v=1" defer></script>
<script src="./modules/navigation.js" defer></script>
<script src="./modules/router.js" defer></script>
<script src="./modules/utils.js?v=4" defer></script>
<script src="./modules/anilist.js?v=8" defer></script>
<!-- ... ~40 módulos ui-*.js depois destes ... -->
```

e, no final:

```html
<script src="./modules/ui-ui-binding.js?v=10" defer></script>
<script src="./modules/ui-auth-gate.js?v=1" defer></script>
<script src="./modules/ui-initialization.js" defer></script>
<script src="./app.js?v=5" defer></script>
```

Porque isto funciona sem um bundler: `defer` garante que os scripts **executam pela ordem
em que aparecem no documento**, mesmo que sejam descarregados em paralelo — ao contrário de
`async`, onde a ordem de execução seguiria a ordem de conclusão do download, não a ordem no
HTML. É precisamente esta garantia de ordem que torna seguro um módulo mais tarde na lista
(ex. `ui-search.js`) referenciar `state.favorites`, sabendo que `state.js` já correu e
definiu esse objeto.

Um detalhe curioso: `ui-initialization.js` (penúltimo) é onde a verdadeira função de
arranque (`main()`, uma IIFE assíncrona) corre. `app.js` (o último, depois dele) hoje **não
tem lógica nenhuma** — é só um bloco de comentários, um vestígio do ponto de entrada
original do projeto, mantido no fim da lista como documentação viva de que "tudo o resto já
tem de estar carregado antes disto".

## O objeto `state`: global, mutável, sem reatividade

`public/modules/state.js` declara um único `const state = {...}`, com chaves como
`favorites`, `history`, `currentManga`, `settings`, `installedSources`, `readingStatus`,
`localManga`, entre várias outras. Não há Proxy, getters/setters, nem qualquer sistema de
pub/sub — qualquer módulo que precise de reagir a uma mudança de estado tem de chamar
explicitamente uma função de re-render (`renderLibrary()`, `renderHistoryView()`, etc.)
depois de mutar `state.*` diretamente. Isto é o oposto de frameworks reativos
(React/Vue/Svelte) onde mutar o estado dispara automaticamente uma nova renderização — aqui,
"esqueceste-te de chamar `renderX()` depois de mudar `state.y`" é uma classe de bug
inteiramente possível, e de facto uma das causas identificadas ao longo do
desenvolvimento deste projeto (dados desnormalizados em `history`/`readingStatus` que não
se atualizavam sozinhos — capítulos 5 e 7).

## `api()` — o único wrapper sobre `fetch`

```js
async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}
```

Três decisões relevantes aqui: (1) o corpo da resposta é lido sempre como texto primeiro,
nunca `res.json()` direto — porque um endpoint pode devolver um corpo vazio (204, ou um
erro sem corpo), e `res.json()` sobre uma string vazia lança uma excepção antes mesmo de
chegar à verificação de `res.ok`; (2) um JSON inválido é tolerado, devolvendo
`{ raw: text }` em vez de propagar o erro de parsing — útil para depurar respostas
inesperadas (ex. uma página de erro HTML devolvida por engano) sem a app rebentar; (3)
qualquer status não-2xx lança sempre um `Error`, com a mensagem tirada do campo `error` do
corpo JSON quando existe — centraliza em **um único sítio** a decisão de "o que conta como
falha", em vez de cada chamador ter de verificar `res.ok` manualmente.

## Um detalhe subtil: `const`/`let` de topo também são partilhados entre ficheiros

Vale a pena ser explícito sobre um comportamento do próprio JavaScript que este projeto usa
ativamente, e que é fácil de errar por intuição: mesmo sem `type="module"`, uma declaração
`const`/`let` (ou `class`) no **nível de topo** de um `<script>` classic fica visível, pelo
nome, em **qualquer** `<script>` classic carregado depois dele no mesmo documento — não só
`var` e `function`, que sempre se sabe que "vão para o `window`". Exemplo real: `ui-library.js`
usa diretamente `AL_BULK_STATUSES` (uma `const` declarada em `anilist.js`, capítulo 6) e
`DEFAULT_SETTINGS` (uma `const` declarada em `ui-settings.js`) é lida por nome a partir de
`ui-settings-modal.js` — nenhum dos dois ficheiros de origem faz `window.X = X` para os
expor; simplesmente funciona, porque `anilist.js`/`ui-settings.js` correm primeiro (ordem de
`<script defer>`, secção acima) e a declaração de topo fica no ambiente léxico global
partilhado por todos os scripts classic da página.

**Onde isto pode confundir**: `const`/`let` de topo **não** aparecem como propriedades de
`window` (`typeof window.AL_BULK_STATUSES` seria `undefined`, mesmo que
`typeof AL_BULK_STATUSES` seja `object`) — só `var` e declarações de função é que se tornam
propriedades explícitas do objeto global. Se fores depurar isto na consola do browser e
tentares `window.NomeDaConst`, vais concluir erradamente que "não existe", quando na
realidade existe e está perfeitamente acessível por outro ficheiro — só não por essa via de
acesso específica. Ao construir algo semelhante, esta é uma razão a mais para preferir
`const` a `var` no topo dos teus ficheiros: continuas a ganhar partilha entre scripts sem
sujar explicitamente o objeto `window` com cada constante interna.

## Prova real: dividir um ficheiro gigante sem quebrar nada

Esta garantia de escopo partilhado não é só teoria — foi usada deliberadamente para
dividir dois dos ficheiros mais problemáticos do projeto, sem tocar em nenhum ponto de
chamada existente. `ui-library.js` tinha 2378 linhas misturando pelo menos quatro
responsabilidades (miniaturas em "lombada de livro", o menu de contexto do botão direito,
lógica de ordenação, e a função `renderLibrary()` de 872 linhas que constrói a grelha em
si); `ui-settings-modal.js` era **uma única função de 1578 linhas**, `showSettings()`.

A divisão seguiu uma regra simples, derivada diretamente do comportamento descrito acima:
qualquer `function` de topo pode mudar de ficheiro livremente, porque só é *chamada* em
tempo de execução (depois de todos os `<script defer>` já terem corrido) — nunca é preciso
mexer no ponto de chamada original. `ui-library.js` ficou com ~1530 linhas depois de
extrair `ui-library-spines.js` (miniaturas + seletor de lombada) e
`ui-library-context-menu.js` (o menu de contexto); `ui-settings-modal.js` ficou com ~960
linhas depois de extrair a sua própria template `innerHTML` (615 linhas, uma função pura de
`state`/`t()`, sem nenhuma closure sobre a `modal` ou outras variáveis locais de
`showSettings()`) para `ui-settings-modal-html.js`. Em nenhum dos dois casos foi preciso
alterar `renderLibrary()` ou o corpo de `showSettings()` que ficou para trás — só adicionar
as novas tags `<script>` antes do ficheiro original em `index.html`.

**O que tornou isto seguro de verificar sem abrir um browser**: confirmar, por grep, que
toda declaração de topo do ficheiro original existe exatamente uma vez na soma dos
ficheiros novos (zero perdida, zero duplicada), e que cada identificador externo que um
ficheiro novo referencia resolve para uma definição real nalgum `.js` já carregado — o
resto é uma garantia da própria linguagem, não algo que precise de ser testado caso a caso.

## Convenção de nomes: `ui-<funcionalidade>.js`

A grande maioria dos ~50 ficheiros em `public/modules/` segue o padrão `ui-*.js`, um
ficheiro por ecrã/funcionalidade — `ui-library.js`, `ui-history.js`, `ui-settings-modal.js`,
`ui-epub-reader.js`, etc. Os nomes são deliberadamente descritivos e por vezes bastante
longos (ex. um ficheiro dedicado ao motor de "flip" 3D de página para leitura da direita
para a esquerda tem um nome que descreve exatamente isso) — a filosofia aqui é que, sem um
sistema de módulos real a impor limites de import/export, um nome de ficheiro longo e
específico é a única "documentação de fronteira" disponível: só de olhar para a lista de
ficheiros, sem abrir nenhum, já é possível adivinhar o que cada um faz.

Fora desta convenção: ficheiros de infraestrutura carregados primeiro (`state.js`,
`api.js`, `utils.js`, `router.js`, `navigation.js` — este último é a única classe ES6 do
projeto, `class NavigationManager`, implementando uma pilha de histórico de navegação ao
estilo browser), e alguns utilitários fora de `modules/` (`customSelect.js`,
`themes.js`, `achievement-manager.js`).

## Isolamento de escopo: convenção, não imposição da linguagem

Só um punhado de ficheiros (`ui-initialization.js`, `ui-scroll-to-top.js`,
`ui-reader-noise.js`, entre poucos outros) usa uma IIFE (`(function(){ 'use strict'; ...
})()`) para isolar o seu escopo. O resto declara `function`/`const`/`let` diretamente no
nível de topo do ficheiro — tudo cai como propriedade implícita do objeto global. A
prevenção de colisões de nomes entre ~51 ficheiros depende inteiramente de:

1. **Nomes de função verbosos e específicos por feature** (`_epubBookmarksStore` em vez de
   `store`, `_bookFlipAnimating` em vez de `animating`) — o prefixo `_` é usado como
   convenção informal de "privado a este ficheiro", sem qualquer imposição real da
   linguagem.
2. **Atribuição explícita a `window.*`** quando uma função precisa de ser chamada de fora
   do seu próprio ficheiro — por exemplo, a partir de um atributo `onclick=""` inline no
   HTML gerado dinamicamente:
   ```js
   window.saveSettings = saveSettings;
   window.openMangaCoverPicker = openMangaCoverPicker;
   ```
   Há pelo menos 15 ficheiros com este padrão.

O risco prático desta abordagem, a ter em mente ao construir algo parecido: renomear uma
função global sem procurar (grep) por todas as referências no projeto inteiro quebra
silenciosamente qualquer outro ficheiro que a chame — não há um compilador ou um sistema
de módulos a apanhar isto em tempo de build, porque não existe build. A disciplina de
"antes de renomear algo global, grep no projeto todo" substitui aqui o que um sistema de
tipos ou um linter de imports faria automaticamente noutra arquitetura.

## Sem bundler — mesmo no executável empacotado

Vale sublinhar que a ausência de build step é real mesmo quando o projeto é empacotado
como executável standalone (capítulo 13): a ferramenta usada (`pkg`) empacota o
**servidor Node** e os ficheiros de `public/` como *assets estáticos servidos como estão*
— não faz nenhuma transformação, minificação ou bundling do JavaScript do frontend. Os
ficheiros em `public/modules/` chegam ao browser do utilizador final exatamente como foram
escritos pelo programador, com os mesmos ~59 `<script>` tags.
