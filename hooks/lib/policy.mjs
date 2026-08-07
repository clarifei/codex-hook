import fs from 'node:fs';
import path from 'node:path';
import { codexHome } from './dependencies.mjs';
import { installedStyle } from './style.mjs';

function buildPolicy() {
  const style = installedStyle(codexHome);
  if (!style) throw new Error('install exactly one beeline or caveman skill');
  return [
    'PONYTAIL MODE ACTIVE - level: full',
    fullMode(fs.readFileSync(path.join(codexHome, 'skills', 'ponytail', 'SKILL.md'), 'utf8')),
    `${style.toUpperCase()} MODE ACTIVE - level: full`,
    fullMode(fs.readFileSync(path.join(codexHome, 'skills', style, 'SKILL.md'), 'utf8')),
    'WIGOLO MCP ACTIVE - use Wigolo for web operations',
    fs.readFileSync(path.join(codexHome, 'RTK.md'), 'utf8'),
  ].join('\n\n');
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

export { buildPolicy, fullMode };
