FROM node:20-alpine

WORKDIR /app

# Instalar dependências
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-package-lock

# Copiar o resto do projeto (incluindo data/sources)
COPY . .

# Garantir que a pasta data existe
RUN mkdir -p /app/data/sources /app/data/cache

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
