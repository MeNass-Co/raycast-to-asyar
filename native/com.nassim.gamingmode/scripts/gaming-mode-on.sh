#!/bin/zsh
#
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gaming Mode ON
# @raycast.mode fullOutput
#
# Optional parameters:
# @raycast.icon 🎮
# @raycast.packageName Gaming
# @raycast.argument1 { "type": "dropdown", "placeholder": "mode", "optional": true, "data": [{"title": "Sweep", "value": "sweep"}, {"title": "Dry run", "value": "dry"}] }
#
# Documentation:
# @raycast.description Snapshots what is running, then closes everything except Asyar and GameHub. Use Gaming Mode OFF to restore.
# @raycast.author Nassim

set -uo pipefail
source "${0:A:h}/_gamemode-lib.sh"

DRY=0
[[ "${1:-}" == "dry" ]] && DRY=1

ME="$(id -un)"
FREE_BEFORE="$(free_pct)"

# ---------------------------------------------------------------------------
# 1. SNAPSHOT — record state BEFORE touching anything.
#    Without this, restore is guesswork.
# ---------------------------------------------------------------------------
typeset -a SNAP_APPS
while IFS= read -r app; do
  [[ -n "$app" ]] && SNAP_APPS+=("$app")
done < <(ps -axo comm= -u "$ME" 2>/dev/null \
          | grep '^/Applications/' \
          | sed 's|\(/Applications/[^/]*\.app\)/.*|\1|' \
          | sort -u)

typeset -a SNAP_AGENTS
while IFS= read -r a; do
  [[ -n "$a" ]] && SNAP_AGENTS+=("$a")
done < <(sweepable_agents)

# ---------------------------------------------------------------------------
# 2. BUILD KILL LIST
# ---------------------------------------------------------------------------
typeset -a V_PID V_MB V_NAME
TOTAL_MB=0

# Tab-separate the fields: ps pads columns with runs of spaces, which makes
# naive ${var%% *} splitting silently produce an empty RSS.
while IFS=$'\t' read -r pid rss cmd; do
  [[ -z "$pid" || -z "$rss" ]] && continue
  [[ "$pid" == "$$" || "$pid" == "${PPID:-0}" ]] && continue
  (( rss < 5120 )) && continue                        # under 5 MB, not worth it
  [[ "$cmd" == /System/* || "$cmd" == /usr/* ]] && continue   # launchd respawns these
  [[ "$cmd" == *.appex/* ]] && continue               # widget/extension hosts, respawned on demand
  is_kept "$cmd" && continue

  V_PID+=("$pid"); V_MB+=($(( rss / 1024 )))
  V_NAME+=("$(basename "${cmd%% *}")")
  TOTAL_MB=$(( TOTAL_MB + rss / 1024 ))
done < <(ps -axo pid=,rss=,command= -u "$ME" | awk '{pid=$1; rss=$2; $1=""; $2=""; sub(/^ +/,""); print pid "\t" rss "\t" $0}')

echo "── gaming mode ON ───────────────────────────"
if (( ${#V_PID[@]} == 0 )); then
  echo "  nothing to close — already clean"
else
  for (( i = 1; i <= ${#V_PID[@]}; i++ )); do
    printf '  %6d MB  %s\n' "${V_MB[$i]}" "${V_NAME[$i]}"
  done | sort -rn | head -30
  printf '  ─────\n  %d processes · %d MB (%.1f GB)\n' \
    "${#V_PID[@]}" "$TOTAL_MB" "$(( TOTAL_MB / 1024.0 ))"
fi

if (( DRY )); then
  echo
  echo "  DRY RUN — nothing closed, no snapshot saved."
  echo "  would restore ${#SNAP_APPS[@]} apps · ${#SNAP_AGENTS[@]} agents"
  exit 0
fi

# ---------------------------------------------------------------------------
# 3. COMMIT SNAPSHOT — only once we are certain we will actually sweep.
# ---------------------------------------------------------------------------
printf '%s\n' "${SNAP_APPS[@]}"   > "$STATE_APPS"
printf '%s\n' "${SNAP_AGENTS[@]}" > "$STATE_AGENTS"
{
  echo "swept_at=$(date '+%Y-%m-%d %H:%M:%S')"
  echo "free_before=$FREE_BEFORE"
  echo "procs_killed=${#V_PID[@]}"
  echo "mb_reclaimed=$TOTAL_MB"
} > "$STATE_META"

# ---------------------------------------------------------------------------
# 4. QUIT GUI APPS GRACEFULLY FIRST
#    A TERM to Google Drive mid-upload can leave a partial file. AppleScript
#    "quit" lets apps flush state and finish writes; only holdouts get signals.
# ---------------------------------------------------------------------------
for app in "${SNAP_APPS[@]}"; do
  is_kept "$app" && continue
  name="$(basename "$app" .app)"
  osascript -e "tell application \"$name\" to quit" >/dev/null 2>&1 &
done
wait
sleep 3

# ---------------------------------------------------------------------------
# 5. STOP USER LAUNCH AGENTS so nothing respawns behind us
# ---------------------------------------------------------------------------
UID_NUM="$(id -u)"
for a in "${SNAP_AGENTS[@]}"; do
  case "$a" in
    *claudex*|*cli-proxy*|*asyar*|*Asyar*) continue ;;   # keep launcher (Asyar) + Claude relay alive; Raycast is swept
  esac
  launchctl bootout "gui/$UID_NUM/$a" >/dev/null 2>&1
done

# ---------------------------------------------------------------------------
# 6. SIGNAL THE HOLDOUTS
# ---------------------------------------------------------------------------
for pid in "${V_PID[@]}"; do kill -TERM "$pid" 2>/dev/null; done
sleep 2
for pid in "${V_PID[@]}"; do kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null; done
sleep 1

echo
echo "  snapshot: ${#SNAP_APPS[@]} apps · ${#SNAP_AGENTS[@]} agents"
echo "  free memory ${FREE_BEFORE} → $(free_pct)"
echo "  run 'Gaming Mode OFF' to restore"
