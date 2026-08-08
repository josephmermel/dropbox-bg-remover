const PIXELCUT_ENDPOINT = 'https://api.developer.pixelcut.ai/v1/remove-background';

export const pixelcutProvider = {
  id: 'pixelcut',
  label: 'Pixelcut',
  requiresApiKey: true,

  async removeBackgroundCutout(inputBuffer, apiKey, sourceFilename) {
    const form = new FormData();
    form.append('image', new Blob([inputBuffer]), sourceFilename || 'image');
    form.append('format', 'png');

    const response = await fetch(PIXELCUT_ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, Accept: 'image/*' },
      body: form,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Pixelcut error (${response.status}): ${errorBody}`);
    }

    return Buffer.from(await response.arrayBuffer());
  },
};
