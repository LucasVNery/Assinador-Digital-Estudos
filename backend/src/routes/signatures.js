const express      = require('express');
const router       = express.Router();
const crypto       = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db           = require('../database');
const authenticate = require('../middleware/authenticate');

// POST /api/signatures — Assinar texto
router.post('/', authenticate, (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'O campo text é obrigatório' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  try {
    // Hash SHA-256 do texto
    const textHash = crypto.createHash('sha256').update(text, 'utf8').digest('hex');

    // Assinar com chave privada RSA-SHA256
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(text, 'utf8');
    const signature = sign.sign(user.private_key, 'base64');

    const id = uuidv4();

    db.prepare(
      'INSERT INTO signatures (id, user_id, text_content, text_hash, signature, algorithm) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, user.id, text, textHash, signature, 'RSA-SHA256');

    res.status(201).json({
      id,
      textHash,
      signature,
      algorithm: 'RSA-SHA256',
      signatoryUsername: user.username,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao assinar texto' });
  }
});

// GET /api/signatures — Listar assinaturas do usuário autenticado
router.get('/', authenticate, (req, res) => {
  const signatures = db.prepare(
    'SELECT id, text_content, text_hash, algorithm, created_at FROM signatures WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);

  res.json({ signatures });
});

// GET /api/signatures/:id — Obter detalhes de uma assinatura
router.get('/:id', (req, res) => {
  const sig = db.prepare(`
    SELECT s.*, u.username, u.public_key
    FROM signatures s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!sig) return res.status(404).json({ error: 'Assinatura não encontrada' });

  res.json({
    id:                sig.id,
    textContent:       sig.text_content,
    textHash:          sig.text_hash,
    signature:         sig.signature,
    algorithm:         sig.algorithm,
    signatoryUsername: sig.username,
    publicKey:         sig.public_key,
    createdAt:         sig.created_at,
  });
});

module.exports = router;
