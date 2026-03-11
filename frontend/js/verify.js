/* verify.js — página verify.html (pública) */

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-by-id').classList.toggle('hidden', tab !== 'by-id');
    document.getElementById('tab-by-content').classList.toggle('hidden', tab !== 'by-content');
    document.getElementById('verify-result').classList.add('hidden');
    document.getElementById('verify-error').classList.add('hidden');
  });
});

// ── Exibir resultado ──────────────────────────────────────────────────────────
function showResult(data) {
  const result  = document.getElementById('verify-result');
  const banner  = document.getElementById('status-banner');
  const icon    = document.getElementById('status-icon');
  const text    = document.getElementById('status-text');
  const sub     = document.getElementById('status-sub');

  document.getElementById('verify-error').classList.add('hidden');

  if (data.valid) {
    banner.style.background = '#F0FDF4';
    banner.style.border     = '1px solid #86EFAC';
    icon.textContent  = '✅';
    text.textContent  = 'VÁLIDA';
    text.style.color  = '#15803D';
    sub.textContent   = 'A assinatura é autêntica e o documento não foi alterado.';
  } else {
    banner.style.background = '#FFF1F2';
    banner.style.border     = '1px solid #FCA5A5';
    icon.textContent  = '❌';
    text.textContent  = 'INVÁLIDA';
    text.style.color  = '#B91C1C';
    sub.textContent   = 'A assinatura é inválida ou o documento foi adulterado.';
  }

  document.getElementById('r-username').textContent  = data.signatoryUsername || '—';
  document.getElementById('r-algorithm').textContent = data.algorithm         || 'RSA-SHA256';
  document.getElementById('r-id').textContent        = data.signatureId       || '—';
  document.getElementById('r-hash').textContent      = data.textHash          || '—';
  document.getElementById('r-date').textContent      = data.createdAt
    ? new Date(data.createdAt).toLocaleString('pt-BR') : '—';

  result.classList.remove('hidden');
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(msg) {
  const el = document.getElementById('verify-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('verify-result').classList.add('hidden');
}

// ── Verificar por ID ──────────────────────────────────────────────────────────
async function verifyById(id) {
  const btn = document.getElementById('verify-id-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="border-top-color:var(--primary);border-color:rgba(37,99,235,.2)"></span> Verificando...';

  try {
    const res  = await fetch(`/api/verify/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (res.status === 404) throw new Error('Assinatura não encontrada para este ID.');
    if (!res.ok) throw new Error(data.error || 'Erro ao verificar');
    showResult(data);
  } catch (ex) {
    showError(ex.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar';
  }
}

document.getElementById('verify-id-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('sig-id-input').value.trim();
  if (id) verifyById(id);
});

// ── Verificar por Conteúdo ────────────────────────────────────────────────────
document.getElementById('verify-content-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('verify-content-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="border-top-color:var(--primary);border-color:rgba(37,99,235,.2)"></span> Verificando...';

  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:      document.getElementById('vc-text').value,
        signature: document.getElementById('vc-sig').value.trim(),
        username:  document.getElementById('vc-username').value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao verificar');
    showResult(data);
  } catch (ex) {
    showError(ex.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar';
  }
});

// ── Auto-verificar se URL tem /:id ────────────────────────────────────────────
(function autoVerify() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Espera path como /verify/<uuid>
  if (parts.length === 2 && parts[0] === 'verify') {
    const id = parts[1];
    document.getElementById('sig-id-input').value = id;
    verifyById(id);
  }
})();
