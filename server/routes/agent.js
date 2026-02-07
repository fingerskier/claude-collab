import { Router } from 'express';
import { sendMessage, interruptAgent } from '../services/agent-session.js';

const router = Router();

// POST /api/agent/send - send message (mostly used via WS, but HTTP fallback)
router.post('/send', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  // Agent responses stream over WebSocket, this just acknowledges receipt
  res.json({ ok: true, note: 'Responses stream via WebSocket' });
});

// POST /api/agent/interrupt - interrupt current agent turn
router.post('/interrupt', (_req, res) => {
  // Will be handled via WebSocket in practice
  res.json({ ok: true });
});

export default router;
