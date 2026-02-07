import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '..', '.env');

const SETTINGS_SCHEMA = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', type: 'secret', restart: false },
  { key: 'CLAUDE_MODEL',      label: 'Claude Model',       type: 'text',   restart: false },
  { key: 'LIVEKIT_API_KEY',   label: 'LiveKit API Key',    type: 'secret', restart: false },
  { key: 'LIVEKIT_API_SECRET', label: 'LiveKit API Secret', type: 'secret', restart: false },
  { key: 'LIVEKIT_WS_URL',   label: 'LiveKit WebSocket URL', type: 'text', restart: false },
  { key: 'PORT',              label: 'Server Port',        type: 'text',   restart: true },
];

const ALLOWED_KEYS = new Set(SETTINGS_SCHEMA.map(s => s.key));

function maskSecret(value) {
  if (!value || value.length < 4) return value ? '****' : '';
  return '****' + value.slice(-4);
}

function readEnvFile() {
  if (!existsSync(ENV_PATH)) return '';
  return readFileSync(ENV_PATH, 'utf-8');
}

function parseEnvValues(content) {
  const values = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    values[key] = val;
  }
  return values;
}

function updateEnvFile(updates) {
  const content = readEnvFile();
  const lines = content.split('\n');
  const written = new Set();

  // Update existing lines
  const updated = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return line;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key in updates) {
      written.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  // Append new keys not already in file
  for (const [key, val] of Object.entries(updates)) {
    if (!written.has(key)) {
      updated.push(`${key}=${val}`);
    }
  }

  // Ensure trailing newline
  const result = updated.join('\n').replace(/\n*$/, '\n');
  writeFileSync(ENV_PATH, result, 'utf-8');
}

const router = Router();

// GET /api/settings - return schema with current (masked) values
router.get('/', (_req, res) => {
  const envContent = readEnvFile();
  const values = parseEnvValues(envContent);

  const settings = SETTINGS_SCHEMA.map(field => ({
    ...field,
    value: field.type === 'secret'
      ? maskSecret(values[field.key] || process.env[field.key] || '')
      : (values[field.key] ?? process.env[field.key] ?? ''),
  }));

  res.json({ settings });
});

// POST /api/settings - update .env and process.env
router.post('/', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Expected object body' });
  }

  // Filter to allowed keys only, skip empty strings (unchanged secrets)
  const filtered = {};
  let restartNeeded = false;

  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof value !== 'string') continue;
    filtered[key] = value;
    process.env[key] = value;

    const field = SETTINGS_SCHEMA.find(s => s.key === key);
    if (field?.restart) restartNeeded = true;
  }

  if (Object.keys(filtered).length > 0) {
    updateEnvFile(filtered);
  }

  res.json({ ok: true, restartNeeded });
});

export default router;
