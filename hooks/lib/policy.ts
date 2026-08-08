import path from 'node:path';
import { codexHome } from './dependencies.ts';
import { installedStyle, type Workstyle } from './style.ts';

function policyFor(style: Workstyle | string | null) {
  if (style !== 'beeline' && style !== 'caveman') {
    throw new Error('install exactly one beeline or caveman skill');
  }
  const skill = (name: string) => path.join(codexHome, 'skills', name, 'SKILL.md');
  return `WORKSTYLE ACTIVE. This hook explicitly invokes \`$ponytail\` and \`$${style}\` at level \`full\`.
Before acting, read \`${skill('ponytail')}\` and \`${
    skill(style)
  }\` completely unless each full file is already in the current context. Treat them as authoritative and follow every rule, boundary, precedence, persistence, and composition instruction. Do not load the unselected style.

CODEBASE MEMORY MCP ACTIVE. For repository work, read \`${
    skill('codebase-memory')
  }\` unless already in context. Use the configured codebase-memory-mcp as the primary source for code discovery and impact analysis.

WIGOLO MCP ACTIVE. For web work, read \`${
    skill('wigolo')
  }\` and the matching installed Wigolo subskill unless already in context. Use the configured Wigolo MCP for every web operation and follow its cache-first routing; do not load unrelated subskills.

RTK ACTIVE. Read \`${
    path.join(codexHome, 'RTK.md')
  }\` unless it is already in the current context. Prefix every shell command with \`rtk\`.`;
}

function buildPolicy() {
  return policyFor(installedStyle(codexHome));
}

export { buildPolicy, policyFor };
