export function initSettings() {
  const btn = document.getElementById('settings-btn');
  if (btn) btn.addEventListener('click', openSettings);
}

async function openSettings() {
  // Prevent duplicate modals
  if (document.querySelector('.modal-overlay')) return;

  const res = await fetch('/api/settings');
  const { settings } = await res.json();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Settings</h2>
      </div>
      <form class="settings-form">
        ${settings.map(field => `
          <div class="form-group">
            <label class="form-label" for="setting-${field.key}">${field.label}</label>
            <input
              class="form-input"
              id="setting-${field.key}"
              data-key="${field.key}"
              data-type="${field.type}"
              type="${field.type === 'secret' ? 'password' : 'text'}"
              ${field.type === 'secret' ? `placeholder="${field.value}"` : `value="${field.value}"`}
              autocomplete="off"
            />
            ${field.restart ? '<span class="form-hint">Requires restart</span>' : ''}
          </div>
        `).join('')}
        <div class="modal-footer">
          <button type="button" class="btn btn-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const close = () => overlay.remove();

  overlay.querySelector('.btn-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onEscape = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEscape);
    }
  };
  document.addEventListener('keydown', onEscape);

  // Save handler
  overlay.querySelector('.settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = overlay.querySelectorAll('.form-input');
    const updates = {};

    for (const input of inputs) {
      const key = input.dataset.key;
      const type = input.dataset.type;
      const val = input.value.trim();

      // Only send secret fields if user actually typed a new value
      if (type === 'secret' && !val) continue;
      // Only send text fields if value changed from original
      if (type === 'text') {
        const original = settings.find(s => s.key === key)?.value || '';
        if (val === original) continue;
      }

      updates[key] = val;
    }

    if (Object.keys(updates).length === 0) {
      close();
      return;
    }

    const saveRes = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const result = await saveRes.json();
    close();

    if (result.restartNeeded) {
      alert('Settings saved. Some changes require a server restart to take effect.');
    }
  });
}
