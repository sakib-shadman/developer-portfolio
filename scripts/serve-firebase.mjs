// Serve dist/ (or $E2E_DIST) with the Firebase Hosting emulator on E2E_PORT (default 5000).
// Writes .firebase-e2e.json (gitignored) next to firebase.json so `public: "dist"` resolves the
// same way, with hub/logging ports offset from E2E_PORT so parallel runs don't collide.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const port = Number(process.env.E2E_PORT ?? 5000);
const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
// E2E_DIST lets the fixtures suite serve dist-fixtures/ next to the real dist/.
if (process.env.E2E_DIST) config.hosting.public = process.env.E2E_DIST;
config.emulators = {
  hosting: { port },
  hub: { port: port + 1 },
  logging: { port: port + 2 },
  ui: { enabled: false },
};
writeFileSync('.firebase-e2e.json', JSON.stringify(config, null, 2));

const child = spawn(
  'pnpm',
  [
    'exec',
    'firebase',
    'emulators:start',
    '--only',
    'hosting',
    '--project',
    'shadman-portfolio',
    '--config',
    '.firebase-e2e.json',
  ],
  { stdio: 'inherit' },
);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
