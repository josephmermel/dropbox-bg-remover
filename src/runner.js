import path from 'node:path';
import { listFolderFiles, downloadFile, uploadFile } from './dropboxClient.js';
import { isSourceImage, outputFilenameFor, extensionOf, sharpFormatFor } from './naming.js';
import { flattenToWhite } from './flatten.js';
import { localProvider, getProvider } from './providers/index.js';

async function processOne({ inputBuffer, format, provider, apiKey, sourceFilename }) {
  const cutout = await provider.removeBackgroundCutout(inputBuffer, apiKey, sourceFilename);
  return flattenToWhite(cutout, format);
}

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
      engine: localProvider.id,
      engineLabel: localProvider.label,
    });
    try {
      const inputBuffer = await downloadFile(file.path_lower);
      const outputBuffer = await processOne({
        inputBuffer,
        format,
        provider: localProvider,
        sourceFilename: file.name,
      });
      await uploadFile(outputPath, outputBuffer);
      onEvent({
        type: 'file-done',
        name: file.name,
        sourcePath: file.path_lower,
        outputName,
        outputPath,
        engine: localProvider.id,
        engineLabel: localProvider.label,
      });
    } catch (err) {
      onEvent({
        type: 'file-failed',
        name: file.name,
        error: err.message,
        engine: localProvider.id,
        engineLabel: localProvider.label,
      });
    }
  }

  onEvent({ type: 'run-complete' });
}

export async function reprocessWithProvider(items, { onEvent = () => {}, providerId, apiKey } = {}) {
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
      const outputBuffer = await processOne({
        inputBuffer,
        format,
        provider,
        apiKey,
        sourceFilename: item.name,
      });
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
