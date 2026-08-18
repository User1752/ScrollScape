# 11. Segurança

O ScrollScape faz scraping de sites externos e permite ao utilizador colar URLs de imagens
arbitrárias — duas capacidades que, sem cuidado, abririam a porta a SSRF (Server-Side
Request Forgery: o servidor a fazer pedidos, em nome de um atacante, a destinos que o
atacante escolhe — incluindo a própria rede interna onde o servidor corre). Este capítulo
documenta as defesas reais implementadas, e porquê cada uma existe.

## `isSafeUrl()` — a defesa central contra SSRF

Usada em **todos** os pontos onde uma URL fornecida por uma fonte não totalmente confiável
(um site scraped, um valor colado pelo utilizador) é usada para fazer um pedido HTTP do
lado do servidor:

```js
const PRIVATE_IP_RE =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1$|fc00:|fe80:)/i;

function isSafeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.replace(/\[|\]/g, '');
    return !PRIVATE_IP_RE.test(host) && host !== 'localhost';
  } catch {
    return false;
  }
}
```

Três verificações em sequência: (1) o URL tem de ser sintaticamente válido — um valor
malformado nunca chega a ser avaliado, cai direto no `catch`; (2) só protocolos `http`/
`https` são aceites — bloqueia `file://`, `ftp://`, e crucialmente
`gopher://`/`dict://`/outros protocolos historicamente usados em ataques SSRF criativos
contra serviços internos; (3) o hostname não pode corresponder a nenhum intervalo de IP
privado/loopback/link-local conhecido, nem à string literal `localhost`.

Esta função é chamada antes de **qualquer** `fetch()` a um destino não fixo no código —
`fetchJson`/`fetchText` (capítulo 4), `fetchProxyImage` (secção seguinte), e a validação de
capas personalizadas (`isAllowedCoverUrl`, capítulo 5). É, na prática, o único portão que
impede um utilizador (ou um site malicioso cujo HTML é parseado por um source) de fazer o
servidor do ScrollScape emitir um pedido para `http://192.168.1.1/admin` ou
`http://localhost:6379` (um Redis local, por exemplo) escondido dentro de um campo de
"URL da imagem".

**Limitação conhecida e aceite**: esta verificação é feita sobre o **hostname literal** do
URL, não sobre o IP real depois de resolução DNS. Um domínio que resolva para um IP privado
(um ataque de "DNS rebinding") passaria esta verificação. Para o contexto de uma app
self-hosted de utilizador único (não uma exposta publicamente a tráfego arbitrário e não
confiável), este é um risco residual aceite, não resolvido — vale a pena que fique
explícito, em vez de dar a entender que `isSafeUrl()` é uma defesa SSRF completa em
qualquer contexto.

## `/api/proxy-image` — nunca expor URLs remotas diretamente ao browser

Sempre que o resultado de um source contém uma imagem (capa, página de capítulo), a URL
final entregue ao frontend é reescrita para `/api/proxy-image?url=<encoded>` em vez do URL
remoto original. Duas razões:

1. **Esconder o servidor de origem do próprio browser do utilizador** — muitos sites que
   servem imagens de manga exigem um cabeçalho `Referer` específico (o próprio domínio de
   origem) para aceitar o pedido; um `<img src="https://site-externo.com/pagina.jpg">`
   direto, feito pelo browser do utilizador, nunca enviaria esse `Referer`, e a imagem
   simplesmente não carregaria. Ao passar pelo servidor, este pode definir o `Referer`
   correto no pedido que faz em nome do browser.
2. **Validação centralizada do conteúdo devolvido** — `fetchProxyImage()`
   (`server/modules/proxy/service.js`) não confia ciegamente no `Content-Type` que o
   servidor remoto declara. Se um pedido a uma imagem for redirecionado (ex. um caminho
   expirado que devolve a homepage do site em HTML, mas com status 200), o proxy deteta
   isto e rejeita com HTTP 415 em vez de servir uma página HTML disfarçada de imagem ao
   browser do utilizador. Quando o servidor remoto não declara `Content-Type` nenhum
   (comum em alguns CDNs, sem ser malicioso), o proxy faz "sniffing" dos primeiros bytes
   (assinaturas de ficheiro conhecidas: JPEG `FFD8FF`, PNG, GIF, WebP) em vez de assumir o
   melhor ou o pior.

## Sanitização de identidade: `safeId()` vs. IDs opacos

`safeId()` (`^[a-z0-9_-]{1,80}$/i`) é aplicado ao **nome do source** (ex. `mangapill`,
`allmanga`) em todos os pontos onde chega de um parâmetro de rota — porque nomes de source
são, por design, slugs simples escolhidos pelo próprio ScrollScape (o nome do ficheiro em
`data/sources/`). **Não é** (nem pode ser, sem quebrar sources legítimos) aplicado a
`mangaId`/`chapterId`, que são strings opacas definidas por cada site externo e já
confirmadas, em produção, a conter barras (`"8/kingdom"`) e outros caracteres que uma regex
de slug rejeitaria. A regra prática seguida no projeto: **um identificador que o ScrollScape
escolhe** (nome de source, ID de lista) pode e deve ser validado contra uma whitelist
rígida de caracteres; **um identificador que um terceiro escolhe** (ID de manga de um
site) deve ser tratado como dado opaco — nunca interpretado como caminho de ficheiro ou
comando, mas também nunca rejeitado por "ter caracteres estranhos", porque estranhos é
precisamente o que é esperado.

## Content-Security-Policy: um caso real de "cada diretiva é independente"

`server/middleware/security.js` define a CSP da aplicação. Uma lição real, encontrada
durante o desenvolvimento: o leitor de EPUB precisa de `blob:` em **três** diretivas CSP
diferentes, para três sub-funcionalidades distintas — e ter `blob:` numa não implica tê-lo
noutra:

- `worker-src blob:` — necessário para o worker do `pdf.js` (o PDF.js corre a
  descompressão/parsing num Web Worker carregado a partir de um `blob:` URL gerado em
  runtime).
- `frame-src blob:` — necessário para os `<iframe>` internos que o `epub.js` usa para
  renderizar cada página do livro.
- `connect-src blob:` — necessário para o próprio `epub.js`/`JSZip` conseguirem fazer
  `fetch()` a `blob:` URLs internas (por exemplo, ao extrair a imagem de capa de dentro do
  ficheiro EPUB comprimido).

A ausência só da terceira diretiva produzia um bug silencioso e confuso: a capa do EPUB
simplesmente nunca aparecia, sem qualquer erro visível no ecrã — só na consola do browser,
como uma violação de CSP bloqueada. **Lição geral**: ao depurar "uma funcionalidade que usa
`blob:` não funciona" depois de já teres `blob:` na CSP, confirma explicitamente **em qual
diretiva** — não assumas que uma cobre as outras, porque cada diretiva CSP controla um tipo
de recurso completamente independente (workers, frames, conexões de rede, scripts,
imagens, etc.), mesmo partilhando o mesmo esquema de URL.

## Auth-gate: password opcional para proteger a instância

`server/middleware/auth-gate.js` implementa uma proteção simples e opcional — se o
utilizador configurar uma password, todos os pedidos exigem uma sessão autenticada
(cookie), exceto uma lista de rotas explicitamente isentas (login, health-check estático).
Não é um sistema de contas com múltiplos utilizadores/permissões — é uma única password
partilhada para toda a instância, adequada ao caso de uso (proteger o acesso à instância
self-hosted de quem não deveria tê-lo, não segregar dados entre utilizadores diferentes).

Uma armadilha real ao implementar isto: verificar se uma rota está na lista de isenção
comparando o `req.path` **depois** do Express já ter removido o prefixo de montagem do
router (`app.use('/api', router)` faz com que, dentro desse router, `req.path` já não
inclua `/api`). Uma lista de isenções escrita a pensar no caminho completo original
(`/api/auth/login`) nunca corresponde ao `req.path` real visto dentro desse middleware
(`/auth/login`), e a rota "isenta" acaba, na prática, também bloqueada — o inverso do
comportamento pretendido, e um erro fácil de não notar em testes manuais rápidos porque o
sintoma (bloqueado quando devia estar livre) só aparece precisamente no fluxo de login, que
é o primeiro sítio onde se testaria a funcionalidade — por isso vale a pena testar
explicitamente o caminho *dentro* do middleware, não assumir que é igual ao caminho
completo do pedido original.
