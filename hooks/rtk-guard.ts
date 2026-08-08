#!/usr/bin/env -S deno run

import { requiresRtk } from './lib/rtk.ts';
import { output, readEvent } from './lib/protocol.ts';

await readEvent((event) => {
  if (event.hook_event_name !== 'PreToolUse' || !requiresRtk(event.tool_input?.command)) return;
  output({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'Run every shell command through rtk.',
    },
  });
});
