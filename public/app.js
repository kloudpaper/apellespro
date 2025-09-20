// ====== CONFIGURA AQUÍ tu API ======
const API_BASE = 'apellespro-production.up.railway.app'; // cámbialo si usas otro dominio

const form = document.getElementById('regForm');
const statusEl = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'Enviando…';

  const fd = new FormData(form);
  const payload = {
    firstName: fd.get('firstName')?.trim(),
    lastName:  fd.get('lastName')?.trim(),
    email:     fd.get('email')?.trim(),
    phone:     fd.get('phone')?.trim() || ''
  };

  if (!payload.firstName || !payload.lastName || !payload.email) {
    statusEl.textContent = 'Por favor completa nombre, apellidos y correo.';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    statusEl.textContent = json?.message || '¡Registro exitoso! Revisa tu correo.';
    form.reset();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + (err.message || 'No se pudo registrar.');
  }
});
