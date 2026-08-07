#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { disablePonytail, ensureWigolo } from './lib/config.mjs';
import { copyTree, gitBlobHash, installBytes, installFile, sameGitBlob } from './lib/files.mjs';
import { ensureRtk } from './lib/rtk.mjs';
import { skillsFor } from './skill-manifest.mjs';
import { syncSkills } from './sync-skills.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.argv[2] === '--self-test') {
  const expected = {
    beeline: 'DietrichGebert/ponytail:skills,KnockOutEZ/wigolo:skills,iceHub82/beeline:skills',
    caveman: 'DietrichGebert/ponytail:skills,JuliusBrussee/caveman:skills,KnockOutEZ/wigolo:skills',
  };
  for (const style of Object.keys(expected)) {
    const sources = skillsFor(style).map((skill) => `${skill.repository}:${skill.source}`).sort().join(',');
    if (sources !== expected[style]) throw new Error(`${style} skill manifest failed`);
  }
  const summary = summarize([{ action: 'replace' }, { action: 'skip' }]);
  if (summary.replace !== 1 || summary.skip !== 1 || summary.remove !== 0) throw new Error('Install summary failed');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-hook-'));
  const target = path.join(directory, 'file');
  try {
    const source = Buffer.from('two');
    if (installBytes(target, Buffer.from('one')) !== 'replace' || installBytes(target, Buffer.from('one')) !== 'skip' || installBytes(target, source) !== 'replace' || !sameGitBlob(target, gitBlobHash(source))) {
      throw new Error('Hash update failed');
    }
    for (const family of ['caveman', 'beeline']) {
      const stale = path.join(directory, 'skills', `${family}-help`);
      fs.mkdirSync(stale, { recursive: true });
      if (removeSkillFamily(directory, family).length !== 1 || fs.existsSync(stale)) {
        throw new Error(`${family} cleanup failed`);
      }
    }
    const configPath = path.join(directory, 'config.toml');
    if (!ensureWigolo(configPath) || ensureWigolo(configPath) || !fs.readFileSync(configPath, 'utf8').includes('[mcp_servers.wigolo]')) {
      throw new Error('Wigolo MCP config failed');
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
  const style = selectedStyle(process.argv.slice(2));
  const rtkAction = ensureRtk();
  const skillResults = await syncSkills(codexHome, style);
  const removedSkillResults = removeSkillFamily(codexHome, style === 'beeline' ? 'caveman' : 'beeline');
  const localSkillResults = [];
  copyTree(path.join(source, 'skills'), path.join(codexHome, 'skills'), (action, target) => {
    localSkillResults.push({ action, target });
  });
  const fileResults = [];
  const report = (action, target) => fileResults.push({ action, target });
  copyTree(path.join(source, 'hooks'), path.join(codexHome, 'hooks'), report);
  for (const file of ['hooks.json', 'RTK.md']) {
    const target = path.join(codexHome, file);
    report(installFile(path.join(source, file), target), target);
  }
  const ponytailChanged = disablePonytail(path.join(codexHome, 'config.toml'));
  const wigoloChanged = ensureWigolo(path.join(codexHome, 'config.toml'));
  printSummary({
    codexHome,
    style,
    rtkAction,
    skills: summarize([...skillResults, ...removedSkillResults, ...localSkillResults]),
    files: summarize(fileResults),
    ponytailChanged,
    wigoloChanged,
  });
  await waitForExit();
}

function selectedStyle(args) {
  const style = args[0] || 'beeline';
  if (!['beeline', 'caveman'].includes(style)) {
    throw new Error(`usage: install [beeline|caveman] (got ${style})`);
  }
  return style;
}

function removeSkillFamily(codexHome, family) {
  const root = path.join(codexHome, 'skills');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === family || entry.name.startsWith(`${family}-`)))
    .map((entry) => {
      const target = path.join(root, entry.name);
      fs.rmSync(target, { recursive: true, force: true });
      return { action: 'remove', target };
    });
}

function summarize(results) {
  return results.reduce((summary, result) => {
    if (result.action === 'replace') summary.replace++;
    if (result.action === 'skip') summary.skip++;
    if (result.action === 'remove') summary.remove++;
    return summary;
  }, { replace: 0, skip: 0, remove: 0 });
}

function printSummary({ codexHome, style, rtkAction, skills, files, ponytailChanged, wigoloChanged }) {
  console.log('\ncodex-hook install complete');
  console.log(`  style    ${style} full`);
  console.log(`  rtk      ${rtkAction === 'install rtk' ? 'installed' : 'already installed'}`);
  console.log(`  skills   ${skills.replace} changed, ${skills.skip} unchanged, ${skills.remove} removed`);
  console.log(`  files    ${files.replace} changed, ${files.skip} unchanged`);
  console.log(`  config   ${ponytailChanged ? 'ponytail hook disabled' : 'ponytail hook already disabled'}`);
  console.log(`  mcp      wigolo ${wigoloChanged ? 'configured' : 'already configured'}`);
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
