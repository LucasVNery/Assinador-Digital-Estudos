const request = require('supertest');
const app = require('../src/app');
const db  = require('../src/database');

// Limpar banco em memória antes dos testes
beforeAll(() => {
  db.exec('DELETE FROM verification_logs; DELETE FROM signatures; DELETE FROM users;');
});

afterAll(() => {
  db.close();
});

let token;
let signatureId;
let signatureB64;
let originalText;

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  test('Registrar usuário gera par de chaves RSA', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'senha123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.publicKey).toMatch(/BEGIN PUBLIC KEY/);
    token = res.body.token;
  });

  test('Login retorna JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'alice',
      password: 'senha123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  test('Login com senha errada retorna 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'alice',
      password: 'errada',
    });
    expect(res.status).toBe(401);
  });
});

// ── Assinatura ────────────────────────────────────────────────────────────────

describe('Assinatura', () => {
  test('Assinar texto retorna ID e metadados', async () => {
    originalText = 'Documento oficial para assinatura digital';

    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: originalText });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.signature).toBeDefined();
    expect(res.body.textHash).toHaveLength(64); // SHA-256 hex
    expect(res.body.algorithm).toBe('RSA-SHA256');
    expect(res.body.signatoryUsername).toBe('alice');

    signatureId  = res.body.id;
    signatureB64 = res.body.signature;
  });

  test('Listar assinaturas do usuário', async () => {
    const res = await request(app)
      .get('/api/signatures')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.signatures.length).toBeGreaterThan(0);
  });

  test('Endpoint de assinatura requer autenticação', async () => {
    const res = await request(app)
      .post('/api/signatures')
      .send({ text: 'sem token' });

    expect(res.status).toBe(401);
  });
});

// ── Verificação ───────────────────────────────────────────────────────────────

describe('Verificação', () => {
  // ✅ Caso positivo: assinatura válida
  test('[POSITIVO] GET /api/verify/:id — assinatura original deve ser VÁLIDA', async () => {
    const res = await request(app).get(`/api/verify/${signatureId}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.status).toBe('VÁLIDA');
    expect(res.body.signatoryUsername).toBe('alice');
    expect(res.body.algorithm).toBe('RSA-SHA256');
  });

  // ❌ Caso negativo: assinatura adulterada
  test('[NEGATIVO] GET /api/verify/:id — assinatura adulterada deve ser INVÁLIDA', async () => {
    // Adulterar a assinatura no banco
    const tampered = Buffer.from('assinatura_adulterada_invalida').toString('base64');
    db.prepare('UPDATE signatures SET signature = ? WHERE id = ?').run(tampered, signatureId);

    const res = await request(app).get(`/api/verify/${signatureId}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.status).toBe('INVÁLIDA');

    // Restaurar assinatura original
    db.prepare('UPDATE signatures SET signature = ? WHERE id = ?').run(signatureB64, signatureId);
  });

  // ✅ Caso positivo por conteúdo
  test('[POSITIVO] POST /api/verify — texto + assinatura corretos devem ser VÁLIDOS', async () => {
    const res = await request(app).post('/api/verify').send({
      text:      originalText,
      signature: signatureB64,
      username:  'alice',
    });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.status).toBe('VÁLIDA');
  });

  // ❌ Caso negativo por conteúdo (texto alterado)
  test('[NEGATIVO] POST /api/verify — texto alterado deve ser INVÁLIDO', async () => {
    const res = await request(app).post('/api/verify').send({
      text:      'Texto completamente diferente do original',
      signature: signatureB64,
      username:  'alice',
    });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.status).toBe('INVÁLIDA');
  });

  // Logs de verificação são persistidos
  test('Logs de verificação são persistidos no banco', () => {
    const logs = db.prepare(
      'SELECT * FROM verification_logs WHERE signature_id = ?'
    ).all(signatureId);

    expect(logs.length).toBeGreaterThan(0);

    const hasValid   = logs.some(l => l.is_valid === 1);
    const hasInvalid = logs.some(l => l.is_valid === 0);
    expect(hasValid).toBe(true);
    expect(hasInvalid).toBe(true);
  });
});
