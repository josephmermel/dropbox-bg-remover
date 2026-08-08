import path from 'node:path';
import { listFolderFiles, downloadFile, uploadFile } from './dropboxClient.js';
import { isSourceImage, outputFilenameFor, extensionOf, sharpFormatFor } from './naming.js';
import { removeImageBackgroundLocal } from './backgroundRemoval.js';
import { removeImageBackgroundApi4ai } from './api4aiApi.js';

export async function runFolder(folder, { onEvent = () => {} } = {}) {
  onEvent({ type: 'scan-start', folder });

  const files = await listFolderFiles(folder);
  const existingNames = new Set(files.map((f) => f.name.toLowerCase()));

  const sourceImages = files.filter((f) => isSourceImage(f.name));
  const pending = sourceImages.filter(
    (f) => !existingNames.has(outputFilenameFor(f.name).toLowerCase())
  );

  onEvent({
    type: 'scan-complete',
    folder,
    totalSource: sourceImages.length,
    pendingCount: pending.length,
  });

  for (const file of pending) {
    const outputName = outputFilenameFor(file.name);
    const outputPath = path.posix.join(folder, outputName);
    const format = sharpFormatFor(extensionOf(file.name));

    if (!format) {
      onEvent({ type: 'file-skipped', name: file.name, reason: 'unsupported extension' });
      continue;
    }

    onEvent({
      type: 'file-start',
      name: file.name,
      sourcePath: file.path_lower,
      outputName,
      outputPath,
      engine: 'local',
    });
    try {
      const inputBuffer = await downloadFile(file.path_lower);
      const outputBuffer = await removeImageBackgroundLocal(inputBuffer, format);
      await uploadFile(outputPath, outputBuffer);
      onEvent({
        type: 'file-done',
        name: file.name,
        sourcePath: file.path_lower,
        outputName,
        outputPath,
        engine: 'local',
      });
    } catch (err) {
      onEvent({ type: 'file-failed', name: file.name, error: err.message, engine: 'local' });
    }
  }

  onEvent({ type: 'run-complete' });
}

export async function reprocessWithApi4ai(items, { onEvent = () => {}, apiKey } = {}) {
  if (!apiKey) {
    onEvent({ type: 'run-error', error: 'API4AI_API_KEY is not configured' });
    return;
  }

  for (const item of items) {
    const format = sharpFormatFor(extensionOf(item.outputName));
    if (!format) {
      onEvent({ type: 'file-skipped', name: item.name, reason: 'unsupported extension' });
      continue;
    }

    onEvent({
      type: 'file-start',
      name: item.name,
      sourcePath: item.sourcePath,
      outputName: item.outputName,
      outputPath: item.outputPath,
      engine: 'api4ai',
    });
    try {
      const inputBuffer = await downloadFile(item.sourcePath);
      const outputBuffer = await removeImageBackgroundApi4ai(inputBuffer, format, apiKey, item.name);
      await uploadFile(item.outputPath, outputBuffer);
      onEvent({
        type: 'file-done',
        name: item.name,
        sourcePath: item.sourcePath,
        outputName: item.outputName,
        outputPath: item.outputPath,
        engine: 'api4ai',
      });
    } catch (err) {
      onEvent({ type: 'file-failed', name: item.name, error: err.message, engine: 'api4ai' });
    }
  }

  onEvent({ type: 'run-complete' });
}
