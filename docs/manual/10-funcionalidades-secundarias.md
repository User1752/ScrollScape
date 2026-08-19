# 10. Funcionalidades secundárias

Este capítulo reúne subsistemas mais pequenos, cada um interessante por uma razão
específica de design — não pela sua complexidade geral.

## Conquistas (achievements) e "Achievement Points"

`server/modules/achievements/service.js` guarda `store.achievements` (array de IDs
desbloqueados) e `store.ap` (`{ bonus, spent }`, uma carteira de pontos usada para
"comprar" temas cosméticos). O catálogo de definições (nomes, descrições, requisitos) é
estático (`data/achievements.json`), não guardado no store — só o **estado** de quais
foram desbloqueadas é persistente.

Detalhe de design importante: `updateProgression(patch)` nunca incrementa valores no
servidor — o cliente envia sempre o valor já calculado e final (depois de reconciliar
contra o que tinha em `localStorage`, por exemplo depois de várias sessões offline). O
servidor confia nesse valor em vez de o recalcular a partir de eventos brutos. Isto é mais
simples de implementar do que um sistema de eventos incrementais, mas significa que a
lógica de "quando é que uma conquista foi realmente ganha" vive inteiramente no cliente —
uma escolha aceitável para uma app pessoal de utilizador único, que seria arriscada num
contexto multi-utilizador sem confiança mútua (um cliente malicioso poderia simplesmente
declarar-se "com todas as conquistas").

## Reviews: um log, não um agregado

`store.reviews[mangaId]` é um **array** de `{ rating, text, date }`, limitado a 20 entradas,
mais recente primeiro — não um único valor "a tua avaliação atual". A avaliação "corrente"
é derivada lendo só o primeiro elemento (`arr[0]?.rating`). Isto é uma escolha de guardar
histórico em vez de estado — permite, por exemplo, mostrar como a opinião do utilizador
sobre um manga evoluiu, ao preço de qualquer leitura simples da "avaliação atual" ter de
saber que precisa de olhar só para o topo do array.

**Detalhe a ter em conta ao copiar este padrão**: a chave usada é só `mangaId`, **sem**
`sourceId` — ao contrário de quase tudo o resto no projeto (capítulo 5), que usa sempre o
par composto. Isto significa que dois mangas diferentes, em dois sources diferentes, que
por coincidência partilhem o mesmo valor de `id` (algo que já se confirmou acontecer neste
projeto, já que os IDs são strings opacas geridas por cada source) **colidem no mesmo
registo de reviews**. Não é necessariamente um bug fatal (reviews são um dado de baixo
risco), mas é uma inconsistência de design que vale a pena notar — e evitar — se
estiveres a desenhar algo semelhante do zero: escolhe uma convenção de chave (composta ou
simples) e aplica-a **sempre**, mesmo em features que pareçam "pequenas demais para
importar".

## Analytics: só local, nunca telemetria externa

`server/modules/analytics/service.js` agrega estatísticas de leitura (tempo total,
capítulos lidos, sequência de dias consecutivos) — tudo derivado de `recordSession()`,
chamado uma vez por capítulo lido. **Nenhum destes dados sai da máquina do utilizador** —
não há nenhum SDK de terceiros (Google Analytics, Sentry, etc.) em lado nenhum do projeto.

Um detalhe de design deliberado, comentado explicitamente no código: enquanto
`readingSessions` (o log detalhado de cada sessão) está limitado a 200 entradas (as mais
antigas são descartadas), `dailyChapterCounts` (os dados por trás do heatmap de atividade
de leitura) **nunca é limpo** — porque, sendo um dicionário de "um número por dia", mesmo
anos de histórico diário continuam a ocupar um espaço trivial. A lição: a política de
retenção de dados não tem de ser uniforme em todo o store — cada estrutura de dados deve
ter o seu limite (ou ausência de limite) decidido de acordo com o seu próprio tamanho
esperado ao longo do tempo, não copiado ciegamente de outra estrutura vizinha.

## Calendário de lançamentos: previsão estatística, não uma API de datas

Não existe uma API única e fiável de "quando sai o próximo capítulo de X" para a maioria
dos sources instalados. `server/modules/calendar/service.js` resolve isto com uma
abordagem estatística: para cada favorito em curso, tenta resolver o título no MangaDex,
calcula a **mediana dos últimos 8 intervalos entre capítulos**, classifica a cadência
(semanal/quinzenal/mensal) com um nível de confiança, e projeta a data seguinte com algum
jitter (variação aleatória controlada) para não parecer artificialmente exata. Para seis
sources específicos com datas reais por capítulo, existe um caminho alternativo nativo,
usado quando a resolução via MangaDex falha.

`calendar/service.js` é o orquestrador de `getCalendar()`; a lógica em si vive em quatro
módulos vizinhos, cada um sem estado partilhado com os outros: `mangadex-dates.js`
(resolução de título → UUID e o *fetch* em lote do feed de capítulos), `native-dates.js`
(o caminho alternativo nativo mencionado acima), `otaku-calendar.js` (scraping de
lançamentos de volumes do OtakuCalendar), e `prediction-math.js` (a mediana, classificação
de cadência e nível de confiança — funções puras, sem I/O nenhum).

Vale a pena documentar aqui um bug real encontrado neste próprio módulo, porque é o tipo
de erro que só aparece em produção: o código de resolução do MangaDex referenciava um
identificador `limits` sem qualquer `require`/import correspondente no ficheiro — o que
significa que, na prática, **a resolução via MangaDex nunca tinha funcionado**, sempre a
lançar `"limits is not defined"`, silenciosamente capturado por um `try/catch` a montante
que fazia o código cair sempre no fallback. O sintoma visível para o utilizador não era um
erro — era simplesmente "o calendário nunca usa datas do MangaDex, só as dos outros seis
sources", um comportamento que passa facilmente por uma limitação de design em vez de um
bug de referência não definida. **Lição**: um `try/catch` genérico à volta de uma chamada
que pode falhar por várias razões diferentes (erro de rede real vs. erro de programação)
esconde a diferença entre as duas — vale a pena, pelo menos em desenvolvimento, logar o
tipo/mensagem do erro capturado, para que um `ReferenceError` não se disfarce
indefinidamente de "falha de rede esperada".

## Backup: exportação/importação total, sem curadoria

`GET /api/backup/export` devolve o `store.json` inteiro, tal como está. `POST
/api/backup/import` corre o objeto recebido pela mesma função `normaliseStore()` usada no
arranque normal (capítulo 3) antes de o escrever — o que significa que um backup de uma
versão mais antiga da aplicação, com campos em falta, é aceite e completado
automaticamente com os valores default, em vez de ser rejeitado. A importação chama
explicitamente `flushNow()` (em vez de esperar pelo debounce normal de 300ms) — uma escrita
deste tipo, disparada por uma ação manual e pouco frequente do utilizador, deve ser
confirmada em disco imediatamente, não fica à espera de "mais escritas a chegar em breve"
como uma operação de rotina.

Um detalhe frequentemente esquecido em sistemas de backup: nem todo o estado relevante do
utilizador vive no lado do servidor. O token OAuth do AniList e outras preferências
puramente de browser vivem em `localStorage`, não no `store.json` — o backup do lado do
cliente (`public/modules/ui-backup.js`) tem de juntar explicitamente as duas fontes num
único ficheiro descarregável, ou um "backup completo" ficaria incompleto sem o utilizador
alguma vez perceber.

## Pesquisa de capas via Google/Brave: scraping de HTML, não uma API

`server/modules/cover-search/` serve o lado do picker de capas (capítulo 5) que não pode
correr diretamente no browser por causa de CORS — a API GraphQL do AniList é aberta a
pedidos cross-origin, mas uma pesquisa de imagens do Google não é. O servidor faz o
scraping da própria página de resultados HTML do Google (com fallback para o Brave Search),
com um User-Agent de Chrome desktop simulado, e usa **quatro estratégias de extração de
regex diferentes** em sequência sobre o mesmo HTML — porque o Google encapsula os URLs de
resultado de formas inconsistentes (por vezes com `=` em vez de `=`, por vezes dentro
de um campo JSON `"ou"`/`"murl"`, por vezes só como um `<img src>` simples). Não existe
aqui nenhuma API estável a consumir — é, por definição, uma integração frágil, sujeita a
quebrar sempre que o Google mudar a estrutura da página, e que só serve como fallback de
melhor-esforço, não como um requisito garantido da aplicação.
