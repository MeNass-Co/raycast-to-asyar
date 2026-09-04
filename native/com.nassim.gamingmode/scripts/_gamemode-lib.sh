#!/bin/zsh
# Shared library for gaming-mode-on / gaming-mode-off.
#
# The pair works like a snapshot/restore, not like a toggle with hardcoded
# lists: gaming-mode-on records what was ACTUALLY running before it sweeps, so
# gaming-mode-off can put back exactly that — nothing more, nothing less. If you
# install a new menu-bar app tomorrow, it is handled with no edit here.

STATE_DIR="$HOME/.local/state/gamemode"
STATE_APPS="$STATE_DIR/apps.txt"
STATE_AGENTS="$STATE_DIR/agents.txt"
STATE_META="$STATE_DIR/meta.txt"

mkdir -p "$STATE_DIR"

# ---------------------------------------------------------------------------
# KEEP — survives the sweep. Matched case-insensitively as a substring of the
# full command path.
#
# Deliberately minimal: Nassim asked for "everything except Raycast and
# GameHub". The rest of this list is the desktop session itself plus the agent
# driving the sweep — killing those does not free useful memory, it just breaks
# the machine or the sweep mid-run.
# ---------------------------------------------------------------------------
KEEP=(
  # The two he asked for.
  "/Applications/Raycast.app"

  # Asyar — the launcher that replaced Raycast, and the process that now RUNS
  # this sweep. Not in the original list because it did not exist yet. It must
  # be kept for the same reason Raycast was: sweeping the launcher kills the
  # sweep itself (asyar is a user LaunchAgent, so `launchctl bootout` takes the
  # whole process group with it) and leaves the Mac half-swept with the restore
  # snapshot unreachable.
  "/Applications/asyar.app"
  "asyar"
  "Raycast"
  "/Applications/GameHub.app"

  # The Claude API relay — Aside talks to its providers through this. Killing
  # it breaks the agent mid-job (it is not restartable from inside Raycast on
  # its own), so it must survive a sweep.
  "cli-proxy-api"
  "com.claudex.cliproxy"

  # The desktop session. Killing these logs you out or freezes the UI.
  "/System/Library/CoreServices/Finder.app"
  "/System/Library/CoreServices/Dock.app"
  "/System/Library/CoreServices/SystemUIServer.app"
  "/System/Library/CoreServices/ControlCenter.app"
  "/System/Library/CoreServices/loginwindow.app"
  "/System/Library/PrivateFrameworks/SkyLight.framework"   # WindowServer
  "/usr/sbin/coreaudiod"                                   # audio

  # The agent + terminals that could run this script are NOT protected anymore —
  # Nassim wants Aside swept too, to free memory for gaming. (claude/terminals
  # stay protected so a sweep raced from a terminal doesn't kill its own shell.)
  "/Applications/Ghostty.app"
  "/Applications/iTerm.app"
  "/Applications/Utilities/Terminal.app"
  "/Applications/Warp.app"
  "claude"
  "/bin/zsh"
  "/bin/bash"
  "/usr/bin/login"

  # --- Not optional. These are correctness/safety, not preference. ---

  # PID 1. Killing launchd panics the machine.
  "/sbin/launchd"

  # A macOS *system extension*, not an app. It cannot be restarted with
  # `open`, so Gaming Mode OFF could never bring it back — killing it would be
  # a one-way trip needing a reboot.
  "/Library/SystemExtensions/"

  # Root privileged helpers. Killing them needs sudo (so it fails anyway) and
  # they are respawned by their own daemons regardless.
  "/Library/PrivilegedHelperTools/"

  # Audio driver + its agent. Kill these and sound dies system-wide until a
  # reboot — including in the game.
  "arkaudiod"
  "ARK.driver"
  "Core Audio Driver"
)

is_kept() {
  local cmd_lower="${1:l}"
  local p
  for p in "${KEEP[@]}"; do
    [[ "$cmd_lower" == *"${p:l}"* ]] && return 0
  done
  return 1
}

# User LaunchAgents we manage. System/Apple agents are left alone — launchd
# respawns them within seconds, so booting them out buys nothing and only risks
# breaking something subtle.
sweepable_agents() {
  launchctl list 2>/dev/null | awk 'NR>1 {print $3}' | grep -vE '^(com\.apple\.|0x)' | sort -u
}

free_pct() {
  memory_pressure 2>/dev/null | awk '/free percentage/ {print $NF}'
}
