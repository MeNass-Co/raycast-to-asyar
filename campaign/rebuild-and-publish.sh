#!/bin/bash
# rebuild-and-publish.sh: after the retry wave, rebuild the WHOLE store with the current converter (every
# earlier build predates the preference-defaults fix), triage, publish every ok build as a GitHub Release
# (deleting the local build), then push index.json. Detached; log: campaign/rebuild-and-publish.log
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT/shim" || exit 1
export RC_STORE="$ROOT/store/extensions" npm_config_cache="$HOME/.npm-rc2asyar" npm_config_fetch_timeout=120000 npm_config_fetch_retries=5
while pgrep -f "campaign/after-campaign.sh" >/dev/null; do sleep 20; done
echo "[rebuild] start $(date)"
node cli/store-convert.mjs --jobs 3 --timeout 600000
echo "[rebuild] done $(date)"
node cli/store-triage.mjs --write ../campaign/clusters.json
echo "[publish] start $(date)"
node cli/publish-release.mjs --all-ok --skip-published
echo "[publish] done $(date)"
node cli/publish-index.mjs
echo "[index] done $(date)"
