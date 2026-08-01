import 'dotenv/config';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  accessToken: requireEnv('DROPBOX_ACCESS_TOKEN'),
  folder: process.env.DROPBOX_FOLDER || '/retake/test',
};
