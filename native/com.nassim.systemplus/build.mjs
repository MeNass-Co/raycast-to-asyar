import { createRequire } from 'node:module'; const esbuild = createRequire(new URL('../../shim/package.json', import.meta.url))('esbuild'); import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const SHIM = path.resolve(here, '../../shim');
const out = process.argv[2] ?? path.join(here, 'dist');
import os0 from 'node:os';
const manifest0 = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const AXWIN = path.join(os0.homedir(), 'Library/Application Support/org.asyar.app/extensions', manifest0.id, 'bin/axwin');
fs.mkdirSync(out, { recursive: true });
await esbuild.build({ entryPoints: [path.join(here, 'src/worker.ts')], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: path.join(out, 'worker.js'), nodePaths: [path.join(SHIM, 'node_modules')], absWorkingDir: here, logLevel: 'warning', loader: { '.json': 'json' }, define: { __AXWIN__: JSON.stringify(AXWIN) } });
fs.writeFileSync(path.join(out, 'worker.html'), '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>System+ (worker)</title></head><body><script type="module" src="./worker.js"></script></body></html>\n');
// axwin: AX window helper (get/set/fullscreen on the topmost normal window). Built here so the binary is
// native to this Mac; its absolute install path goes into permissionArgs (Asyar wants absolute programs).
import { execFileSync } from 'node:child_process'; import os from 'node:os';
fs.mkdirSync(path.join(out, 'bin'), { recursive: true });
fs.cpSync(path.join(here, 'assets'), path.join(out, 'assets'), { recursive: true });
execFileSync('swiftc', ['-O', '-import-objc-header', path.join(here, 'swift/axwin-bridge.h'), path.join(here, 'swift/axwin.swift'), '-o', path.join(out, 'bin/axwin')], { stdio: ['ignore', 'ignore', 'inherit'] });
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const axwinPath = path.join(os.homedir(), 'Library/Application Support/org.asyar.app/extensions', manifest.id, 'bin/axwin');
manifest.permissionArgs['shell:spawn'] = [...manifest.permissionArgs['shell:spawn'].filter((p) => !p.endsWith('/bin/axwin')), axwinPath];
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('built', out);
