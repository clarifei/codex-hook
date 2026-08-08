import path from 'node:path';
import { installBytes, sameGitBlob } from './lib/files.mjs';
import { bytes, tree } from './lib/github.mjs';
import { skillsFor } from './skill-manifest.mjs';

async function syncSkills(codexHome, style = 'beeline') {
  const skills = skillsFor(style);
  const treeRequests = new Map();
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    if (!treeRequests.has(key)) treeRequests.set(key, tree(skill.repository, skill.ref));
  }
  const trees = new Map(await Promise.all(
    [...treeRequests].map(async ([key, request]) => [key, await request]),
  ));
  const files = [];
  const targets = new Set();
  for (const skill of skills) {
    const key = `${skill.repository}@${skill.ref}`;
    const entries = trees.get(key);
    for (const entry of entries) {
      if (!entry.path.startsWith(`${skill.source}/`)) continue;
      const relative = entry.path.slice(skill.source.length + 1);
      if (excluded(skill, relative)) continue;
      reserve(targets, relative);
      files.push({ skill, path: entry.path, relative });
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

function excluded(skill, relative) {
  return Boolean(skill.exclude?.some((name) => relative === name || relative.startsWith(`${name}/`)));
}

function reserve(targets, relative) {
  if (targets.has(relative)) throw new Error(`duplicate skill target: ${relative}`);
  targets.add(relative);
}

export { excluded, reserve, syncSkills };
