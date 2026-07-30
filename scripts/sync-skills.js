const path = require('path');
const { installBytes, sameGitBlob } = require('./lib/files');
const { bytes, tree } = require('./lib/github');
const skills = require('./skill-manifest');

async function syncSkills(codexHome) {
  const treeRequests = new Map();
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    if (!treeRequests.has(key)) treeRequests.set(key, tree(skill.repository, skill.ref));
  }
  const trees = new Map(await Promise.all(
    [...treeRequests].map(async ([key, request]) => [key, await request]),
  ));
  const files = [];
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    const entries = trees.get(key);
    for (const entry of entries) {
      if (!entry.path.startsWith(`${skill.source}/`)) continue;
      files.push({ skill, path: entry.path, relative: entry.path.slice(skill.source.length + 1) });
    }
  }

  const downloads = await Promise.all(files.map(async (file) => {
    const target = path.join(codexHome, 'skills', file.relative);
    if (sameGitBlob(target, file.sha)) return { ...file, action: 'skip', target };
    return { ...file, bytes: await bytes(file.skill.repository, file.skill.ref, file.path), target };
  }));
  return downloads.map((file) => {
    return { action: file.action || installBytes(file.target, file.bytes), target: file.target };
  });
}

module.exports = { syncSkills };
