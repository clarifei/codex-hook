#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { disablePonytail } from './lib/config.mjs';
import { copyTree, gitBlobHash, installBytes, installFile, sameGitBlob } from './lib/files.mjs';
import { ensureRtk } from './lib/rtk.mjs';
import skills from './skill-manifest.mjs';
import { syncSkills } from './sync-skills.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.argv[2] === '--self-test') {
  const sources = skills.map((skill) => `${skill.repository}:${skill.source}`).sort().join(',');
  if (sources !== 'DietrichGebert/ponytail:skills,JuliusBrussee/caveman:skills') {
    throw new Error('Skill manifest failed');
  }
  const summary = summarize([{ action: 'replace' }, { action: 'skip' }]);
  if (summary.replace !== 1 || summary.skip !== 1) throw new Error('Install summary failed');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-hook-'));
  const target = path.join(directory, 'file');
  try {
    const source = Buffer.from('two');
    if (installBytes(target, Buffer.from('one')) !== 'replace' || installBytes(target, Buffer.from('one')) !== 'skip' || installBytes(target, source) !== 'replace' || !sameGitBlob(target, gitBlobHash(source))) {
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
  const rtkAction = ensureRtk();
  const skillResults = await syncSkills(codexHome);
  const fileResults = [];
  const report = (action, target) => fileResults.push({ action, target });
  copyTree(path.join(source, 'hooks'), path.join(codexHome, 'hooks'), report);
  for (const file of ['hooks.json', 'RTK.md']) {
    const target = path.join(codexHome, file);
    report(installFile(path.join(source, file), target), target);
  }
  const ponytailChanged = disablePonytail(path.join(codexHome, 'config.toml'));
  printSummary({
    codexHome,
    rtkAction,
    skills: summarize(skillResults),
    files: summarize(fileResults),
    ponytailChanged,
  });
  await waitForExit();
}

function summarize(results) {
  return results.reduce((summary, result) => {
    if (result.action === 'replace') summary.replace++;
    if (result.action === 'skip') summary.skip++;
    return summary;
  }, { replace: 0, skip: 0 });
}

function printSummary({ codexHome, rtkAction, skills, files, ponytailChanged }) {
  console.log('\ncodex-hook install complete');
  console.log(`  rtk      ${rtkAction === 'install rtk' ? 'installed' : 'already installed'}`);
  console.log(`  skills   ${skills.replace} changed, ${skills.skip} unchanged`);
  console.log(`  files    ${files.replace} changed, ${files.skip} unchanged`);
  console.log(`  config   ${ponytailChanged ? 'ponytail hook disabled' : 'ponytail hook already disabled'}`);
  console.log(`  home     ${codexHome}`);
  console.log('\nNext steps');
  console.log(`  1. Trust the hook in ${path.join(codexHome, 'hooks')}.`);
  console.log('  2. Start a new Codex session.');
}

function waitForExit() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return Promise.resolve();
  return new Promise((resolve) => {
    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    input.question('\nPress Enter to close.', () => {
      input.close();
      resolve();
    });
  });
}
