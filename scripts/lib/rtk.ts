import { spawnSync } from 'node:child_process';
import { resolveExecutable } from '../../hooks/lib/executable.ts';

const installerUrl = 'https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh';

function exists(command: string) {
  return spawnSync(resolveExecutable(command), ['--version'], { stdio: 'ignore' }).status === 0;
}

function ensureRtk(): 'install rtk' | 'skip rtk' {
  if (exists('rtk')) return 'skip rtk';

  if (Deno.build.os !== 'windows') {
    if (!exists('curl')) {
      throw new Error(
        'rtk needs curl to install from https://github.com/rtk-ai/rtk',
      );
    }
    const download = spawnSync('curl', ['-fsSL', installerUrl], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    if (download.status !== 0) throw new Error('rtk installer download failed');
    const result = spawnSync('sh', [], {
      input: download.stdout,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (result.status !== 0 || !exists('rtk')) {
      throw new Error('rtk install failed');
    }
    return 'install rtk';
  }

  if (!exists('cargo')) {
    throw new Error(
      'rtk needs cargo to install from https://github.com/rtk-ai/rtk',
    );
  }
  const result = spawnSync(resolveExecutable('cargo'), [
    'install',
    '--git',
    'https://github.com/rtk-ai/rtk',
  ], { stdio: 'inherit' });
  if (result.status !== 0 || !exists('rtk')) {
    throw new Error('rtk install failed');
  }
  return 'install rtk';
}

export { ensureRtk };
