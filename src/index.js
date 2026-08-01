import { config } from './config.js';
import { runFolder } from './runner.js';

function logEvent(event) {
  switch (event.type) {
    case 'scan-start':
      console.log(`Scanning ${event.folder} ...`);
      break;
    case 'scan-complete':
      console.log(`Found ${event.totalSource} source image(s), ${event.pendingCount} need processing.`);
      break;
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
    case 'run-complete':
      console.log('Done.');
      break;
  }
}

runFolder(config.folder, { onEvent: logEvent }).catch((err) => {
  console.error(err);
  process.exit(1);
});
