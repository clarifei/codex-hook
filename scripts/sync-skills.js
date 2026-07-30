const path = require('path');
const { installBytes } = require('./lib/files');
const { bytes, tree } = require('./lib/github');
const skills = require('./skill-manifest');

async function syncSkills(codexHome) {
  const cachedTrees = new Map();
  const files = [];
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    if (!cachedTrees.has(key)) cachedTrees.set(key, tree(skill.repository, skill.ref));
    const entries = await cachedTrees.get(key);
    for (const entry of entries) {
      if (!entry.path.startsWith(`${skill.source}/`)) continue;
      files.push({ skill, path: entry.path, relative: entry.path.slice(skill.source.length + 1) });
    }
  }

  const downloads = await Promise.all(files.map(async (file) => ({
    ...file,
    bytes: await bytes(file.skill.repository, file.skill.ref, file.path),
  })));
  return downloads.map((file) => {
    const target = path.join(codexHome, 'skills', file.relative);
    return { action: installBytes(target, file.bytes), target };
  });
}

module.exports = { syncSkills };
