const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../apps/web/website');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === '.next') continue;
      walk(p, out);
    } else if (name.name.endsWith('.tsx') || name.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

const replacements = [
  [/text-\[#4A2E1B\]\/(\d+)/g, 'text-paw-foreground/$1'],
  [/text-\[#4A2E1B\]/g, 'text-paw-foreground'],
  [/bg-\[#F8F6F0\]/g, 'bg-paw-panel'],
  [/border-\[#4A2E1B\]/g, 'border-paw-foreground'],
];

let files = 0;
for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8');
  let next = s;
  for (const [re, to] of replacements) {
    next = next.replace(re, to);
  }
  if (next !== s) {
    fs.writeFileSync(file, next);
    files += 1;
  }
}
console.log('Tokenized', files, 'files under website');
