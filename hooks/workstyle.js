#!/usr/bin/env node

const { missingDependencies, requiresRtk } = require('./lib/dependencies');
const { buildPolicy, fullMode } = require('./lib/policy');
const { output, readEvent } = require('./lib/protocol');

if (process.argv[2] === '--self-test') {
  if (!requiresRtk('git status') || requiresRtk('rtk git status') || requiresRtk('  RTK cmd /c dir')) {
    throw new Error('RTK guard failed');
  }
  if (fullMode('| **lite** | x |\n| **full** | y |\n| **ultra** | z |').includes('lite')) {
    throw new Error('Mode filter failed');
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
