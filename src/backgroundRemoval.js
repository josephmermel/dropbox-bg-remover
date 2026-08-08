import { removeBackground } from '@imgly/background-removal-node';
import { flattenToWhite } from './flatten.js';

export async function removeImageBackgroundLocal(inputBuffer, outputFormat) {
  const inputBlob = new Blob([inputBuffer], { type: 'application/octet-stream' });
  const cutoutBlob = await removeBackground(inputBlob, {
    output: { format: 'image/png' },
  });
  const cutoutBuffer = Buffer.from(await cutoutBlob.arrayBuffer());
  return flattenToWhite(cutoutBuffer, outputFormat);
}
