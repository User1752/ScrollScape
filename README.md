# 🎌 Manghu - Manga Web Reader

Leitor de mangá web auto-contido com suporte a MangaDex.

## 🚀 Instalação Local

```bash
npm install
npm start
```

Abra: http://localhost:3000

## 🐳 Docker

```bash
cd docker
docker compose up --build
```

Abra: http://localhost:3000

## 📚 Como usar

1. **Pesquisar**: Digite o nome do mangá e clique em "Pesquisar"
2. **Ler**: Clique no mangá → Escolha um capítulo → Leia
3. **Favoritos**: Adicione mangás aos favoritos para acesso rápido
4. **Histórico**: Veja o histórico de leitura na aba "Biblioteca"

## 🔧 Sources Incluídas

- **MangaDex** (pré-instalada): Milhares de mangás em várias línguas

## 📝 Estrutura

```
Manghu/
├── data/
│   ├── sources/       # Sources JavaScript
│   │   └── mangadex.js
│   ├── store.json     # Dados persistentes
│   └── cache/
├── public/            # Frontend
├── docker/            # Docker configs
├── server.js          # Backend
└── package.json
```

## 🛠️ Desenvolvimento

Adicionar nova source em `data/sources/nome.js`:

```javascript
module.exports = {
  meta: { id: "nome", name: "Nome", version: "1.0.0" },
  async search(query, page) { /* ... */ },
  async mangaDetails(mangaId) { /* ... */ },
  async chapters(mangaId) { /* ... */ },
  async pages(chapterId) { /* ... */ }
};
```

Reinicie o servidor para auto-instalar.
