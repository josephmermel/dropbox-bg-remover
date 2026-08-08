import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { listSubfolders, getThumbnail } from './dropboxClient.js';
import { runFolder, reprocessWithApi4ai } from './runner.js';
import { dropboxPathToLocalPath } from './localDropbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

function normalizeDropboxPath(rawPath) {
  if (!rawPath || rawPath === '/') return '';
  return rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
}

let currentRun = null;
let galleryResults = new Map(); // outputPath -> latest file-done event, persists across runs

function startRun(meta, runFn) {
  if (meta.mode === 'scan') {
    galleryResults = new Map();
  }

  currentRun = {
    id: Date.now().toString(),
    status: 'running',
    events: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    ...meta,
  };
  const run = currentRun;

  runFn({
    onEvent: (event) => {
      run.events.push({ ...event, at: new Date().toISOString() });
      if (event.type === 'file-done') {
        galleryResults.set(event.outputPath, { ...event, at: new Date().toISOString() });
      }
    },
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

  return run;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({ defaultFolder: config.folder, api4aiEnabled: Boolean(config.api4aiApiKey) });
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

app.get('/api/thumbnail', async (req, res) => {
  const dropboxPath = req.query.path;
  if (!dropboxPath) return res.status(400).json({ error: 'path is required' });
  try {
    const buffer = await getThumbnail(dropboxPath);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/open-local', (req, res) => {
  const dropboxPath = req.body?.path;
  if (!dropboxPath) return res.status(400).json({ error: 'path is required' });

  const localPath = dropboxPathToLocalPath(dropboxPath);
  if (!localPath) {
    return res.status(400).json({
      error: 'Could not find a local Dropbox folder on this Mac (or the path was invalid).',
    });
  }
  if (!fs.existsSync(localPath)) {
    return res.status(404).json({ error: `Not synced locally yet: ${localPath}` });
  }

  execFile('open', [localPath], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

app.post('/api/run', (req, res) => {
  const folder = req.body?.folder;
  if (!folder || typeof folder !== 'string') {
    return res.status(400).json({ error: 'folder is required' });
  }
  if (currentRun && currentRun.status === 'running') {
    return res.status(409).json({ error: 'A run is already in progress', run: currentRun });
  }

  const run = startRun({ mode: 'scan', folder }, ({ onEvent }) => runFolder(folder, { onEvent }));
  res.status(202).json({ id: run.id });
});

app.post('/api/reprocess', (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required' });
  }
  if (!config.api4aiApiKey) {
    return res.status(400).json({ error: 'API4AI_API_KEY is not configured in .env' });
  }
  if (currentRun && currentRun.status === 'running') {
    return res.status(409).json({ error: 'A run is already in progress', run: currentRun });
  }

  const run = startRun({ mode: 'reprocess', folder: currentRun?.folder ?? null }, ({ onEvent }) =>
    reprocessWithApi4ai(items, { onEvent, apiKey: config.api4aiApiKey })
  );
  res.status(202).json({ id: run.id });
});

app.get('/api/run/current', (req, res) => {
  res.json({ run: currentRun, results: Array.from(galleryResults.values()) });
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
