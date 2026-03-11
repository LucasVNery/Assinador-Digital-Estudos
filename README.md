# Assinador Digital Web

Aplicação web para assinatura e verificação de documentos digitais usando criptografia **RSA-2048 / SHA-256**.

---

## Arquitetura

```
digital-signer/
├── backend/               # API REST (Node.js + Express + SQLite)
│   ├── src/
│   │   ├── app.js         # Configuração Express
│   │   ├── database.js    # SQLite (better-sqlite3) + migrações inline
│   │   ├── middleware/
│   │   │   └── authenticate.js   # Middleware JWT
│   │   └── routes/
│   │       ├── auth.js        # /api/auth/*
│   │       ├── signatures.js  # /api/signatures/*
│   │       └── verify.js      # /api/verify/*
│   ├── tests/
│   │   └── signature.test.js  # Testes Jest + Supertest
│   └── server.js
├── frontend/              # HTML + CSS + JS vanilla
│   ├── index.html         # Login / Cadastro
│   ├── sign.html          # Área autenticada de assinatura
│   ├── verify.html        # Verificação pública
│   ├── css/style.css
│   └── js/
│       ├── auth.js
│       ├── sign.js
│       └── verify.js
├── docker-compose.yml
└── README.md
```

---

## Como rodar

### Opção 1 — Direto com Node.js

**Requisitos:** Node.js >= 18

```bash
cd backend
npm install
npm start
```

Acesse: http://localhost:3000

### Opção 2 — Docker Compose

```bash
docker compose up --build
```

Acesse: http://localhost:3000

### Variáveis de ambiente

Copie `backend/.env.example` para `backend/.env` e ajuste os valores:

| Variável     | Padrão                        | Descrição                    |
|--------------|-------------------------------|------------------------------|
| `PORT`       | `3000`                        | Porta do servidor            |
| `JWT_SECRET` | *(valor dev inseguro)*        | Segredo para assinar JWTs    |
| `NODE_ENV`   | `development`                 | `production` em produção     |

---

## Fluxos

### 1. Cadastro
```
POST /api/auth/register  { username, email, password }
  → gera par RSA-2048 (spki/pkcs8 PEM)
  → armazena public_key + private_key no banco
  → retorna JWT + publicKey
```

### 2. Assinatura
```
POST /api/signatures  { text }   [Authorization: Bearer <jwt>]
  → calcula hash SHA-256 do texto
  → sign("RSA-SHA256", privateKey, text) → base64
  → persiste no banco, retorna { id, textHash, signature, algorithm, ... }
```

### 3. Verificação
```
GET /api/verify/:id
  → lê text_content + signature + public_key do banco
  → verify("RSA-SHA256", publicKey, signature) → true/false
  → persiste log, retorna { valid, status, signatoryUsername, algorithm, ... }

POST /api/verify  { text, signature, username }
  → mesma lógica usando chave pública do username informado
```

---

## Endpoints da API

### Auth

| Método | Rota                  | Proteção | Descrição                        |
|--------|-----------------------|----------|----------------------------------|
| POST   | `/api/auth/register`  | —        | Cadastrar usuário + gerar chaves |
| POST   | `/api/auth/login`     | —        | Login, retorna JWT               |
| GET    | `/api/auth/me`        | JWT      | Dados do usuário autenticado     |

### Assinaturas

| Método | Rota                   | Proteção | Descrição                        |
|--------|------------------------|----------|----------------------------------|
| POST   | `/api/signatures`      | JWT      | Assinar texto                    |
| GET    | `/api/signatures`      | JWT      | Listar assinaturas do usuário    |
| GET    | `/api/signatures/:id`  | —        | Detalhes de uma assinatura       |

### Verificação

| Método | Rota               | Proteção | Descrição                              |
|--------|--------------------|----------|----------------------------------------|
| GET    | `/api/verify/:id`  | —        | Verificar por ID da assinatura         |
| POST   | `/api/verify`      | —        | Verificar por texto + assinatura       |

---

## Exemplos de requisição/resposta

### Cadastro
```http
POST /api/auth/register
Content-Type: application/json

{ "username": "alice", "email": "alice@example.com", "password": "senha123" }
```
```json
{
  "message": "Usuário cadastrado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "username": "alice", "email": "alice@example.com" },
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg..."
}
```

### Assinar texto
```http
POST /api/signatures
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{ "text": "Contrato de prestação de serviços nº 42." }
```
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "textHash": "3b4c5d6e7f...",
  "signature": "base64==...",
  "algorithm": "RSA-SHA256",
  "signatoryUsername": "alice",
  "createdAt": "2026-03-11T10:00:00.000Z"
}
```

### Verificar por ID
```http
GET /api/verify/550e8400-e29b-41d4-a716-446655440000
```
```json
{
  "valid": true,
  "status": "VÁLIDA",
  "signatureId": "550e8400-e29b-41d4-a716-446655440000",
  "signatoryUsername": "alice",
  "algorithm": "RSA-SHA256",
  "textHash": "3b4c5d6e7f...",
  "createdAt": "2026-03-11 10:00:00"
}
```

### Verificar por conteúdo (assinatura adulterada)
```http
POST /api/verify
Content-Type: application/json

{ "text": "Texto diferente", "signature": "base64==...", "username": "alice" }
```
```json
{
  "valid": false,
  "status": "INVÁLIDA",
  "signatoryUsername": "alice",
  "algorithm": "RSA-SHA256"
}
```

---

## Banco de dados

### Schema (SQLite)

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  public_key    TEXT NOT NULL,   -- RSA-2048 SPKI PEM
  private_key   TEXT NOT NULL,   -- RSA-2048 PKCS8 PEM
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE signatures (
  id           TEXT PRIMARY KEY,   -- UUID v4
  user_id      INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  text_hash    TEXT NOT NULL,      -- SHA-256 hex
  signature    TEXT NOT NULL,      -- RSA-SHA256 Base64
  algorithm    TEXT NOT NULL DEFAULT 'RSA-SHA256',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE verification_logs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  signature_id        TEXT NOT NULL,
  verified_by_ip      TEXT,
  is_valid            INTEGER NOT NULL,   -- 0 ou 1
  verification_method TEXT NOT NULL,      -- 'by_id' ou 'by_content'
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signature_id) REFERENCES signatures(id)
);
```

O banco é criado automaticamente em `backend/data/signatures.db` na primeira execução. Não há passo de migração manual.

---

## Testes

```bash
cd backend
npm test
```

### Casos cobertos

| # | Tipo      | Cenário                                                     | Resultado esperado |
|---|-----------|-------------------------------------------------------------|--------------------|
| 1 | Positivo  | Verificar assinatura original por ID                        | `valid: true`      |
| 2 | Negativo  | Verificar assinatura com valor adulterado no banco          | `valid: false`     |
| 3 | Positivo  | Verificar por conteúdo com texto e assinatura corretos      | `valid: true`      |
| 4 | Negativo  | Verificar por conteúdo com texto diferente do assinado      | `valid: false`     |
| 5 | Integridade | Logs de verificação persistidos no banco                  | `length > 0`       |

Os testes usam banco SQLite **em memória** (`:memory:`) — sem efeitos colaterais no banco de produção.

---

## Conceitos de segurança envolvidos

| Conceito        | Implementação                                      |
|-----------------|----------------------------------------------------|
| Assimetria      | RSA-2048: chave privada assina, pública verifica   |
| Hash            | SHA-256 garante integridade do documento           |
| Não-repúdio     | Só quem tem a chave privada pode gerar a assinatura|
| Autenticação    | JWT HS256 com expiração de 24h                     |
| Senhas          | bcrypt com fator 12                                |
| Persistência    | SQLite com WAL e foreign keys ativas               |
