import fs from 'node:fs';
import path from 'node:path';

function installedStyle(codexHome) {
  const installed = ['beeline', 'caveman'].filter((style) => fs.existsSync(path.join(codexHome, 'skills', style, 'SKILL.md')));
  return installed.length === 1 ? installed[0] : null;
}

export { installedStyle };
