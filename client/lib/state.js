/**
 * Minimal pub/sub state store
 */
const state = {
  chatMessages: [],
  tasks: [],
  fileTree: [],
  agentStatus: 'idle', // idle | thinking | streaming
  livekitRoom: null,
  pendingPermission: null,
  settings: loadSettings(),
  wsConnected: false,
};

const listeners = new Map();

export function getState(key) {
  return key ? state[key] : { ...state };
}

export function setState(key, value) {
  state[key] = value;
  notify(key, value);
}

export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

function notify(key, value) {
  const subs = listeners.get(key);
  if (subs) subs.forEach(fn => fn(value));
}

// Convenience: append to array state
export function appendState(key, item) {
  const arr = [...(state[key] || []), item];
  setState(key, arr);
}

// Update item in array by id
export function updateInArray(key, id, updates) {
  const arr = (state[key] || []).map(item =>
    item.id === id ? { ...item, ...updates } : item
  );
  setState(key, arr);
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('claude-collab-settings') || '{}');
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  setState('settings', settings);
  localStorage.setItem('claude-collab-settings', JSON.stringify(settings));
}
