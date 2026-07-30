#!/usr/bin/env node

const { disable, disablePonytail } = require('./lib/config');

if (process.argv[2] === '--self-test') {
  const once = disable('[plugins."ponytail@ponytail"]\nenabled = true\n');
  if (!once.changed || !/enabled = false/.test(once.text) || disable(once.text).changed) {
    throw new Error('Ponytail config update failed');
  }
  console.log('ok');
  process.exit(0);
}

const config = process.argv[2];
if (!config) throw new Error('config path is required');
disablePonytail(config);
