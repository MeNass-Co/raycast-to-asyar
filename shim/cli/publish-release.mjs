#!/usr/bin/env node
// publish-release.mjs: zip a converted extension from shim/out/<id> into <id>.asyar, upload it as a
// GitHub Release asset (tag "<id>@<version>") in MeNass-Co/asyar-raycast-store, then delete the local
// build. Output: a JSON line {id, version, url, sha256} appended to shim/releases.jsonl.
//
//   node cli/publish-release.mjs <id> [<id> ...]        # explicit
//   node cli/publish-release.mjs --all-ok               # every "ok" entry of store-report.json
//   node cli/publish-release.mjs --all-ok --keep        # keep local out/ dirs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.resolve(here, '..');
const OUT = path.join(SHIM, 'out');
const REPO = process.env.RC_RELEASE_REPO ?? 'MeNass-Co/asyar-raycast-store';
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const ids = args.includes('--all-ok')
  ? Object.values(JSON.parse(fs.readFileSync(path.join(SHIM, 'store-report.json'), 'utf8')).results).filter((r) => r.status === 'ok').map((r) => r.id)
  : args.filter((a) => !a.startsWith('--'));
const log = (...a) => console.log('[publish]', ...a);

function ensureRepo() {
  const r = spawnSync('gh', ['repo', 'view', REPO, '--json', 'name'], { encoding: 'utf8' });
  if (r.status === 0) return;
  log('creating', REPO);
  execFileSync('gh', ['repo', 'create', REPO, '--public', '--description', 'Raycast store extensions converted for Asyar by rc2asyar. One GitHub Release per extension; install the .asyar from Asyar → Extensions → Install from File, or via the rc2asyar store index.'], { stdio: 'inherit' });
  const tmp = fs.mkdtempSync('/tmp/rc-store-');
  fs.writeFileSync(path.join(tmp, 'README.md'), `# asyar-raycast-store\n\nRaycast store extensions converted to run unmodified inside [Asyar](https://asyar.org) via [rc2asyar](https://github.com/MeNass-Co/raycast-to-asyar).\n\nEach extension is a GitHub Release tagged \`<extensionId>@<version>\` with a single \`.asyar\` asset (a zip of the built extension). The index of every published extension is \`index.json\` on the \`main\` branch.\n`);
  fs.writeFileSync(path.join(tmp, 'index.json'), '[]\n');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
  execFileSync('git', ['add', '-A'], { cwd: tmp });
  execFileSync('git', ['-c', 'user.name=rc2asyar', '-c', 'user.email=rc2asyar@users.noreply.github.com', 'commit', '-qm', 'init'], { cwd: tmp });
  execFileSync('git', ['remote', 'add', 'origin', `https://github.com/${REPO}.git`], { cwd: tmp });
  execFileSync('git', ['push', '-q', 'origin', 'main'], { cwd: tmp });
  fs.rmSync(tmp, { recursive: true, force: true });
}

function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

function publishOne(id) {
  const dir = path.join(OUT, id);
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) { log('skip (no build):', id); return null; }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const tag = `${id}@${manifest.version}`;
  const asset = path.join('/tmp', `${id}.asyar`);
  fs.rmSync(asset, { force: true });
  // Zip only what Asyar needs (no npm caches, no swift .build).
  execFileSync('zip', ['-qr', asset, '.', '-x', '.swift-*', 'rc2asyar.json'], { cwd: dir });
  const sum = sha256(asset);
  const exists = spawnSync('gh', ['release', 'view', tag, '-R', REPO, '--json', 'tagName'], { encoding: 'utf8' }).status === 0;
  if (exists) {
    execFileSync('gh', ['release', 'upload', tag, asset, '-R', REPO, '--clobber'], { stdio: 'pipe' });
  } else {
    const notes = `**${manifest.name}** v${manifest.version} — converted from the Raycast store (\`${manifest.author}\`) by rc2asyar.\n\nCommands: ${manifest.commands.map((c) => c.name).join(', ')}${manifest.tools?.length ? `\nAI tools: ${manifest.tools.map((t) => t.id).join(', ')}` : ''}\n\nsha256: \`${sum}\``;
    execFileSync('gh', ['release', 'create', tag, asset, '-R', REPO, '--title', `${manifest.name} ${manifest.version}`, '--notes', notes], { stdio: 'pipe' });
  }
  const url = `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${id}.asyar`;
  fs.rmSync(asset, { force: true });
  if (!keep) fs.rmSync(dir, { recursive: true, force: true });
  const rec = { id, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, commands: manifest.commands.length, tools: manifest.tools?.length ?? 0, tag, url, sha256: sum, publishedAt: new Date().toISOString() };
  fs.appendFileSync(path.join(SHIM, 'releases.jsonl'), JSON.stringify(rec) + '\n');
  log(exists ? 'updated' : 'released', tag);
  return rec;
}

ensureRepo();
let n = 0;
for (const id of ids) { try { if (publishOne(id)) n++; } catch (e) { log('FAILED', id, String(e.stderr ?? e.message).split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160)); } }
log(`${n}/${ids.length} published → releases.jsonl`);
