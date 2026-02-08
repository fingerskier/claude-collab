/**
 * Minimal pub/sub state store
 */
const state = {
  chatMessages: [],
  tasks: [],
  fileTree: [],
  roomMessages: [],
  agentStatus: 'idle', // idle | thinking | streaming
  livekitRoom: null,
  pendingPermission: null,
  settings: loadSettings(),
  wsConnected: false,
  sessionArtifacts: [],   // { id, type, content, sender, ts } — type: cognate|bookmark|link|snippet
  roomParticipants: [],   // { identity, joinedAt }
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

const pendingNotifications = new Map();
let notifyScheduled = false;

function notify(key, value) {
  pendingNotifications.set(key, value);
  if (!notifyScheduled) {
    notifyScheduled = true;
    queueMicrotask(flushNotifications);
  }
}

function flushNotifications() {
  notifyScheduled = false;
  for (const [key, value] of pendingNotifications) {
    const subs = listeners.get(key);
    if (subs) subs.forEach(fn => fn(value));
  }
  pendingNotifications.clear();
}

// Convenience: append to array state (mutates in-place to avoid O(n) copy)
export function appendState(key, item) {
  if (!state[key]) state[key] = [];
  state[key].push(item);
  notify(key, state[key]);
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
