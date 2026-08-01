import { Dropbox } from 'dropbox';
import { config } from './config.js';

const dbx = new Dropbox({ accessToken: config.accessToken });

export async function listFolderFiles(folder) {
  const entries = [];
  let response = await dbx.filesListFolder({ path: folder });
  entries.push(...response.result.entries);

  while (response.result.has_more) {
    response = await dbx.filesListFolderContinue({ cursor: response.result.cursor });
    entries.push(...response.result.entries);
  }

  return entries.filter((entry) => entry['.tag'] === 'file');
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
