import { tree, type TreeEntry } from './lib/github.ts';

type Workstyle = 'caveman' | 'beeline';

type InstallSelection = {
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

type SkillDiscovery = {
  repository: string;
  ref: string;
  root: string;
  layout: 'children' | 'nested-children' | 'plugins';
  destination: 'child' | 'none';
  idPrefix?: string;
  include?: readonly string[];
};

const workstyles: readonly WorkstyleOption[] = [
  {
    id: 'caveman',
    label: 'Caveman',
    description: 'Terse, direct responses',
    source: {
      repository: 'JuliusBrussee/caveman',
      ref: 'main',
      source: 'skills',
    },
  },
  {
    id: 'beeline',
    label: 'Beeline',
    description: 'Structured, action-first responses',
    source: {
      repository: 'iceHub82/beeline',
      ref: 'main',
      source: 'skills',
    },
  },
];

const styleSkills = Object.fromEntries(
  workstyles.map(({ id, source }) => [id, source]),
) as Record<Workstyle, SkillSource>;

const coreComponents: readonly CoreComponent[] = [
  {
    label: 'Ponytail',
    source: { repository: 'DietrichGebert/ponytail', ref: 'main', source: 'skills' },
  },
  { label: 'RTK' },
  { label: 'Codebase Memory MCP' },
  {
    label: 'Wigolo',
    source: { repository: 'KnockOutEZ/wigolo', ref: 'main', source: 'skills' },
  },
];

const coreSkills = coreComponents.flatMap(({ source }) => source ? [source] : []);

const staticOptionalSkillGroups: readonly OptionalSkillGroup[] = [
  {
    id: 'matt-pocock',
    label: 'Matt Pocock',
    description: 'Engineering and productivity workflows',
    skills: [
      {
        id: 'matt-pocock-engineering',
        label: 'Engineering',
        description: 'Engineering workflows and code-quality tools',
        sources: [{
          repository: 'mattpocock/skills',
          ref: 'main',
          source: 'skills/engineering',
          exclude: ['README.md'],
        }],
      },
      {
        id: 'matt-pocock-productivity',
        label: 'Productivity',
        description: 'General planning, communication, and agent-writing tools',
        sources: [{
          repository: 'mattpocock/skills',
          ref: 'main',
          source: 'skills/productivity',
          exclude: ['README.md'],
        }],
      },
    ],
  },
  {
    id: 'emil-kowalski',
    label: 'Emil Kowalski',
    description: 'Design engineering and motion skills',
    skills: [{
      id: 'emil-kowalski',
      label: 'Emil Kowalski',
      description: 'Design engineering and motion skills',
      sources: [{
        repository: 'emilkowalski/skills',
        ref: 'main',
        source: 'skills',
        exclude: ['prototype'],
      }],
    }],
  },
  {
    id: 'deno',
    label: 'Deno',
    description: 'Deno runtime, deployment, frontend, migration, and sandboxing',
    skills: [
      ['deno', 'Deno', 'Core Deno runtime and tooling'],
      ['migrate-to-deno', 'Migrate to Deno', 'Move Node, npm, Yarn, pnpm, or Bun projects to Deno'],
      ['deno-deploy', 'Deno Deploy', 'Deploy and operate applications on Deno Deploy'],
      ['deno-frontend', 'Deno Frontend', 'Fresh, Preact, and Tailwind frontend development'],
      ['deno-sandbox', 'Deno Sandbox', 'Safe code execution with @deno/sandbox'],
    ].map(([id, label, description]) => ({
      id,
      label,
      description,
      sources: [{
        repository: 'denoland/skills',
        ref: 'main',
        source: `skills/${id}`,
        destination: id,
      }],
    })),
  },
  {
    id: 'hono',
    label: 'Hono',
    description: 'Hono routing, middleware, validation, RPC, and testing',
    skills: [{
      id: 'hono',
      label: 'Hono',
      description: 'Hono routing, middleware, validation, RPC, and testing',
      sources: [{ repository: 'yusukebe/hono-skill', ref: 'main', source: 'skills/hono', destination: 'hono' }],
    }],
  },
  {
    id: 'elysia',
    label: 'ElysiaJS',
    description: 'ElysiaJS backend routing, validation, plugins, and deployment',
    skills: [{
      id: 'elysia',
      label: 'ElysiaJS',
      description: 'ElysiaJS backend routing, validation, plugins, and deployment',
      sources: [{ repository: 'elysiajs/skills', ref: 'main', source: 'elysia', destination: 'elysia' }],
    }],
  },
  {
    id: 'mcollina',
    label: 'Matteo Collina',
    description: 'Fastify backend development and skill optimization',
    skills: [
      {
        id: 'fastify',
        label: 'Fastify',
        description: 'Fastify Node.js servers, APIs, schemas, plugins, and testing',
        sources: [{
          repository: 'mcollina/skills',
          ref: 'main',
          source: 'skills/fastify',
          destination: 'fastify',
        }],
      },
      {
        id: 'skill-optimizer',
        label: 'Skill Optimizer',
        description: 'Improve skill activation, clarity, context cost, and reliability',
        sources: [{
          repository: 'mcollina/skills',
          ref: 'main',
          source: 'skills/skill-optimizer',
          destination: 'skill-optimizer',
        }],
      },
    ],
  },
  {
    id: 'better-auth',
    label: 'Better Auth',
    description: 'Better Auth setup, features, and security guidance',
    skills: [
      [
        'better-auth-best-practices',
        'Best Practices',
        'Recommended Better Auth configuration and patterns',
        'better-auth/best-practices',
      ],
      [
        'better-auth-create-auth',
        'Create Auth',
        'Create and configure a Better Auth instance',
        'better-auth/create-auth',
      ],
      [
        'better-auth-email-password',
        'Email and Password',
        'Email and password authentication',
        'better-auth/emailAndPassword',
      ],
      [
        'better-auth-organization',
        'Organization',
        'Organization and team authentication features',
        'better-auth/organization',
      ],
      ['better-auth-two-factor', 'Two Factor', 'Two-factor authentication setup', 'better-auth/twoFactor'],
      ['better-auth-security', 'Security', 'Rate limits, secrets, CSRF, origins, sessions, and cookies', 'security'],
    ].map(([id, label, description, source]) => ({
      id,
      label,
      description,
      sources: [{ repository: 'better-auth/skills', ref: 'main', source, destination: id }],
    })),
  },
  {
    id: 'vercel-react',
    label: 'Vercel React',
    description: 'React performance and native view transitions',
    skills: [
      [
        'react-best-practices',
        'React Best Practices',
        'React and Next.js performance guidance from Vercel Engineering',
        'react-best-practices',
      ],
      [
        'react-view-transitions',
        'React View Transitions',
        'React View Transition API and CSS animation patterns',
        'react-view-transitions',
      ],
    ].map(([id, label, description, source]) => ({
      id,
      label,
      description,
      sources: [{
        repository: 'vercel-labs/agent-skills',
        ref: 'main',
        source: `skills/${source}`,
        destination: id,
      }],
    })),
  },
  {
    id: 'tanstack',
    label: 'TanStack',
    description: 'Select individual skills from the TanStack ecosystem',
    skills: [
      ['tanstack-ai', 'TanStack AI', 'Provider-agnostic AI SDK with streaming and tools'],
      ['tanstack-cli', 'TanStack CLI', 'Project scaffolding and integrations'],
      ['tanstack-config', 'TanStack Config', 'Build, lint, and publish configuration'],
      ['tanstack-db', 'TanStack DB', 'Client-first reactive database and live queries'],
      ['tanstack-devtools', 'TanStack Devtools', 'Centralized devtools panel and plugins'],
      ['tanstack-form', 'TanStack Form', 'Headless forms with sync and async validation'],
      ['tanstack-pacer', 'TanStack Pacer', 'Debouncing, throttling, queues, and rate limits'],
      ['tanstack-query', 'TanStack Query', 'Async state, caching, mutations, and SSR'],
      ['tanstack-ranger', 'TanStack Ranger', 'Headless range and slider primitives'],
      ['tanstack-router', 'TanStack Router', 'Type-safe file-based routing and data loading'],
      ['tanstack-start', 'TanStack Start', 'Full-stack React framework with SSR and streaming'],
      ['tanstack-store', 'TanStack Store', 'Framework-agnostic reactive data store'],
      ['tanstack-table', 'TanStack Table', 'Headless tables, sorting, filtering, and pagination'],
      ['tanstack-virtual', 'TanStack Virtual', 'Virtualized lists and grids'],
    ].map(([id, label, description]) => ({
      id,
      label,
      description,
      sources: [{
        repository: 'tanstack-skills/tanstack-skills',
        ref: 'main',
        source: `plugins/${id}/skills/${id}`,
        destination: id,
      }],
    })),
  },
];

const discoveries: Record<string, SkillDiscovery> = {
  'matt-pocock': {
    repository: 'mattpocock/skills',
    ref: 'main',
    root: 'skills',
    layout: 'nested-children',
    destination: 'none',
    idPrefix: 'matt-pocock-',
    include: ['engineering', 'productivity'],
  },
  deno: {
    repository: 'denoland/skills',
    ref: 'main',
    root: 'skills',
    layout: 'children',
    destination: 'child',
  },
  hono: {
    repository: 'yusukebe/hono-skill',
    ref: 'main',
    root: 'skills',
    layout: 'children',
    destination: 'child',
    include: ['hono'],
  },
  mcollina: {
    repository: 'mcollina/skills',
    ref: 'main',
    root: 'skills',
    layout: 'children',
    destination: 'child',
    include: ['fastify', 'skill-optimizer'],
  },
  'better-auth': {
    repository: 'better-auth/skills',
    ref: 'main',
    root: 'better-auth',
    layout: 'children',
    destination: 'child',
    idPrefix: 'better-auth-',
  },
  'vercel-react': {
    repository: 'vercel-labs/agent-skills',
    ref: 'main',
    root: 'skills',
    layout: 'children',
    destination: 'child',
    include: ['react-best-practices', 'react-view-transitions'],
  },
  tanstack: {
    repository: 'tanstack-skills/tanstack-skills',
    ref: 'main',
    root: 'plugins',
    layout: 'plugins',
    destination: 'child',
  },
};

let optionalSkillGroups: readonly OptionalSkillGroup[] = staticOptionalSkillGroups;
let optionalSkills = optionalSkillGroups.flatMap(({ skills }) => skills);

async function refreshOptionalSkillGroups(refresh = false) {
  const updates = await Promise.all(
    Object.entries(discoveries).map(async ([groupId, discovery]) => {
      try {
        const entries = await tree(discovery.repository, discovery.ref, refresh);
        return [groupId, discoverSkills(groupId, discovery, entries)] as const;
      } catch {
        return [groupId, null] as const;
      }
    }),
  );
  const discovered = new Map(updates);
  setOptionalSkillGroups(staticOptionalSkillGroups.map((group) => {
    const skills = discovered.get(group.id);
    return skills?.length ? { ...group, skills } : group;
  }));
}

function setOptionalSkillGroups(groups: readonly OptionalSkillGroup[]) {
  optionalSkillGroups = groups;
  optionalSkills = groups.flatMap(({ skills }) => skills);
}

function discoverSkills(
  groupId: string,
  discovery: SkillDiscovery,
  entries: readonly TreeEntry[],
): OptionalSkill[] {
  const roots = skillRoots(discovery, entries);
  if (!roots.length) return [];
  const group = staticOptionalSkillGroups.find(({ id }) => id === groupId)!;
  const known = new Map(
    group.skills.flatMap((skill) => skill.sources.map((source) => [source.source, skill] as const)),
  );
  const discovered = roots.map((source) =>
    known.get(source) || {
      id: skillId(groupId, discovery, source),
      label: humanize(source.split('/').at(-1)!),
      description: `${group.label} skill`,
      sources: [{
        repository: discovery.repository,
        ref: discovery.ref,
        source,
        ...(discovery.destination === 'child' ? { destination: source.split('/').at(-1) } : {}),
        exclude: ['README.md'],
      }],
    }
  );
  const preserved = group.skills.filter((skill) =>
    skill.sources.every(({ repository, ref, source }) =>
      repository !== discovery.repository || ref !== discovery.ref || !source.startsWith(`${discovery.root}/`)
    )
  );
  return [...discovered, ...preserved].sort((left, right) => left.id.localeCompare(right.id));
}

function skillRoots(discovery: SkillDiscovery, entries: readonly TreeEntry[]): string[] {
  const files = entries
    .filter(({ type, path }) => type === 'blob' && path.endsWith('/SKILL.md'))
    .map(({ path }) => path.slice(0, -'/SKILL.md'.length));
  const prefix = `${discovery.root}/`;
  if (discovery.layout === 'plugins') {
    return files.filter((source) => {
      const parts = source.split('/');
      return parts.length === 4 && parts[0] === discovery.root && parts[2] === 'skills' && parts[1] === parts[3] &&
        (!discovery.include || discovery.include.includes(parts[1]));
    });
  }
  const children = new Set<string>();
  for (const source of files) {
    if (!source.startsWith(prefix)) continue;
    const child = source.slice(prefix.length).split('/')[0];
    if (!child) continue;
    if (discovery.include && !discovery.include.includes(child)) continue;
    if (discovery.layout === 'children' && source !== `${prefix}${child}`) continue;
    children.add(`${prefix}${child}`);
  }
  return [...children];
}

function skillId(groupId: string, discovery: SkillDiscovery, source: string) {
  const name = source.split('/').at(-1)!;
  if (groupId === 'tanstack') return name;
  return `${discovery.idPrefix || ''}${name}`;
}

function humanize(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// TUI/state selections are leaf IDs; this disambiguates IDs shared by a group and leaf.
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
export type {
  InstallSelection,
  OptionalSkill,
  OptionalSkillGroup,
  SkillDiscovery,
  SkillSource,
  Workstyle,
  WorkstyleOption,
};
