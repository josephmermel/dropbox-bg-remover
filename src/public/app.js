const breadcrumbEl = document.getElementById('breadcrumb');
const folderListEl = document.getElementById('folder-list');
const chosenPathEl = document.getElementById('chosen-path');
const runBtn = document.getElementById('run-btn');
const stopBtn = document.getElementById('stop-btn');
const runStatusEl = document.getElementById('run-status');
const eventLogEl = document.getElementById('event-log');

let stopped = false;

let currentPath = '/';
let pollTimer = null;

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
  switch (event.type) {
    case 'scan-start':
      return { text: `Scanning ${event.folder} ...`, cls: '' };
    case 'scan-complete':
      return {
        text: `Found ${event.totalSource} source image(s), ${event.pendingCount} need processing.`,
        cls: '',
      };
    case 'file-start':
      return { text: `Processing ${event.name} -> ${event.outputName}`, cls: '' };
    case 'file-done':
      return { text: `done: ${event.outputName}`, cls: 'ok' };
    case 'file-failed':
      return { text: `failed: ${event.name} - ${event.error}`, cls: 'fail' };
    case 'file-skipped':
      return { text: `skipped ${event.name}: ${event.reason}`, cls: 'skip' };
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
    return;
  }

  const statusLabel = {
    running: `Running on ${run.folder} ...`,
    complete: `Complete: ${run.folder}`,
    error: `Failed: ${run.error}`,
  }[run.status];
  runStatusEl.textContent = statusLabel;

  eventLogEl.innerHTML = '';
  for (const event of run.events) {
    const { text, cls } = eventLine(event);
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = text;
    eventLogEl.appendChild(li);
  }
  eventLogEl.scrollTop = eventLogEl.scrollHeight;

  const running = run.status === 'running';
  runBtn.disabled = running;
}

async function pollRun() {
  if (stopped) return;
  try {
    const res = await fetch('/api/run/current');
    const run = await res.json();
    renderRun(run);
    if (run && run.status === 'running') {
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

async function init() {
  let startPath = '/';
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.defaultFolder) startPath = data.defaultFolder;
  } catch {
    // fall back to root
  }
  await loadFolders(startPath);
  pollRun();
}

init();
