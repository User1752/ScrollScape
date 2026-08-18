# 9. Integrações externas

## OPDS — expor a biblioteca a leitores de terceiros

OPDS (Open Publication Distribution System) é um formato de feed baseado em Atom/XML,
suportado por vários leitores de e-books/comics (ex. apps móveis dedicadas). O ScrollScape
expõe a biblioteca local através dele em `server/routes/opds.js`.

Um detalhe de arquitetura deliberado: as rotas OPDS são registadas **fora do prefixo
`/api`**. Isto importa porque `server.js` monta o rate limiter e o timeout de API
especificamente sobre `app.use('/api', ...)` — qualquer rota fora desse prefixo não passa
por esse middleware. Um leitor OPDS de terceiros pode fazer pedidos com um padrão de
tráfego bem diferente de um browser normal (polling periódico, downloads grandes), e sujeitá-lo
ao mesmo limite de 6000 pedidos/10min pensado para a UI interativa arriscaria bloqueá-lo
sem necessidade. Ainda assim, o endpoint de download dentro do OPDS (`/opds/download`, que
desencadeia fetches reais a sites externos e construção de ficheiros ZIP) tem o **seu
próprio** rate limiter dedicado (20/min) — a lição aqui é: sair de um middleware genérico
não significa sair de qualquer proteção; significa decidir explicitamente qual proteção
específica faz sentido para aquele endpoint em particular.

## Importação de backups do Tachiyomi/Mihon

O Mihon (fork mantido do Tachiyomi, um leitor de manga popular no Android) guarda backups
num formato `.tachibk` — na prática, **protobuf comprimido com gzip**. A implementação
(`server/modules/mihon-import/`) segue três passos:

1. **Descomprimir** o ficheiro com gzip (Node tem isto nativo via `zlib`).
2. **Decodificar o protobuf** usando um schema `.proto` escrito de propósito para este
   projeto (`backup.proto`), com a biblioteca `protobufjs`. O schema foi construído lendo a
   definição pública dos modelos `BackupManga`, `BackupChapter`, `BackupCategory`,
   `BackupSource`, `BackupTracking`, `BackupHistory` do repositório público do Mihon no
   GitHub — nomes de campo, números `@ProtoNumber`, e tipos, sem copiar código-fonte
   verbatim.
3. **Mapear IDs de source**: o campo `source` do Mihon é um número interno específico do
   Mihon, sem qualquer correspondência genérica com os IDs de source do ScrollScape. A
   resolução usa o nome **legível** do source (presente na própria lista `BackupSource` do
   backup) e compara-o contra `state.installedSources`; para o MangaDex especificamente,
   existe uma heurística adicional de extrair o UUID da própria URL guardada no backup
   (o MangaDex identifica mangas por UUID na URL, o que torna esta extração fiável). Para
   qualquer source sem correspondência clara, o manga é importado como metadados apenas,
   com `sourceId: 'unknown'` — um estado já tolerado pelo resto da aplicação, em vez de
   rejeitar a importação por completo.

**Lição de integração com formatos de terceiros não documentados publicamente como API**:
quando não existe uma API estável a consumir, mas o formato de ficheiro é conhecido através
do código-fonte público de outro projeto, a abordagem correta é extrair só a informação
estrutural necessária (nomes de campo, tipos, números de protobuf) e escrever a tua própria
definição de schema a partir disso — nunca copiar/colar código de outro projeto para dentro
do teu, mesmo quando ambos são open-source, a menos que a licença o permita explicitamente
e isso seja intencional.

## Enriquecimento de metadados para comics ocidentais: cadeia de fallback

O BatCave (source de comics ocidentais, protegido por Cloudflare) tem dados próprios mais
pobres do que os de outros sources — por isso o ScrollScape encadeia **duas fontes externas
de metadados** para melhorar capas e nomes de editora, chamadas diretamente do código do
source (não através de nenhuma rota Express — `lookupCover()` é uma chamada de função
direta dentro do módulo do source durante a pesquisa/detalhes):

1. **ComicVine** (API oficial, precisa de chave própria do utilizador) — tentado primeiro.
2. **League of Comic Geeks** — sem API pública, por isso feito por scraping de HTML,
   atrás do mesmo FlareSolverr usado pelo BatCave. Só é tentado se o ComicVine devolver
   `null`.

Ambos delegam a decisão de "isto é ou não o comic certo" a uma função partilhada
(`title-matching.js`, `parseTitle`/`pickBestMatch`) que só aceita uma correspondência
**exata** de nome (ignorando maiúsculas/pontuação) — e, entre vários resultados com o mesmo
nome, só aceita um se o ano de publicação também confirmar qual é a edição certa. Nunca
devolve "a melhor aproximação" quando não há confirmação — devolve `null`, deixando o
BatCave usar a sua própria capa scraped como fallback final.

Duas armadilhas reais valem a pena documentar aqui:

- **ComicVine, com o parâmetro de paginação por defeito, falha para nomes comuns.** Um caso
  real testado ("Batman") tinha a edição certa, do ano certo, na posição 42 dos resultados
  de relevância — por isso o pedido usa explicitamente `limit=100`, não o valor por
  defeito da API.
- **ComicVine devolve HTTP 420** (não um código HTTP padrão — é uma extensão informal usada
  por alguns serviços para "estás a pedir demasiado", com a mensagem literal "...a tad bit
  gluttonous don't you think?") quando o rate limit é excedido. A resposta correta não é
  tratar isto como um erro genérico e tentar de novo imediatamente — é entrar num
  arrefecimento de 15 minutos em memória antes de voltar a tentar esse serviço.

Cada um destes dois serviços mantém a sua própria cache em disco (`cache/comicvine.json`,
`cache/leagueofcomicgeeks.json`) com TTL de 24 horas — o mesmo padrão de escrita atómica
(ficheiro `.tmp` + rename) descrito no capítulo 3 para o store principal, reaproveitado
aqui para um propósito diferente.

## MangaUpdates: enriquecimento pontual, não sincronização

Distinto do AniList (capítulo 6), a integração com o MangaUpdates.com não sincroniza
progresso nem biblioteca — é uma pesquisa pontual por título (`searchByTitle`), sem
qualquer chave de API, usada só para obter dados suplementares (último capítulo conhecido,
estado, géneros) quando pedido explicitamente. Não há persistência do resultado — cada
pedido volta a consultar o serviço externo.
