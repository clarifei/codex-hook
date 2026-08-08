const styleSkills = {
  beeline: { repository: 'iceHub82/beeline', ref: 'main', source: 'skills' },
  caveman: { repository: 'JuliusBrussee/caveman', ref: 'main', source: 'skills' },
};

const sharedSkills = [
  { repository: 'DietrichGebert/ponytail', ref: 'main', source: 'skills' },
  { repository: 'KnockOutEZ/wigolo', ref: 'main', source: 'skills' },
  { repository: 'mattpocock/skills', ref: 'main', source: 'skills/engineering', exclude: ['README.md'] },
  { repository: 'mattpocock/skills', ref: 'main', source: 'skills/productivity', exclude: ['README.md'] },
  { repository: 'emilkowalski/skills', ref: 'main', source: 'skills', exclude: ['prototype'] },
];

function skillsFor(style = 'beeline') {
  if (!styleSkills[style]) throw new Error(`unsupported style: ${style}; choose beeline or caveman`);
  return [styleSkills[style], ...sharedSkills];
}

export { skillsFor };
export default skillsFor();
