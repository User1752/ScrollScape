# Manual Técnico do ScrollScape

## Como construir um leitor de manga/comics self-hosted com sources plugáveis

Este manual documenta a arquitetura completa do ScrollScape — um leitor de manga, comics
e light novels self-hosted, com um sistema de "sources" plugáveis (scrapers), sincronização
com o AniList, importação de ficheiros locais (EPUB/PDF/CBZ), feed OPDS, e um frontend
100% em JavaScript vanilla sem build step.

O objetivo não é documentar "o que o ScrollScape faz" do ponto de vista do utilizador —
é ensinar **como e porquê** foi construído desta forma, para que sirva de referência a
quem queira construir um projeto semelhante do zero. Cada capítulo foi escrito a partir
de leitura direta do código-fonte real (não é um resumo de memória nem de suposições),
com excertos de código verdadeiros e números reais tirados do `data/store.json` da
instalação em uso.

## Índice

1. [Visão geral e filosofia do projeto](01-visao-geral-e-filosofia.md)
2. [Arquitetura geral (cliente/servidor, ciclo de um pedido)](02-arquitetura-geral.md)
3. [O modelo de dados: store.json](03-modelo-de-dados-store-json.md)
4. [O sistema de sources (plugins de scraping)](04-sistema-de-sources.md)
5. [Biblioteca, favoritos e progresso de leitura](05-biblioteca-favoritos-progresso.md)
6. [Integração com o AniList](06-integracao-anilist.md)
7. [Importação de ficheiros locais (EPUB, PDF, CBZ/CBR)](07-importacao-local.md)
8. [Categorias, listas inteligentes e tags](08-categorias-listas-tags.md)
9. [Integrações externas (OPDS, Mihon/Tachiyomi, metadados de comics)](09-integracoes-externas.md)
10. [Funcionalidades secundárias (conquistas, reviews, analytics, calendário...)](10-funcionalidades-secundarias.md)
11. [Segurança (CSP, SSRF, sanitização, auth-gate)](11-seguranca.md)
12. [Arquitetura do frontend (vanilla JS sem build step)](12-frontend-arquitetura.md)
13. [Empacotamento e arranque (launcher, pkg, FlareSolverr)](13-deployment-launcher.md)
14. [Lições e armadilhas reais (bugs encontrados e corrigidos)](14-licoes-e-armadilhas.md)

## Como ler este manual

Se estiveres a construir algo do zero, a ordem sugerida é a do índice: primeiro entende
o modelo de dados (capítulo 3), porque quase tudo o resto — sources, biblioteca, AniList,
categorias — não é mais do que ler/escrever partes diferentes do mesmo objeto `store.json`.
Depois o sistema de sources (capítulo 4), que é o "contrato" central que torna o projeto
extensível. Os capítulos 5 a 10 são features construídas por cima dessa base, e podem ser
lidos por qualquer ordem, consoante o que quiseres construir primeiro.

O capítulo 14 ("Lições e armadilhas") é propositadamente o último — reúne bugs reais,
concretos, encontrados e corrigidos durante o desenvolvimento deste mesmo projeto. É a
parte mais valiosa para quem vai implementar algo parecido, porque mostra exatamente onde
a intuição costuma falhar (ex.: cache de `require()` do Node, prioridade de merge em lógica
de deduplicação, blob URLs vs ficheiros reais em bibliotecas como o epub.js).

## Convenções usadas neste manual

- Caminhos de ficheiro são relativos à raiz do projeto (`server/routes/library.js`, não
  `C:\...\server\routes\library.js`).
- Excertos de código são cópias reais do código-fonte no momento em que este manual foi
  escrito, não pseudocódigo. Onde o comportamento pode mudar com versões futuras, isso é
  assinalado explicitamente.
- "Source" refere-se sempre a um módulo scraper plugável (ex. `data/sources/mangapill.js`),
  nunca a "código fonte" em sentido genérico — para esse segundo significado, este manual
  usa sempre "código".
