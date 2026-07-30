import fs from 'node:fs';
import path from 'node:path';

function disablePonytail(configPath) {
  const original = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const result = disable(original);
  if (result.changed) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, result.text, 'utf8');
  }
  return result.changed;
}

function disable(text) {
  const header = '[plugins."ponytail@ponytail"]';
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const start = text.indexOf(header);
  if (start < 0) {
    const separator = text && !text.endsWith('\n') ? newline : '';
    return { changed: true, text: `${text}${separator}${header}${newline}enabled = false${newline}` };
  }

  const afterHeader = start + header.length;
  const boundary = text.slice(afterHeader).match(/\r?\n\[/);
  const end = boundary ? afterHeader + boundary.index : text.length;
  const section = text.slice(start, end);
  const current = section.match(/^enabled\s*=\s*(.+)$/m);
  if (current && /^false(?:\s*(?:#.*)?)?$/.test(current[1])) return { changed: false, text };
  const updated = current
    ? section.replace(/^enabled\s*=\s*.+$/m, 'enabled = false')
    : `${section}${newline}enabled = false`;
  return { changed: true, text: text.slice(0, start) + updated + text.slice(end) };
}

export { disable, disablePonytail };
