#!/usr/bin/env node
// store-convert.mjs: run rc2asyar over every Raycast store extension, in parallel, with a
// per-extension timeout, and write a machine-readable report. Never throws on a single failure.
//
//   node cli/store-convert.mjs [--jobs 4] [--limit N] [--filter substring] [--only a,b,c] [--resume]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.resolve(here, '..');
const STORE = path.resolve(SHIM, '..', 'raycast-extensions', 'extensions');
const OUT = path.join(SHIM, 'out');
const REPORT = path.join(SHIM, 'store-report.json');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const jobs = Number(flag('--jobs', Math.max(2, Math.min(6, os.cpus().length - 2))));
const limit = Number(flag('--limit', 0));
const filter = flag('--filter', '');
const only = flag('--only', '') ? flag('--only', '').split(',') : null;
const resume = args.includes('--resume');
const timeoutMs = Number(flag('--timeout', 300_000));

const report = resume && fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : { startedAt: new Date().toISOString(), results: {} };
const save = () => fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));

let names = fs.readdirSync(STORE).filter((n) => fs.existsSync(path.join(STORE, n, 'package.json')) && fs.existsSync(path.join(STORE, n, 'src')));
if (only) names = names.filter((n) => only.includes(n));
if (filter) names = names.filter((n) => n.includes(filter));
if (resume) names = names.filter((n) => !report.results[n] || report.results[n].status === 'timeout');
if (limit) names = names.slice(0, limit);
console.log(`[store] ${names.length} extensions, ${jobs} jobs`);

const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^[^a-z]+/, '') || 'x';
function convertOne(name) {
  return new Promise((resolve) => {
    const dir = path.join(STORE, name);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const id = `raycast.${slug(pkg.owner ?? pkg.author ?? 'community')}.${slug(pkg.name)}`;
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(here, 'rc2asyar.mjs'), dir, '--id', id], { cwd: SHIM, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      const status = signal === 'SIGKILL' ? 'timeout' : code === 0 ? 'ok' : 'fail';
      const outDir = path.join(OUT, id);
      const sizes = status === 'ok' ? Object.fromEntries(['sidecar.cjs', 'view.js', 'worker.js'].filter((f) => fs.existsSync(path.join(outDir, f))).map((f) => [f, fs.statSync(path.join(outDir, f)).size])) : {};
      const manifest = status === 'ok' && fs.existsSync(path.join(outDir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8')) : null;
      // Keep the error tail compact: last meaningful esbuild/npm lines.
      const tail = (err + '\n' + out).split('\n').filter((l) => /error|Error|ERR|✘|Cannot|not found|failed/i.test(l)).slice(-6).map((l) => l.trim().slice(0, 300));
      report.results[name] = { id, status, ms, code, commands: manifest?.commands?.length ?? 0, tools: manifest?.tools?.length ?? 0, sizes, errors: tail, deps: Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@raycast/')) };
      resolve();
    });
  });
}

let i = 0; let done = 0;
async function worker() {
  while (i < names.length) {
    const name = names[i++];
    await convertOne(name);
    done++;
    const r = report.results[name];
    console.log(`[${done}/${names.length}] ${r.status.padEnd(7)} ${name} ${Math.round(r.ms / 1000)}s${r.errors.length ? ' :: ' + r.errors[r.errors.length - 1].slice(0, 120) : ''}`);
    if (done % 10 === 0) save();
  }
}
await Promise.all(Array.from({ length: jobs }, worker));
report.finishedAt = new Date().toISOString();
save();
const c = Object.values(report.results).reduce((a, r) => { a[r.status] = (a[r.status] ?? 0) + 1; return a; }, {});
console.log('[store] done', JSON.stringify(c), '→', REPORT);
