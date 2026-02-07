import { getState, appendState, setState, subscribe } from '../lib/state.js';
import { send, on } from '../lib/ws-client.js';
import { createMessage } from '../components/message.js';
import { getRoom, getIdentity } from './screen-share.js';
import { escapeHtml } from '../lib/escape-html.js';

const messagesEl = () => document.getElementById('chat-messages');
const inputEl = () => document.getElementById('chat-input');
const sendBtn = () => document.getElementById('send-btn');
const roomSendBtn = () => document.getElementById('room-send-btn');
const interruptBtn = () => document.getElementById('interrupt-btn');

let currentAssistantEl = null;
let currentAssistantText = '';
let currentTextBlockEl = null;

export function initChat() {
  // Send button
  sendBtn()?.addEventListener('click', sendUserMessage);

  // Room send button
  roomSendBtn()?.addEventListener('click', sendRoomMessage);

  // Enter to send (shift+enter for newline, ctrl+enter for room)
  inputEl()?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      sendRoomMessage();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage();
    }
  });

  // Interrupt button
  interruptBtn()?.addEventListener('click', () => {
    send({ type: 'agent:interrupt' });
  });

  // WebSocket message handlers
  on('agent:text', handleAgentText);
  on('agent:tool_call', handleToolCall);
  on('agent:done', handleAgentDone);
  on('agent:error', handleAgentError);
  on('agent:status', handleAgentStatus);
  on('agent:interrupted', handleInterrupted);
  on('agent:permission', handlePermission);
}

function sendUserMessage() {
  const input = inputEl();
  const message = input?.value?.trim();
  if (!message) return;

  // Add user message to UI
  addMessageToUI('user', message);
  appendState('chatMessages', { role: 'user', content: message, ts: Date.now() });

  // Send over WebSocket
  send({ type: 'agent:send', message });

  // Clear input
  input.value = '';
  input.focus();

  // Update status
  setState('agentStatus', 'thinking');
  interruptBtn().style.display = '';
}

export function submitPrompt(prompt) {
  const input = inputEl();
  if (input) {
    input.value = prompt;
    sendUserMessage();
  }
}

function sendRoomMessage() {
  const input = inputEl();
  const text = input?.value?.trim();
  if (!text) return;

  const room = getRoom();
  if (!room) {
    alert('Join a room first');
    return;
  }

  const cognateMatch = text.match(/^cognate:\s*/i);
  const isCognate = cognateMatch !== null;
  const content = isCognate ? text.slice(cognateMatch[0].length) : text;

  if (isCognate && !content) return;

  const msg = {
    type: 'room:chat',
    sender: getIdentity() || 'unknown',
    text: isCognate ? `cognate:${content}` : content,
    ts: Date.now(),
  };

  const encoded = new TextEncoder().encode(JSON.stringify(msg));
  room.localParticipant.publishData(encoded, { reliable: true });

  appendState('roomMessages', {
    ...msg,
    text: content,
    sender: isCognate ? 'You (shared)' : 'You',
  });

  input.value = '';
  input.focus();
}

function handleAgentText(msg) {
  setState('agentStatus', 'streaming');

  if (!currentAssistantEl) {
    currentAssistantEl = addMessageToUI('assistant', '');
    currentAssistantText = '';
    currentTextBlockEl = null;

  }

  if (!currentTextBlockEl) {
    currentTextBlockEl = document.createElement('div');
    currentTextBlockEl.className = 'msg-content';
    currentAssistantEl.appendChild(currentTextBlockEl);

  }

  currentAssistantText += msg.text;
  currentTextBlockEl.appendChild(document.createTextNode(msg.text));
  scrollToBottom();
}

function handleToolCall(msg) {
  if (!currentAssistantEl) {
    currentAssistantEl = addMessageToUI('assistant', '');
    currentAssistantText = '';
  }

  const toolEl = document.createElement('div');
  toolEl.className = 'tool-call';
  toolEl.innerHTML = `
    <div class="tool-call-header">&#9881; ${escapeHtml(msg.tool)}</div>
    <div class="tool-call-body"><pre>${escapeHtml(JSON.stringify(msg.input, null, 2))}</pre></div>
  `;
  toolEl.addEventListener('click', () => toolEl.classList.toggle('expanded'));

  currentAssistantEl.appendChild(toolEl);
  currentTextBlockEl = null;
  currentSegmentText = '';
  scrollToBottom();
}

function handleAgentDone(msg) {
  setState('agentStatus', 'idle');
  interruptBtn().style.display = 'none';

  if (currentAssistantEl && msg.cost) {
    const costEl = document.createElement('div');
    costEl.className = 'msg-meta';
    costEl.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:6px;';
    costEl.textContent = `Cost: $${msg.cost?.toFixed(4) || '?'} | ${msg.duration ? (msg.duration / 1000).toFixed(1) + 's' : ''}`;
    currentAssistantEl.appendChild(costEl);
  }

  // Add share button if connected to a room
  if (currentAssistantEl && currentAssistantText && getRoom()) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-xs cognate-share-btn';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', () => {
      const room = getRoom();
      if (!room) return;

      const text = shareBtn.dataset.text;
      const chatMsg = {
        type: 'room:chat',
        sender: getIdentity() || 'unknown',
        text: `cognate:${text}`,
        ts: Date.now(),
      };

      const encoded = new TextEncoder().encode(JSON.stringify(chatMsg));
      room.localParticipant.publishData(encoded, { reliable: true });

      // Local echo in room messages
      appendState('roomMessages', { ...chatMsg, text, sender: 'You (shared)' });

      shareBtn.textContent = 'Shared';
      shareBtn.disabled = true;
    });
    shareBtn.dataset.text = currentAssistantText;
    currentAssistantEl.appendChild(shareBtn);
  }

  appendState('chatMessages', {
    role: 'assistant',
    content: currentAssistantText,
    ts: Date.now(),
  });

  currentAssistantEl = null;
  currentAssistantText = '';
  currentTextBlockEl = null;
  currentSegmentText = '';
}

function handleAgentError(msg) {
  setState('agentStatus', 'idle');
  interruptBtn().style.display = 'none';

  addMessageToUI('assistant', `Error: ${msg.error}`).style.color = 'var(--danger)';
  currentAssistantEl = null;
  currentAssistantText = '';
  currentTextBlockEl = null;
  currentSegmentText = '';
}

function handleAgentStatus(msg) {
  setState('agentStatus', msg.status);
  if (msg.status === 'thinking') {
    interruptBtn().style.display = '';
  }
}

function handleInterrupted() {
  setState('agentStatus', 'idle');
  interruptBtn().style.display = 'none';

  if (currentAssistantEl) {
    const el = document.createElement('div');
    el.style.cssText = 'color:var(--warning);font-size:12px;margin-top:4px;';
    el.textContent = '[interrupted]';
    currentAssistantEl.appendChild(el);
  }
  currentAssistantEl = null;
  currentAssistantText = '';
  currentTextBlockEl = null;
  currentSegmentText = '';
}

function handlePermission(msg) {
  setState('pendingPermission', msg);

  const container = messagesEl();
  const el = document.createElement('div');
  el.className = 'permission-request';
  el.innerHTML = `
    <div class="perm-title">Permission Required: ${escapeHtml(msg.tool || 'Unknown tool')}</div>
    <div class="perm-detail" style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
      ${escapeHtml(JSON.stringify(msg.input || {}, null, 2))}
    </div>
    <div class="permission-buttons">
      <button class="btn btn-sm btn-success perm-approve">Approve</button>
      <button class="btn btn-sm btn-danger perm-deny">Deny</button>
    </div>
  `;

  el.querySelector('.perm-approve').addEventListener('click', () => {
    send({ type: 'permission:respond', approved: true });
    el.remove();
    setState('pendingPermission', null);
  });

  el.querySelector('.perm-deny').addEventListener('click', () => {
    send({ type: 'permission:respond', approved: false });
    el.remove();
    setState('pendingPermission', null);
  });

  container.appendChild(el);
  scrollToBottom();
}

function addMessageToUI(role, content) {
  const el = createMessage(role, content);
  messagesEl().appendChild(el);
  scrollToBottom();
  return el;
}

let scrollRafPending = false;
function scrollToBottom() {
  if (scrollRafPending) return;
  scrollRafPending = true;
  requestAnimationFrame(() => {
    scrollRafPending = false;
    const el = messagesEl();
    if (el) el.scrollTop = el.scrollHeight;
  });
}

export function injectCognateMessage(text, sender) {
  const el = createMessage('cognate', text, { sender });
  messagesEl().appendChild(el);
  scrollToBottom();

  appendState('chatMessages', { role: 'cognate', content: text, sender, ts: Date.now() });

  // Send to Claude as a user message with context
  send({ type: 'agent:send', message: `[Cognate from ${sender}]:\n${text}` });
  setState('agentStatus', 'thinking');
  interruptBtn().style.display = '';
}

