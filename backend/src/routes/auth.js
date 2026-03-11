const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../database');
const authenticate = require('../middleware/authenticate');

const JWT_SECRET = process.env.JWT_SECRET || 'digital-signer-dev-secret-change-in-production';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email e password são obrigatórios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username ou email já em uso' });
  }

  try {
    // Gerar par de chaves RSA-2048
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, public_key, private_key) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email, passwordHash, publicKey, privateKey);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso',
      token,
      user: { id: result.lastInsertRowid, username, email },
      publicKey,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao cadastrar usuário' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username e password são obrigatórios' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email },
    publicKey: user.public_key,
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, email, public_key, created_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    publicKey: user.public_key,
    createdAt: user.created_at,
  });
});

module.exports = router;
