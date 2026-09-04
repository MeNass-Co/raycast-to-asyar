#!/bin/zsh
#
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Gaming Mode OFF
# @raycast.mode fullOutput
#
# Optional parameters:
# @raycast.icon 🔄
# @raycast.packageName Gaming
#
# Documentation:
# @raycast.description Brings the Mac back up like a fresh login: reopens every startup item plus whatever Gaming Mode ON closed.
# @raycast.author Nassim

set -uo pipefail
source "${0:A:h}/_gamemode-lib.sh"

UID_NUM="$(id -u)"

echo "── gaming mode OFF ──────────────────────────"
[[ -f "$STATE_META" ]] && { sed 's/^/  /' "$STATE_META"; echo "  ─────"; }

# ---------------------------------------------------------------------------
# 1. LAUNCH AGENTS
#    From the snapshot when we have one; otherwise fall back to every user
#    LaunchAgent on disk, which is what login would have started anyway.
# ---------------------------------------------------------------------------
typeset -a WANT_AGENTS
if [[ -s "$STATE_AGENTS" ]]; then
  while IFS= read -r a; do [[ -n "$a" ]] && WANT_AGENTS+=("$a"); done < "$STATE_AGENTS"
else
  for p in "$HOME/Library/LaunchAgents"/*.plist(N); do
    WANT_AGENTS+=("${${p:t}%.plist}")
  done
fi

agents_up=0
for a in "${WANT_AGENTS[@]}"; do
  launchctl list "$a" >/dev/null 2>&1 && continue          # already up
  for d in "$HOME/Library/LaunchAgents" "/Library/LaunchAgents"; do
    if [[ -f "$d/$a.plist" ]]; then
      launchctl bootstrap "gui/$UID_NUM" "$d/$a.plist" >/dev/null 2>&1 && (( agents_up++ ))
      break
    fi
  done
done

# ---------------------------------------------------------------------------
# 2. BUILD THE APP LIST — union of:
#      a) macOS login items  (the "like a restart" part, always available)
#      b) the Gaming Mode ON snapshot (catches apps that were open but are not
#         login items, e.g. Things3, Noir, Jomo)
#    A union means OFF still does the right thing even with no snapshot at all.
# ---------------------------------------------------------------------------
typeset -A SEEN
typeset -a WANT_APPS

add_app() {
  local p="$1"
  [[ -z "$p" || ! -d "$p" ]] && return
  [[ -n "${SEEN[$p]:-}" ]] && return
  SEEN[$p]=1
  WANT_APPS+=("$p")
}

# (a) login items. Ask System Events for the PATH, not the name: several items
# are nested helpers whose display name does not match any bundle at the top
# level (e.g. "BackdropWallpaper" actually lives inside Backdrop.app/Contents/
# Resources/). Guessing /Applications/<name>.app silently misses those.
while IFS= read -r p; do
  p="${p## }"; p="${p%% }"
  # System Events returns "missing value" for items whose target is gone
  # (uninstalled app, or a login item registered by a since-removed helper).
  [[ -z "$p" || "$p" == "missing value" ]] && continue
  # Prefer the outer .app: launching the nested helper directly often fails,
  # and opening the parent starts the helper the same way login does.
  outer="${p%%.app/Contents/*}.app"
  if [[ "$outer" != "$p" && -d "$outer" ]]; then
    add_app "$outer"
  else
    add_app "$p"
  fi
done < <(osascript -e 'tell application "System Events" to get the path of every login item' 2>/dev/null | tr ',' '\n')

# (b) snapshot (current, else the .last we rotated) — already absolute paths
for f in "$STATE_APPS" "$STATE_APPS.last"; do
  [[ -s "$f" ]] || continue
  while IFS= read -r app; do add_app "$app"; done < "$f"
  break
done

# ---------------------------------------------------------------------------
# 3. REOPEN — hidden, staggered so 20 cold starts do not thrash the disk.
# ---------------------------------------------------------------------------
# Snapshot which bundles are live ONCE, as literal strings. pgrep is unusable
# here: these paths contain spaces and parentheses ("CleanShot X.app",
# "Rize Helper (GPU).app"), so -f mis-parses them and -fF does not substring
# match a full command line. An associative array is exact and costs one ps.
typeset -A LIVE
while IFS= read -r b; do [[ -n "$b" ]] && LIVE[$b]=1; done < <(
  ps -axo comm= -u "$(id -un)" | sed -n 's|\(.*\.app\)/Contents/.*|\1|p' | sort -u
)

apps_up=0
typeset -a failed
for app in "${WANT_APPS[@]}"; do
  name="${${app:t}%.app}"
  # Never bring Raycast back: Asyar replaced it and both grab ⌥Space, so a
  # restored Raycast steals the hotkey (Nassim needed two presses, 04/09).
  case "$name" in Raycast|"Raycast Beta") continue ;; esac
  [[ -n "${LIVE[$app]:-}" ]] && continue                  # already running
  if open -g -j -a "$app" >/dev/null 2>&1; then
    (( apps_up++ ))
  else
    failed+=("$name")
  fi
  sleep 0.4
done

sleep 2

echo "  reopened $apps_up apps · $agents_up agents"
(( ${#failed[@]} )) && echo "  could not start: ${(j:, :)failed}"
echo "  free memory now $(free_pct)"

# Snapshot consumed. Keep a copy, drop the live one so a second OFF cannot
# double-launch — the login-item path above still works on its own.
for f in "$STATE_APPS" "$STATE_AGENTS" "$STATE_META"; do
  [[ -f "$f" ]] && mv "$f" "$f.last" 2>/dev/null
done
