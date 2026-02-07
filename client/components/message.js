export function createMessage(role, content) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;

  const contentEl = document.createElement('div');
  contentEl.className = 'msg-content';
  contentEl.textContent = content;
  el.appendChild(contentEl);

  return el;
}
