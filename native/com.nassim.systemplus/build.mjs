import { createRequire } from 'node:module'; const esbuild = createRequire(new URL('../../shim/package.json', import.meta.url))('esbuild'); import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const SHIM = path.resolve(here, '../../shim');
const out = process.argv[2] ?? path.join(here, 'dist');
fs.mkdirSync(out, { recursive: true });
await esbuild.build({ entryPoints: [path.join(here, 'src/worker.ts')], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: path.join(out, 'worker.js'), nodePaths: [path.join(SHIM, 'node_modules')], absWorkingDir: here, logLevel: 'warning', loader: { '.json': 'json' } });
fs.writeFileSync(path.join(out, 'worker.html'), '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>System+ (worker)</title></head><body><script type="module" src="./worker.js"></script></body></html>\n');
fs.copyFileSync(path.join(here, 'manifest.json'), path.join(out, 'manifest.json'));
console.log('built', out);
