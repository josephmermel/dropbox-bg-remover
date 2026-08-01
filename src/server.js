import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { listSubfolders } from './dropboxClient.js';
import { runFolder } from './runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

function normalizeDropboxPath(rawPath) {
  if (!rawPath || rawPath === '/') return '';
  return rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
}

let currentRun = null;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({ defaultFolder: config.folder });
});

app.get('/api/folders', async (req, res) => {
  const requestedPath = normalizeDropboxPath(req.query.path);
  try {
    const folders = await listSubfolders(requestedPath);
    res.json({ path: requestedPath || '/', folders });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/run', (req, res) => {
  const folder = req.body?.folder;
  if (!folder || typeof folder !== 'string') {
    return res.status(400).json({ error: 'folder is required' });
  }
  if (currentRun && currentRun.status === 'running') {
    return res.status(409).json({ error: 'A run is already in progress', run: currentRun });
  }

  currentRun = {
    id: Date.now().toString(),
    folder,
    status: 'running',
    events: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };
  const run = currentRun;

  runFolder(folder, {
    onEvent: (event) => run.events.push({ ...event, at: new Date().toISOString() }),
  })
    .then(() => {
      run.status = 'complete';
      run.finishedAt = new Date().toISOString();
    })
    .catch((err) => {
      run.status = 'error';
      run.error = err.message;
      run.finishedAt = new Date().toISOString();
    });

  res.status(202).json({ id: run.id });
});

app.get('/api/run/current', (req, res) => {
  res.json(currentRun);
});

app.post('/api/shutdown', (req, res) => {
  const force = req.query.force === 'true' || req.body?.force === true;
  if (currentRun && currentRun.status === 'running' && !force) {
    return res.status(409).json({ error: 'A run is in progress', running: true });
  }
  res.json({ message: 'Server shutting down.' });
  setTimeout(() => process.exit(0), 200);
});

app.listen(PORT, () => {
  console.log(`dropbox-bg-remover web UI: http://localhost:${PORT}`);
  console.log(`Default folder from .env: ${config.folder}`);
});
