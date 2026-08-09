const OUTPUT_SUFFIX_PATTERN = /-nobackground\.[^./]+$/i;

const SHARP_FORMAT_BY_EXTENSION = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

export function isOutputImage(filename) {
  return OUTPUT_SUFFIX_PATTERN.test(filename);
}

export function extensionOf(filename) {
  const dotIndex = filename.lastIndexOf('.');
  return filename.slice(dotIndex + 1);
}

export function outputFilenameFor(filename) {
  const dotIndex = filename.lastIndexOf('.');
  const base = filename.slice(0, dotIndex);
  const ext = filename.slice(dotIndex + 1);
  return `${base}-nobackground.${ext}`;
}

export function sharpFormatFor(extension) {
  return SHARP_FORMAT_BY_EXTENSION[extension.toLowerCase()] || null;
}
