import 'dotenv/config';
import { providers } from './providers/index.js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Each provider's API key is read from <PROVIDER_ID>_API_KEY, e.g.
// api4ai -> API4AI_API_KEY. Adding a new provider to providers/index.js
// picks up its key automatically, no changes needed here.
const providerApiKeys = {};
for (const provider of providers) {
  const envVar = `${provider.id.toUpperCase()}_API_KEY`;
  providerApiKeys[provider.id] = process.env[envVar] || null;
}

export const config = {
  appKey: requireEnv('DROPBOX_APP_KEY'),
  appSecret: requireEnv('DROPBOX_APP_SECRET'),
  refreshToken: requireEnv('DROPBOX_REFRESH_TOKEN'),
  folder: process.env.DROPBOX_FOLDER || '/retake/test',
  providerApiKeys,
};
