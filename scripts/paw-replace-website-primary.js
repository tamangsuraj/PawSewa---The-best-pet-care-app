/**
 * Replace legacy Tailwind primary/secondary tokens with paw-* in customer website.
 * Admin panel is excluded.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../apps/web/website");

const REPLACEMENTS = [
  [/text-primary\b/g, "text-paw-bark"],
  [/bg-primary\b/g, "bg-paw-bark"],
  [/border-primary\b/g, "border-paw-bark"],
  [/ring-primary\b/g, "ring-paw-bark"],
  [/focus:ring-primary\b/g, "focus:ring-paw-teal-mid"],
  [/focus:border-primary\b/g, "focus:border-paw-teal-mid"],
  [/from-secondary\b/g, "from-paw-sand"],
  [/to-secondary\b/g, "to-paw-cream"],
  [/via-secondary\b/g, "via-paw-sand"],
  [/bg-secondary\b/g, "bg-paw-sand"],
  [/bg-secondary\//g, "bg-paw-sand/"],
];

const SKIP_DIRS = new Set([".next", "node_modules", "dist", ".turbo"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory() && SKIP_DIRS.has(name.name)) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name.name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  if (s !== orig) {
    fs.writeFileSync(file, s);
    changed++;
    console.log(file.replace(ROOT + path.sep, ""));
  }
}
console.log("Files updated:", changed);
