/* keys.js — página keys.html (área de chaves) */

const token = localStorage.getItem('token');
if (!token) window.location.href = '/';

// ── Utilitários ───────────────────────────────────────────────────────────────
function authHeader() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function copyKey(elId, btn) {
  navigator.clipboard.writeText(document.getElementById(elId).textContent)
    .then(() => {
      btn.textContent = 'Copiado!';
      setTimeout(() => btn.textContent = 'Copiar', 1500);
    })
    .catch(() => {
      btn.textContent = 'Erro';
      setTimeout(() => btn.textContent = 'Copiar', 1500);
    });
}

function downloadKey(elId, filename) {
  const content = document.getElementById(elId).textContent;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Expor globalmente para onclick inline no HTML
window.copyKey = copyKey;
window.downloadKey = downloadKey;

// ── Carregar info do usuário ──────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeader() });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/'; return; }
    const data = await res.json();
    document.getElementById('user-name').textContent = data.username;
    document.getElementById('user-email').textContent = data.email;
  } catch {
    document.getElementById('user-name').textContent = 'Erro ao carregar';
  }
}

// ── Carregar minhas chaves ────────────────────────────────────────────────────
async function loadMyKeys() {
  try {
    const res = await fetch('/api/auth/keys', { headers: authHeader() });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/'; return; }
    const data = await res.json();

    document.getElementById('my-public-key').textContent = data.publicKey;
    document.getElementById('my-private-key').textContent = data.privateKey;
  } catch (err) {
    console.error('Erro ao carregar chaves:', err);
    document.getElementById('my-public-key').textContent = 'Erro ao carregar chave pública';
    document.getElementById('my-private-key').textContent = 'Erro ao carregar chave privada';
  }
}

// ── Carregar todos os usuários ────────────────────────────────────────────────
async function loadAllUsers() {
  const loading = document.getElementById('users-loading');
  const empty = document.getElementById('users-empty');
  const list = document.getElementById('users-list');

  loading.classList.remove('hidden');
  empty.classList.add('hidden');
  list.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/users', { headers: authHeader() });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/'; return; }
    const data = await res.json();

    loading.classList.add('hidden');

    if (!data.users || data.users.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    // Criar accordions individuais para cada usuário
    list.innerHTML = data.users.map((user, index) => `
      <div style="border-top:1px solid var(--border);padding-top:1rem;margin-top:${index === 0 ? '0' : '1rem'}">
        <div class="accordion-header collapsed" onclick="toggleAccordion('user-content-${user.id}', this)" style="margin-bottom:0;padding:.5rem 0">
          <div>
            <div style="font-weight:700;font-size:.95rem;color:var(--text)">${escHtml(user.username)}</div>
            <div style="font-size:.8rem;color:var(--muted)">${escHtml(user.email)}</div>
          </div>
          <span class="accordion-icon">▼</span>
        </div>

        <div id="user-content-${user.id}" class="accordion-content collapsed" style="margin-top:.75rem">
          <div class="form-group">
            <label style="font-size:.8rem">Chave Pública</label>
            <div class="id-display" style="align-items:flex-start">
              <span id="user-key-${user.id}" style="flex:1;word-break:break-all;font-size:.72rem;white-space:pre-wrap">${escHtml(user.publicKey)}</span>
              <div style="display:flex;gap:.5rem;flex-shrink:0">
                <button class="copy-btn" onclick="copyKey('user-key-${user.id}', this)">Copiar</button>
                <button class="copy-btn" onclick="downloadKey('user-key-${user.id}', 'chave_publica_${escHtml(user.username)}.pem')">Baixar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    list.classList.remove('hidden');
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
    loading.textContent = 'Erro ao carregar usuários.';
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Accordion Toggle ──────────────────────────────────────────────────────────
function toggleAccordion(contentId, headerElement) {
  const content = document.getElementById(contentId);
  content.classList.toggle('collapsed');
  headerElement.classList.toggle('collapsed');
}
// Expor globalmente para onclick inline no HTML
window.toggleAccordion = toggleAccordion;

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/';
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadUser();
loadMyKeys();
loadAllUsers();
