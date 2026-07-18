const fs = require('fs');

const publisher = process.argv[2];
if (!publisher) {
  console.error('Usage: node scripts/set-publisher.js <publisher-id>');
  process.exit(1);
}

const manifestPath = 'package.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.publisher = publisher;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`publisher -> ${publisher}`);
