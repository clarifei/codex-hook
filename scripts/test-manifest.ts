import type { OptionalSkillGroup } from './skill-manifest.ts';

const source = (repository: string, source: string, destination?: string) => ({
  repository,
  ref: 'main',
  source,
  ...(destination ? { destination } : {}),
});

const testOptionalSkillGroups: readonly OptionalSkillGroup[] = [
  {
    id: 'matt-pocock',
    label: 'Matt Pocock',
    description: 'Engineering and productivity workflows',
    skills: [
      {
        id: 'matt-pocock-engineering',
        label: 'Engineering',
        description: 'Engineering workflows',
        sources: [source('mattpocock/skills', 'skills/engineering')],
      },
      {
        id: 'matt-pocock-productivity',
        label: 'Productivity',
        description: 'Productivity workflows',
        sources: [source('mattpocock/skills', 'skills/productivity')],
      },
    ],
  },
  {
    id: 'deno',
    label: 'Deno',
    description: 'Deno skills',
    skills: [
      {
        id: 'deno',
        label: 'Deno',
        description: 'Deno runtime',
        sources: [source('denoland/skills', 'skills/deno', 'deno')],
      },
      {
        id: 'deno-deploy',
        label: 'Deno Deploy',
        description: 'Deno Deploy',
        sources: [source('denoland/skills', 'skills/deno-deploy', 'deno-deploy')],
      },
    ],
  },
  {
    id: 'tanstack',
    label: 'TanStack',
    description: 'TanStack skills',
    skills: [
      {
        id: 'tanstack-ai',
        label: 'TanStack AI',
        description: 'TanStack AI',
        sources: [source('tanstack-skills/tanstack-skills', 'plugins/tanstack-ai/skills/tanstack-ai', 'tanstack-ai')],
      },
      {
        id: 'tanstack-query',
        label: 'TanStack Query',
        description: 'TanStack Query',
        sources: [
          source('tanstack-skills/tanstack-skills', 'plugins/tanstack-query/skills/tanstack-query', 'tanstack-query'),
        ],
      },
    ],
  },
];

export { testOptionalSkillGroups };
