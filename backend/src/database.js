const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isTest = process.env.NODE_ENV === 'test';

let db;

if (isTest) {
  db = new Database(':memory:');
} else {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  db = new Database(path.join(dataDir, 'signatures.db'));
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    public_key  TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS signatures (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    text_hash    TEXT NOT NULL,
    signature    TEXT NOT NULL,
    algorithm    TEXT NOT NULL DEFAULT 'RSA-SHA256',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS verification_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_id        TEXT NOT NULL,
    verified_by_ip      TEXT,
    is_valid            INTEGER NOT NULL,
    verification_method TEXT NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_id) REFERENCES signatures(id)
  );
`);

module.exports = db;
