import fs from 'fs/promises';
import path from 'path';
import ignore from 'ignore';

const CWD = process.cwd();

// Cache .gitignore rules
let ig = null;

async function loadGitignore() {
  if (ig) return ig;
  ig = ignore();
  // Always ignore these
  ig.add(['node_modules', '.git', 'dist']);
  try {
    const gitignoreContent = await fs.readFile(path.join(CWD, '.gitignore'), 'utf-8');
    ig.add(gitignoreContent);
  } catch {
    // No .gitignore, that's fine
  }
  return ig;
}

function sanitizePath(inputPath) {
  const resolved = path.resolve(CWD, inputPath);
  if (!resolved.startsWith(CWD)) {
    throw new Error('Path traversal not allowed');
  }
  return resolved;
}

export async function getTree(dirPath) {
  const absPath = sanitizePath(dirPath);
  const gitignore = await loadGitignore();
  const entries = await fs.readdir(absPath, { withFileTypes: true });

  const items = [];
  for (const entry of entries) {
    const relativePath = path.relative(CWD, path.join(absPath, entry.name));
    const relativeForIgnore = relativePath.replace(/\\/g, '/');

    if (gitignore.ignores(relativeForIgnore)) continue;

    items.push({
      name: entry.name,
      path: relativePath.replace(/\\/g, '/'),
      type: entry.isDirectory() ? 'directory' : 'file',
    });
  }

  // Sort: directories first, then alphabetical
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

export async function getFileContent(filePath) {
  const absPath = sanitizePath(filePath);
  const stat = await fs.stat(absPath);
  if (stat.isDirectory()) throw new Error('Path is a directory');
  if (stat.size > 1024 * 1024) throw new Error('File too large (>1MB)');
  return fs.readFile(absPath, 'utf-8');
}

// Invalidate gitignore cache when .gitignore changes
export function invalidateGitignoreCache() {
  ig = null;
}
