import { Router } from 'express';
import { getTree, getFileContent } from '../services/file-tree.js';

const router = Router();

// GET /api/files?path= - directory listing (one level)
router.get('/', async (req, res) => {
  try {
    const dirPath = req.query.path || '.';
    const tree = await getTree(dirPath);
    res.json(tree);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/files/content?path= - file contents
router.get('/content', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    const content = await getFileContent(filePath);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/synopsis - AI-generated file synopsis
router.post('/synopsis', async (req, res) => {
  const filePath = req.body?.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  let content;
  try {
    content = await getFileContent(filePath);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Detect binary: check first 512 bytes for control chars (except common whitespace)
  const sample = content.slice(0, 512);
  const isBinary = /[\x00-\x08\x0E-\x1F]/.test(sample);
  if (isBinary) {
    return res.json({ synopsis: 'Binary file — no synopsis available.' });
  }

  // Truncate to ~8K chars to keep costs low
  const truncated = content.slice(0, 8000);

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Give a brief 1-2 sentence synopsis of this file. Be specific about what it does, not generic. File: ${filePath}\n\n${truncated}`,
        }],
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      return res.status(502).json({ error: `Anthropic API error: ${err}` });
    }

    const data = await apiRes.json();
    const synopsis = data.content?.[0]?.text || 'No synopsis generated.';
    res.json({ synopsis });
  } catch (err) {
    res.status(502).json({ error: `API request failed: ${err.message}` });
  }
});

export default router;
