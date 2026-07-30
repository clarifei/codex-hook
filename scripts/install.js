#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { disablePonytail } = require('./lib/config');
const { copyTree, installBytes, installFile } = require('./lib/files');
const { ensureRtk } = require('./lib/rtk');
const skills = require('./skill-manifest');
const { syncSkills } = require('./sync-skills');

if (process.argv[2] === '--self-test') {
  const sources = skills.map((skill) => `${skill.repository}:${skill.source}`).sort().join(',');
  if (sources !== 'DietrichGebert/ponytail:skills,JuliusBrussee/caveman:skills') {
    throw new Error('Skill manifest failed');
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-hook-'));
  const target = path.join(directory, 'file');
  try {
    if (installBytes(target, Buffer.from('one')) !== 'replace' || installBytes(target, Buffer.from('one')) !== 'skip' || installBytes(target, Buffer.from('two')) !== 'replace') {
      throw new Error('Hash update failed');
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
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
