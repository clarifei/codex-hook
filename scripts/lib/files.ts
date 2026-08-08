import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type InstallAction = 'replace' | 'skip';
type InstallReport = (action: InstallAction, target: string) => void;

function gitBlobHash(bytes: Uint8Array) {
  const result = crypto.createHash('sha1');
  result.update(`blob ${bytes.length}\0`);
  result.update(bytes);
  return result.digest('hex');
}

function sameGitBlob(target: string, expected: string) {
  let bytes;
  try {
    bytes = fs.readFileSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  return gitBlobHash(bytes) === expected;
}

function installBytes(target: string, bytes: Uint8Array): InstallAction {
  let current;
  try {
    current = fs.readFileSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (current && current.equals(bytes)) return 'skip';
  return writeBytes(target, bytes);
}

function writeBytes(target: string, bytes: Uint8Array): InstallAction {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return 'replace';
}

function installFile(source: string, target: string): InstallAction {
  return installBytes(target, fs.readFileSync(source));
}

function copyTree(source: string, target: string, report: InstallReport) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to, report);
    else report(installFile(from, to), to);
  }
}

export { copyTree, gitBlobHash, installBytes, installFile, sameGitBlob, writeBytes };
export type { InstallAction, InstallReport };
