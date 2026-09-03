#!/bin/bash
# after-campaign.sh: wait for store-convert to finish, re-run every "fail" with the current converter,
# then triage. Detached (nohup) so t3 restarts cannot kill it. Log: campaign/after-campaign.log
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT/shim" || exit 1
export RC_STORE="$ROOT/store/extensions" npm_config_cache="$HOME/.npm-rc2asyar" npm_config_fetch_timeout=120000 npm_config_fetch_retries=5
while pgrep -f "cli/store-convert.mjs --jobs 3" >/dev/null; do sleep 20; done
echo "[after] campaign finished $(date)"
FAILED=$(node -e 'const r=require("./store-report.json").results;console.log(Object.entries(r).filter(([,v])=>v.status!=="ok").map(([k])=>k).join(","))')
echo "[after] retrying $(echo "$FAILED" | tr ',' '\n' | grep -c .) failed extensions"
node cli/store-convert.mjs --resume --only "$FAILED" --jobs 3 --timeout 600000
echo "[after] retry done $(date)"
node cli/store-triage.mjs --write ../campaign/clusters.json
echo "[after] triage written $(date)"
