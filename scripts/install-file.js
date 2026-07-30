#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [source, target] = process.argv.slice(2);
if (!source || !target) throw new Error('source and target are required');

fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target) && hash(source) === hash(target)) {
  console.log(`skip ${target}`);
} else {
  fs.copyFileSync(source, target);
  console.log(`replace ${target}`);
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
