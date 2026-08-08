type Workstyle = 'caveman' | 'beeline';

type InstallSelection = {
  style: Workstyle;
  optional: string[];
  installed?: string[];
  uninstall?: string[];
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

const optionalSkillGroups: readonly OptionalSkillGroup[] = [
  {
    id: 'matt-pocock',
    label: 'Matt Pocock',
    description: 'Engineering and productivity workflows',
    skills: [{
      id: 'matt-pocock',
      label: 'Matt Pocock',
      description: 'Engineering and productivity workflows',
      sources: [
        {
          repository: 'mattpocock/skills',
          ref: 'main',
          source: 'skills/engineering',
          exclude: ['README.md'],
        },
        {
          repository: 'mattpocock/skills',
          ref: 'main',
          source: 'skills/productivity',
          exclude: ['README.md'],
        },
      ],
    }],
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

const optionalSkills = optionalSkillGroups.flatMap(({ skills }) => skills);

function normalizeOptional(optional: readonly string[]): string[] {
  const selected = new Set<string>();
  const unknown = new Set<string>();
  for (const id of optional) {
    const group = optionalSkillGroups.find((candidate) => candidate.id === id);
    if (group) {
      group.skills.forEach(({ id: skillId }) => selected.add(skillId));
      continue;
    }
    if (optionalSkills.some((skill) => skill.id === id)) selected.add(id);
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
): SkillSource[] {
  const selected = new Set(normalizeOptional(optional));
  return [
    styleSkills[style],
    ...coreSkills,
    ...optionalSkills.filter(({ id }) => selected.has(id)).flatMap(({ sources }) => sources),
  ];
}

export {
  coreComponents,
  isWorkstyle,
  normalizeOptional,
  optionalSkillGroups,
  optionalSkills,
  skillsFor,
  styleSkills,
  workstyles,
};
export type { InstallSelection, OptionalSkill, OptionalSkillGroup, SkillSource, Workstyle, WorkstyleOption };
