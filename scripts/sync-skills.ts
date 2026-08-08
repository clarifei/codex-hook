import fs from 'node:fs';
import path from 'node:path';
import { type InstallAction, sameGitBlob, writeBytes } from './lib/files.ts';
import { bytes, tree, type TreeEntry } from './lib/github.ts';
import {
  type InstallSelection,
  isWorkstyle,
  normalizeOptional,
  optionalSkills,
  skillsFor,
  type SkillSource,
  type Workstyle,
} from './skill-manifest.ts';

type ManagedState = {
  version?: number;
  style?: Workstyle;
  optional?: string[];
  files: Record<string, string>;
  skillFiles?: Record<string, string[]>;
};

type ManagedAction = InstallAction | 'remove' | 'preserve';
type ManagedResult = { action: ManagedAction; target: string };
type SyncFile = {
  skill: SkillSource;
  owner?: string;
  path: string;
  relative: string;
  sha: string;
};
type SyncOptions = { install?: boolean; refresh?: boolean };

const downloadConcurrency = 12;
const sourceOwners = new Map(
  optionalSkills.flatMap(({ id, sources }) => sources.map((source) => [source, id] as const)),
);

async function syncSkills(
  codexHome: string,
  selection: Partial<InstallSelection> | Workstyle = {},
  options: SyncOptions = {},
): Promise<ManagedResult[]> {
  const { style, optional } = typeof selection === 'string' ? { style: selection, optional: [] } : {
    style: selection.style || 'caveman',
    optional: selection.optional || [],
  };
  const selected = normalizeOptional(optional, false);
  const statePath = path.join(codexHome, '.codex-hook', 'skills.json');
  const state = readState(statePath);
  const cached = options.refresh ? null : cachedResults(codexHome, state, style, selected);
  if (cached) return cached;

  const skills = skillsFor(style, selected, false);
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
      files.push({ skill, owner: sourceOwners.get(skill), path: entry.path, relative, sha: entry.sha });
    }
  }

  const desired: Record<string, string> = Object.fromEntries(
    files.map((file) => [file.relative, file.sha]),
  );
  const removed = pruneManaged(codexHome, state.files, desired);
  const downloads = options.install === false
    ? files.map((file) => ({ ...file, action: 'skip' as const, target: targetFor(codexHome, file.relative) }))
    : await mapConcurrent(files, downloadConcurrency, async (file) => {
      const target = targetFor(codexHome, file.relative);
      if (sameGitBlob(target, file.sha)) {
        return { ...file, action: 'skip' as const, target };
      }
      return {
        ...file,
        action: 'replace' as const,
        bytes: await bytes(file.skill.repository, file.skill.ref, file.path),
        target,
      };
    });
  const installed: ManagedResult[] = downloads.map((file) => ({
    action: 'bytes' in file ? writeBytes(file.target, file.bytes) : file.action,
    target: file.target,
  }));
  writeState(statePath, {
    version: 2,
    style,
    optional: selected,
    files: desired,
    skillFiles: groupFilesByOwner(files),
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
  const selected = normalizeOptional(state.optional || [], false);
  const optional = selected
    .filter((id) => !requested.has(id));
  const removed = selected.filter((id) => requested.has(id));
  const skillFiles = state.skillFiles;
  if (state.version === 2 && skillFiles && removed.every((id) => skillFiles[id])) {
    const desired = { ...state.files };
    for (const id of removed) {
      for (const relative of skillFiles[id]) delete desired[relative];
    }
    const remainingSkillFiles = Object.fromEntries(
      Object.entries(skillFiles).filter(([id]) => !requested.has(id)),
    );
    const results = pruneManaged(codexHome, state.files, desired);
    writeState(statePath, {
      version: 2,
      style: state.style,
      optional,
      files: desired,
      skillFiles: remainingSkillFiles,
    });
    return Promise.resolve(results);
  }
  return syncSkills(
    codexHome,
    { style: isWorkstyle(state.style) ? state.style : 'caveman', optional },
    { install: false, refresh: true },
  );
}

function cachedResults(
  codexHome: string,
  state: ManagedState,
  style: Workstyle,
  optional: readonly string[],
): ManagedResult[] | null {
  if (
    state.version !== 2 ||
    state.style !== style ||
    !sameOptional(state.optional, optional) ||
    !Object.keys(state.files).length
  ) return null;
  const results: ManagedResult[] = [];
  for (const [relative, sha] of Object.entries(state.files)) {
    const target = targetFor(codexHome, relative);
    if (!sameGitBlob(target, sha)) return null;
    results.push({ action: 'skip', target });
  }
  return results;
}

function sameOptional(current: unknown, expected: readonly string[]) {
  return Array.isArray(current) && current.length === expected.length &&
    current.every((id, index) => id === expected[index]);
}

function groupFilesByOwner(files: readonly SyncFile[]) {
  return files.reduce<Record<string, string[]>>((skillFiles, { owner, relative }) => {
    if (owner) (skillFiles[owner] ||= []).push(relative);
    return skillFiles;
  }, {});
}

async function mapConcurrent<T, Result>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]);
    }
  }));
  return results;
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
    return state && (state.version === 1 || state.version === 2) && state.files &&
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
