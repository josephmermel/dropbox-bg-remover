import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let cachedRoot;

export function getLocalDropboxRoot() {
  if (cachedRoot !== undefined) return cachedRoot;

  try {
    const infoPath = path.join(os.homedir(), '.dropbox', 'info.json');
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    cachedRoot = info.personal?.path || info.business?.path || null;
  } catch {
    cachedRoot = null;
  }

  return cachedRoot;
}

export function dropboxPathToLocalPath(dropboxPath) {
  const root = getLocalDropboxRoot();
  if (!root) return null;

  const resolvedRoot = path.resolve(root);
  const resolvedLocal = path.resolve(root, '.' + dropboxPath);

  if (resolvedLocal !== resolvedRoot && !resolvedLocal.startsWith(resolvedRoot + path.sep)) {
    return null;
  }

  return resolvedLocal;
}
