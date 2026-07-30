#!/usr/bin/env node

const os = require('os');
const path = require('path');
const { disablePonytail } = require('./lib/config');
const { copyTree, installFile } = require('./lib/files');
const { ensureRtk } = require('./lib/rtk');
const skills = require('./skill-manifest');
const { syncSkills } = require('./sync-skills');

if (process.argv[2] === '--self-test') {
  const names = skills.map((skill) => skill.target).sort().join(',');
  if (names !== 'caveman,caveman-commit,caveman-compress,ponytail,ponytail-audit,ponytail-review') {
    throw new Error('Skill manifest failed');
  }
  console.log('ok');
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const source = path.resolve(__dirname, '..');
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  console.log(ensureRtk());
  for (const result of await syncSkills(codexHome)) console.log(`${result.action} ${result.target}`);
  const report = (action, target) => console.log(`${action} ${target}`);
  copyTree(path.join(source, 'hooks'), path.join(codexHome, 'hooks'), report);
  for (const file of ['hooks.json', 'RTK.md']) {
    const target = path.join(codexHome, file);
    report(installFile(path.join(source, file), target), target);
  }
  console.log(disablePonytail(path.join(codexHome, 'config.toml')) ? 'disable ponytail hook' : 'skip ponytail hook');
  console.log('installed. trust the hook in /hooks, then start a new session.');
}
