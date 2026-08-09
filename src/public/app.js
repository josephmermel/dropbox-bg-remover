const breadcrumbEl = document.getElementById('breadcrumb');
const folderListEl = document.getElementById('folder-list');
const chosenPathEl = document.getElementById('chosen-path');
const loadBtn = document.getElementById('load-btn');
const stopBtn = document.getElementById('stop-btn');
const runStatusEl = document.getElementById('run-status');
const eventLogEl = document.getElementById('event-log');

const pickerGalleryEl = document.getElementById('picker-gallery');
const pickerEmptyEl = document.getElementById('picker-empty');
const pickerActionsEl = document.getElementById('picker-actions');
const selectedCountEl = document.getElementById('selected-count');
const providerSelectEl = document.getElementById('provider-select');
const runBtn = document.getElementById('run-btn');

const processedGalleryEl = document.getElementById('processed-gallery');
const processedEmptyEl = document.getElementById('processed-empty');

let stopped = false;
let currentPath = '/';
let loadedFolder = null;
let pollTimer = null;
let providers = [];
let pendingItems = [];
let selectedSourcePaths = new Set();
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

function eventLine(event) {
  const prefix = event.engineLabel ? `[${event.engineLabel}] ` : '';
  switch (event.type) {
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

  const label = {
    running: `Processing selected images ...`,
    complete: 'Run complete.',
    error: `Failed: ${run.error}`,
  }[run.status];
  runStatusEl.textContent = label;

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

function updatePickerActions() {
  const enabledProviders = providers.filter((p) => p.enabled);
  selectedCountEl.textContent = `${selectedSourcePaths.size} selected`;
  loadBtn.disabled = isRunning;
  runBtn.disabled = selectedSourcePaths.size === 0 || enabledProviders.length === 0 || isRunning;
  providerSelectEl.disabled = enabledProviders.length === 0 || isRunning;
  runBtn.title =
    enabledProviders.length === 0
      ? 'Set at least one provider API key in .env to enable this (see README)'
      : '';
}

function makeThumb(outputPath, altText) {
  const img = document.createElement('img');
  img.src = `/api/thumbnail?path=${encodeURIComponent(outputPath)}`;
  img.alt = altText;
  img.setAttribute('data-pin-nopin', 'true');
  return img;
}

function renderPicker(processedResults) {
  const processedPaths = new Set(processedResults.map((r) => r.outputPath));
  const visible = pendingItems.filter((item) => !processedPaths.has(item.outputPath));

  // drop selections for items that just got processed or no longer exist
  for (const sourcePath of [...selectedSourcePaths]) {
    if (!visible.some((item) => item.sourcePath === sourcePath)) {
      selectedSourcePaths.delete(sourcePath);
    }
  }

  if (visible.length === 0) {
    pickerEmptyEl.hidden = false;
    pickerEmptyEl.textContent = loadedFolder
      ? 'No unprocessed images found in this folder.'
      : 'Load a folder above to see its images.';
    pickerGalleryEl.innerHTML = '';
    pickerActionsEl.hidden = true;
    updatePickerActions();
    return;
  }

  pickerEmptyEl.hidden = true;
  pickerActionsEl.hidden = false;
  pickerGalleryEl.innerHTML = '';

  for (const item of visible) {
    const cell = document.createElement('div');
    cell.className = 'gallery-item picker';
    if (selectedSourcePaths.has(item.sourcePath)) cell.classList.add('selected');

    const badge = document.createElement('span');
    badge.className = 'select-badge';
    badge.textContent = '✓';
    cell.appendChild(badge);

    cell.appendChild(makeThumb(item.sourcePath, item.name));

    const caption = document.createElement('div');
    caption.className = 'gallery-caption';
    caption.textContent = item.name;
    caption.title = item.name;
    cell.appendChild(caption);

    cell.addEventListener('click', () => {
      if (isRunning) return;
      if (selectedSourcePaths.has(item.sourcePath)) {
        selectedSourcePaths.delete(item.sourcePath);
        cell.classList.remove('selected');
      } else {
        selectedSourcePaths.add(item.sourcePath);
        cell.classList.add('selected');
      }
      updatePickerActions();
    });

    pickerGalleryEl.appendChild(cell);
  }

  updatePickerActions();
}

function renderProcessed(results) {
  if (results.length === 0) {
    processedEmptyEl.hidden = false;
    processedGalleryEl.innerHTML = '';
    return;
  }

  processedEmptyEl.hidden = true;
  processedGalleryEl.innerHTML = '';

  for (const item of results) {
    const cell = document.createElement('div');
    cell.className = 'gallery-item';

    const img = makeThumb(item.outputPath, item.outputName);
    img.title = 'Click to open locally';
    img.addEventListener('click', () => openLocal(item.outputPath));
    cell.appendChild(img);

    if (item.engineLabel) {
      const badge = document.createElement('span');
      badge.className = 'gallery-engine-badge';
      badge.textContent = item.engineLabel;
      cell.appendChild(badge);
    }

    const caption = document.createElement('div');
    caption.className = 'gallery-caption';
    caption.textContent = item.outputName;
    caption.title = item.outputName;
    cell.appendChild(caption);

    processedGalleryEl.appendChild(cell);
  }
}

async function loadImages() {
  loadBtn.disabled = true;
  try {
    const res = await fetch(`/api/scan?folder=${encodeURIComponent(currentPath)}`);
    const data = await res.json();
    if (!res.ok) {
      alert(`Could not load images: ${data.error}`);
      return;
    }
    loadedFolder = data.folder;
    pendingItems = data.pending;
    selectedSourcePaths.clear();
    renderPicker(data.results);
    renderProcessed(data.results);
  } finally {
    loadBtn.disabled = false;
  }
}

async function pollRun() {
  if (stopped) return;
  try {
    const res = await fetch('/api/run/current');
    const data = await res.json();
    renderRun(data.run);
    renderPicker(data.results);
    renderProcessed(data.results);
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
    loadBtn.disabled = true;
    runBtn.disabled = true;
    stopBtn.disabled = true;
    runStatusEl.textContent = 'Server stopped. You can close this tab.';
  } catch {
    stopped = true;
    if (pollTimer) clearTimeout(pollTimer);
    loadBtn.disabled = true;
    runBtn.disabled = true;
    stopBtn.disabled = true;
    runStatusEl.textContent = 'Server stopped. You can close this tab.';
  }
}

stopBtn.addEventListener('click', () => requestShutdown(false));
loadBtn.addEventListener('click', loadImages);

runBtn.addEventListener('click', async () => {
  const items = pendingItems.filter((item) => selectedSourcePaths.has(item.sourcePath));
  if (items.length === 0 || !loadedFolder) return;
  const providerId = providerSelectEl.value;

  runBtn.disabled = true;
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: loadedFolder, items, providerId }),
  });
  if (res.status === 409) {
    const data = await res.json();
    alert(data.error);
    updatePickerActions();
    return;
  }
  if (!res.ok) {
    const data = await res.json();
    alert(`Could not start run: ${data.error}`);
    updatePickerActions();
    return;
  }
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
  await loadImages();
  pollRun();
}

init();
