import { getState, subscribe, saveSettings } from '../lib/state.js';
import { submitPrompt } from './chat.js';

const container = () => document.getElementById('task-buttons');

let buttonsConfig = [];

export async function initTaskButtons() {
  try {
    const res = await fetch('/api/files/content?path=client/config/buttons.json');
    const data = await res.json();
    buttonsConfig = JSON.parse(data.content);
  } catch {
    buttonsConfig = getDefaultButtons();
  }

  renderButtons();
}

function getDefaultButtons() {
  return [
    { id: 'explain', label: 'Explain', promptTemplate: 'Explain the current code in {file}', defaultVisible: true },
    { id: 'fix', label: 'Fix Bug', promptTemplate: 'Find and fix bugs in this project', defaultVisible: true },
    { id: 'refactor', label: 'Refactor', promptTemplate: 'Suggest refactoring improvements', defaultVisible: true },
    { id: 'test', label: 'Write Tests', promptTemplate: 'Write tests for the current module', defaultVisible: true },
    { id: 'review', label: 'Code Review', promptTemplate: 'Review the recent changes and provide feedback', defaultVisible: true },
    { id: 'docs', label: 'Add Docs', promptTemplate: 'Add documentation comments to the code', defaultVisible: false },
    { id: 'optimize', label: 'Optimize', promptTemplate: 'Suggest performance optimizations', defaultVisible: false },
  ];
}

function renderButtons() {
  const el = container();
  if (!el) return;

  const settings = getState('settings');
  const hidden = settings.hiddenButtons || [];

  el.innerHTML = '';
  for (const btn of buttonsConfig) {
    if (!btn.defaultVisible && hidden.includes(btn.id)) continue;
    if (hidden.includes(btn.id)) continue;

    const button = document.createElement('button');
    button.className = 'task-btn';
    button.textContent = btn.label;
    button.title = btn.promptTemplate;
    button.addEventListener('click', () => {
      if (btn.requiresInput) {
        const val = prompt(`Input for "${btn.label}":`);
        if (!val) return;
        submitPrompt(btn.promptTemplate.replace('{input}', val));
      } else {
        submitPrompt(btn.promptTemplate);
      }
    });
    el.appendChild(button);
  }
}
