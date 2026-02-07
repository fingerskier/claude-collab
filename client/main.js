import { connect } from './lib/ws-client.js';
import { initFileTree } from './panels/file-tree.js';
import { initChat } from './panels/chat.js';
import { initTaskQueue } from './panels/task-queue.js';
import { initScreenShare } from './panels/screen-share.js';
import { initTaskButtons } from './panels/task-buttons.js';
import { initSettings } from './panels/settings.js';

// Initialize WebSocket connection
connect();

// Initialize panels
initFileTree();
initChat();
initTaskQueue();
initTaskButtons();
initScreenShare();
initSettings();

// Room code from URL param
const params = new URLSearchParams(location.search);
const room = params.get('room');
if (room) {
  const input = document.getElementById('room-input');
  if (input) input.value = room;
}
