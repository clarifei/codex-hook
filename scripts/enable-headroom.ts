#!/usr/bin/env -S deno run --allow-env --allow-read --allow-write

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureHeadroomBridge } from './lib/config.ts';
import { installFile } from './lib/files.ts';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codexHome = Deno.env.get('CODEX_HOME') || path.join(os.homedir(), '.codex');
const configPath = path.join(codexHome, 'config.toml');
const files = [
  'hooks.json',
  'hooks/headroom-bridge.ts',
  'hooks/lib/executable.ts',
  'hooks/lib/headroom-bridge.ts',
];

for (const file of files) installFile(path.join(source, file), path.join(codexHome, file));
const configured = ensureHeadroomBridge(configPath);

console.log(`
Headroom bridge ${configured ? 'enabled' : 'already enabled'}
  bridge   http://127.0.0.1:8788
  headroom http://127.0.0.1:8787
  upstream Afterinput (OAuth preserved)
`);
