#!/usr/bin/env node
// rc2asyar: convert a Raycast extension directory into an Asyar extension, without touching its src/.
//
//   rc2asyar <raycast-ext-dir> [--out <dir>] [--id <reverse.dns.id>] [--install] [--node <path>]
//
// Output layout (Asyar Tier 2 extension):
//   manifest.json   view.html   view.js   view.css   worker.html   worker.js   sidecar.cjs   assets/   bin/
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import ts from 'typescript';
import { toolSchema } from './schema.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const SHIM = path.resolve(here, '..');
const PKG = path.join(SHIM, 'packages');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(n);
const srcDir = path.resolve(args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true) ?? '.');
if (!fs.existsSync(path.join(srcDir, 'package.json'))) { console.error('no package.json in', srcDir); process.exit(1); }
const pkg = JSON.parse(fs.readFileSync(path.join(srcDir, 'package.json'), 'utf8'));
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^[^a-z]+/, '') || 'x';
const extensionId = flag('--id', `raycast.${slug(pkg.owner ?? pkg.author ?? 'community')}.${slug(pkg.name)}`);
const APP_DATA = path.join(os.homedir(), 'Library/Application Support/org.asyar.app');
const outDir = path.resolve(flag('--out', has('--install') ? path.join(APP_DATA, 'extensions', extensionId) : path.join(SHIM, 'out', extensionId)));
const nodePath = flag('--node', findNode());

function findNode() {
  for (const p of ['/opt/homebrew/bin/node', '/usr/local/bin/node', process.execPath]) if (fs.existsSync(p)) return p;
  return 'node';
}
const log = (...a) => console.log('[rc2asyar]', ...a);

// ── 1. manifest ─────────────────────────────────────────────────────────
const commands = (pkg.commands ?? []).filter((c) => !c.disabledByDefault || true);
const modeOf = (c) => c.mode ?? 'view';
const prefToAsyar = (p) => {
  const type = { textfield: 'textfield', password: 'password', checkbox: 'checkbox', dropdown: 'dropdown', appPicker: 'appPicker', file: 'file', directory: 'directory', textarea: 'textfield' }[p.type] ?? 'textfield';
  const out = { name: p.name, type, title: p.title || p.label || p.name, description: p.description || p.title || p.name, required: !!p.required };
  if (p.placeholder) out.placeholder = p.placeholder;
  if (p.default !== undefined) out.default = p.default;
  if (type === 'dropdown' && p.data) out.data = p.data.map((d) => ({ value: String(d.value), title: d.title }));
  return out;
};
// The host renders manifest icons as text unless they are an image URL; use the extension scheme.
const iconOf = (icon) => {
  if (!icon) return undefined;
  const f = path.join(srcDir, 'assets', icon);
  return fs.existsSync(f) ? `asyar-extension://${extensionId}/assets/${icon}` : undefined;
};
const argsOf = (c) => (c.arguments ?? []).slice(0, 3).map((a) => ({ name: a.name, type: a.type === 'dropdown' ? 'dropdown' : a.type === 'password' ? 'password' : 'text', placeholder: a.placeholder, required: !!a.required, ...(a.type === 'dropdown' && a.data ? { data: a.data.map((d) => ({ value: String(d.value), title: d.title })) } : {}) }));

const manifestCommands = commands.map((c) => {
  const mode = modeOf(c);
  const base = { id: c.name, name: c.title, description: c.description || c.subtitle || c.title, icon: iconOf(c.icon) ?? iconOf(pkg.icon) ?? undefined };
  if (c.preferences?.length) base.preferences = c.preferences.map(prefToAsyar);
  if (c.arguments?.length) base.arguments = argsOf(c);
  if (mode === 'view') return { ...base, mode: 'view', component: c.name };
  const bg = { ...base, mode: 'background' };
  // Menu-bar commands are not mirrored to the status bar (nothing in the menu bar, by design), so they get no
  // refresh schedule either: no timer ticks, no sidecar wake-ups. They stay runnable on demand.
  if (mode === 'menu-bar') { /* no schedule */ }
  return bg;
});
function intervalSeconds(iv) { if (!iv) return 0; const m = /^(\d+)([smhd])$/.exec(iv); if (!m) return 0; const n = +m[1]; const mult = { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]; return Math.min(86400, Math.max(10, n * mult)); }

const toolsDir = path.join(srcDir, 'src', 'tools');
const toolFiles = (pkg.tools ?? []).map((t) => {
  const f = ['ts', 'tsx', 'js'].map((e) => path.join(toolsDir, `${t.name}.${e}`)).find((p) => fs.existsSync(p));
  return { ...t, file: f };
}).filter((t) => t.file);
log(`${manifestCommands.length} commands, ${toolFiles.length} tools`);
const manifestTools = toolFiles.map((t) => ({ id: t.name, name: t.title ?? t.name, description: t.description ?? t.title ?? t.name, parameters: toolSchema(t.file) }));

const permissions = ['shell:spawn', 'shell:open-url', 'shell:open-path', 'clipboard:read', 'clipboard:write', 'storage:read', 'storage:write', 'cache:read', 'cache:write', 'preferences:read', 'network', 'fs:read', 'fs:write', 'selection:read', 'extension:invoke', 'application:read', 'notifications:send'];
if (manifestTools.length) permissions.push('tools:register');
const hasBg = true; // always ship a worker: `searchable: true` (host search bar drives List filtering) requires background.main

const manifest = {
  id: extensionId,
  name: pkg.title ?? pkg.name,
  version: /^\d+\.\d+\.\d+/.test(pkg.version ?? '') ? pkg.version : '1.0.0',
  description: String(pkg.description ?? pkg.title ?? pkg.name).slice(0, 200).padEnd(10, '.'),
  author: pkg.author ?? pkg.owner ?? 'raycast',
  icon: iconOf(pkg.icon) ?? '🧩',
  type: 'extension',
  asyarSdk: '^4.10.0',
  platforms: ['macos'],
  searchable: true,
  background: { main: 'worker.js' },
  permissions,
  permissionArgs: { 'shell:spawn': [nodePath], 'shell:open-url': ['imessage', 'sms', 'message', 'mailto', 'message-mail', 'x-apple.systempreferences', 'raycast', 'asyar'] },
  ...(pkg.preferences?.length ? { preferences: pkg.preferences.map(prefToAsyar) } : {}),
  commands: manifestCommands,
  ...(manifestTools.length ? { tools: manifestTools } : {}),
};

// ── 2. bundles ──────────────────────────────────────────────────────────
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Swift tools: build once, copy the binary into bin/, alias `swift:` imports to a runner.
const swiftAliases = {};
const swiftBins = new Set();
for (const f of walk(path.join(srcDir, 'src'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:from\s+|import\()\s*["']swift:([^"']+)["']/g)) {
    const rel = m[1];
    const pkgDir = path.resolve(path.dirname(f), rel);
    if (swiftAliases[rel]) continue;
    const bin = buildSwift(pkgDir);
    const name = path.basename(bin);
    fs.mkdirSync(path.join(outDir, 'bin'), { recursive: true });
    fs.copyFileSync(bin, path.join(outDir, 'bin', name));
    fs.chmodSync(path.join(outDir, 'bin', name), 0o755);
    swiftBins.add(name);
    const fnNames = swiftFunctionNames(pkgDir);
    const shimFile = path.join(outDir, `.swift-${slug(name)}.cjs`);
    fs.writeFileSync(shimFile, `const { runSwift } = require('${path.join(PKG, 'api-node', 'swift.cjs').replace(/\\/g, '/')}');\nconst BIN = ${JSON.stringify(name)};\n${fnNames.map((n) => `exports.${n} = (...a) => runSwift(BIN, ${JSON.stringify(n)}, a);`).join('\n')}\n`);
    swiftAliases[rel] = shimFile;
  }
}
function buildSwift(pkgDir) {
  const rel = path.join(pkgDir, '.build', 'release');
  const product = swiftProductName(pkgDir);
  const bin = path.join(rel, product);
  if (!fs.existsSync(bin)) { log('swift build', pkgDir); execFileSync('swift', ['build', '-c', 'release', '--product', product], { cwd: pkgDir, stdio: 'inherit' }); }
  if (!fs.existsSync(bin)) throw new Error('swift product not built: ' + bin);
  return bin;
}
function swiftProductName(pkgDir) {
  const src = fs.readFileSync(path.join(pkgDir, 'Package.swift'), 'utf8');
  const m = /\.executable\(\s*name:\s*"([^"]+)"/.exec(src) ?? /\.executableTarget\(\s*name:\s*"([^"]+)"/.exec(src);
  if (!m) throw new Error('no executable product in ' + pkgDir);
  return m[1];
}
function swiftFunctionNames(pkgDir) {
  const names = [];
  for (const f of walk(path.join(pkgDir, 'Sources'))) if (f.endsWith('.swift')) for (const m of fs.readFileSync(f, 'utf8').matchAll(/@raycast\s+func\s+([A-Za-z0-9_]+)/g)) names.push(m[1]);
  return names;
}
function* walk(dir) { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.build') yield* walk(p); } else yield p; } }

// tsconfig `paths` (e.g. "@utils/*": ["./src/utils/*"]) used by ~5% of the store.
const tsBaseUrl = (() => { try { const f = path.join(srcDir, 'tsconfig.json'); if (!fs.existsSync(f)) return null; const c = ts.parseConfigFileTextToJson(f, fs.readFileSync(f, 'utf8')).config?.compilerOptions ?? {}; return c.baseUrl ? path.resolve(srcDir, c.baseUrl) : null; } catch { return null; } })();
const tsPaths = (() => { try { const f = path.join(srcDir, 'tsconfig.json'); if (!fs.existsSync(f)) return []; const t = ts.parseConfigFileTextToJson(f, fs.readFileSync(f, 'utf8')).config ?? {}; const base = path.resolve(srcDir, t.compilerOptions?.baseUrl ?? '.'); return Object.entries(t.compilerOptions?.paths ?? {}).map(([k, v]) => ({ re: new RegExp('^' + k.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace('*', '(.*)') + '$'), targets: v.map((x) => path.resolve(base, x)) })); } catch { return []; } })();
// Make sure the extension's own deps are installed (for the sidecar bundle). `@raycast/*` packages are
// never installed: the shim aliases `@raycast/api`, and `@raycast/utils` resolves from the shim's own
// node_modules. Skipping them cuts the install to the extension's real runtime deps.
// Re-run the install when node_modules exists but a declared dep is missing (an earlier run that failed
// half-way leaves a partial tree; --resume would then skip the install forever).
const missingDeclared = fs.existsSync(path.join(srcDir, 'node_modules')) && Object.keys(pkg.dependencies ?? {}).some((k) => !k.startsWith('@raycast/') && !fs.existsSync(path.join(srcDir, 'node_modules', k)));
if (missingDeclared) fs.rmSync(path.join(srcDir, 'node_modules'), { recursive: true, force: true });
if (!fs.existsSync(path.join(srcDir, 'node_modules'))) {
  const realDeps = Object.entries(pkg.dependencies ?? {}).filter(([k]) => !k.startsWith('@raycast/'));
  // Add bare imports used in src/ but missing from dependencies (Raycast hoisting used to hide this).
  const declared = new Set(Object.keys(pkg.dependencies ?? {}));
  const devRanges = pkg.devDependencies ?? {};
  const builtin = new Set(['fs', 'path', 'os', 'crypto', 'child_process', 'util', 'url', 'events', 'stream', 'buffer', 'http', 'https', 'net', 'zlib', 'readline', 'assert', 'tty', 'dns', 'querystring', 'string_decoder', 'timers', 'worker_threads', 'perf_hooks', 'module', 'process', 'constants', 'vm', 'punycode', 'v8', 'async_hooks', 'diagnostics_channel', 'react', 'react-dom']);
  const undeclared = new Set();
  for (const f of walk(srcDir)) {
    if (!/\.(t|j)sx?$/.test(f) || /\/(node_modules|assets|swift|rust)\//.test(f)) continue;
    // ts.preProcessFile parses real import/require specifiers; a regex on `from "` also matched
    // template strings and prose ("${baseBranch || " etc.) and produced bogus npm installs.
    const specs = ts.preProcessFile(fs.readFileSync(f, 'utf8'), true, true).importedFiles.map((i) => [null, i.fileName]);
    for (const m of specs) {
      if (!m[1] || m[1].startsWith('.') || m[1].startsWith('/')) continue;
      const spec = m[1]; if (/^(node|swift|rust|bun|data|https?):/.test(spec)) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (tsPaths.some(({ re }) => re.test(spec))) continue;
      if (tsBaseUrl && ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'].some((x) => fs.existsSync(path.join(tsBaseUrl, spec) + x))) continue;
      if (!name.startsWith('@raycast/') && !declared.has(name) && !builtin.has(name)) undeclared.add(name);
    }
  }
  for (const n of undeclared) realDeps.push([n, devRanges[n] ?? 'latest']);
  if (undeclared.size) log('undeclared deps:', [...undeclared].join(', '));
  if (realDeps.length) {
    log(`npm install (${realDeps.length} deps)`);
    const tmpPkg = path.join(srcDir, 'package.json');
    const backup = fs.readFileSync(tmpPkg, 'utf8');
    try {
      fs.writeFileSync(tmpPkg, JSON.stringify({ name: pkg.name, private: true, dependencies: Object.fromEntries(realDeps) }));
      try { execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', '--no-package-lock', '--loglevel=error'], { cwd: srcDir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, npm_config_cache: path.join(os.homedir(), '.npm-rc2asyar') } }); }
      catch (e) { const tail = String(e.stderr ?? '').split('\n').filter((l) => /npm (error|ERR)/i.test(l)).slice(0, 4).join(' | '); throw new Error('npm install failed: ' + (tail || e.message)); }
    } finally { fs.writeFileSync(tmpPkg, backup); }
  }
}

const commandEntries = {};
for (const c of commands) { const f = ['tsx', 'ts', 'jsx', 'js'].map((e) => path.join(srcDir, 'src', `${c.name}.${e}`)).find((p) => fs.existsSync(p)); if (f) commandEntries[c.name] = f; else log('WARN: no source for command', c.name); }

const sidecarEntry = path.join(outDir, '.sidecar-entry.ts');
fs.writeFileSync(sidecarEntry, [
  `import { start } from ${JSON.stringify(path.join(PKG, 'sidecar', 'main.ts'))};`,
  `start({`,
  `  commands: {`,
  ...Object.entries(commandEntries).map(([n, f]) => `    ${JSON.stringify(n)}: () => import(${JSON.stringify(f)}),`),
  `  },`,
  `  tools: {`,
  ...toolFiles.map((t) => `    ${JSON.stringify(t.name)}: () => import(${JSON.stringify(t.file)}),`),
  `  },`,
  `});`,
].join('\n'));

const raycastApiPlugin = {
  name: 'raycast-api-alias',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (a) => {
      for (const { re, targets } of tsPaths) {
        const m = re.exec(a.path); if (!m) continue;
        for (const t of targets) {
          const cand = t.replace('*', m[1] ?? '');
          for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) if (fs.existsSync(cand + ext) && fs.statSync(cand + ext).isFile()) return { path: cand + ext };
        }
      }
      return undefined;
    });
    // tsconfig `baseUrl` ("src"): bare imports like "Const" or "Managers/foo" resolve under it before npm.
    build.onResolve({ filter: /^[^./@][^:]*$/ }, (a) => {
      if (!tsBaseUrl || a.pluginData?.rcRequire) return undefined;
      const cand = path.join(tsBaseUrl, a.path);
      for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) if (fs.existsSync(cand + ext) && fs.statSync(cand + ext).isFile()) return { path: cand + ext };
      return undefined;
    });
    build.onResolve({ filter: /^@raycast\/api$/ }, () => ({ path: path.join(PKG, 'api-node', 'index.ts') }));
    // Optional native/desktop-only modules that libraries probe at runtime (got→electron, jsdom→canvas,
    // drizzle→better-sqlite3, urllib→proxy-agent, chokidar→fsevents): Raycast's bundler leaves them
    // unresolved too. Stub them as empty modules so the bundle builds; the code paths guard with try/catch.
    build.onResolve({ filter: /^(electron|canvas|better-sqlite3|proxy-agent|fsevents|bufferutil|utf-8-validate|@babel\/preset-typescript\/package\.json)$/ }, (a) => ({ path: a.path, namespace: 'rc-stub' }));
    build.onResolve({ filter: /\.node$/ }, (a) => ({ path: a.path, namespace: 'rc-stub' }));
    build.onLoad({ filter: /.*/, namespace: 'rc-stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
    // Raycast bundles for Node/CJS, where `import x from "pkg"` on a dual package yields module.exports.
    // esbuild's ESM output picks the "import" condition (no default export → build error). Resolve bare
    // dual packages through the "require" condition so `default` exists like it does in Raycast.
    build.onResolve({ filter: /^[^./][^:]*$/, namespace: 'file' }, async (a) => {
      if (a.pluginData?.rcRequire || a.kind !== 'import-statement' || a.path.startsWith('@raycast/') || a.path.startsWith('node:') || a.path === 'react' || a.path === 'react/jsx-runtime' || a.path === 'react-reconciler') return undefined;
      const name = a.path.startsWith('@') ? a.path.split('/').slice(0, 2).join('/') : a.path.split('/')[0];
      let pkgJson; for (const base of [path.join(srcDir, 'node_modules', name), path.join(SHIM, 'node_modules', name)]) { const f = path.join(base, 'package.json'); if (fs.existsSync(f)) { pkgJson = JSON.parse(fs.readFileSync(f, 'utf8')); break; } }
      const exp = pkgJson?.exports?.['.'] ?? pkgJson?.exports; if (!exp || typeof exp !== 'object' || !('require' in exp)) return undefined;
      const r = await build.resolve(a.path, { kind: 'require-call', resolveDir: a.resolveDir, importer: a.importer, pluginData: { rcRequire: true } });
      return r.errors.length ? undefined : { path: r.path };
    });
    // One React only: the reconciler and the extension must share the shim's copy.
    build.onResolve({ filter: /^(react|react\/jsx-runtime|react\/jsx-dev-runtime|react-reconciler|react-reconciler\/constants(\.js)?)$/ }, (a) => ({ path: require.resolve(a.path, { paths: [SHIM] }) }));
    // `rust:` helpers are Raycast-for-Windows binaries (extensions-rust-tools); on macOS the extension code
    // takes the Swift branch. Resolve them to a stub whose functions reject at call time, so the bundle builds.
    build.onResolve({ filter: /^rust:/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.slice('rust:'.length)), namespace: 'rc-rust' }));
    build.onLoad({ filter: /.*/, namespace: 'rc-rust' }, (a) => {
      const names = new Set();
      for (const f of fs.existsSync(a.path) ? walk(a.path) : []) if (f.endsWith('.rs')) for (const m of fs.readFileSync(f, 'utf8').matchAll(/#\[raycast\][^\n]*\n\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g)) names.add(m[1]);
      const body = [...names].map((n) => `export const ${n} = async () => { throw new Error('rust helper "${n}" is not available on macOS'); };`).join('\n');
      return { contents: body + '\nexport default {};', loader: 'js' };
    });
    build.onResolve({ filter: /^swift:/ }, (a) => { const rel = a.path.slice('swift:'.length); const s = swiftAliases[rel]; if (!s) return { errors: [{ text: `swift package not built for ${rel}` }] }; return { path: s }; });
  },
};

await esbuild.build({
  entryPoints: [sidecarEntry],
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  outfile: path.join(outDir, 'sidecar.cjs'),
  banner: { js: "import { createRequire as __rcCreateRequire } from 'node:module'; const require = __rcCreateRequire(import.meta.url); const __filename = new URL(import.meta.url).pathname; const __dirname = __filename.slice(0, __filename.lastIndexOf('/'));" },
  jsx: 'automatic', sourcemap: 'inline', logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.json': 'json', '.png': 'file', '.svg': 'file', '.wasm': 'binary' },
  plugins: [raycastApiPlugin],
  nodePaths: [path.join(SHIM, 'node_modules'), path.join(srcDir, 'node_modules')],
  absWorkingDir: srcDir,
  external: [],
});
fs.unlinkSync(sidecarEntry);

// Raycast applies a preference's `default` when the user never set it; Asyar returns nothing. Embed the
// defaults so getPreferenceValues() matches Raycast (checkbox → boolean, others verbatim).
const prefDefaults = (list) => Object.fromEntries((list ?? []).filter((p) => p.default !== undefined || p.type === 'checkbox').map((p) => [p.name, p.type === 'checkbox' ? Boolean(p.default) : p.default]));
const shimConfig = {
  extensionId, extensionName: pkg.name, ownerOrAuthorName: pkg.owner ?? pkg.author ?? '', nodePath,
  commands: Object.fromEntries(commands.map((c) => [c.name, { mode: modeOf(c), title: c.title, interval: c.interval }])),
  tools: toolFiles.map((t) => t.name),
  prefDefaults: { global: prefDefaults(pkg.preferences), commands: Object.fromEntries(commands.map((c) => [c.name, prefDefaults(c.preferences)])) },
};
const defines = { '__SHIM_CONFIG__': JSON.stringify(shimConfig), '__MANIFEST__': JSON.stringify(manifest), 'process.env.NODE_ENV': '"production"' };
const iframeCommon = { bundle: true, platform: 'browser', format: 'esm', target: 'es2022', jsx: 'automatic', define: defines, logLevel: 'warning', nodePaths: [path.join(SHIM, 'node_modules')], absWorkingDir: SHIM, loader: { '.json': 'json', '.css': 'css' }, sourcemap: false, minify: false };
await esbuild.build({ ...iframeCommon, entryPoints: [path.join(PKG, 'view', 'view.tsx')], outfile: path.join(outDir, 'view.js') });
if (hasBg) await esbuild.build({ ...iframeCommon, entryPoints: [path.join(PKG, 'worker', 'worker.ts')], outfile: path.join(outDir, 'worker.js') });

const html = (title, js, css) => `<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>${css ? `<link rel="stylesheet" href="./${css}">` : ''}</head><body><div id="app"></div><script type="module" src="./${js}"></script></body></html>\n`;
fs.writeFileSync(path.join(outDir, 'view.html'), html(manifest.name, 'view.js', fs.existsSync(path.join(outDir, 'view.css')) ? 'view.css' : ''));
if (hasBg) fs.writeFileSync(path.join(outDir, 'worker.html'), html(manifest.name + ' (worker)', 'worker.js', ''));

// assets (+ the Raycast package.json: @raycast/utils reads `<assetsPath>/../package.json` for owner/name)
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
if (fs.existsSync(path.join(srcDir, 'assets'))) fs.cpSync(path.join(srcDir, 'assets'), path.join(outDir, 'assets'), { recursive: true });
// Launcher rows do not load asyar-extension:// images (empty box); inline 64 px data URIs into the manifest
// icons instead. Assets stay on disk for the extension's own views.
try { execFileSync('python3', [path.join(SHIM, '..', 'tools', 'inline-icons.py'), '--single', outDir], { stdio: 'ignore' }); } catch {}
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ name: pkg.name, title: pkg.title, owner: pkg.owner, author: pkg.author, commands: pkg.commands, preferences: pkg.preferences, tools: pkg.tools }, null, 1));
// keep the Python MCP server if the source ships one (v1 compat)
if (pkg.ai?.instructions) fs.writeFileSync(path.join(outDir, 'agent-instructions.md'), String(pkg.ai.instructions));
fs.writeFileSync(path.join(outDir, 'rc2asyar-agent.json'), JSON.stringify({ suggestedTools: manifestTools.map((t) => `${extensionId}:${t.id}`), instructions: pkg.ai?.instructions ?? null }, null, 1));
fs.writeFileSync(path.join(outDir, 'rc2asyar.json'), JSON.stringify({ source: srcDir, raycastName: pkg.name, builtAt: new Date().toISOString(), swiftBins: [...swiftBins] }, null, 2));
try { execFileSync('xattr', ['-dr', 'com.apple.quarantine', outDir]); } catch { /* fine */ }
log('wrote', outDir);
if (has('--zip')) { const zip = path.join(path.dirname(outDir), `${extensionId}.asyar`); fs.rmSync(zip, { force: true }); execFileSync('zip', ['-qr', zip, '.'], { cwd: outDir }); log('packaged', zip); }
