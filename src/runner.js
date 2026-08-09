import path from 'node:path';
import { listFolderFiles, downloadFile, uploadFile } from './dropboxClient.js';
import { isOutputImage, outputFilenameFor, extensionOf, sharpFormatFor } from './naming.js';
import { flattenToWhite } from './flatten.js';
import { getProvider } from './providers/index.js';

export async function scanFolder(folder) {
  const files = await listFolderFiles(folder);
  const existingNames = new Set(files.map((f) => f.name.toLowerCase()));

  const processed = [];
  const pending = [];

  for (const file of files) {
    if (isOutputImage(file.name)) {
      processed.push({
        name: file.name,
        outputName: file.name,
        outputPath: file.path_lower,
        engine: null,
        engineLabel: null,
      });
      continue;
    }

    if (!sharpFormatFor(extensionOf(file.name))) continue;

    const outputName = outputFilenameFor(file.name);
    if (existingNames.has(outputName.toLowerCase())) continue;

    pending.push({
      name: file.name,
      sourcePath: file.path_lower,
      outputName,
      outputPath: path.posix.join(folder, outputName),
    });
  }

  return { pending, processed };
}

export async function processSelected(items, { onEvent = () => {}, providerId, apiKey } = {}) {
  const provider = getProvider(providerId);
  if (!provider) {
    onEvent({ type: 'run-error', error: `Unknown provider: ${providerId}` });
    return;
  }
  if (provider.requiresApiKey && !apiKey) {
    onEvent({ type: 'run-error', error: `${provider.label} API key is not configured` });
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
      engine: provider.id,
      engineLabel: provider.label,
    });
    try {
      const inputBuffer = await downloadFile(item.sourcePath);
      const cutout = await provider.removeBackgroundCutout(inputBuffer, apiKey, item.name);
      const outputBuffer = await flattenToWhite(cutout, format);
      await uploadFile(item.outputPath, outputBuffer);
      onEvent({
        type: 'file-done',
        name: item.name,
        sourcePath: item.sourcePath,
        outputName: item.outputName,
        outputPath: item.outputPath,
        engine: provider.id,
        engineLabel: provider.label,
      });
    } catch (err) {
      onEvent({
        type: 'file-failed',
        name: item.name,
        error: err.message,
        engine: provider.id,
        engineLabel: provider.label,
      });
    }
  }

  onEvent({ type: 'run-complete' });
}
