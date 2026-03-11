FROM node:20-alpine

WORKDIR /app

# Instalar dependências nativas para better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar e instalar dependências
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copiar código
COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "server.js"]
