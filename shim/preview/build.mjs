import esbuild from 'esbuild'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const render = fs.readFileSync(process.argv[2], 'utf8');
const theme = JSON.parse(fs.readFileSync(path.join(process.env.HOME, 'Library/Application Support/org.asyar.app/extensions/com.nassim.raycast-glass/theme.json'), 'utf8')).variables;
await esbuild.build({ entryPoints: [path.join(here, 'preview.tsx')], bundle: true, outfile: path.join(here, 'out/preview.js'), jsx: 'automatic', platform: 'browser', format: 'esm', define: { __RENDER__: render, __THEME__: JSON.stringify(theme), 'process.env.NODE_ENV': '"production"' }, loader: { '.json': 'json', '.css': 'css' }, logLevel: 'warning' });
fs.writeFileSync(path.join(here, 'out/index.html'), `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="preview.css"><style>html,body{background:#151517}#app{width:750px;height:432px;margin:0}</style></head><body><div id="app"></div><script type="module" src="preview.js"></script></body></html>`);
console.log('preview built');
