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
  return [
    !rtkInstalled() && 'rtk',
    !fs.existsSync(path.join(codexHome, 'skills', 'ponytail', 'SKILL.md')) &&
    'ponytail skill',
    !installedStyle(codexHome) && 'exactly one beeline or caveman skill',
    !fs.existsSync(
      path.join(codexHome, 'skills', 'codebase-memory', 'SKILL.md'),
    ) && 'codebase-memory skill',
    !codebaseMemoryMcpConfigured() && 'codebase-memory MCP configuration',
    !fs.existsSync(path.join(codexHome, 'skills', 'wigolo', 'SKILL.md')) &&
    'wigolo skill',
    !wigoloMcpConfigured() && 'wigolo MCP configuration',
    !fs.existsSync(path.join(codexHome, 'RTK.md')) && 'RTK.md',
  ].filter((value): value is string => Boolean(value));
}

function mcpSection(name: string) {
  const configPath = path.join(codexHome, 'config.toml');
  if (!fs.existsSync(configPath)) return null;
  const text = fs.readFileSync(configPath, 'utf8');
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

function codebaseMemoryMcpConfigured() {
  const section = mcpSection('codebase-memory-mcp');
  return Boolean(section && /^command\s*=\s*.+$/m.test(section));
}

function wigoloMcpConfigured() {
  const section = mcpSection('wigolo');
  if (!section) return false;
  return /^command\s*=\s*"npx"\s*$/m.test(section) &&
    /^args\s*=\s*\["-y",\s*"wigolo"\]\s*$/m.test(section);
}

function requiresRtk(command: unknown) {
  return typeof command === 'string' && !/^\s*rtk(?:\s|$)/i.test(command);
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

export { codebaseMemoryMcpConfigured, codexHome, missingDependencies, requiresRtk, wigoloMcpConfigured };
