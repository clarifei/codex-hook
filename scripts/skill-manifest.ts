import fs from 'node:fs';
import path from 'node:path';
import { tree, type TreeEntry } from './lib/github.ts';

type Workstyle = 'caveman' | 'beeline';

type InstallSelection = {
  headroom?: boolean;
  style: Workstyle;
  optional: string[];
  installed?: string[];
  uninstall?: string[];
  refresh?: boolean;
};

type SkillSource = {
  repository: string;
  ref: string;
  source: string;
  destination?: string;
  exclude?: readonly string[];
};

type WorkstyleOption = {
  id: Workstyle;
  label: string;
  description: string;
  source: SkillSource;
};

type CoreComponent = {
  label: string;
  source?: SkillSource;
};

type OptionalSkillGroup = {
  id: string;
  label: string;
  description: string;
  skills: readonly OptionalSkill[];
};

type OptionalSkill = {
  id: string;
  label: string;
  description: string;
  sources: readonly SkillSource[];
};

type SkillRepository = Pick<OptionalSkillGroup, 'id' | 'label'> & {
  repository: string;
  ref: string;
  excluded?: readonly string[];
};

const workstyles: readonly WorkstyleOption[] = [
  {
    id: 'caveman',
    label: 'Caveman',
    description: 'Terse, direct responses',
    source: { repository: 'JuliusBrussee/caveman', ref: 'main', source: 'skills', destination: 'caveman' },
  },
  {
    id: 'beeline',
    label: 'Beeline',
    description: 'Structured, action-first responses',
    source: { repository: 'iceHub82/beeline', ref: 'main', source: 'skills', destination: 'beeline' },
  },
];

const styleSkills = Object.fromEntries(
  workstyles.map(({ id, source }) => [id, source]),
) as Record<Workstyle, SkillSource>;

const coreComponents: readonly CoreComponent[] = [
  {
    label: 'Ponytail',
    source: { repository: 'DietrichGebert/ponytail', ref: 'main', source: 'skills', destination: 'ponytail' },
  },
  { label: 'RTK' },
  { label: 'Codebase Memory MCP' },
  {
    label: 'Wigolo',
    source: { repository: 'KnockOutEZ/wigolo', ref: 'main', source: 'skills', destination: 'wigolo' },
  },
];

const coreSkills = coreComponents.flatMap(({ source }) => source ? [source] : []);

// Only official repositories are configured here. Every optional skill is inferred from SKILL.md paths.
const skillRepositories: readonly SkillRepository[] = [
  {
    id: 'matt-pocock',
    label: 'Matt Pocock',
    repository: 'mattpocock/skills',
    ref: 'main',
  },
  {
    id: 'emil-kowalski',
    label: 'Emil Kowalski',
    repository: 'emilkowalski/skills',
    ref: 'main',
    excluded: ['skills/prototype'],
  },
  {
    id: 'deno',
    label: 'Deno',
    repository: 'denoland/skills',
    ref: 'main',
  },
  {
    id: 'hono',
    label: 'Hono',
    repository: 'yusukebe/hono-skill',
    ref: 'main',
  },
  {
    id: 'elysia',
    label: 'ElysiaJS',
    repository: 'elysiajs/skills',
    ref: 'main',
  },
  {
    id: 'mcollina',
    label: 'Matteo Collina',
    repository: 'mcollina/skills',
    ref: 'main',
  },
  {
    id: 'better-auth',
    label: 'Better Auth',
    repository: 'better-auth/skills',
    ref: 'main',
  },
  {
    id: 'vercel-react',
    label: 'Vercel React',
    repository: 'vercel-labs/agent-skills',
    ref: 'main',
  },
  {
    id: 'tanstack',
    label: 'TanStack',
    repository: 'tanstack-skills/tanstack-skills',
    ref: 'main',
  },
];

const catalogTtlMs = 60 * 60 * 1000;
const catalogVersion = 5;
const emptyGroups = skillRepositories.map(({ id, label }) => ({
  id,
  label,
  description: `${label} skills`,
  skills: [],
}));
let optionalSkillGroups: readonly OptionalSkillGroup[] = emptyGroups;
let optionalSkills: readonly OptionalSkill[] = [];

async function refreshOptionalSkillGroups(cachePath?: string, refresh = false) {
  const cached = cachePath ? readCatalog(cachePath) : null;
  if (cached && !refresh && Date.now() - cached.fetchedAt < catalogTtlMs) {
    setOptionalSkillGroups(cached.groups);
    return;
  }
  const updates = await Promise.all(skillRepositories.map(async (repository) => {
    try {
      return await discoverGroup(repository, await tree(repository.repository, repository.ref, refresh));
    } catch {
      return null;
    }
  }));
  const cachedGroups = new Map(cached?.groups.map((group) => [group.id, group]));
  setOptionalSkillGroups(
    updates.map((group, index) => group || cachedGroups.get(skillRepositories[index].id) || emptyGroups[index]),
  );
  if (cachePath && updates.some(Boolean)) writeCatalog(cachePath, optionalSkillGroups);
}

function discoverGroup(repository: SkillRepository, entries: readonly TreeEntry[]): OptionalSkillGroup {
  const skills = discoverSkills(repository, entries);
  return { id: repository.id, label: repository.label, description: `${repository.label} skills`, skills };
}

function discoverSkills(
  repository: SkillRepository,
  entries: readonly TreeEntry[],
): OptionalSkill[] {
  const skillDirectories = new Set(
    entries
      .filter(({ type, path }) => type === 'blob' && (path === 'SKILL.md' || path.endsWith('/SKILL.md')))
      .map(({ path }) => skillDirectory(path)),
  );
  return [...new Set([...skillDirectories].map((source) => sourceRoot(source, skillDirectories)))]
    .filter((source) => !repository.excluded?.includes(source))
    .map((source) => {
      const directSkill = skillDirectories.has(source);
      const id = skillId(repository.id, source, directSkill);
      const child = source.split('/').at(-1) || repository.id;
      return {
        id,
        label: humanize(child),
        description: `${repository.label} skill`,
        sources: [{
          repository: repository.repository,
          ref: repository.ref,
          source,
          destination: skillDestination(repository.id, id),
          exclude: ['README.md'],
        }],
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function skillDirectory(file: string) {
  return file === 'SKILL.md' ? '' : file.slice(0, -'/SKILL.md'.length);
}

function sourceRoot(source: string, skillDirectories: ReadonlySet<string>) {
  const parts = source.split('/');
  const skillsIndex = parts.lastIndexOf('skills');
  if (skillsIndex < 0 || skillsIndex >= parts.length - 2) return source;
  const collection = parts.slice(0, skillsIndex + 2).join('/');
  return skillDirectories.has(collection) ? source : collection;
}

function skillId(groupId: string, source: string, directSkill: boolean) {
  const child = slug(source.split('/').at(-1) || groupId);
  if (directSkill && source.startsWith('skills/')) return child;
  const family = groupId.split('-').at(-1)!;
  return child === groupId || child.startsWith(`${family}-`) ? child : `${groupId}-${child}`;
}

function skillDestination(groupId: string, skillId: string) {
  const local = localSkillName(groupId, skillId);
  return local ? `${groupId}/${local}` : groupId;
}

function localSkillName(groupId: string, skillId: string) {
  if (skillId === groupId) return '';
  if (skillId.startsWith(`${groupId}-`)) return skillId.slice(groupId.length + 1);
  const family = groupId.split('-').at(-1)!;
  return skillId.startsWith(`${family}-`) ? skillId.slice(family.length + 1) : skillId;
}

function slug(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function humanize(value: string) {
  return slug(value).replace(/\b\w/g, (character) => character.toUpperCase()).replace(/-/g, ' ');
}

function readCatalog(cachePath: string): { fetchedAt: number; groups: OptionalSkillGroup[] } | null {
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return cache?.version === catalogVersion && typeof cache.fetchedAt === 'number' && Array.isArray(cache.groups)
      ? cache as { fetchedAt: number; groups: OptionalSkillGroup[] }
      : null;
  } catch {
    return null;
  }
}

function writeCatalog(cachePath: string, groups: readonly OptionalSkillGroup[]) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify({ version: catalogVersion, fetchedAt: Date.now(), groups })}\n`);
}

function setOptionalSkillGroups(groups: readonly OptionalSkillGroup[]) {
  optionalSkillGroups = groups;
  optionalSkills = groups.flatMap(({ skills }) => skills);
}

function normalizeOptional(optional: readonly string[], expandGroups = true): string[] {
  const selected = new Set<string>();
  const unknown = new Set<string>();
  for (const id of optional) {
    const group = optionalSkillGroups.find((candidate) => candidate.id === id);
    const skill = optionalSkills.find((candidate) => candidate.id === id);
    if (group && expandGroups) {
      group.skills.forEach(({ id: skillId }) => selected.add(skillId));
      continue;
    }
    if (skill) selected.add(id);
    else if (group) group.skills.forEach(({ id: skillId }) => selected.add(skillId));
    else unknown.add(id);
  }
  if (unknown.size) throw new Error(`unknown optional skill group: ${[...unknown].join(', ')}`);
  return [...selected].sort();
}

function isWorkstyle(value: unknown): value is Workstyle {
  return workstyles.some(({ id }) => id === value);
}

function skillsFor(
  style: Workstyle = 'caveman',
  optional: readonly string[] = [],
  expandGroups = true,
): SkillSource[] {
  const selected = new Set(normalizeOptional(optional, expandGroups));
  return [
    styleSkills[style],
    ...coreSkills,
    ...optionalSkills.filter(({ id }) => selected.has(id)).flatMap(({ sources }) => sources),
  ];
}

export {
  coreComponents,
  discoverSkills,
  isWorkstyle,
  normalizeOptional,
  optionalSkillGroups,
  optionalSkills,
  refreshOptionalSkillGroups,
  setOptionalSkillGroups,
  skillsFor,
  styleSkills,
  workstyles,
};
export type { InstallSelection, OptionalSkill, OptionalSkillGroup, SkillSource, Workstyle, WorkstyleOption };
