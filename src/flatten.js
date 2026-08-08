import sharp from 'sharp';

const WHITE = { r: 255, g: 255, b: 255 };

export async function flattenToWhite(cutoutPngBuffer, outputFormat) {
  const flattened = sharp(cutoutPngBuffer).flatten({ background: WHITE });

  if (outputFormat === 'jpeg') {
    return flattened.jpeg({ quality: 92 }).toBuffer();
  }
  if (outputFormat === 'webp') {
    return flattened.webp({ quality: 92 }).toBuffer();
  }
  return flattened.png().toBuffer();
}
