import fs from 'node:fs';
import path from 'node:path';

type Workstyle = 'beeline' | 'caveman';

function installedStyle(codexHome: string): Workstyle | null {
  const installed = (['beeline', 'caveman'] as const)
    .filter((style) => fs.existsSync(path.join(codexHome, 'skills', style, 'SKILL.md')));
  return installed.length === 1 ? installed[0] : null;
}

export { installedStyle };
export type { Workstyle };
