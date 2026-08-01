import path from 'node:path';
import { config } from './config.js';
import { listFolderFiles, downloadFile, uploadFile } from './dropboxClient.js';
import { isSourceImage, outputFilenameFor, extensionOf, sharpFormatFor } from './naming.js';
import { removeImageBackground } from './backgroundRemoval.js';

async function main() {
  console.log(`Scanning ${config.folder} ...`);
  const files = await listFolderFiles(config.folder);
  const existingNames = new Set(files.map((f) => f.name.toLowerCase()));

  const sourceImages = files.filter((f) => isSourceImage(f.name));
  const pending = sourceImages.filter(
    (f) => !existingNames.has(outputFilenameFor(f.name).toLowerCase())
  );

  console.log(`Found ${sourceImages.length} source image(s), ${pending.length} need processing.`);

  for (const file of pending) {
    const outputName = outputFilenameFor(file.name);
    const outputPath = path.posix.join(config.folder, outputName);
    const format = sharpFormatFor(extensionOf(file.name));

    if (!format) {
      console.warn(`  skipping ${file.name}: unsupported extension .${extensionOf(file.name)}`);
      continue;
    }

    console.log(`Processing ${file.name} -> ${outputName}`);
    try {
      const inputBuffer = await downloadFile(file.path_lower);
      const outputBuffer = await removeImageBackground(inputBuffer, format);
      await uploadFile(outputPath, outputBuffer);
      console.log(`  done: ${outputName}`);
    } catch (err) {
      console.error(`  failed: ${file.name} - ${err.message}`);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
