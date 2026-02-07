import { WebSocketServer } from 'ws';
import { getSession, sendMessage, interruptAgent } from '../services/agent-session.js';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade manually so Vite HMR doesn't conflict
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Let other upgrades (Vite HMR) pass through
  });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
        return;
      }
      handleMessage(ws, wss, msg);
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  });

  return wss;
}

function handleMessage(ws, wss, msg) {
  switch (msg.type) {
    case 'agent:send':
      sendMessage(ws, msg.message);
      break;

    case 'agent:interrupt':
      interruptAgent(ws);
      break;

    case 'permission:respond':
      getSession()?.resolvePermission(msg.approved);
      break;

    case 'task:submit':
      handleTaskSubmit(ws, wss, msg);
      break;

    case 'task:approve':
    case 'task:reject':
      handleTaskAction(ws, wss, msg);
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
  }
}

function handleTaskSubmit(ws, wss, msg) {
  const task = {
    id: Date.now().toString(36),
    prompt: msg.prompt,
    status: 'queued',
    createdAt: Date.now(),
  };

  broadcast(wss, { type: 'task:update', task });
  sendMessage(ws, msg.prompt, task.id);
}

function handleTaskAction(ws, wss, msg) {
  broadcast(wss, {
    type: 'task:update',
    task: { id: msg.taskId, status: msg.type === 'task:approve' ? 'approved' : 'rejected' },
  });
}

export function broadcast(wss, data) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
