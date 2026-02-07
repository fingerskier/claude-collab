import { getState, appendState, setState, subscribe } from '../lib/state.js';
import { send, on } from '../lib/ws-client.js';
import { createMessage } from '../components/message.js';

const messagesEl = () => document.getElementById('chat-messages');
const inputEl = () => document.getElementById('chat-input');
const sendBtn = () => document.getElementById('send-btn');
const interruptBtn = () => document.getElementById('interrupt-btn');

let currentAssistantEl = null;
let currentAssistantText = '';

export function initChat() {
  // Send button
  sendBtn()?.addEventListener('click', sendUserMessage);

  // Enter to send (shift+enter for newline)
  inputEl()?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

function handleAgentText(msg) {
  setState('agentStatus', 'streaming');

  if (!currentAssistantEl) {
    currentAssistantEl = addMessageToUI('assistant', '');
    currentAssistantText = '';
  }

  currentAssistantText += msg.text;
  currentAssistantEl.querySelector('.msg-content').textContent = currentAssistantText;
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

  appendState('chatMessages', {
    role: 'assistant',
    content: currentAssistantText,
    ts: Date.now(),
  });

  currentAssistantEl = null;
  currentAssistantText = '';
}

function handleAgentError(msg) {
  setState('agentStatus', 'idle');
  interruptBtn().style.display = 'none';

  addMessageToUI('assistant', `Error: ${msg.error}`).style.color = 'var(--danger)';
  currentAssistantEl = null;
  currentAssistantText = '';
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

function scrollToBottom() {
  const el = messagesEl();
  if (el) el.scrollTop = el.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
