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

type OptionalSkillGroup = {
  id: string;
  label: string;
  description: string;
  sources: readonly SkillSource[];
};

const styleSkills: Record<Workstyle, SkillSource> = {
  caveman: {
    repository: 'JuliusBrussee/caveman',
    ref: 'main',
    source: 'skills',
  },
  beeline: { repository: 'iceHub82/beeline', ref: 'main', source: 'skills' },
};

const coreSkills: readonly SkillSource[] = [
  { repository: 'DietrichGebert/ponytail', ref: 'main', source: 'skills' },
  { repository: 'KnockOutEZ/wigolo', ref: 'main', source: 'skills' },
];

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

export { optionalSkillGroups, skillsFor, styleSkills };
export type { InstallSelection, OptionalSkillGroup, SkillSource, Workstyle };
