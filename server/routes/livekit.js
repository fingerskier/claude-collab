import { Router } from 'express';

const router = Router();

// POST /api/livekit/token - generate a LiveKit JWT
router.post('/token', async (req, res) => {
  const { room, identity } = req.body;
  if (!room || !identity) {
    return res.status(400).json({ error: 'room and identity required' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LiveKit not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env' });
  }

  try {
    const { AccessToken } = await import('livekit-server-sdk');
    const token = new AccessToken(apiKey, apiSecret, { identity });
    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });
    const jwt = await token.toJwt();
    res.json({ token: jwt, wsUrl: process.env.LIVEKIT_WS_URL });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
