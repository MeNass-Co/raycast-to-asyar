#!/usr/bin/env node
// store-triage.mjs: cluster store-report.json failures by root-cause signature so each cluster can be
// handed to one worker agent (one shim fix usually unlocks a whole cluster).
//
//   node cli/store-triage.mjs [--top 40] [--write campaign/clusters.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.resolve(here, '..');
const report = JSON.parse(fs.readFileSync(path.join(SHIM, 'store-report.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const top = Number(flag('--top', 40));
const writeTo = flag('--write', '');

/** Normalise an esbuild/npm error line into a stable signature. */
function signature(lines) {
  for (const raw of [...lines].reverse()) {
    const l = raw.replace(/\x1b\[[0-9;]*m/g, '');
    let m;
    if ((m = /Could not resolve "([^"]+)"/.exec(l))) return `unresolved:${m[1].replace(/^(\.\.?\/)+/, './')}`;
    if ((m = /No matching export in "([^"]+)" for import "([^"]+)"/.exec(l))) return `missing-export:${m[2]}`;
    if ((m = /swift package not built for (.+)/.exec(l))) return `swift:${m[1]}`;
    if (/npm install/.test(l) && /failed/i.test(l)) return 'npm-install';
    if ((m = /ERR! (?:code )?([A-Z_]+)/.exec(l))) return `npm:${m[1]}`;
    if (/Unexpected "\w+"|Expected .* but found/.test(l)) return 'esbuild-syntax';
    if (/Top-level await/.test(l)) return 'tla';
    if ((m = /error TS\d+: ([^.]{0,60})/.exec(l))) return `ts:${m[1].trim()}`;
    if (/Cannot read properties of/.test(l)) return 'converter-crash';
  }
  return lines.length ? 'other:' + lines[lines.length - 1].replace(/\x1b\[[0-9;]*m/g, '').slice(0, 60) : 'no-error-captured';
}

const clusters = new Map();
const counts = { ok: 0, fail: 0, timeout: 0 };
for (const [name, r] of Object.entries(report.results)) {
  counts[r.status] = (counts[r.status] ?? 0) + 1;
  if (r.status === 'ok') continue;
  const sig = r.status === 'timeout' ? 'timeout' : signature(r.errors);
  const c = clusters.get(sig) ?? { sig, extensions: [], sample: r.errors.slice(-2) };
  c.extensions.push(name);
  clusters.set(sig, c);
}
const sorted = [...clusters.values()].sort((a, b) => b.extensions.length - a.extensions.length);
console.log(`ok=${counts.ok} fail=${counts.fail} timeout=${counts.timeout} clusters=${sorted.length}`);
for (const c of sorted.slice(0, top)) console.log(`${String(c.extensions.length).padStart(5)}  ${c.sig}  e.g. ${c.extensions.slice(0, 3).join(', ')}`);
if (writeTo) { fs.mkdirSync(path.dirname(path.resolve(SHIM, writeTo)), { recursive: true }); fs.writeFileSync(path.resolve(SHIM, writeTo), JSON.stringify({ counts, clusters: sorted }, null, 1)); console.log('→', writeTo); }
