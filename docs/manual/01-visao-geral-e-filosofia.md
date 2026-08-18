# 1. Visão geral e filosofia do projeto

## O que é o ScrollScape

O ScrollScape é uma aplicação web self-hosted (corre na máquina do próprio utilizador,
não num serviço de terceiros) que funciona como leitor e gestor de biblioteca para manga,
comics ocidentais, webtoons e light novels. Tecnicamente é:

- Um **servidor Node.js/Express** que serve uma API REST e ficheiros estáticos.
- Um **frontend em JavaScript vanilla**, sem framework (nada de React/Vue/Angular) e sem
  build step (nada de Webpack/Vite) — os ficheiros em `public/` são servidos exatamente
  como estão escritos.
- Um **armazenamento em ficheiro único** (`data/store.json`) em vez de uma base de dados
  — não há PostgreSQL, MongoDB, SQLite, nada. Um objeto JSON, lido para memória e escrito
  de volta para disco de forma atómica e com debounce.
- Um **sistema de "sources"** — módulos `.js` plugáveis, cada um implementando um scraper
  para um site específico (MangaDex, MangaPill, AllManga, BatCave, etc.), todos a
  implementar o mesmo contrato de quatro funções (`search`, `mangaDetails`, `chapters`,
  `pages`).
- Um mecanismo de **empacotamento standalone** via `pkg`, que transforma tudo isto num
  executável único (`.exe` no Windows) que o utilizador pode correr com um duplo-clique,
  sem instalar Node.js.

## Porque estas escolhas (e não outras)

### Sem base de dados

Um leitor de manga pessoal, para um único utilizador (ou uma família), não tem volume de
dados que justifique uma base de dados relacional. Um `store.json` real desta instalação
tem **555 KB** para 255 mangas na biblioteca, 257 entradas de estado de leitura, 32 no
histórico e 29 conquistas desbloqueadas — perfeitamente confortável para ler/escrever como
um único blob JSON em memória. A vantagem prática desta escolha:

- **Backup trivial**: uma cópia do ficheiro é o backup completo (ver capítulo 10, secção
  "Backup").
- **Zero configuração**: não há servidor de base de dados a instalar/configurar/atualizar
  separadamente.
- **Debugging trivial**: abrir o ficheiro num editor de texto mostra literalmente todo o
  estado da aplicação.

O custo desta escolha — e é importante entendê-lo antes de copiar o padrão — é que
**todas as escritas competem pelo mesmo ficheiro**. O ScrollScape resolve isto com um
padrão de leitura-modificação-escrita em memória com debounce de 300ms (capítulo 3), o
que é seguro para um processo Node.js único (sem concorrência real, só a fila de eventos),
mas **não escalaria** para múltiplos processos/utilizadores a escrever em simultâneo sem
um mecanismo de lock adicional.

### Sem build step no frontend

O frontend inteiro é ~51 ficheiros `.js` carregados via `<script src="..." defer>` no
`index.html`, na ordem exata em que são precisos (capítulo 12). Não há JSX, não há
TypeScript, não há bundling. A motivação é a mesma do parágrafo anterior: **simplicidade
de manutenção e de deployment** para um projeto self-hosted de utilizador único, onde
"correr `npm run build` antes de cada deploy" seria fricção sem benefício real — não há
milhares de utilizadores a justificar a otimização de bundle size, tree-shaking, ou
code-splitting.

O custo aqui é a **disciplina manual**: a ordem dos `<script>` no HTML tem de respeitar
as dependências entre ficheiros (um módulo que usa `state.favorites` tem de carregar
depois de `state.js` definir esse objeto), e não há isolamento de escopo automático — é
tudo global (`window`), com colisões de nomes evitadas por convenção, não por design da
linguagem (ver capítulo 12).

### Sources como plugins, não como código fixo

Em vez de hardcodar suporte a "MangaDex" e "MangaPill" dentro da lógica principal da
aplicação, o ScrollScape define um **contrato mínimo** que qualquer ficheiro `.js` dentro
de `data/sources/` tem de implementar — e a aplicação nunca precisa saber, à priori, quais
sources existem. Isto significa:

- Adicionar suporte a um site novo = escrever um ficheiro novo que implementa 4 funções,
  sem tocar em mais nada.
- O utilizador pode instalar/desinstalar sources em runtime (copiar/remover um ficheiro),
  sem reiniciar o servidor no caso comum.
- Sources com comportamento problemático (ex. um site protegido por Cloudflare que exige
  FlareSolverr) ficam isolados — um site em baixo não deve afetar os outros.

Este é provavelmente o design mais importante a copiar se estiveres a construir algo
parecido: **definir o contrato antes de implementar o primeiro plugin**, e mantê-lo o mais
pequeno possível (4 funções obrigatórias — ver capítulo 4).

## O que NÃO é o ScrollScape

Para evitar mal-entendidos ao ler os capítulos seguintes:

- **Não é multi-utilizador** no sentido de um SaaS — o `auth-gate` (capítulo 11) é uma
  simples password opcional para proteger o acesso à instância, não um sistema de contas
  com permissões diferenciadas.
- **Não faz scraping "ao vivo" sem cache** — usa caches em disco/memória com TTL em vários
  pontos (ComicVine, LeagueOfComicGeeks, calendário, sessões de domínio do FlareSolverr)
  precisamente para não martelar sites externos a cada pedido.
- **Não reimplementa um leitor de PDF/EPUB do zero** — usa bibliotecas de terceiros
  (`pdf.js`, `epub.js`, `JSZip`) carregadas via CDN no `<head>` do `index.html`, e a lógica
  própria do ScrollScape foca-se em integrá-las com o resto da biblioteca (progresso,
  capas, bookmarks) — ver capítulo 7.
