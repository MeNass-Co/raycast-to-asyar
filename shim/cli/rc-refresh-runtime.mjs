#!/usr/bin/env node
// rc-refresh-runtime.mjs: rebuild ONLY the shim runtime (view.js, worker.js) inside already-installed
// converted extensions, so shim fixes (Action.PickDate, colorOf, toasts…) reach them without re-running the
// full store conversion. Reads each extension's rc2asyar.json + manifest + the extension's Raycast
// package.json (from the recorded source dir) to rebuild the exact same __SHIM_CONFIG__ / __MANIFEST__ defines
// rc2asyar.mjs uses. Quit Asyar first; relaunch after.
//
//   node cli/rc-refresh-runtime.mjs            # every installed raycast.* extension
//   node cli/rc-refresh-runtime.mjs <id> [..]  # specific ids
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.resolve(here, '..');
const PKG = path.join(SHIM, 'packages');
const EXT_DIR = path.join(os.homedir(), 'Library/Application Support/org.asyar.app/extensions');
const args = process.argv.slice(2);
// Store-installed extensions have no rc2asyar.json (publish-release strips it) but always carry package.json.
const ids = args.length ? args : fs.readdirSync(EXT_DIR).filter((d) => d.startsWith('raycast.') && fs.existsSync(path.join(EXT_DIR, d, 'package.json')) && fs.existsSync(path.join(EXT_DIR, d, 'view.js')));
const log = (...a) => console.log('[refresh]', ...a);

const prefDefaults = (list) => Object.fromEntries((list ?? []).filter((p) => p.default !== undefined || p.type === 'checkbox').map((p) => [p.name, p.type === 'checkbox' ? Boolean(p.default) : p.default]));
const modeOf = (c) => c.mode ?? 'view';

let ok = 0, skipped = 0;
for (const id of ids) {
  const dir = path.join(EXT_DIR, id);
  const metaPath = path.join(dir, 'rc2asyar.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  // The Raycast package.json ships next to assets (rc2asyar copies it); fall back to the source dir.
  const pkgPath = [path.join(dir, 'package.json'), path.join(meta.source ?? '', 'package.json')].find((p) => p && fs.existsSync(p));
  if (!pkgPath) { log('skip (no package.json):', id); skipped++; continue; }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const commands = pkg.commands ?? [];
  const toolFiles = (pkg.tools ?? []).map((t) => ({ name: t.name }));
  // Same resolution as rc2asyar.mjs::findNode (the sidecar is launched with this absolute path).
  const nodePath = ['/opt/homebrew/bin/node', '/usr/local/bin/node', process.execPath].find((p) => fs.existsSync(p)) ?? 'node';
  const shimConfig = {
    extensionId: id, extensionName: pkg.name, ownerOrAuthorName: pkg.owner ?? pkg.author ?? '', nodePath,
    commands: Object.fromEntries(commands.map((c) => [c.name, { mode: modeOf(c), title: c.title, interval: c.interval }])),
    tools: toolFiles.map((t) => t.name),
    prefDefaults: { global: prefDefaults(pkg.preferences), commands: Object.fromEntries(commands.map((c) => [c.name, prefDefaults(c.preferences)])) },
  };
  const defines = { '__SHIM_CONFIG__': JSON.stringify(shimConfig), '__MANIFEST__': JSON.stringify(manifest), 'process.env.NODE_ENV': '"production"' };
  const common = { bundle: true, platform: 'browser', format: 'esm', target: 'es2022', jsx: 'automatic', define: defines, logLevel: 'warning', nodePaths: [path.join(SHIM, 'node_modules')], absWorkingDir: SHIM, loader: { '.json': 'json', '.css': 'css' }, sourcemap: false, minify: false };
  try {
    await esbuild.build({ ...common, entryPoints: [path.join(PKG, 'view', 'view.tsx')], outfile: path.join(dir, 'view.js') });
    if (fs.existsSync(path.join(dir, 'worker.js'))) await esbuild.build({ ...common, entryPoints: [path.join(PKG, 'worker', 'worker.ts')], outfile: path.join(dir, 'worker.js') });
    // view.css ships with the runtime too (glyph cells, toasts…): refresh it alongside view.js.
    if (fs.existsSync(path.join(dir, 'view.css'))) fs.copyFileSync(path.join(PKG, 'view', 'view.css'), path.join(dir, 'view.css'));
    ok++;
  } catch (e) { log('FAILED', id, String(e.message ?? e).split('\n')[0].slice(0, 160)); }
}
log(`${ok} refreshed, ${skipped} skipped, ${ids.length - ok - skipped} failed`);
