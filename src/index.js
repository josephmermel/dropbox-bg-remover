import { config } from './config.js';
import { providers } from './providers/index.js';
import { scanFolder, processSelected } from './runner.js';

function logEvent(event) {
  switch (event.type) {
    case 'file-start':
      console.log(`Processing ${event.name} -> ${event.outputName}`);
      break;
    case 'file-done':
      console.log(`  done: ${event.outputName}`);
      break;
    case 'file-failed':
      console.error(`  failed: ${event.name} - ${event.error}`);
      break;
    case 'file-skipped':
      console.warn(`  skipping ${event.name}: ${event.reason}`);
      break;
    case 'run-error':
      console.error(event.error);
      break;
    case 'run-complete':
      console.log('Done.');
      break;
  }
}

async function main() {
  const provider = providers.find((p) => config.providerApiKeys[p.id]);
  if (!provider) {
    const envVars = providers.map((p) => `${p.id.toUpperCase()}_API_KEY`).join(', ');
    console.error(`No provider API key configured. Set one of: ${envVars} in .env.`);
    process.exit(1);
  }

  console.log(`Scanning ${config.folder} ...`);
  const { pending } = await scanFolder(config.folder);
  console.log(`Found ${pending.length} image(s) to process using ${provider.label}.`);

  await processSelected(pending, {
    onEvent: logEvent,
    providerId: provider.id,
    apiKey: config.providerApiKeys[provider.id],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
