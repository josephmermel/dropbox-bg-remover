import { removeBackground } from '@imgly/background-removal-node';

export const localProvider = {
  id: 'local',
  label: 'Local (offline)',
  requiresApiKey: false,

  async removeBackgroundCutout(inputBuffer) {
    const inputBlob = new Blob([inputBuffer], { type: 'application/octet-stream' });
    const cutoutBlob = await removeBackground(inputBlob, {
      output: { format: 'image/png' },
    });
    return Buffer.from(await cutoutBlob.arrayBuffer());
  },
};
