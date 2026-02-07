/**
 * WebSocket client with auto-reconnect and message routing
 */
import { setState } from './state.js';

let ws = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
const handlers = new Map();

export function connect() {
  if (ws && ws.readyState <= 1) return; // already connected or connecting

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws`;

  setState('wsConnected', false);
  updateStatus('connecting');

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[ws] connected');
    setState('wsConnected', true);
    updateStatus('connected');
    clearTimeout(reconnectTimer);
    reconnectDelay = 1000;
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      console.warn('[ws] invalid message:', event.data);
      return;
    }
    dispatch(msg);
  };

  ws.onclose = () => {
    console.log('[ws] disconnected');
    setState('wsConnected', false);
    updateStatus('disconnected');
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.error('[ws] error:', err);
  };
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => connect(), reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

function updateStatus(status) {
  const dot = document.getElementById('connection-status');
  if (dot) {
    dot.className = `status-dot ${status}`;
    dot.title = status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    console.warn('[ws] not connected, message dropped:', msg);
  }
}

export function on(type, handler) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(handler);
  return () => handlers.get(type).delete(handler);
}

function dispatch(msg) {
  const fns = handlers.get(msg.type);
  if (fns) fns.forEach(fn => fn(msg));

  // Wildcard handlers
  const wildcards = handlers.get('*');
  if (wildcards) wildcards.forEach(fn => fn(msg));
}
