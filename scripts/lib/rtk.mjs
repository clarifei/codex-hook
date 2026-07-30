import { spawnSync } from 'node:child_process';

const binary = process.platform === 'win32' ? 'rtk.exe' : 'rtk';
const cargo = process.platform === 'win32' ? 'cargo.exe' : 'cargo';

function exists(command) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

function ensureRtk() {
  if (exists(binary)) return 'skip rtk';
  if (!exists(cargo)) throw new Error('rtk needs cargo to install from https://github.com/rtk-ai/rtk');
  const result = spawnSync(cargo, ['install', '--git', 'https://github.com/rtk-ai/rtk'], { stdio: 'inherit' });
  if (result.status !== 0 || !exists(binary)) throw new Error('rtk install failed');
  return 'install rtk';
}

export { ensureRtk };
