import { getState, setState, appendState } from '../lib/state.js';
import { injectCognateMessage } from './chat.js';
import { addArtifact } from './project-context.js';

let room = null;
let localIdentity = null;

export function getRoom() { return room; }
export function getIdentity() { return localIdentity; }

export function initScreenShare() {
  document.getElementById('join-room-btn')?.addEventListener('click', joinRoom);
  document.getElementById('share-screen-btn')?.addEventListener('click', toggleScreenShare);
  initSplitter();
}

function initSplitter() {
  const splitter = document.getElementById('panel-splitter');
  const app = document.getElementById('app');
  if (!splitter || !app) return;

  // Restore persisted width
  const saved = localStorage.getItem('screenshare-width');
  if (saved) app.style.setProperty('--screenshare-width', saved + 'px');

  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    app.classList.add('resizing');

    const onMove = (e) => {
      const vw = document.documentElement.clientWidth;
      let width = vw - e.clientX;
      // Clamp between 200px and 60% of viewport
      width = Math.max(200, Math.min(width, vw * 0.6));
      app.style.setProperty('--screenshare-width', width + 'px');
    };

    const onUp = (e) => {
      splitter.releasePointerCapture(e.pointerId);
      app.classList.remove('resizing');
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
      // Persist
      const current = getComputedStyle(app).getPropertyValue('--screenshare-width').trim();
      localStorage.setItem('screenshare-width', parseInt(current, 10));
    };

    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
  });
}

async function joinRoom() {
  const roomName = document.getElementById('room-input')?.value?.trim();
  if (!roomName) return;

  const identity = `user-${Date.now().toString(36)}`;
  localIdentity = identity;

  try {
    // Get token from server
    const res = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomName, identity }),
    });
    const data = await res.json();

    if (data.error) {
      console.error('LiveKit token error:', data.error);
      alert(data.error);
      return;
    }

    // Dynamic import of livekit-client
    const { Room, RoomEvent } = await import('livekit-client');

    room = new Room();

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === 'video') {
        const el = track.attach();
        if (track.source === 'screen_share') {
          document.getElementById('remote-video-container').innerHTML = '';
          document.getElementById('remote-video-container').appendChild(el);
          document.getElementById('screen-share-placeholder').style.display = 'none';
        } else {
          // Webcam -> PiP
          document.getElementById('webcam-pip').innerHTML = '';
          document.getElementById('webcam-pip').appendChild(el);
          document.getElementById('webcam-pip').style.display = 'block';
        }
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach(el => el.remove());
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      const participants = getState('roomParticipants') || [];
      if (!participants.find(p => p.identity === participant.identity)) {
        appendState('roomParticipants', { identity: participant.identity, joinedAt: Date.now() });
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      const participants = (getState('roomParticipants') || []).filter(p => p.identity !== participant.identity);
      setState('roomParticipants', participants);
    });

    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);
        if (msg.type === 'room:chat') {
          // Don't echo our own messages (already shown locally)
          if (participant?.identity !== localIdentity) {
            if (msg.text && msg.text.startsWith('cognate:')) {
              const cognateText = msg.text.slice('cognate:'.length);
              const sender = msg.sender || participant?.identity || 'unknown';
              injectCognateMessage(cognateText, sender);
              addArtifact('cognate', cognateText, sender);
            } else {
              appendState('roomMessages', msg);
            }
          }
        }
      } catch (err) {
        console.warn('[livekit] failed to parse data message:', err);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      setState('livekitRoom', null);
      setState('roomParticipants', []);
      document.getElementById('screen-share-placeholder').style.display = '';
      document.getElementById('remote-video-container').innerHTML = '';
      document.getElementById('webcam-pip').innerHTML = '';
      document.getElementById('webcam-pip').style.display = 'none';
    });

    await room.connect(data.wsUrl, data.token);
    setState('livekitRoom', roomName);
    document.getElementById('screen-share-placeholder').textContent = `Connected to "${roomName}"`;
    console.log('[livekit] connected to room:', roomName);
  } catch (err) {
    console.error('[livekit] failed to connect:', err);
    alert('Failed to connect to room: ' + err.message);
  }
}

async function toggleScreenShare() {
  if (!room) {
    alert('Join a room first');
    return;
  }

  try {
    const enabled = room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(!enabled);
    document.getElementById('share-screen-btn').textContent = enabled ? 'Share Screen' : 'Stop Sharing';
  } catch (err) {
    console.error('[livekit] screen share error:', err);
  }
}
