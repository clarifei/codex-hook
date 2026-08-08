#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run

import { missingDependencies, requiresRtk } from './lib/dependencies.ts';
import { buildPolicy, policyFor } from './lib/policy.ts';
import { type HookEvent, output, readEvent } from './lib/protocol.ts';

if (Deno.args[0] === '--self-test') {
  if (
    !requiresRtk('git status') || requiresRtk('rtk git status') ||
    requiresRtk('  RTK cmd /c dir')
  ) {
    throw new Error('RTK guard failed');
  }
  for (const style of ['beeline', 'caveman'] as const) {
    const policy = policyFor(style);
    const other = style === 'beeline' ? 'caveman' : 'beeline';
    if (
      policy.length > 2000 || !policy.includes(`\`$${style}\``) ||
      policy.includes(`\`$${other}\``) ||
      !policy.includes('/codebase-memory/SKILL.md') ||
      !policy.includes('/wigolo/SKILL.md') ||
      !policy.includes('Prefix every shell command with \`rtk\`')
    ) {
      throw new Error(`${style} policy failed`);
    }
  }
  console.log('ok');
  Deno.exit(0);
}

await readEvent(run);

function run(event: HookEvent) {
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

  if (
    event.hook_event_name === 'SessionStart' ||
    event.hook_event_name === 'SubagentStart'
  ) {
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

function fail(missing: string[]) {
  Deno.stderr.writeSync(
    new TextEncoder().encode(
      `workstyle hook requires installed ${missing.join(', ')}.\n`,
    ),
  );
  Deno.exitCode = 1;
}
