#!/bin/bash
# final-fails.sh: after the swift batch, re-run every remaining fail with the current converter, then
# publish whatever became ok (--skip-published keeps earlier releases untouched) and refresh the index.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT/shim" || exit 1
export RC_STORE="$ROOT/store/extensions" npm_config_cache="$HOME/.npm-rc2asyar" npm_config_fetch_timeout=120000 npm_config_fetch_retries=5
while pgrep -f "store-convert.mjs --resume" >/dev/null; do sleep 20; done
FAILED=$(node -e 'const r=require("./store-report.json").results;console.log(Object.entries(r).filter(([,v])=>v.status!=="ok").map(([k])=>k).join(","))')
echo "[final] retrying: $FAILED"
node cli/store-convert.mjs --resume --only "$FAILED" --jobs 2 --timeout 900000
echo "[final] convert done $(date)"
while pgrep -f "campaign/after-publish.sh" >/dev/null; do sleep 30; done
node cli/publish-release.mjs --all-ok --skip-published
node cli/publish-index.mjs
echo "[final] done $(date)"
