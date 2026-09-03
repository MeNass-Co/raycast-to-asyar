#!/usr/bin/env node
// make-batches.mjs: turn campaign/clusters.json into one self-contained worker prompt per cluster.
//   node campaign/make-batches.mjs [--max-per-batch 25] [--top 12]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const maxPer = Number(flag('--max-per-batch', 25));
const top = Number(flag('--top', 12));
const clusters = JSON.parse(fs.readFileSync(path.join(here, 'clusters.json'), 'utf8')).clusters.filter((c) => c.sig !== 'timeout').slice(0, top);
const brief = fs.readFileSync(path.join(here, 'AGENT-BRIEF.md'), 'utf8');
const outDir = path.join(here, 'batches');
fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (const c of clusters) {
  const exts = c.extensions.slice(0, maxPer);
  const id = `b${String(++n).padStart(2, '0')}-${c.sig.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`;
  const prompt = `${brief}

## Your batch: ${id}
Failure signature: \`${c.sig}\` (${c.extensions.length} extensions share it; you get ${exts.length}).
Sample error lines:
${c.sample.map((l) => '  ' + l).join('\n')}

Extensions (dirs under ~/Developer/raycast-to-asyar/store/extensions/):
${exts.map((e) => '- ' + e).join('\n')}

Steps:
1. Reproduce on the first extension with rc2asyar. Read the real error.
2. Find the ROOT CAUSE in the shim (packages/api-node, packages/view, cli/rc2asyar.mjs). One fix
   should unlock the whole cluster. Do not special-case extension names.
3. Apply the fix, re-run \`node cli/store-convert.mjs --only ${exts.join(',')} --jobs 3\`.
4. For every extension now converting, smoke-test its first view command through the sidecar
   (python3 /tmp/rc-test.py <command> 10 from shim/out/<id>) and classify READY / ALMOST / SALVAGEABLE / DEAD.
5. Write campaign/reports/${id}.md: the root cause (one paragraph), the diff summary, and one line
   per extension with its class and, for ALMOST, the decisive error line. If nothing could be fixed,
   say so and name what you inspected.
`;
  fs.writeFileSync(path.join(outDir, `${id}.md`), prompt);
}
console.log(`${n} batch prompts → ${outDir}`);
