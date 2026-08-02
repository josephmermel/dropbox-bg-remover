import 'dotenv/config';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  appKey: requireEnv('DROPBOX_APP_KEY'),
  appSecret: requireEnv('DROPBOX_APP_SECRET'),
  refreshToken: requireEnv('DROPBOX_REFRESH_TOKEN'),
  folder: process.env.DROPBOX_FOLDER || '/retake/test',
};
