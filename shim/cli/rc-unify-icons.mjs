#!/usr/bin/env node
// rc-unify-icons.mjs: in every installed extension, set each command's icon to the extension's root icon
// (Nassim: "chaque commande = même logo que son extension"). Optionally override an extension's root icon
// with a PNG (used for Apple-app extensions → the real macOS app icon). Quit Asyar before, relaunch after.
//   node cli/rc-unify-icons.mjs [--set <extId>=<png> ...]
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const EXT = path.join(os.homedir(), 'Library/Application Support/org.asyar.app/extensions');
const args = process.argv.slice(2); const overrides = {};
for (let i = 0; i < args.length; i++) if (args[i] === '--set') { const [id, png] = args[++i].split('='); overrides[id] = png; }
const toUri = (png) => 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
let ext = 0, cmds = 0;
for (const id of fs.readdirSync(EXT)) {
  const mp = path.join(EXT, id, 'manifest.json'); if (!fs.existsSync(mp)) continue;
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (overrides[id]) m.icon = toUri(overrides[id]);
  if (!m.icon || !Array.isArray(m.commands)) continue;
  let changed = Boolean(overrides[id]);
  for (const c of m.commands) if (c.icon !== m.icon) { c.icon = m.icon; cmds++; changed = true; }
  if (changed) { fs.writeFileSync(mp, JSON.stringify(m, null, 2)); ext++; }
}
console.log(`[unify] ${ext} extensions touched, ${cmds} command icons unified`);
