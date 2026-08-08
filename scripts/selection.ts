import path from 'node:path';
import { installedStyle } from '../hooks/lib/style.ts';
import {
  type InstallSelection,
  isWorkstyle,
  normalizeOptional,
  optionalSkillGroups,
  optionalSkills,
  type Workstyle,
  workstyles,
} from './skill-manifest.ts';
import { readState } from './sync-skills.ts';

type InstallArgs = {
  interactive: boolean;
  style?: Workstyle;
  optional?: string[];
};

async function chooseSelection(
  source: string,
  codexHome: string,
  args: readonly string[],
): Promise<InstallSelection | null> {
  const parsed = parseArgs(args);
  const saved = savedSelection(codexHome);
  const initial: InstallSelection = {
    style: parsed.style || saved.style,
    optional: parsed.optional === undefined ? saved.optional : parsed.optional,
  };
  return parsed.interactive && Deno.stdin.isTerminal() && Deno.stdout.isTerminal()
    ? await chooseWithTui(source, initial)
    : initial;
}

async function chooseWithTui(
  source: string,
  defaults: InstallSelection,
): Promise<InstallSelection | null> {
  const output = await Deno.makeTempFile({
    prefix: 'codex-hook-selection-',
    suffix: '.json',
  });
  try {
    let status: { success: boolean; code: number };
    try {
      status = await new Deno.Command('bun', {
        args: [
          'run',
          path.join(source, 'scripts', 'tui.ts'),
          '--output',
          output,
          '--defaults',
          JSON.stringify(defaults),
        ],
        cwd: source,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      }).spawn().status;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error('Bun is required for the interactive OpenTUI; use --yes for a Deno-only install');
      }
      throw error;
    }
    if (!status.success) throw new Error(`OpenTUI exited with code ${status.code}`);
    return JSON.parse(await Deno.readTextFile(output)) as InstallSelection | null;
  } finally {
    await Deno.remove(output).catch(() => {});
  }
}

function savedSelection(codexHome: string): InstallSelection {
  const state = readState(path.join(codexHome, '.codex-hook', 'skills.json'));
  const style: Workstyle = isWorkstyle(state.style) ? state.style : installedStyle(codexHome) || 'caveman';
  const known = new Set([
    ...optionalSkillGroups.map(({ id }) => id),
    ...optionalSkills.map(({ id }) => id),
  ]);
  const optional = Array.isArray(state.optional) ? normalizeOptional(state.optional.filter((id) => known.has(id))) : [];
  return { style, optional };
}

function parseArgs(args: readonly string[]): InstallArgs {
  const result: InstallArgs = { interactive: args.length === 0 };
  const known = new Set([
    ...optionalSkillGroups.map(({ id }) => id),
    ...optionalSkills.map(({ id }) => id),
  ]);
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--yes') continue;
    if (argument === '--all') {
      result.optional = normalizeOptional(optionalSkillGroups.map(({ id }) => id));
      continue;
    }
    if (argument === '--style' || argument === '--with') {
      if (!args[index + 1]) throw new Error(`${argument} needs a value`);
      if (argument === '--style') result.style = normalizeStyle(args[++index]);
      else result.optional = parseOptional(args[++index], known);
      continue;
    }
    if (argument.startsWith('--style=')) {
      result.style = normalizeStyle(argument.slice(8));
      continue;
    }
    if (argument.startsWith('--with=')) {
      result.optional = parseOptional(argument.slice(7), known);
      continue;
    }
    if (!argument.startsWith('-') && result.style === undefined) {
      result.style = normalizeStyle(argument);
      continue;
    }
    const styles = workstyles.map(({ id }) => id).join('|');
    throw new Error(`usage: install [${styles}] [--with group-or-skill,...] [--all] [--yes] (got ${argument})`);
  }
  return result;
}

function normalizeStyle(style: string): Workstyle {
  if (style === 'baseline') return 'caveman';
  if (!isWorkstyle(style)) throw new Error(`unsupported style: ${style}`);
  return style;
}

function parseOptional(value: string, known: Set<string>) {
  const selected = value ? [...new Set(value.split(',').filter(Boolean))] : [];
  const unknown = selected.filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`unknown optional skill group: ${unknown.join(', ')}`);
  return normalizeOptional(selected);
}

export { chooseSelection, parseArgs };
export type { InstallArgs };
