// build.mjs — bundle src/worker.ts into dist/ and ship the zsh scripts alongside it.
// Mirrors native/com.nassim.systemplus/build.mjs; instead of compiling a Swift helper it injects the
// absolute install path of scripts/ (Asyar spawns from an unpredictable cwd, so the path must be absolute).
import { createRequire } from 'node:module'; const esbuild = createRequire(new URL('../../shim/package.json', import.meta.url))('esbuild');
import path from 'node:path'; import fs from 'node:fs'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const SHIM = path.resolve(here, '../../shim');
const out = process.argv[2] ?? path.join(here, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const SCRIPTS = path.join(os.homedir(), 'Library/Application Support/org.asyar.app/extensions', manifest.id, 'scripts');
fs.mkdirSync(out, { recursive: true });
await esbuild.build({ entryPoints: [path.join(here, 'src/worker.ts')], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: path.join(out, 'worker.js'), nodePaths: [path.join(SHIM, 'node_modules')], absWorkingDir: here, logLevel: 'warning', loader: { '.json': 'json' }, define: { __SCRIPTS__: JSON.stringify(SCRIPTS) } });
fs.writeFileSync(path.join(out, 'worker.html'), '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gaming Mode (worker)</title></head><body><script type="module" src="./worker.js"></script></body></html>\n');
fs.cpSync(path.join(here, 'assets'), path.join(out, 'assets'), { recursive: true });
fs.cpSync(path.join(here, 'scripts'), path.join(out, 'scripts'), { recursive: true });
for (const f of fs.readdirSync(path.join(out, 'scripts'))) fs.chmodSync(path.join(out, 'scripts', f), 0o755);
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('built', out, '\nscripts will resolve at', SCRIPTS);
