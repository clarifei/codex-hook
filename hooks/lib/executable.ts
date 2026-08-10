import fs from 'node:fs';
import path from 'node:path';

type ResolveExecutableOptions = {
  env?: Record<string, string>;
  os?: typeof Deno.build.os;
};

function resolveExecutable(
  command: string,
  {
    env = Deno.env.toObject(),
    os = Deno.build.os,
  }: ResolveExecutableOptions = {},
): string {
  if (os !== 'windows' || path.isAbsolute(command) || /[\\/]/.test(command)) return command;

  const pathValue = environmentValue(env, 'PATH');
  if (!pathValue) return command;
  const extensions = path.extname(command) ? [''] : (environmentValue(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((extension) => extension.trim())
    .filter(Boolean);

  // Scan entries independently so one unmatched quote cannot hide the rest of PATH from Deno.
  for (const entry of pathValue.split(';')) {
    const directory = entry.trim().replace(/^"+|"+$/g, '');
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = path.resolve(directory, `${command}${extension}`);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        continue;
      }
    }
  }
  return command;
}

function environmentValue(env: Record<string, string>, name: string) {
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key ? env[key] : undefined;
}

export { resolveExecutable };
export type { ResolveExecutableOptions };
