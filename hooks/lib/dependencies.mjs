import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { installedStyle } from './style.mjs';

const codexHome = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function missingDependencies() {
  return [
    !rtkInstalled() && 'rtk',
    !fs.existsSync(path.join(codexHome, 'skills', 'ponytail', 'SKILL.md')) && 'ponytail skill',
    !installedStyle(codexHome) && 'exactly one beeline or caveman skill',
    !fs.existsSync(path.join(codexHome, 'skills', 'codebase-memory', 'SKILL.md')) && 'codebase-memory skill',
    !fs.existsSync(path.join(codexHome, 'skills', 'wigolo', 'SKILL.md')) && 'wigolo skill',
    !wigoloMcpConfigured() && 'wigolo MCP configuration',
    !fs.existsSync(path.join(codexHome, 'RTK.md')) && 'RTK.md',
  ].filter(Boolean);
}

function wigoloMcpConfigured() {
  const configPath = path.join(codexHome, 'config.toml');
  if (!fs.existsSync(configPath)) return false;
  const text = fs.readFileSync(configPath, 'utf8');
  const header = '[mcp_servers.wigolo]';
  const start = text.indexOf(header);
  if (start < 0) return false;
  const afterHeader = start + header.length;
  const boundary = text.slice(afterHeader).match(/\r?\n\[/);
  const section = text.slice(start, boundary ? afterHeader + boundary.index : text.length);
  return /^command\s*=\s*"npx"\s*$/m.test(section) && /^args\s*=\s*\["-y",\s*"wigolo"\]\s*$/m.test(section);
}

function requiresRtk(command) {
  return Boolean(command && !/^\s*rtk(?:\s|$)/i.test(command));
}

function rtkInstalled() {
  return spawnSync(process.platform === 'win32' ? 'rtk.exe' : 'rtk', ['--version'], { stdio: 'ignore' }).status === 0;
}

export { codexHome, missingDependencies, requiresRtk, wigoloMcpConfigured };
