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

export default router;
