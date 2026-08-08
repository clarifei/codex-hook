import fs from 'node:fs';
import path from 'node:path';
import { type InstallAction, installBytes, sameGitBlob } from './lib/files.ts';
import { bytes, tree, type TreeEntry } from './lib/github.ts';
import {
  type InstallSelection,
  isWorkstyle,
  normalizeOptional,
  skillsFor,
  type SkillSource,
  type Workstyle,
} from './skill-manifest.ts';

type ManagedState = {
  version?: number;
  style?: Workstyle;
  optional?: string[];
  files: Record<string, string>;
};

type ManagedAction = InstallAction | 'remove' | 'preserve';
type ManagedResult = { action: ManagedAction; target: string };
type SyncFile = {
  skill: SkillSource;
  path: string;
  relative: string;
  sha: string;
};

async function syncSkills(
  codexHome: string,
  selection: Partial<InstallSelection> | Workstyle = {},
  options: { install?: boolean } = {},
): Promise<ManagedResult[]> {
  const { style, optional } = typeof selection === 'string' ? { style: selection, optional: [] } : {
    style: selection.style || 'caveman',
    optional: selection.optional || [],
  };
  const skills = skillsFor(style, optional);
  const treeRequests = new Map<string, Promise<TreeEntry[]>>();
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    if (!treeRequests.has(key)) {
      treeRequests.set(key, tree(skill.repository, skill.ref));
    }
  }
  const trees = new Map<string, TreeEntry[]>(
    await Promise.all(
      [...treeRequests].map(async ([key, request]) => [key, await request] as const),
    ),
  );
  const files: SyncFile[] = [];
  const targets = new Set<string>();
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    for (const entry of trees.get(key) ?? []) {
      if (!entry.path.startsWith(`${skill.source}/`)) continue;
      const inner = entry.path.slice(skill.source.length + 1);
      if (excluded(skill, inner)) continue;
      const relative = skill.destination ? `${skill.destination}/${inner}` : inner;
      reserve(targets, relative);
      files.push({ skill, path: entry.path, relative, sha: entry.sha });
    }
  }

  const statePath = path.join(codexHome, '.codex-hook', 'skills.json');
  const desired: Record<string, string> = Object.fromEntries(
    files.map((file) => [file.relative, file.sha]),
  );
  const removed = pruneManaged(codexHome, readState(statePath).files, desired);
  const downloads = options.install === false
    ? files.map((file) => ({ ...file, action: 'skip' as const, target: targetFor(codexHome, file.relative) }))
    : await Promise.all(files.map(async (file) => {
      const target = targetFor(codexHome, file.relative);
      if (sameGitBlob(target, file.sha)) {
        return { ...file, action: 'skip' as const, target };
      }
      return {
        ...file,
        bytes: await bytes(file.skill.repository, file.skill.ref, file.path),
        target,
      };
    }));
  const installed: ManagedResult[] = downloads.map((file) => ({
    action: 'action' in file ? file.action : installBytes(file.target, file.bytes),
    target: file.target,
  }));
  writeState(statePath, {
    version: 1,
    style,
    optional: [...optional].sort(),
    files: desired,
  });
  return [...installed, ...removed];
}

function uninstallSkills(
  codexHome: string,
  ids: readonly string[],
): Promise<ManagedResult[]> {
  const statePath = path.join(codexHome, '.codex-hook', 'skills.json');
  const state = readState(statePath);
  const requested = new Set(normalizeOptional(ids));
  const optional = normalizeOptional(state.optional || [])
    .filter((id) => !requested.has(id));
  return syncSkills(
    codexHome,
    { style: isWorkstyle(state.style) ? state.style : 'caveman', optional },
    { install: false },
  );
}

function targetFor(codexHome: string, relative: string) {
  if (
    !relative ||
    relative.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new Error(`invalid skill target: ${relative}`);
  }
  const root = path.resolve(codexHome, 'skills');
  const target = path.resolve(root, ...relative.split('/'));
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`invalid skill target: ${relative}`);
  }
  return target;
}

function readState(statePath: string): ManagedState {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return state && state.version === 1 && state.files &&
        typeof state.files === 'object'
      ? state as ManagedState
      : { files: {} };
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === 'ENOENT' ||
      error instanceof SyntaxError
    ) return { files: {} };
    throw error;
  }
}

function writeState(statePath: string, state: ManagedState) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function pruneManaged(
  codexHome: string,
  previous: Record<string, string>,
  desired: Record<string, string>,
): ManagedResult[] {
  const root = path.resolve(codexHome, 'skills');
  const results: ManagedResult[] = [];
  for (const [relative, sha] of Object.entries(previous)) {
    if (desired[relative]) continue;
    const target = targetFor(codexHome, relative);
    if (!fs.existsSync(target)) continue;
    if (!sameGitBlob(target, sha)) {
      results.push({ action: 'preserve', target });
      continue;
    }
    fs.rmSync(target, { force: true });
    removeEmptyParents(path.dirname(target), root);
    results.push({ action: 'remove', target });
  }
  return results;
}

function removeEmptyParents(directory: string, root: string) {
  while (directory.startsWith(`${root}${path.sep}`) && directory !== root) {
    if (fs.readdirSync(directory).length) return;
    fs.rmdirSync(directory);
    directory = path.dirname(directory);
  }
}

function excluded(skill: SkillSource, relative: string) {
  return Boolean(
    skill.exclude?.some((name) => relative === name || relative.startsWith(`${name}/`)),
  );
}

function reserve(targets: Set<string>, relative: string) {
  if (targets.has(relative)) {
    throw new Error(`duplicate skill target: ${relative}`);
  }
  targets.add(relative);
}

export { excluded, pruneManaged, readState, reserve, syncSkills, targetFor, uninstallSkills, writeState };
export type { ManagedResult, ManagedState };
