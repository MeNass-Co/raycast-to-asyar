#!/bin/bash
# after-publish.sh: once rebuild-and-publish.sh ends, republish the two extensions whose morning releases
# predate the converter fixes (messages was skipped by --skip-published), then push index.json again.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT/shim" || exit 1
while pgrep -f "campaign/rebuild-and-publish.sh" >/dev/null; do sleep 30; done
echo "[after-publish] start $(date)"
node cli/publish-release.mjs raycast.thomaslombart.messages
node cli/publish-index.mjs
echo "[after-publish] done $(date)"
