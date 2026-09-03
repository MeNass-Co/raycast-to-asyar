#!/usr/bin/env node
// rc-install.mjs: install a converted Raycast extension from the GitHub store index into Asyar.
//   node cli/rc-install.mjs <id|raycast-name> [...]     e.g. raycast.gebeto.translate  or  google-translate
//   node cli/rc-install.mjs --search <text>             list matching index entries
// Steps: download the release .asyar (sha256-checked) → unzip into the Asyar extensions dir → enable +
// consent (from the manifest) in settings.dat → trust the node sidecar → restart Asyar (settings.dat is
// only read at boot and flushed at quit, so Asyar must be quit while it is edited).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

const REPO = process.env.RC_RELEASE_REPO ?? 'MeNass-Co/asyar-raycast-store';
const INDEX = `https://raw.githubusercontent.com/${REPO}/main/index.json`;
const APP = path.join(os.homedir(), 'Library/Application Support/org.asyar.app');
const args = process.argv.slice(2);
const log = (...a) => console.log('[rc-install]', ...a);

// raw.githubusercontent.com caches the branch file for minutes; the contents API is always current.
const API = `https://api.github.com/repos/${REPO}/contents/index.json`;
const index = await (await fetch(API, { headers: { Accept: 'application/vnd.github.raw+json' } }).then((r) => (r.ok ? r : fetch(INDEX)))).json();
const byId = new Map(index.extensions.map((e) => [e.id, e]));
if (args[0] === '--search') { const q = args.slice(1).join(' ').toLowerCase(); for (const e of index.extensions) if ((e.id + ' ' + e.name + ' ' + (e.description ?? '')).toLowerCase().includes(q)) console.log(`${e.id.padEnd(48)} ${e.name} — ${(e.description ?? '').slice(0, 80)}`); process.exit(0); }

const wanted = args.filter((a) => !a.startsWith('--')).map((a) => byId.get(a) ?? index.extensions.find((e) => e.id.endsWith('.' + a.replace(/-/g, '')) || e.name.toLowerCase() === a.toLowerCase()) ?? (() => { throw new Error(`not in index: ${a}`); })());
if (!wanted.length) { console.error('usage: rc-install.mjs <id> ... | --search <text>'); process.exit(2); }

// 1. download + verify + unzip (Asyar not touched yet)
const staged = [];
for (const e of wanted) {
  const tmp = path.join(os.tmpdir(), `${e.id}.asyar`);
  fs.writeFileSync(tmp, Buffer.from(await (await fetch(e.url)).arrayBuffer()));
  const sum = crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
  if (sum !== e.sha256) throw new Error(`sha256 mismatch for ${e.id}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-install-'));
  execFileSync('unzip', ['-qo', tmp, '-d', dir]);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  staged.push({ e, dir, manifest }); log('downloaded', e.id, e.version);
}

// 2. quit Asyar, swap files, edit settings + DB, relaunch
const running = spawnSync('pgrep', ['-x', 'asyar']).status === 0;
if (running) { spawnSync('osascript', ['-e', 'tell application "asyar" to quit']); await new Promise((r) => setTimeout(r, 2000)); spawnSync('pkill', ['-x', 'asyar']); await new Promise((r) => setTimeout(r, 1000)); }
const settingsPath = path.join(APP, 'settings.dat');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const ext = settings.settings.extensions; ext.enabled ??= {}; ext.consent ??= {};
const db = new Database(path.join(APP, 'asyar_data.db'));
for (const { e, dir, manifest } of staged) {
  const dest = path.join(APP, 'extensions', manifest.id);
  fs.rmSync(dest, { recursive: true, force: true }); fs.cpSync(dir, dest, { recursive: true }); fs.rmSync(dir, { recursive: true, force: true });
  ext.enabled[manifest.id] = true;
  ext.consent[manifest.id] = { consentedAt: Date.now(), grandfathered: false, permissionArgs: manifest.permissionArgs ?? {}, permissions: manifest.permissions ?? [] };
  for (const bin of manifest.permissionArgs?.['shell:spawn'] ?? []) db.prepare('insert or ignore into shell_trusted_binaries(extension_id,binary_path,trusted_at) values(?,?,?)').run(manifest.id, bin, Math.floor(Date.now() / 1000));
  log('installed', manifest.id, `(${manifest.commands.length} commands${manifest.tools?.length ? `, ${manifest.tools.length} AI tools` : ''})`);
}
db.close();
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
spawnSync('open', ['-a', '/Applications/asyar.app']);
log('Asyar relaunched');
