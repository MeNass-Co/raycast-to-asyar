#!/usr/bin/env node
// publish-index.mjs: build index.json from shim/releases.jsonl (latest record per id) and push it to the
// main branch of the store repo through the GitHub contents API (no local clone).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SHIM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.RC_RELEASE_REPO ?? 'MeNass-Co/asyar-raycast-store';
const byId = new Map();
for (const l of fs.readFileSync(path.join(SHIM, 'releases.jsonl'), 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); byId.set(r.id, r); }
const index = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
const body = JSON.stringify({ generatedAt: new Date().toISOString(), count: index.length, extensions: index }, null, 1) + '\n';
const tmp = path.join('/tmp', 'rc-index.json'); fs.writeFileSync(tmp, body);
const cur = spawnSync('gh', ['api', `repos/${REPO}/contents/index.json`, '--jq', '.sha'], { encoding: 'utf8' });
const args = ['api', '-X', 'PUT', `repos/${REPO}/contents/index.json`, '-f', `message=index: ${index.length} extensions`, '-f', `content=${fs.readFileSync(tmp).toString('base64')}`];
if (cur.status === 0 && cur.stdout.trim()) args.push('-f', `sha=${cur.stdout.trim()}`);
execFileSync('gh', args, { stdio: 'pipe' });
console.log(`[index] ${index.length} extensions → https://raw.githubusercontent.com/${REPO}/main/index.json`);
