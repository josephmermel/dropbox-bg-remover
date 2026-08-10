import { Dropbox } from 'dropbox';
import { config } from './config.js';

const dbx = new Dropbox({
  clientId: config.appKey,
  clientSecret: config.appSecret,
  refreshToken: config.refreshToken,
});

export async function listFolderEntries(folder, { recursive = false } = {}) {
  const entries = [];
  let response = await dbx.filesListFolder({ path: folder, recursive });
  entries.push(...response.result.entries);

  while (response.result.has_more) {
    response = await dbx.filesListFolderContinue({ cursor: response.result.cursor });
    entries.push(...response.result.entries);
  }

  return entries;
}

export async function listFolderFiles(folder, options) {
  const entries = await listFolderEntries(folder, options);
  return entries.filter((entry) => entry['.tag'] === 'file');
}

export async function listSubfolders(folder) {
  const entries = await listFolderEntries(folder);
  return entries
    .filter((entry) => entry['.tag'] === 'folder')
    .map((entry) => ({ name: entry.name, path: entry.path_display }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function downloadFile(path) {
  const response = await dbx.filesDownload({ path });
  return Buffer.from(response.result.fileBinary);
}

export async function uploadFile(path, buffer) {
  await dbx.filesUpload({
    path,
    contents: buffer,
    mode: { '.tag': 'overwrite' },
  });
}

export async function getThumbnail(path) {
  const response = await dbx.filesGetThumbnail({
    path,
    format: { '.tag': 'jpeg' },
    size: { '.tag': 'w256h256' },
  });
  return Buffer.from(response.result.fileBinary);
}
