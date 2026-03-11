const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes       = require('./routes/auth');
const signaturesRoutes = require('./routes/signatures');
const verifyRoutes     = require('./routes/verify');

const app = express();

app.use(cors());
app.use(express.json());

const frontendDir = path.join(__dirname, '..', '..', 'frontend');

// Arquivos estáticos do frontend
app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/js',  express.static(path.join(frontendDir, 'js')));

// Páginas do frontend
app.get('/',             (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
app.get('/sign',         (req, res) => res.sendFile(path.join(frontendDir, 'sign.html')));
app.get('/verify',       (req, res) => res.sendFile(path.join(frontendDir, 'verify.html')));
app.get('/verify/:id',   (req, res) => res.sendFile(path.join(frontendDir, 'verify.html')));

// Rotas da API
app.use('/api/auth',       authRoutes);
app.use('/api/signatures', signaturesRoutes);
app.use('/api/verify',     verifyRoutes);

// 404 para rotas de API desconhecidas
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

module.exports = app;
