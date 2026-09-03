#!/bin/bash
# install-on-mac.sh: bring a Mac's Asyar to today's state (run ON that Mac, from the repo checkout).
#   theme (com.nassim.raycast, activated) · System+ · Search Menu Items · converted messages/mail/translate/
#   color-picker from the GitHub store · 14 AI Commands + 39 presets (DeepSeek provider must exist) ·
#   Raycast script commands (system category). settings.dat is edited with Asyar quit.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; export PATH=/opt/homebrew/bin:$PATH
APP="$HOME/Library/Application Support/org.asyar.app"; EXT="$APP/extensions"
say(){ echo "[install] $*"; }
[ -d "$ROOT/shim/node_modules" ] || (cd "$ROOT/shim" && npm install --no-audit --no-fund --loglevel=error)

# 1. builds (native)
(cd "$ROOT/native/com.nassim.systemplus" && node build.mjs >/dev/null) && say "System+ built (axwin compiled)"
(cd "$ROOT/shim" && node cli/rc2asyar.mjs ../native/menu-items --id com.nassim.menu-items >/dev/null 2>&1) && say "menu-items built"
(cd "$ROOT/shim" && node cli/rc-scripts.mjs /tmp/sc-repo/script-commands-master "$ROOT/scripts/raycast" >/dev/null 2>&1) || true

# 2. quit Asyar
pgrep -x asyar >/dev/null && { osascript -e 'tell application "asyar" to quit' 2>/dev/null; sleep 2; pkill -x asyar 2>/dev/null; sleep 1; }

# 3. copy local extensions + theme
mkdir -p "$EXT"
for pair in "theme/com.nassim.raycast:com.nassim.raycast" "native/com.nassim.systemplus/dist:com.nassim.systemplus" "shim/out/com.nassim.menu-items:com.nassim.menu-items"; do
  src="$ROOT/${pair%%:*}"; id="${pair##*:}"; rm -rf "$EXT/$id"; cp -R "$src" "$EXT/$id"; say "copied $id"
done

# 4. settings.dat: enable + consent + activeTheme ; DB: trusted binaries, agents, script dir
python3 - "$APP" "$ROOT" <<'PY'
import json, os, sys, time, sqlite3, subprocess
APP, ROOT = sys.argv[1], sys.argv[2]
p = os.path.join(APP, 'settings.dat'); d = json.load(open(p)); s = d['settings']
ext = s.setdefault('extensions', {}); ext.setdefault('enabled', {}); ext.setdefault('consent', {})
con = sqlite3.connect(os.path.join(APP, 'asyar_data.db'))
for E in ('com.nassim.raycast', 'com.nassim.systemplus', 'com.nassim.menu-items'):
    m = json.load(open(os.path.join(APP, 'extensions', E, 'manifest.json')))
    ext['enabled'][E] = True
    if m.get('type') != 'theme':
        ext['consent'][E] = {'consentedAt': int(time.time()*1000), 'grandfathered': False, 'permissionArgs': m.get('permissionArgs', {}), 'permissions': m.get('permissions', [])}
        for b in m.get('permissionArgs', {}).get('shell:spawn', []):
            con.execute("insert or ignore into shell_trusted_binaries(extension_id,binary_path,trusted_at) values(?,?,strftime('%s','now'))", (E, b))
s.setdefault('appearance', {})['activeTheme'] = 'com.nassim.raycast'
json.dump(d, open(p, 'w'), indent=2)
sd = os.path.join(ROOT, 'scripts', 'raycast', 'system')
if os.path.isdir(sd): con.execute("insert or ignore into script_directories(path,added_at) values(?,?)", (sd, int(time.time()*1000)))
con.commit()
prov = s.get('ai', {}).get('providers', {})
print('[install] settings written; theme active; DeepSeek provider present:', 'custom_8ee25dd7' in prov)
PY

# 5. agents (need the DeepSeek provider id used in the seed scripts)
python3 "$ROOT/native/ai-commands/seed-ai-commands.py" && python3 "$ROOT/native/ai-commands/seed-presets.py"

# 6. converted store extensions from GitHub (rc-install quits/relaunches Asyar itself)
(cd "$ROOT/shim" && node cli/rc-install.mjs raycast.thomaslombart.messages raycast.yug2005.mail raycast.gebeto.translate raycast.thomas.colorpicker)
say "done — Asyar relaunched. Grant Accessibility to asyar if not already."
