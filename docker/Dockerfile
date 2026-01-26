FROM node:20-alpine

WORKDIR /app

# Instalar dependências primeiro (melhora cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copiar o resto do projeto
COPY . .

# Garantir que a pasta data/sources existe (por segurança)
RUN mkdir -p /app/data/sources

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
