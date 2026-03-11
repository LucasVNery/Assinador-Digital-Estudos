/* auth.js — página index.html (login / cadastro) */

// Redirecionar se já está logado
if (localStorage.getItem('token')) {
  window.location.href = '/sign';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('tab-register').classList.toggle('hidden', tab !== 'register');
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  err.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('login-username').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/sign';
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

// ── Cadastro ──────────────────────────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn     = document.getElementById('register-btn');
  const err     = document.getElementById('register-error');
  const success = document.getElementById('register-success');
  err.classList.add('hidden');
  success.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Cadastrando...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('reg-username').value.trim(),
        email:    document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    success.textContent = 'Cadastro realizado! Redirecionando...';
    success.classList.remove('hidden');
    setTimeout(() => window.location.href = '/sign', 1000);
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Cadastrar';
  }
});
