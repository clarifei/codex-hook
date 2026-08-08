import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedStyle } from './style.ts';

const codexHome = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

function missingDependencies(): string[] {
  const config = readConfig();
  return [
    !rtkInstalled() && 'rtk',
    !fs.existsSync(path.join(codexHome, 'skills', 'ponytail', 'SKILL.md')) &&
    'ponytail skill',
    !installedStyle(codexHome) && 'exactly one beeline or caveman skill',
    !fs.existsSync(
      path.join(codexHome, 'skills', 'codebase-memory', 'SKILL.md'),
    ) && 'codebase-memory skill',
    !codebaseMemoryMcpConfigured(config) && 'codebase-memory MCP configuration',
    !fs.existsSync(path.join(codexHome, 'skills', 'wigolo', 'SKILL.md')) &&
    'wigolo skill',
    !wigoloMcpConfigured(config) && 'wigolo MCP configuration',
    !fs.existsSync(path.join(codexHome, 'RTK.md')) && 'RTK.md',
  ].filter((value): value is string => Boolean(value));
}

function readConfig() {
  const configPath = path.join(codexHome, 'config.toml');
  return fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
}

function mcpSection(name: string, text = readConfig()) {
  if (!text) return null;
  const header = `[mcp_servers.${name}]`;
  const start = text.indexOf(header);
  if (start < 0) return null;
  const afterHeader = start + header.length;
  const boundary = text.slice(afterHeader).match(/\r?\n\[/);
  return text.slice(
    start,
    boundary ? afterHeader + (boundary.index ?? 0) : text.length,
  );
}

function codebaseMemoryMcpConfigured(text?: string) {
  const section = mcpSection('codebase-memory-mcp', text);
  return Boolean(section && /^command\s*=\s*.+$/m.test(section));
}

function wigoloMcpConfigured(text?: string) {
  const section = mcpSection('wigolo', text);
  if (!section) return false;
  return /^command\s*=\s*"npx"\s*$/m.test(section) &&
    /^args\s*=\s*\["-y",\s*"wigolo"\]\s*$/m.test(section);
}

function rtkInstalled() {
  try {
    return new Deno.Command(Deno.build.os === 'windows' ? 'rtk.exe' : 'rtk', {
      args: ['--version'],
      stdin: 'null',
      stdout: 'null',
      stderr: 'null',
    }).outputSync().success;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export { codebaseMemoryMcpConfigured, codexHome, missingDependencies, wigoloMcpConfigured };
