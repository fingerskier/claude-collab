import { escapeHtml } from '../lib/escape-html.js';

export function createTaskCard(task, { onApprove, onReject }) {
  const el = document.createElement('div');
  el.className = 'task-card';
  el.dataset.id = task.id;

  el.innerHTML = `
    <div class="task-card-header">
      <span class="badge ${task.status}">${task.status}</span>
      <span style="font-size:11px;color:var(--text-muted);">${task.id}</span>
    </div>
    <div class="prompt-preview">${escapeHtml(task.prompt || '')}</div>
  `;

  if (task.status === 'review') {
    const actions = document.createElement('div');
    actions.className = 'task-card-actions';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn btn-sm btn-success';
    approveBtn.textContent = 'Approve';
    approveBtn.addEventListener('click', () => onApprove(task.id));

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn btn-sm btn-danger';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => onReject(task.id));

    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);
    el.appendChild(actions);
  }

  return el;
}

