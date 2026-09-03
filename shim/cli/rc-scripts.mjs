#!/usr/bin/env node
// rc-scripts.mjs: convert Raycast Script Commands (`# @raycast.*` headers) into Asyar scripts
// (`# @asyar.*` headers). The script body is untouched; only the header block is rewritten.
//
//   node cli/rc-scripts.mjs <src-dir-or-file> <dest-dir>
//
// Mapping: title/icon/mode/refreshTime → same names; argumentN {type,placeholder,optional,data} →
// argument:N {name,type,placeholder,required,data}; needsConfirmation/packageName/author/description
// are kept as plain comments (Asyar has no equivalent). Non-emoji icons (png paths) → icon:terminal.
import fs from 'node:fs';
import path from 'node:path';

const [src, dest] = process.argv.slice(2);
if (!src || !dest) { console.error('usage: rc-scripts.mjs <src> <dest>'); process.exit(2); }
const EXT = new Set(['.sh', '.bash', '.zsh', '.py', '.rb', '.js', '.ts', '.swift', '.applescript', '.scpt', '.pl', '.php', '.fish']);
const isEmoji = (s) => /^\p{Extended_Pictographic}/u.test(s.trim());

function convertHeader(text) {
  const lines = text.split('\n');
  const out = []; let title = ''; let n = 0;
  for (const line of lines) {
    const m = /^(\s*#\s*)@raycast\.([A-Za-z0-9]+)\s*(.*)$/.exec(line);
    if (!m) { out.push(line); continue; }
    const [, pre, key, valRaw] = m; const val = valRaw.trim(); n++;
    switch (key) {
      case 'title': title = val; out.push(`${pre}@asyar.title ${val}`); break;
      case 'mode': out.push(`${pre}@asyar.mode ${['silent', 'compact', 'fullOutput', 'inline'].includes(val) ? val : 'compact'}`); break;
      case 'refreshTime': out.push(`${pre}@asyar.refreshTime ${val}`); break;
      case 'icon': out.push(`${pre}@asyar.icon ${isEmoji(val) ? val : 'icon:terminal'}`); break;
      case 'argument1': case 'argument2': case 'argument3': {
        const i = Number(key.slice(-1)); let a = {};
        try { a = JSON.parse(val); } catch { out.push(`${pre}(unparseable raycast argument dropped: ${val})`); break; }
        const type = a.type === 'password' ? 'password' : a.type === 'dropdown' ? 'dropdown' : 'text';
        const arg = { name: (a.placeholder || `arg${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `arg${i}`, type, placeholder: a.placeholder || undefined, required: !a.optional };
        if (type === 'dropdown' && Array.isArray(a.data)) arg.data = a.data.map((d) => ({ title: String(d.title ?? d.value), value: String(d.value) }));
        out.push(`${pre}@asyar.argument:${i} ${JSON.stringify(arg)}`);
        break;
      }
      case 'schemaVersion': break; // implicit
      default: out.push(`${pre}raycast.${key} ${val}`); // author, packageName, description, needsConfirmation, iconDark, authorURL, currentDirectoryPath
    }
  }
  return { text: out.join('\n'), title, directives: n };
}

function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) yield* walk(p); } else yield p; } }
const files = fs.statSync(src).isDirectory() ? [...walk(src)] : [src];
let ok = 0, skipped = 0;
for (const f of files) {
  if (!EXT.has(path.extname(f))) { skipped++; continue; }
  const text = fs.readFileSync(f, 'utf8');
  if (!/^\s*#\s*@raycast\./m.test(text)) { skipped++; continue; }
  const { text: converted, title } = convertHeader(text);
  const rel = fs.statSync(src).isDirectory() ? path.relative(src, f) : path.basename(f);
  // Flatten "<category>/commands/<file>" (raycast/script-commands layout) to "<category>/<file>".
  // Asyar scans a script directory one level deep: flatten "<category>/<sub>/<file>" to "<category>/<sub>--<file>".
  const parts = rel.replace(/\/commands\//, '/').replace(/^commands\//, '').split('/');
  const target = path.join(dest, parts.length > 2 ? path.join(parts[0], parts.slice(1).join('--')) : parts.join('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, converted); fs.chmodSync(target, 0o755); ok++;
  // Sibling assets (icons/images referenced relatively) travel along.
  const images = path.join(path.dirname(f), 'images'); if (fs.existsSync(images)) fs.cpSync(images, path.join(path.dirname(target), 'images'), { recursive: true });
}
console.log(`[rc-scripts] ${ok} scripts converted, ${skipped} files skipped → ${dest}`);
