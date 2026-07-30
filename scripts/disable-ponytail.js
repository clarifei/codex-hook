#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (process.argv[2] === '--self-test') {
  const once = disable('[plugins."ponytail@ponytail"]\nenabled = true\n');
  if (!once.changed || !/enabled = false/.test(once.text) || disable(once.text).changed) {
    throw new Error('Ponytail config update failed');
  }
  console.log('ok');
  process.exit(0);
}

const config = process.argv[2];
if (!config) throw new Error('config path is required');
const original = fs.existsSync(config) ? fs.readFileSync(config, 'utf8') : '';
const result = disable(original);
if (result.changed) {
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, result.text, 'utf8');
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
