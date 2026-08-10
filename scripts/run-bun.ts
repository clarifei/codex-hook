#!/usr/bin/env -S deno run -A

import { resolveExecutable } from '../hooks/lib/executable.ts';

const status = await new Deno.Command(resolveExecutable('bun'), {
  args: ['run', ...Deno.args],
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
}).spawn().status;

Deno.exit(status.code);
