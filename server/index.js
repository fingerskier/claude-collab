try { await import('dotenv/config'); } catch {}
import fs from 'fs';
import express from 'express';
import { createServer } from 'http';
import { createServer as createNetServer } from 'net';
import { fileURLToPath } from 'url';
import path from 'path';
import { setupWebSocket } from './ws/handler.js';
import agentRoutes from './routes/agent.js';
import fileRoutes from './routes/files.js';
import livekitRoutes from './routes/livekit.js';
import settingsRoutes from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

app.use(express.json());

// API routes
app.use('/api/agent', agentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/livekit', livekitRoutes);
app.use('/api/settings', settingsRoutes);

// WebSocket
const wss = setupWebSocket(server);
app.set('wss', wss);

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = createNetServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

async function findAvailablePort(preferred, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    const port = preferred + i;
    if (await isPortAvailable(port)) return port;
    console.log(`Port ${port} in use, trying ${port + 1}...`);
  }
  throw new Error(`No available port found in range ${preferred}–${preferred + maxRetries - 1}`);
}

async function start() {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    // Use Vite dev server as middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: path.join(__dirname, '..', 'client'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve built static files in production
    const distPath = path.join(__dirname, '..', 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.error(
        'Error: dist/index.html not found. The client has not been built.\n' +
        'Run "npm run build" first, then retry.'
      );
      process.exit(1);
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res, next) => {
      if (_req.path.startsWith('/api') || _req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const preferredPort = parseInt(process.env.PORT, 10) || 3000;
  const port = await findAvailablePort(preferredPort, 10);

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Server running on ${url}`);
    console.log(`WebSocket available on ws://localhost:${port}/ws`);
    if (isDev) {
      console.log('Vite dev server enabled (HMR active)');
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
