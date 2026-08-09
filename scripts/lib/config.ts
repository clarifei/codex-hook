import fs from 'node:fs';
import path from 'node:path';

type TextChange = { changed: boolean; text: string };
type ProviderSection = { end: number; section: string; start: number };

const headroomBridgeUrl = 'http://127.0.0.1:8788';

function disablePonytail(configPath: string) {
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const result = disable(original);
  if (result.changed) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, result.text, 'utf8');
  }
  return result.changed;
}

function ensureWigolo(configPath: string) {
  return ensureMcpServer(configPath, 'wigolo', 'npx', ['-y', 'wigolo']);
}

function ensureCodebaseMemory(configPath: string) {
  return ensureMcpServer(configPath, 'codebase-memory-mcp', 'npx', [
    '-y',
    'codebase-memory-mcp',
  ], true);
}

function ensureHeadroomBridge(configPath: string) {
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const provider = activeProviderSection(original);
  if (!provider) return false;
  const baseUrl = provider.section.match(/^base_url\s*=\s*"([^"]+)"\s*$/m);
  if (!baseUrl || baseUrl[1] === headroomBridgeUrl) return false;

  try {
    const upstream = new URL(baseUrl[1]);
    if (!['http:', 'https:'].includes(upstream.protocol) || upstream.hostname !== 'pool.afterinput.com') return false;
  } catch {
    return false;
  }

  const statePath = path.join(path.dirname(configPath), '.codex-hook', 'headroom-bridge.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify({ upstream: baseUrl[1] }, null, 2)}\n`, 'utf8');
  const updated = provider.section.replace(baseUrl[0], `base_url = "${headroomBridgeUrl}"`);
  fs.writeFileSync(
    configPath,
    original.slice(0, provider.start) + updated + original.slice(provider.end),
    'utf8',
  );
  return true;
}

function disableHeadroomBridge(configPath: string) {
  const statePath = path.join(path.dirname(configPath), '.codex-hook', 'headroom-bridge.json');
  let upstream: string;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (typeof state.upstream !== 'string') return false;
    const url = new URL(state.upstream);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'pool.afterinput.com') return false;
    upstream = url.toString().replace(/\/$/, '');
  } catch {
    return false;
  }

  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const provider = activeProviderSection(original);
  const baseUrl = provider?.section.match(/^base_url\s*=\s*"([^"]+)"\s*$/m);
  if (provider && baseUrl?.[1] === headroomBridgeUrl) {
    const updated = provider.section.replace(baseUrl[0], `base_url = ${JSON.stringify(upstream)}`);
    fs.writeFileSync(
      configPath,
      original.slice(0, provider.start) + updated + original.slice(provider.end),
      'utf8',
    );
  }
  fs.rmSync(statePath, { force: true });
  return true;
}

function headroomBridgeEnabled(configPath: string) {
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const section = activeProviderSection(original)?.section;
  if (section?.match(/^base_url\s*=\s*"([^"]+)"\s*$/m)?.[1] !== headroomBridgeUrl) return false;
  try {
    const state = JSON.parse(
      fs.readFileSync(path.join(path.dirname(configPath), '.codex-hook', 'headroom-bridge.json'), 'utf8'),
    );
    return typeof state.upstream === 'string';
  } catch {
    return false;
  }
}

function activeProviderSection(text: string): ProviderSection | null {
  const provider = text.match(/^model_provider\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!provider) return null;
  const header = `[model_providers.${provider}]`;
  const start = text.indexOf(header);
  if (start < 0) return null;
  const afterHeader = start + header.length;
  const boundary = text.slice(afterHeader).match(/\r?\n\[/);
  const end = boundary ? afterHeader + (boundary.index ?? 0) : text.length;
  return { end, section: text.slice(start, end), start };
}

function ensureMcpServer(
  configPath: string,
  name: string,
  commandValue: string,
  argsValue: readonly string[],
  preserveExisting = false,
) {
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const header = `[mcp_servers.${name}]`;
  const desiredCommand = `command = ${JSON.stringify(commandValue)}`;
  const desiredArgs = `args = [${argsValue.map((value) => JSON.stringify(value)).join(', ')}]`;
  const start = original.indexOf(header);
  if (start < 0) {
    const separator = !original
      ? ''
      : original.endsWith(`${newline}${newline}`)
      ? ''
      : original.endsWith(newline)
      ? newline
      : `${newline}${newline}`;
    const text = `${original}${separator}${header}${newline}${desiredCommand}${newline}${desiredArgs}${newline}`;
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, text, 'utf8');
    return true;
  }

  const afterHeader = start + header.length;
  const boundary = original.slice(afterHeader).match(/\r?\n\[/);
  const end = boundary ? afterHeader + (boundary.index ?? 0) : original.length;
  const section = original.slice(start, end);
  const command = section.match(/^command\s*=\s*.+$/m);
  const args = section.match(/^args\s*=\s*.+$/m);
  if (preserveExisting && command) return false;
  if (
    command && args && command[0].trim() === desiredCommand &&
    args[0].trim() === desiredArgs
  ) return false;
  let updated = command
    ? section.replace(/^command\s*=\s*.+$/m, desiredCommand)
    : `${section}${section.endsWith(newline) ? '' : newline}${desiredCommand}`;
  updated = args
    ? updated.replace(/^args\s*=\s*.+$/m, desiredArgs)
    : `${updated}${updated.endsWith(newline) ? '' : newline}${desiredArgs}`;
  fs.writeFileSync(
    configPath,
    original.slice(0, start) + updated + original.slice(end),
    'utf8',
  );
  return true;
}

function disable(text: string): TextChange {
  const header = '[plugins."ponytail@ponytail"]';
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const start = text.indexOf(header);
  if (start < 0) {
    const separator = text && !text.endsWith('\n') ? newline : '';
    return {
      changed: true,
      text: `${text}${separator}${header}${newline}enabled = false${newline}`,
    };
  }

  const afterHeader = start + header.length;
  const boundary = text.slice(afterHeader).match(/\r?\n\[/);
  const end = boundary ? afterHeader + (boundary.index ?? 0) : text.length;
  const section = text.slice(start, end);
  const current = section.match(/^enabled\s*=\s*(.+)$/m);
  if (current && /^false(?:\s*(?:#.*)?)?$/.test(current[1])) {
    return { changed: false, text };
  }
  const updated = current
    ? section.replace(/^enabled\s*=\s*.+$/m, 'enabled = false')
    : `${section}${newline}enabled = false`;
  return {
    changed: true,
    text: text.slice(0, start) + updated + text.slice(end),
  };
}

export {
  disable,
  disableHeadroomBridge,
  disablePonytail,
  ensureCodebaseMemory,
  ensureHeadroomBridge,
  ensureMcpServer,
  ensureWigolo,
  headroomBridgeEnabled,
};
