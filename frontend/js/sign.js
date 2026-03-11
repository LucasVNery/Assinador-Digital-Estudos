/* sign.js — página sign.html (área autenticada) */

const token = localStorage.getItem('token');
if (!token) window.location.href = '/';

// ── Utilitários ───────────────────────────────────────────────────────────────
function authHeader() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('pt-BR');
}

function copyText(elId, btn) {
  navigator.clipboard.writeText(document.getElementById(elId).textContent)
    .then(() => { btn.textContent = 'Copiado!'; setTimeout(() => btn.textContent = 'Copiar', 1500); });
}
// Expor globalmente para onclick inline no HTML
window.copyText = copyText;

// ── Carregar info do usuário ──────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeader() });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/'; return; }
    const data = await res.json();
    document.getElementById('user-name').textContent = data.username;
    document.getElementById('user-email').textContent = data.email;
    document.getElementById('pubkey-display').textContent = data.publicKey;
  } catch {
    document.getElementById('user-name').textContent = 'Erro ao carregar';
  }
}

// ── Toggle chave pública ──────────────────────────────────────────────────────
document.getElementById('toggle-pubkey-btn').addEventListener('click', () => {
  const block = document.getElementById('pubkey-display');
  const btn   = document.getElementById('toggle-pubkey-btn');
  block.classList.toggle('open');
  btn.textContent = block.classList.contains('open') ? 'Ocultar chave' : 'Ver chave pública';
});

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/';
});

// ── Formulário de assinatura ──────────────────────────────────────────────────
document.getElementById('sign-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn    = document.getElementById('sign-btn');
  const err    = document.getElementById('sign-error');
  const result = document.getElementById('sign-result');
  err.classList.add('hidden');
  result.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Assinando...';

  try {
    const text = document.getElementById('text-input').value;
    const res = await fetch('/api/signatures', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao assinar');

    document.getElementById('result-id').textContent   = data.id;
    document.getElementById('result-hash').textContent = data.textHash;
    document.getElementById('result-sig').textContent  = data.signature;
    document.getElementById('verify-link').href        = `/verify/${data.id}`;
    result.classList.remove('hidden');
    loadHistory();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '&#128396; Assinar com RSA-SHA256';
  }
});

// ── Histórico ─────────────────────────────────────────────────────────────────
async function loadHistory() {
  const loading  = document.getElementById('history-loading');
  const empty    = document.getElementById('history-empty');
  const wrap     = document.getElementById('history-table-wrap');
  const tbody    = document.getElementById('history-body');

  loading.classList.remove('hidden');
  empty.classList.add('hidden');
  wrap.classList.add('hidden');

  try {
    const res  = await fetch('/api/signatures', { headers: authHeader() });
    const data = await res.json();
    loading.classList.add('hidden');

    if (!data.signatures || data.signatures.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = data.signatures.map(s => `
      <tr>
        <td style="white-space:nowrap;font-size:.8rem">${fmtDate(s.created_at)}</td>
        <td class="td-truncate" title="${escHtml(s.text_content)}">${escHtml(s.text_content)}</td>
        <td style="font-family:monospace;font-size:.72rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.text_hash}">${s.text_hash}</td>
        <td>${s.algorithm}</td>
        <td><a href="/verify/${s.id}" class="link-verify">Verificar</a></td>
      </tr>
    `).join('');
    wrap.classList.remove('hidden');
  } catch {
    loading.textContent = 'Erro ao carregar histórico.';
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadUser();
loadHistory();
