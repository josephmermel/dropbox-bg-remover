import { flattenToWhite } from './flatten.js';

const API4AI_ENDPOINT = 'https://api4ai.cloud/img-bg-removal/v1/results';

export async function removeImageBackgroundApi4ai(inputBuffer, outputFormat, apiKey, sourceFilename) {
  const form = new FormData();
  form.append('image', new Blob([inputBuffer]), sourceFilename || 'image');

  const response = await fetch(API4AI_ENDPOINT, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`api4.ai error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const entity = data?.results?.[0]?.entities?.[0];
  if (!entity?.image) {
    throw new Error(`api4.ai response missing image data: ${JSON.stringify(data)}`);
  }

  const cutoutBuffer = Buffer.from(entity.image, 'base64');
  return flattenToWhite(cutoutBuffer, outputFormat);
}
