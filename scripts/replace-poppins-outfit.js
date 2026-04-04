const fs = require('fs');
const path = require('path');

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error('Usage: node replace-poppins-outfit.js <dir> [...]');
  process.exit(1);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.dart')) out.push(p);
  }
  return out;
}

let n = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    let s = fs.readFileSync(file, 'utf8');
    if (!s.includes('GoogleFonts.poppins')) continue;
    const next = s.replace(/GoogleFonts\.poppins/g, 'GoogleFonts.outfit');
    if (next !== s) {
      fs.writeFileSync(file, next);
      n += 1;
    }
  }
}
console.log('Updated', n, 'files');
