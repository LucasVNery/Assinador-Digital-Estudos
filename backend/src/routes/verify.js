const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../database');

function logVerification(signatureId, ip, isValid, method) {
  db.prepare(
    'INSERT INTO verification_logs (signature_id, verified_by_ip, is_valid, verification_method) VALUES (?, ?, ?, ?)'
  ).run(signatureId, ip, isValid ? 1 : 0, method);
}

// GET /api/verify/:id — Verificar assinatura por ID
router.get('/:id', (req, res) => {
  const sig = db.prepare(`
    SELECT s.*, u.username, u.public_key
    FROM signatures s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!sig) return res.status(404).json({ error: 'Assinatura não encontrada' });

  let isValid = false;
  let verifyError = null;

  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(sig.text_content, 'utf8');
    isValid = verify.verify(sig.public_key, sig.signature, 'base64');
  } catch (err) {
    verifyError = err.message;
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  logVerification(sig.id, ip, isValid, 'by_id');

  res.json({
    valid:             isValid,
    status:            isValid ? 'VÁLIDA' : 'INVÁLIDA',
    signatureId:       sig.id,
    signatoryUsername: sig.username,
    algorithm:         sig.algorithm,
    textHash:          sig.text_hash,
    createdAt:         sig.created_at,
    ...(verifyError && { verifyError }),
  });
});

// POST /api/verify — Verificar por conteúdo (texto + assinatura + username)
router.post('/', (req, res) => {
  const { text, signature, username } = req.body;

  if (!text || !signature || !username) {
    return res.status(400).json({ error: 'text, signature e username são obrigatórios' });
  }

  const user = db.prepare('SELECT id, username, public_key FROM users WHERE username = ?').get(username);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  let isValid = false;
  let verifyError = null;

  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(text, 'utf8');
    isValid = verify.verify(user.public_key, signature, 'base64');
  } catch (err) {
    verifyError = err.message;
  }

  // Registrar log se encontrar a assinatura correspondente no banco
  const sigRecord = db.prepare(
    'SELECT id FROM signatures WHERE user_id = ? AND signature = ?'
  ).get(user.id, signature);

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (sigRecord) {
    logVerification(sigRecord.id, ip, isValid, 'by_content');
  }

  res.json({
    valid:             isValid,
    status:            isValid ? 'VÁLIDA' : 'INVÁLIDA',
    signatoryUsername: user.username,
    algorithm:         'RSA-SHA256',
    ...(verifyError && { verifyError }),
  });
});

module.exports = router;
