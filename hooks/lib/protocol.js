function output(value) {
  process.stdout.write(JSON.stringify(value));
}

function readEvent(callback) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      callback(JSON.parse(input.replace(/^\uFEFF/, '')));
    } catch {
      process.exit(0);
    }
  });
  process.stdin.on('error', () => process.exit(0));
}

module.exports = { output, readEvent };
