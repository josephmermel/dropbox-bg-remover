import { localProvider } from './local.js';
import { api4aiProvider } from './api4ai.js';
import { pixelcutProvider } from './pixelcut.js';

// Remote (paid, API-based) providers. Add a new one by creating
// src/providers/<name>.js with the same shape and listing it here —
// nothing else needs to change.
export const remoteProviders = [api4aiProvider, pixelcutProvider];

export { localProvider };

export function getProvider(id) {
  if (id === localProvider.id) return localProvider;
  return remoteProviders.find((p) => p.id === id) || null;
}
