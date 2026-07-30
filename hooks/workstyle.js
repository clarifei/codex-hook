#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const codexHome = path.resolve(__dirname, '..');
let input = '';

if (process.argv[2] === '--self-test') {
  if (!requiresRtk('git status') || requiresRtk('rtk git status') || requiresRtk('  RTK cmd /c dir')) {
    throw new Error('RTK guard failed');
  }
  if (typeof output !== 'function') {
    throw new Error('Hook output failed');
  }
  if (fullMode('| **lite** | x |\n| **full** | y |\n| **ultra** | z |').includes('lite')) {
    throw new Error('Mode filter failed');
  }
  console.log('ok');
  process.exit(0);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', run);
process.stdin.on('error', () => process.exit(0));

function run() {
  let event;
  try {
    event = JSON.parse(input.replace(/^\uFEFF/, ''));
  } catch {
    process.exit(0);
  }

  if (event.hook_event_name === 'PreToolUse') {
    const command = event.tool_input && event.tool_input.command;
    if (!requiresRtk(command)) return;
    return output({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Run every shell command through rtk.',
      },
    });
  }

  if (event.hook_event_name === 'SessionStart' || event.hook_event_name === 'SubagentStart') {
    const missing = missingDependencies();
    if (missing.length) return fail(missing);
    output({
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: policy(),
      },
    });
  }
}

function requiresRtk(command) {
  return Boolean(command && !/^\s*rtk(?:\s|$)/i.test(command));
}

function output(value) {
  process.stdout.write(JSON.stringify(value));
}

function policy() {
  return [
    'PONYTAIL MODE ACTIVE - level: full',
    fullMode(fs.readFileSync(ponytailSkill(), 'utf8')),
    'CAVEMAN MODE ACTIVE - level: full',
    fullMode(fs.readFileSync(cavemanSkill(), 'utf8')),
    fs.readFileSync(path.join(codexHome, 'RTK.md'), 'utf8'),
  ].join('\n\n');
}

function missingDependencies() {
  return [
    !rtkInstalled() && 'rtk',
    !ponytailSkill() && 'ponytail skill',
    !cavemanSkill() && 'caveman skill',
    !fs.existsSync(path.join(codexHome, 'RTK.md')) && 'RTK.md',
  ].filter(Boolean);
}

function rtkInstalled() {
  const result = spawnSync(process.platform === 'win32' ? 'rtk.exe' : 'rtk', ['--version'], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function ponytailSkill() {
  const file = path.join(codexHome, 'skills', 'ponytail', 'SKILL.md');
  return fs.existsSync(file) ? file : null;
}

function cavemanSkill() {
  const file = path.join(codexHome, 'skills', 'caveman', 'SKILL.md');
  return fs.existsSync(file) ? file : null;
}

function fullMode(skill) {
  return skill.replace(/^---[\s\S]*?---\s*/, '').split(/\r?\n/).filter((line) => {
    const table = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
    if (table && isMode(table[1])) return table[1].trim().toLowerCase() === 'full';
    const example = line.match(/^-\s*([^:]+):\s*"/);
    return !example || !isMode(example[1]) || example[1].trim().toLowerCase() === 'full';
  }).join('\n');
}

function isMode(value) {
  return /^(lite|full|ultra|wenyan-lite|wenyan-full|wenyan-ultra)$/.test(value.trim().toLowerCase());
}

function fail(missing) {
  process.stderr.write(`workstyle hook requires installed ${missing.join(', ')}.\n`);
  process.exitCode = 1;
}
