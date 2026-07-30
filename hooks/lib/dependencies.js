const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const codexHome = path.resolve(__dirname, '..', '..');

function missingDependencies() {
  return [
    !rtkInstalled() && 'rtk',
    !fs.existsSync(path.join(codexHome, 'skills', 'ponytail', 'SKILL.md')) && 'ponytail skill',
    !fs.existsSync(path.join(codexHome, 'skills', 'caveman', 'SKILL.md')) && 'caveman skill',
    !fs.existsSync(path.join(codexHome, 'RTK.md')) && 'RTK.md',
  ].filter(Boolean);
}

function requiresRtk(command) {
  return Boolean(command && !/^\s*rtk(?:\s|$)/i.test(command));
}

function rtkInstalled() {
  return spawnSync(process.platform === 'win32' ? 'rtk.exe' : 'rtk', ['--version'], { stdio: 'ignore' }).status === 0;
}

module.exports = { codexHome, missingDependencies, requiresRtk };
