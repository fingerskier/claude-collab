import { getState, setState } from '../lib/state.js';

let room = null;

export function initScreenShare() {
  document.getElementById('join-room-btn')?.addEventListener('click', joinRoom);
  document.getElementById('share-screen-btn')?.addEventListener('click', toggleScreenShare);
}

async function joinRoom() {
  const roomName = document.getElementById('room-input')?.value?.trim();
  if (!roomName) return;

  const identity = `user-${Date.now().toString(36)}`;

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

    room.on(RoomEvent.Disconnected, () => {
      setState('livekitRoom', null);
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
