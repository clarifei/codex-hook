#!/usr/bin/env node

import { missingDependencies, requiresRtk } from './lib/dependencies.mjs';
import { buildPolicy, policyFor } from './lib/policy.mjs';
import { output, readEvent } from './lib/protocol.mjs';

if (process.argv[2] === '--self-test') {
  if (!requiresRtk('git status') || requiresRtk('rtk git status') || requiresRtk('  RTK cmd /c dir')) {
    throw new Error('RTK guard failed');
  }
  for (const style of ['beeline', 'caveman']) {
    const policy = policyFor(style);
    const other = style === 'beeline' ? 'caveman' : 'beeline';
    if (policy.length > 2000 || !policy.includes(`\`$${style}\``) || policy.includes(`\`$${other}\``)
      || !policy.includes('/codebase-memory/SKILL.md') || !policy.includes('/wigolo/SKILL.md')
      || !policy.includes('Prefix every shell command with \`rtk\`')) {
      throw new Error(`${style} policy failed`);
    }
  }
  console.log('ok');
  process.exit(0);
}

readEvent(run);

function run(event) {
  if (!event) return;

  if (event.hook_event_name === 'PreToolUse') {
    const command = event.tool_input && event.tool_input.command;
    if (!requiresRtk(command)) return;
    return output({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Run every shell command through rtk.',
      },
    });
  }

  if (event.hook_event_name === 'SessionStart' || event.hook_event_name === 'SubagentStart') {
    const missing = missingDependencies();
    if (missing.length) return fail(missing);
    output({
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: buildPolicy(),
      },
    });
  }
}

function fail(missing) {
  process.stderr.write(`workstyle hook requires installed ${missing.join(', ')}.\n`);
  process.exitCode = 1;
}
