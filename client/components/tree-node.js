import { escapeHtml } from '../lib/escape-html.js';

export function createTreeNode(item, loadDirectory) {
  const el = document.createElement('div');

  const row = document.createElement('div');
  row.className = `tree-item ${item.type}`;
  row.innerHTML = `<span class="icon"></span><span class="name">${escapeHtml(item.name)}</span>`;

  el.appendChild(row);

  if (item.type === 'directory') {
    let loaded = false;
    let expanded = false;
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.style.display = 'none';
    el.appendChild(childrenContainer);

    row.addEventListener('click', async () => {
      expanded = !expanded;
      row.classList.toggle('expanded', expanded);
      childrenContainer.style.display = expanded ? '' : 'none';

      if (!loaded) {
        loaded = true;
        childrenContainer.innerHTML = '<div style="padding:4px 8px;color:var(--text-muted);font-size:12px;">Loading...</div>';
        try {
          const children = await loadDirectory(item.path);
          childrenContainer.innerHTML = '';
          for (const child of children) {
            childrenContainer.appendChild(createTreeNode(child, loadDirectory));
          }
        } catch {
          childrenContainer.innerHTML = '<div style="color:var(--danger);padding:4px 8px;font-size:12px;">Failed to load</div>';
        }
      }
    });
  }

  return el;
}

