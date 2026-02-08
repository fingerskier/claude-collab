import { getState, setState, subscribe, appendState } from '../lib/state.js';
import { on } from '../lib/ws-client.js';
import { createTreeNode } from '../components/tree-node.js';
import { escapeHtml } from '../lib/escape-html.js';

let artifactId = 0;
const synopsisCache = new Map();
let activePopover = null;

export function initProjectContext() {
  // --- File tree (preserved from file-tree.js) ---
  loadDirectory('.');

  document.getElementById('refresh-files-btn')?.addEventListener('click', () => {
    loadDirectory('.');
  });

  on('files:changed', () => {
    loadDirectory('.');
    synopsisCache.clear();
  });

  // --- Section toggles ---
  document.querySelectorAll('.context-section-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking the refresh button
      if (e.target.closest('.btn')) return;
      const section = header.parentElement;
      section.classList.toggle('expanded');
    });
  });

  // --- Status rendering ---
  renderStatus();
  subscribe('wsConnected', renderStatus);
  subscribe('livekitRoom', renderStatus);
  subscribe('agentStatus', renderStatus);
  subscribe('roomParticipants', renderStatus);

  // --- Artifacts rendering ---
  subscribe('sessionArtifacts', renderArtifacts);

  // --- Left-click file -> show synopsis popover ---
  document.getElementById('file-tree')?.addEventListener('file:select', async (e) => {
    const path = e.detail?.path;
    const name = e.detail?.name;
    if (!path) return;

    const anchor = e.target.closest('.tree-item') || e.target;
    dismissPopover();

    // Check cache
    if (synopsisCache.has(path)) {
      showPopover(anchor, synopsisCache.get(path), name);
      return;
    }

    // Show loading popover
    const popover = showPopover(anchor, null, name);

    try {
      const res = await fetch('/api/files/synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      const synopsis = data.synopsis || data.error || 'No synopsis available.';
      synopsisCache.set(path, synopsis);
      // Only update if this popover is still active
      if (activePopover === popover) {
        updatePopoverContent(popover, synopsis);
      }
    } catch (err) {
      if (activePopover === popover) {
        updatePopoverContent(popover, 'Failed to load synopsis.');
      }
    }
  });

  // --- Right-click file -> insert @path into chat ---
  document.getElementById('file-tree')?.addEventListener('file:context', (e) => {
    const path = e.detail?.path;
    if (!path) return;
    const input = document.getElementById('chat-input');
    if (!input) return;
    const ref = `@${path} `;
    const start = input.selectionStart;
    const before = input.value.slice(0, start);
    const after = input.value.slice(input.selectionEnd);
    input.value = before + ref + after;
    input.focus();
    input.selectionStart = input.selectionEnd = start + ref.length;
  });

  // --- Dismiss popover on click outside or Escape ---
  document.addEventListener('click', (e) => {
    if (activePopover && !activePopover.contains(e.target) && !e.target.closest('.tree-item')) {
      dismissPopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dismissPopover();
  });
}

// --- Popover functions ---

function showPopover(anchor, content, fileName) {
  dismissPopover();
  const popover = document.createElement('div');
  popover.className = 'synopsis-popover';
  popover.innerHTML =
    `<div class="synopsis-popover-header">${escapeHtml(fileName)}</div>` +
    `<div class="synopsis-popover-body">${content ? escapeHtml(content) : '<span class="synopsis-loading">Loading synopsis...</span>'}</div>`;

  document.body.appendChild(popover);
  activePopover = popover;
  positionPopover(popover, anchor);
  return popover;
}

function positionPopover(el, anchor) {
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = 320;

  // Position to the right of the clicked row
  let left = rect.right + 8;
  let top = rect.top;

  // Flip left if it would overflow the viewport
  if (left + popoverWidth > window.innerWidth) {
    left = rect.left - popoverWidth - 8;
  }

  // Keep within vertical bounds
  if (top + 250 > window.innerHeight) {
    top = window.innerHeight - 260;
  }
  if (top < 4) top = 4;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function updatePopoverContent(el, text) {
  const body = el.querySelector('.synopsis-popover-body');
  if (body) body.textContent = text;
}

function dismissPopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

// --- File tree logic (unchanged) ---

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
  const el = document.getElementById('file-tree');
  if (!el) return;
  el.innerHTML = '';
  for (const item of items) {
    el.appendChild(createTreeNode(item, loadDirectory));
  }
}

// --- Status section ---

function renderStatus() {
  const el = document.getElementById('context-status');
  if (!el) return;

  const wsConnected = getState('wsConnected');
  const roomName = getState('livekitRoom');
  const agentStatus = getState('agentStatus');
  const participants = getState('roomParticipants') || [];

  const lines = [];

  // Server connection
  const serverColor = wsConnected ? 'var(--success)' : 'var(--danger)';
  const serverText = wsConnected ? 'Server connected' : 'Disconnected';
  lines.push(statusLine(serverColor, serverText));

  // Room
  if (roomName) {
    lines.push(statusLine('var(--success)', `Room "${escapeHtml(roomName)}"`));
    if (participants.length > 0) {
      lines.push(statusLine('var(--text-muted)', `${participants.length} participant${participants.length !== 1 ? 's' : ''}`));
    }
  }

  // Agent status
  if (agentStatus && agentStatus !== 'idle') {
    const color = agentStatus === 'streaming' ? 'var(--primary)' : 'var(--warning)';
    lines.push(statusLine(color, `Agent: ${agentStatus}`));
  }

  el.innerHTML = lines.join('');
}

function statusLine(dotColor, text) {
  return `<div class="context-status-line"><span class="status-dot" style="background:${dotColor}"></span>${escapeHtml(text)}</div>`;
}

// --- Artifacts section ---

function renderArtifacts() {
  const list = document.getElementById('artifacts-list');
  const badge = document.getElementById('artifacts-count');
  if (!list) return;

  const artifacts = getState('sessionArtifacts') || [];

  // Update badge
  if (badge) {
    if (artifacts.length > 0) {
      badge.textContent = artifacts.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  list.innerHTML = '';
  // Show newest first
  for (let i = artifacts.length - 1; i >= 0; i--) {
    const a = artifacts[i];
    const icon = artifactIcon(a.type);
    const typeClass = `type-${a.type}`;
    const ts = formatTime(a.ts);
    const div = document.createElement('div');
    div.className = 'artifact-item';
    div.innerHTML = `<span class="artifact-icon">${icon}</span><span class="artifact-content ${typeClass}">${escapeHtml(a.content)}</span><span class="artifact-ts">${ts}</span>`;
    list.appendChild(div);
  }
}

function artifactIcon(type) {
  switch (type) {
    case 'cognate': return '&#128172;'; // speech bubble
    case 'link': return '&#128279;';    // link
    case 'snippet': return '&#128196;'; // page
    case 'bookmark': return '&#128278;';// bookmark
    default: return '&#8226;';
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Public API for adding artifacts ---

export function addArtifact(type, content, sender) {
  const artifacts = getState('sessionArtifacts') || [];
  // Cap at 100
  if (artifacts.length >= 100) {
    artifacts.shift();
  }
  appendState('sessionArtifacts', {
    id: ++artifactId,
    type,
    content: content?.slice(0, 500) || '',
    sender: sender || 'unknown',
    ts: Date.now(),
  });
}
