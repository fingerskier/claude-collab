import { getState, subscribe, updateInArray, appendState } from '../lib/state.js';
import { on, send } from '../lib/ws-client.js';
import { createTaskCard } from '../components/task-card.js';

const queueEl = () => document.getElementById('task-queue');
const countEl = () => document.getElementById('task-count');

export function initTaskQueue() {
  on('task:update', handleTaskUpdate);
  subscribe('tasks', renderTasks);
}

function handleTaskUpdate(msg) {
  const tasks = getState('tasks');
  const existing = tasks.find(t => t.id === msg.task.id);
  if (existing) {
    updateInArray('tasks', msg.task.id, msg.task);
  } else {
    appendState('tasks', msg.task);
  }
}

function renderTasks(tasks) {
  const el = queueEl();
  if (!el) return;

  el.innerHTML = '';
  for (const task of tasks) {
    el.appendChild(createTaskCard(task, {
      onApprove: (id) => send({ type: 'task:approve', taskId: id }),
      onReject: (id) => send({ type: 'task:reject', taskId: id }),
    }));
  }

  const count = countEl();
  if (count) {
    const active = tasks.filter(t => t.status !== 'done' && t.status !== 'rejected').length;
    count.textContent = active;
  }
}
