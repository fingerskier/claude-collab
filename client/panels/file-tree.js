import { setState, subscribe } from '../lib/state.js';
import { on } from '../lib/ws-client.js';
import { createTreeNode } from '../components/tree-node.js';

const container = () => document.getElementById('file-tree');

export function initFileTree() {
  loadDirectory('.');

  // Refresh button
  document.getElementById('refresh-files-btn')?.addEventListener('click', () => {
    loadDirectory('.');
  });

  // Listen for file changes from server
  on('files:changed', () => loadDirectory('.'));
}

async function loadDirectory(dirPath) {
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
    const items = await res.json();

    if (dirPath === '.') {
      setState('fileTree', items);
      renderRoot(items);
    }

    return items;
  } catch (err) {
    console.error('Failed to load file tree:', err);
    return [];
  }
}

function renderRoot(items) {
  const el = container();
  if (!el) return;
  el.innerHTML = '';
  for (const item of items) {
    el.appendChild(createTreeNode(item, loadDirectory));
  }
}
