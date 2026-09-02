// Runs a Raycast swift-tools binary: `<bin> <fn> <jsonArg1> <jsonArg2> …` prints JSON on stdout.
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function binDir() {
  // The sidecar is compiled from stdin, so locate bin/ next to the extension's manifest.
  const id = process.env.RC_EXTENSION_ID || global.__rcExtensionId;
  const base = path.join(require('node:os').homedir(), 'Library/Application Support/org.asyar.app');
  const candidates = [id && path.join(base, 'extensions', id, 'bin'), global.__rcExtensionDir && path.join(global.__rcExtensionDir, 'bin')].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('swift bin dir not found for ' + id);
}

const FALLBACKS = { Messages: () => require('./contacts-fallback.cjs') };
exports.runSwift = function runSwift(bin, fn, args) {
  return runSwiftRaw(bin, fn, args).catch((e) => {
    const fb = FALLBACKS[bin]?.();
    if (fb && typeof fb[fn] === 'function' && /accessDenied|denied|not authorized/i.test(String(e?.message))) return fb[fn](...args);
    throw e;
  });
};
function runSwiftRaw(bin, fn, args) {
  return new Promise((resolve, reject) => {
    const file = path.join(binDir(), bin);
    execFile(file, [fn, ...args.map((a) => JSON.stringify(a))], { maxBuffer: 256 << 20 }, (err, stdout, stderr) => {
      if (err) { reject(new Error((stderr || err.message || '').trim() || 'swift tool failed')); return; }
      const out = stdout.trim();
      if (!out) { resolve(undefined); return; }
      try { resolve(JSON.parse(out)); } catch { resolve(out); }
    });
  });
}
