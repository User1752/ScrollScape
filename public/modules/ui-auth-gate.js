// ============================================================================
// AUTH GATE — optional single-password lock, off unless set in Settings.
// See server/modules/auth/service.js for the server-side half; this client
// piece is purely UX (show a login form) — the actual boundary is enforced
// server-side (server/middleware/auth-gate.js rejects /api/* with 401 when
// there's no valid session), so failing open here on a network hiccup just
// means the rest of the app's own API calls will surface the same 401.
// ============================================================================

async function checkAuthGate() {
  let status;
  try {
    status = await fetch('/api/auth/status').then((r) => r.json());
  } catch (_) {
    return true;
  }
  if (!status?.passwordSet || status.authenticated) return true;

  return new Promise((resolve) => {
    const overlay = document.getElementById('authGateOverlay');
    const form = document.getElementById('authGateForm');
    const input = document.getElementById('authGatePasswordInput');
    const errorEl = document.getElementById('authGateError');
    const submitBtn = document.getElementById('authGateSubmitBtn');
    if (!overlay || !form || !input || !errorEl || !submitBtn) { resolve(true); return; }

    overlay.classList.remove('hidden');
    input.focus();

    form.onsubmit = async (e) => {
      e.preventDefault();
      errorEl.classList.add('hidden');
      submitBtn.disabled = true;
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: input.value }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || 'Incorrect password');
        overlay.classList.add('hidden');
        resolve(true);
      } catch (err) {
        errorEl.textContent = err.message || 'Incorrect password';
        errorEl.classList.remove('hidden');
        input.value = '';
        input.focus();
      } finally {
        submitBtn.disabled = false;
      }
    };
  });
}
