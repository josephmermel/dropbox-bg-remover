import path from 'node:path';
import { listFolderFiles, downloadFile, uploadFile } from './dropboxClient.js';
import { isSourceImage, outputFilenameFor, extensionOf, sharpFormatFor } from './naming.js';
import { removeImageBackground } from './backgroundRemoval.js';

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

    onEvent({ type: 'file-start', name: file.name, outputName });
    try {
      const inputBuffer = await downloadFile(file.path_lower);
      const outputBuffer = await removeImageBackground(inputBuffer, format);
      await uploadFile(outputPath, outputBuffer);
      onEvent({ type: 'file-done', name: file.name, outputName });
    } catch (err) {
      onEvent({ type: 'file-failed', name: file.name, error: err.message });
    }
  }

  onEvent({ type: 'run-complete' });
}
