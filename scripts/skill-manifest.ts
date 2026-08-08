type Workstyle = 'caveman' | 'beeline';

type InstallSelection = {
  style: Workstyle;
  optional: string[];
};

type SkillSource = {
  repository: string;
  ref: string;
  source: string;
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
  },
  {
    id: 'emil-kowalski',
    label: 'Emil Kowalski',
    description: 'Design engineering and motion skills',
    sources: [
      {
        repository: 'emilkowalski/skills',
        ref: 'main',
        source: 'skills',
        exclude: ['prototype'],
      },
    ],
  },
];

function isWorkstyle(value: unknown): value is Workstyle {
  return workstyles.some(({ id }) => id === value);
}

function skillsFor(
  style: Workstyle = 'caveman',
  optional: readonly string[] = [],
): SkillSource[] {
  const selected = new Set(optional);
  const unknown = [...selected].filter((id) => !optionalSkillGroups.some((group) => group.id === id));
  if (unknown.length) {
    throw new Error(`unknown optional skill group: ${unknown.join(', ')}`);
  }
  return [
    styleSkills[style],
    ...coreSkills,
    ...optionalSkillGroups.filter((group) => selected.has(group.id)).flatMap((
      group,
    ) => group.sources),
  ];
}

export { coreComponents, isWorkstyle, optionalSkillGroups, skillsFor, styleSkills, workstyles };
export type { InstallSelection, OptionalSkillGroup, SkillSource, Workstyle, WorkstyleOption };
