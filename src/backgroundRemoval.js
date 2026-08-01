import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

const WHITE = { r: 255, g: 255, b: 255 };

export async function removeImageBackground(inputBuffer, outputFormat) {
  const inputBlob = new Blob([inputBuffer], { type: 'application/octet-stream' });
  const cutoutBlob = await removeBackground(inputBlob, {
    output: { format: 'image/png' },
  });
  const cutoutBuffer = Buffer.from(await cutoutBlob.arrayBuffer());

  const flattened = sharp(cutoutBuffer).flatten({ background: WHITE });

  if (outputFormat === 'jpeg') {
    return flattened.jpeg({ quality: 92 }).toBuffer();
  }
  if (outputFormat === 'webp') {
    return flattened.webp({ quality: 92 }).toBuffer();
  }
  return flattened.png().toBuffer();
}
