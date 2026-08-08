const breadcrumbEl = document.getElementById('breadcrumb');
const folderListEl = document.getElementById('folder-list');
const chosenPathEl = document.getElementById('chosen-path');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const runStatusEl = document.getElementById('run-status');
const eventLogEl = document.getElementById('event-log');
const galleryEl = document.getElementById('gallery');
const galleryEmptyEl = document.getElementById('gallery-empty');
const galleryActionsEl = document.getElementById('gallery-actions');
const selectedCountEl = document.getElementById('selected-count');
const reprocessBtn = document.getElementById('reprocess-btn');
const providerSelectEl = document.getElementById('provider-select');

let stopped = false;
let currentPath = '/';
let pollTimer = null;
let providers = [];
let selectedPaths = new Set();
let lastResults = [];
let isRunning = false;

function segmentsFor(dropboxPath) {
  const parts = dropboxPath.split('/').filter(Boolean);
  const segments = [{ label: 'Home', path: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    segments.push({ label: part, path: acc });
  }
  return segments;
}

function renderBreadcrumb(dropboxPath) {
  breadcrumbEl.innerHTML = '';
  const segments = segmentsFor(dropboxPath);
  segments.forEach((segment, i) => {
    const btn = document.createElement('button');
    btn.textContent = segment.label;
    btn.addEventListener('click', () => loadFolders(segment.path));
    breadcrumbEl.appendChild(btn);
    if (i < segments.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      breadcrumbEl.appendChild(sep);
    }
  });
}

function renderFolderList(folders) {
  folderListEl.innerHTML = '';
  if (folders.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '(no subfolders here)';
    folderListEl.appendChild(li);
    return;
  }
  for (const folder of folders) {
    const li = document.createElement('li');
    li.textContent = `📁 ${folder.name}`;
    li.addEventListener('click', () => loadFolders(folder.path));
    folderListEl.appendChild(li);
  }
}

async function loadFolders(dropboxPath) {
  const res = await fetch(`/api/folders?path=${encodeURIComponent(dropboxPath)}`);
  const data = await res.json();
  if (!res.ok) {
    alert(`Could not list folder: ${data.error}`);
    return;
  }
  currentPath = data.path;
  chosenPathEl.textContent = currentPath;
  renderBreadcrumb(currentPath);
  renderFolderList(data.folders);
}

function eventLine(event) {
  const prefix = event.engine && event.engine !== 'local' ? `[${event.engineLabel}] ` : '';
  switch (event.type) {
    case 'scan-start':
      return { text: `Scanning ${event.folder} ...`, cls: '' };
    case 'scan-complete':
      return {
        text: `Found ${event.totalSource} source image(s), ${event.pendingCount} need processing.`,
        cls: '',
      };
    case 'file-start':
      return { text: `${prefix}Processing ${event.name} -> ${event.outputName}`, cls: '' };
    case 'file-done':
      return { text: `${prefix}done: ${event.outputName}`, cls: 'ok' };
    case 'file-failed':
      return { text: `${prefix}failed: ${event.name} - ${event.error}`, cls: 'fail' };
    case 'file-skipped':
      return { text: `${prefix}skipped ${event.name}: ${event.reason}`, cls: 'skip' };
    case 'run-error':
      return { text: event.error, cls: 'fail' };
    case 'run-complete':
      return { text: 'Done.', cls: 'ok' };
    default:
      return { text: JSON.stringify(event), cls: '' };
  }
}

function renderRun(run) {
  if (!run) {
    runStatusEl.textContent = 'No run started yet.';
    eventLogEl.innerHTML = '';
    isRunning = false;
    return;
  }

  const label =
    run.mode === 'reprocess'
      ? { running: 'Reprocessing selected images ...', complete: 'Reprocess complete.', error: `Failed: ${run.error}` }
      : { running: `Running on ${run.folder} ...`, complete: `Complete: ${run.folder}`, error: `Failed: ${run.error}` };
  runStatusEl.textContent = label[run.status];

  eventLogEl.innerHTML = '';
  for (const event of run.events) {
    const { text, cls } = eventLine(event);
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = text;
    eventLogEl.appendChild(li);
  }
  eventLogEl.scrollTop = eventLogEl.scrollHeight;

  isRunning = run.status === 'running';
  runBtn.disabled = isRunning;
}

async function openLocal(dropboxPath) {
  const res = await fetch('/api/open-local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath }),
  });
  if (!res.ok) {
    const data = await res.json();
    alert(`Could not open file: ${data.error}`);
  }
}

function updateGalleryActions() {
  const enabledProviders = providers.filter((p) => p.enabled);
  selectedCountEl.textContent = `${selectedPaths.size} selected`;
  reprocessBtn.disabled = selectedPaths.size === 0 || enabledProviders.length === 0 || isRunning;
  providerSelectEl.disabled = enabledProviders.length === 0 || isRunning;
  reprocessBtn.title =
    enabledProviders.length === 0
      ? 'Set at least one provider API key in .env to enable this (see README)'
      : '';
}

function renderProviderOptions() {
  providerSelectEl.innerHTML = '';
  const enabledProviders = providers.filter((p) => p.enabled);
  const options = enabledProviders.length > 0 ? enabledProviders : providers;
  for (const provider of options) {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.enabled ? provider.label : `${provider.label} (no API key set)`;
    option.disabled = !provider.enabled;
    providerSelectEl.appendChild(option);
  }
}

function renderGallery(results) {
  lastResults = results;
  // drop selections for items no longer present
  for (const path of [...selectedPaths]) {
    if (!results.some((r) => r.outputPath === path)) selectedPaths.delete(path);
  }

  if (results.length === 0) {
    galleryEmptyEl.hidden = false;
    galleryEl.innerHTML = '';
    galleryActionsEl.hidden = true;
    return;
  }

  galleryEmptyEl.hidden = true;
  galleryActionsEl.hidden = false;
  galleryEl.innerHTML = '';

  for (const item of results) {
    const cell = document.createElement('div');
    cell.className = 'gallery-item';

    const label = document.createElement('label');
    label.className = 'gallery-select';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedPaths.has(item.outputPath);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedPaths.add(item.outputPath);
      else selectedPaths.delete(item.outputPath);
      updateGalleryActions();
    });
    label.appendChild(checkbox);
    cell.appendChild(label);

    const img = document.createElement('img');
    img.src = `/api/thumbnail?path=${encodeURIComponent(item.outputPath)}`;
    img.alt = item.outputName;
    img.title = 'Click to open locally';
    img.addEventListener('click', () => openLocal(item.outputPath));
    cell.appendChild(img);

    const badge = document.createElement('span');
    badge.className = `gallery-engine-badge ${item.engine !== 'local' ? 'remote' : ''}`;
    badge.textContent = item.engineLabel || item.engine;
    cell.appendChild(badge);

    const caption = document.createElement('div');
    caption.className = 'gallery-caption';
    caption.textContent = item.outputName;
    caption.title = item.outputName;
    cell.appendChild(caption);

    galleryEl.appendChild(cell);
  }

  updateGalleryActions();
}

async function pollRun() {
  if (stopped) return;
  try {
    const res = await fetch('/api/run/current');
    const data = await res.json();
    renderRun(data.run);
    renderGallery(data.results);
    if (data.run && data.run.status === 'running') {
      pollTimer = setTimeout(pollRun, 1000);
    } else {
      pollTimer = null;
    }
  } catch {
    // server likely stopped; stop polling quietly
    pollTimer = null;
  }
}

async function requestShutdown(force) {
  try {
    const res = await fetch(`/api/shutdown${force ? '?force=true' : ''}`, { method: 'POST' });
    if (res.status === 409) {
      const proceed = confirm('A run is currently in progress. Stop anyway?');
      if (proceed) await requestShutdown(true);
      return;
    }
    if (!res.ok) {
      const data = await res.json();
      alert(`Could not stop server: ${data.error}`);
      return;
    }
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    runBtn.disabled = true;
    stopBtn.disabled = true;
    runStatusEl.textContent = 'Server stopped. You can close this tab.';
  } catch {
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    runBtn.disabled = true;
    stopBtn.disabled = true;
    runStatusEl.textContent = 'Server stopped. You can close this tab.';
  }
}

stopBtn.addEventListener('click', () => requestShutdown(false));

runBtn.addEventListener('click', async () => {
  runBtn.disabled = true;
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: currentPath }),
  });
  if (res.status === 409) {
    const data = await res.json();
    alert(data.error);
    runBtn.disabled = false;
    return;
  }
  if (!res.ok) {
    const data = await res.json();
    alert(`Could not start run: ${data.error}`);
    runBtn.disabled = false;
    return;
  }
  if (pollTimer) clearTimeout(pollTimer);
  pollRun();
});

reprocessBtn.addEventListener('click', async () => {
  const items = lastResults
    .filter((r) => selectedPaths.has(r.outputPath))
    .map((r) => ({
      name: r.name,
      sourcePath: r.sourcePath,
      outputName: r.outputName,
      outputPath: r.outputPath,
    }));
  if (items.length === 0) return;
  const providerId = providerSelectEl.value;

  reprocessBtn.disabled = true;
  const res = await fetch('/api/reprocess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, providerId }),
  });
  if (!res.ok) {
    const data = await res.json();
    alert(`Could not start reprocess: ${data.error}`);
    updateGalleryActions();
    return;
  }
  selectedPaths.clear();
  if (pollTimer) clearTimeout(pollTimer);
  pollRun();
});

async function init() {
  let startPath = '/';
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.defaultFolder) startPath = data.defaultFolder;
    providers = Array.isArray(data.providers) ? data.providers : [];
    renderProviderOptions();
  } catch {
    // fall back to root
  }
  await loadFolders(startPath);
  pollRun();
}

init();
