import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function gitBlobHash(bytes) {
  const result = crypto.createHash('sha1');
  result.update(`blob ${bytes.length}\0`);
  result.update(bytes);
  return result.digest('hex');
}

function sameGitBlob(target, expected) {
  let bytes;
  try {
    bytes = fs.readFileSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  return gitBlobHash(bytes) === expected;
}

function installBytes(target, bytes) {
  let current;
  try {
    current = fs.readFileSync(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current && current.equals(bytes)) return 'skip';
  fs.mkdirSync(path.dirname(target), { recursive: true });
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

export { copyTree, gitBlobHash, installBytes, installFile, sameGitBlob };
