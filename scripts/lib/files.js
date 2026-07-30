const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function installBytes(target, bytes) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && hash(fs.readFileSync(target)) === hash(bytes)) return 'skip';
  fs.writeFileSync(target, bytes);
  return 'replace';
}

function installFile(source, target) {
  return installBytes(target, fs.readFileSync(source));
}

function copyTree(source, target, report) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to, report);
    else report(installFile(from, to), to);
  }
}

module.exports = { copyTree, installBytes, installFile };
