import { api4aiProvider } from './api4ai.js';
import { pixelcutProvider } from './pixelcut.js';

// Background-removal providers. Add a new one by creating
// src/providers/<name>.js with the same shape and listing it here —
// nothing else needs to change (config, the run API, and the UI all
// pick it up automatically).
export const providers = [pixelcutProvider, api4aiProvider];

export function getProvider(id) {
  return providers.find((p) => p.id === id) || null;
}
