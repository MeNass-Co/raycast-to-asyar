#!/bin/bash
# run-campaign.sh: convert the whole store in the background (survives session restarts), then triage.
#   campaign/run-campaign.sh            # full run
#   campaign/run-campaign.sh --resume   # continue after an interruption
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/shim" || exit 1
LOG="$ROOT/campaign/store-convert.log"
export RC_STORE="$ROOT/store/extensions"
export npm_config_cache="$HOME/.npm-rc2asyar"
export npm_config_fetch_timeout=120000 npm_config_fetch_retries=5
if [ ! -d "$RC_STORE" ] || [ "$(ls "$RC_STORE" | wc -l)" -lt 3000 ]; then echo "store not extracted: $RC_STORE"; exit 1; fi
nohup node cli/store-convert.mjs --jobs 3 --timeout 600000 "$@" > "$LOG" 2>&1 &
echo "campaign pid $! → $LOG"
echo "watch:  tail -f $LOG"
echo "triage: node cli/store-triage.mjs --write ../campaign/clusters.json"
