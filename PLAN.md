# raycast-to-asyar — plan (2026-09-02)

## Goal (Nassim's words)
1:1 clones of the Raycast store as Asyar-native extensions, AI features included,
through a universal compatibility layer / one-click conversion that does NOT rewrite
extension source. First targets: `messages`, `mail`. Then the whole store.
Third workstream: a true 1:1 Raycast theme for Asyar.

## Verified facts (live, this Mac = MBA)
- Asyar 0.1.1-45 at /Applications/asyar.app, SDK asyar-sdk 4.10.0. Config restored
  from handoff (33 snippets, MCP ai-local, agent, glass theme). FDA already OK
  (chat.db readable by the MCP server → verified by previous session on MBP; re-verify here).
- Extension = two iframes (worker.html always-on, view.html on demand). CSP allows
  'unsafe-inline' 'unsafe-eval' → React runtime fine inside the view iframe.
- Manifest schema is closed (deny_unknown_fields). type "extension", commands
  {id,name,description,mode:view|background,component}, tools {id,name,description,parameters},
  preferences, actions, searchBarAccessory, permissions, permissionArgs, runtimes[bun|claude|uv].
- Host → view: `asyar:view:search` (each keystroke), `asyar:view:submit` (Enter),
  `asyar:view:keydown` for ArrowUp/Down/Left/Right/Enter/Tab only. Escape = host goBack.
  ⌘K = host action drawer; dynamic actions via `actions.registerAction({context: EXTENSION_VIEW})`.
- Services: shell.spawn({program,args}) streams stdout by LINE (tokio lines()); stdin
  param auto-closes; write() must be retried until spawn registered. Program must be an
  absolute path or PATH-resolvable from the GUI env (/opt/homebrew/bin not on PATH → use
  absolute). Trusted binaries per extension (consent dialog once).
- network.fetch (string body, base64 for binary), storage (KV), cache (TTL), clipboard,
  opener.openUrl/openPath, feedback.showHUD/confirmAlert/showProgress, selection,
  interop.launchCommand, statusBar.registerItem (menu-bar), timers, commands.schedule.
- Tools: manifest `tools` + worker `context.getService('tools').registerTool(tool, handler)`.
  Agent invokes via postMessage `asyar:tools:invoke` to the WORKER iframe.
- Raycast extension runtime = Node (child_process, fs, node:sqlite, net). Asyar has none
  in the iframe. Node 26 is at /opt/homebrew/bin/node (has node:sqlite). bun 1.3 lacks node:sqlite.
- Raycast swift tools (`swift:../../swift/contacts`) build fine with CLT only:
  `.build/release/Messages <fn> <jsonArgs>` prints JSON to stdout.
- Codex quota exhausted until Sep 7 04:25 → Fable builds everything this week.
- Raycast 1.104.25 installed here at /Applications/Raycast.app (theme analysis source).

## Architecture — "raycast-shim" (one converter, zero source edits)
Two halves, split by where Raycast code needs Node:

A. **UI half (view iframe)** — `@raycast/api` implemented in React 19 rendering Raycast-
   identical DOM (List/Grid/Detail/Form/ActionPanel/Action/Icon/Color/Image/Toast/
   Keyboard/…), styled with Asyar tokens. Search bar = host search (asyar:view:search),
   Enter/arrows forwarded by host, ⌘K = host drawer fed by ActionPanel items,
   navigation push/pop = internal stack (host Escape → goBack → we intercept via
   viewDeactivated? no: we render our own stack inside one host view and map Escape
   to pop when depth>1 — verify live).

B. **Node half (sidecar)** — every non-UI Raycast API that needs Node (executeSQL,
   runAppleScript, child_process, fs, node-fetch, mailparser, got, execa, swift tools,
   Cache/LocalStorage backing, AI tools' handlers) runs UNMODIFIED in a Node sidecar
   spawned by the worker via shell.spawn(node, [-e bootstrap]) with the extension's
   Node bundle streamed on stdin. JSON-RPC over stdio, one line per message.
   Tools (AI) run entirely in the sidecar; the worker registers manifest tools and
   forwards `asyar:tools:invoke` → sidecar → result.

The converter (`rc2asyar <raycast-ext-dir>`):
1. Parse package.json → manifest.json (id `io.raycast.<name>` style, commands, prefs,
   tools with JSON-schema derived from TS `Input` types via ts type extraction,
   searchBarAccessory from List.Dropdown? no — dropdown rendered in-view; ai.instructions
   → docs/agent-prompt.md + walkthrough).
2. Bundle each command entry (src/<name>.tsx) twice with esbuild:
   - view bundle: platform=browser, `@raycast/api` → shim/ui, Node-only modules → RPC
     proxies that call the sidecar.
   - sidecar bundle: platform=node, `@raycast/api` → shim/node (environment, Cache,
     LocalStorage, getPreferenceValues, AI, Tool), tools/*.ts exported by name.
3. Emit worker.js (tool registration + sidecar supervisor), view.html/view.js (React app),
   manifest.json, assets/, swift binaries if any.
4. Zip → `<id>.asyar`, or write straight into the extensions dir for dev.

Ordering: build the shim against messages + mail, ship both, then run the census over
3248 store extensions and iterate on the long tail (node-fetch/axios/date-fns are all
sidecar-side → free).

## Theme workstream
Analyse Raycast 1.104 live (window capture by CGWindowID + Assets.car + colour picks) →
token-by-token theme.json. Fonts, radii, shadows, list row metrics, accessory colours.
Limits: Asyar themes cannot change spacing/font-size; those need CSS in the shim views.

## Status log
- 22:40 handoff read; RESTORE.sh run; Asyar relaunched with restored config.
- 23:05 SSH mbpn.local OK. Raycast sources sparse-cloned; asyar repo cloned; SDK unpacked.

- 01:50 (03/09) rc2asyar WORKS end-to-end: messages + mail converted (0 edits to src/), both
  installed + enabled, 11 AI tools registered in Asyar's ToolRegistry, DeepSeek answered
  "dernier message de Margotte" correctly after 19 self-directed tool calls through the worker
  sidecar. View: List/Form/Detail render, arrows/Enter/Escape/⌘K OK, contact names + photos via
  AddressBook fallback (Asyar has no Contacts TCC). Fixes that mattered: `file` scheme is denied
  in permissionArgs; bundle line must precede any JSON on stdin; sidecar sends `ready` at boot;
  Cache methods bound (useSyncExternalStore); statusBar item needs string text + icon;
  DeepSeek provider maxTokens 1000000 → 8192 (API rejects >393216).
- Known: Mail.app AppleEvents time out on this Mac (-1712) even from plain osascript → mail
  views show empty; mail tools (search-emails via Envelope Index + ripgrep) work. Not a shim bug.

- 10:50 (03/09) Theme `com.nassim.raycast` live (measured colours, Inter). View CSS on Raycast metrics.
  Raycast ActionPanel mirrored into Asyar's native ⌘K drawer (registerAction, extension_view).
  Mail views render (TCC "control Mail" consent accepted). Form dropdown default fixed.
  DeepSeek maxTokens → 393216 (API ceiling; context 1M). Store: full tarball downloading to
  store/ (git sparse checkout abandoned: 6 GB objects in 42 min); runner store-convert.mjs,
  triage store-triage.mjs, agent brief campaign/AGENT-BRIEF.md. npm registry is slow from here
  (TLS 4-8 s): converter now installs only non-@raycast deps with a shared cache.

## 2026-09-03 — Raycast Pro parity, pass 1 (AI)
- **AI Commands**: `native/ai-commands/seed-ai-commands.py` seeds Raycast's 14 stock AI Commands
  (prompts verbatim from the Raycast binary; input=selection; output replace/copy/HUD) as Asyar
  silent agents `rc-ai-*`, hotkeys ⌘⇧L (Fix Spelling) and ⌘⇧E (Explain). Verified through Asyar's
  silent pipeline (clipboard input → HUD): "I received your message yesterday and I'll respond ASAP."
- **Chat presets**: `seed-presets.py` seeds the 39 official ray.so presets (verbatim instructions,
  `raycast-presets.json`) as chat agents `rc-preset-*`.
- **Blocker**: `selection` input needs Accessibility for `org.asyar.app` (TCC auth_value=0). The
  toggle asks for the admin password → Nassim must flip it once (System Settings → Privacy &
  Security → Accessibility → asyar). Until then the ⌘⇧ commands HUD "Could not read selection".
  (AppleEvents "asyar → System Events" prompt was accepted by me; that one needed no password.)
- **Shim fix (all converted exts)**: Raycast applies a preference's `default` when unset, Asyar
  returns nothing → `prefDefaults` embedded in `__SHIM_CONFIG__` and merged in view/worker
  `prefs()`. Also `prefs()` spread the PreferencesFacade *object* (leaking `proxy`/`values`
  fields into `getPreferenceValues()`, which broke google-translate's HttpsProxyAgent) → now
  spreads `.values`. Google Translate Quick Translate verified live in Asyar (EN+FR rows, detail
  pane, Copy Translation) — screenshot `iCloud temp/asyar-handoff/asyar-google-translate-live.png`.
- Converted-ext install checklist (until the store index does it): copy `out/<id>` to
  `~/Library/Application Support/org.asyar.app/extensions/<id>`; settings.dat
  `extensions.enabled[<id>]=true` + `extensions.consent[<id>]={consentedAt,grandfathered:false,
  permissionArgs,permissions}` (from manifest); `shell_trusted_binaries` row for
  `/opt/homebrew/bin/node`; restart Asyar. Missing consent → `[PermissionGate] BLOCKED`; missing
  trust → in-window "wants to access the terminal" dialog and a 10 s spawn timeout.
- **Translator**: converted `raycast.gebeto.translate` (Google Translate, 6 commands) installed,
  enabled + consented in settings.dat (consent record = `{consentedAt, grandfathered, permissionArgs,
  permissions}` from the manifest; missing consent → `[PermissionGate] BLOCKED`).
- DeepSeek note: v4-flash spends a reasoning budget before answering; with max_tokens 400 one call
  in three hit `finish_reason=length` and returned ''. Asyar sends 393216 so it does not bite there.
  `thinking:{type:"disabled"}` is accepted by the API but Asyar has no way to pass it.

## 2026-09-03 — afternoon
- **The one gate: Accessibility for `org.asyar.app`.** Everything Asyar spawns (osascript, node sidecars)
  runs under Asyar's TCC identity, so without that grant: silent agents cannot read the selection,
  System+ window extras / hide / quit / dismiss-notifications and Search Menu Items all fail with
  "osascript is not allowed assistive access". System+ now HUDs the fix and opens the pane. The toggle
  asks for the admin password → Nassim flips it once; nothing else to change afterwards.
- System+ 1.1: +13 window commands (Toggle Fullscreen, Make Larger/Smaller, Maximize Height/Width,
  Move ←→↑↓, Next/Previous Display, Top/Bottom Center Sixth) = Raycast's full Window Management set
  on top of Asyar's 17 built-ins. Do Not Disturb + Focus Session verified live (DND 1→0→1).
- `native/menu-items`: Raycast-API extension (System Events menu walk, 2 levels, shortcuts shown,
  click to run) converted by rc2asyar → `com.nassim.menu-items`; sidecar renders 63 TextEdit items
  locally; inside Asyar it needs the Accessibility grant above.
- Store: retry wave 3143 ok / 105 fail; fixes shipped for the top clusters (TS-parsed imports,
  rust:/bun: schemes, cheerio-style CJS default via require condition, .wasm loader, legacy
  pasteText/ListSection/ListItem). Full rebuild + publish + index chain running detached
  (`campaign/rebuild-and-publish.sh`, log `campaign/rebuild-and-publish.log`).
- Store rebuild with the fixed converter: **3214 ok / 34 fail / 3248** (99.0%). Publishing to
  `MeNass-Co/asyar-raycast-store` at ~20 releases/min (rate-limit sleeps handled), local builds
  deleted as they go; then `index.json` is pushed. Log: `campaign/rebuild-and-publish.log`.
- Script Commands: `cli/rc-scripts.mjs` converts `# @raycast.*` headers to `# @asyar.*` (title, mode,
  icon emoji, refreshTime, argumentN → argument:N with name/placeholder/required/data). 825/825
  converted into `scripts/raycast/<category>/` (git-ignored, regenerable). Asyar scans one level deep
  → nested folders flattened to `sub--file`. `system` category registered (`script_directories`)
  and indexed: 88 scripts, no InvalidHeader issues.
- messages + mail reinstalled from the current shim (same ids, agent tool bindings intact; 4 + 7 tools
  registered). My Messages view verified live (50 rows) — `iCloud temp/asyar-handoff/asyar-messages-live.png`.
- **Install path from git (no disk transit):** `node shim/cli/rc-install.mjs <id|raycast-name>` reads
  `index.json` from the store repo, downloads the release `.asyar`, checks sha256, unzips into Asyar's
  extensions dir, writes `enabled` + `consent` (from the manifest) into settings.dat **with Asyar
  quit**, trusts the sidecar binaries, relaunches. `--search <text>` lists index entries. Verified
  live with `raycast.peduarte.clickconfetti` (2 commands indexed, no PermissionGate block).
  `publish-index.mjs` is safe to re-run any time (contents-API PUT with sha).
- Converter: optional native modules (electron, canvas, better-sqlite3, proxy-agent, fsevents, `.node`)
  stubbed as empty modules → 3223 ok / 25 fail. Remaining 25 = Swift/Rust helpers not built (8),
  `rust:`/`bun:` imports (7), missing npm packages (lodash/html2pug/ts-reset), 2 registry 404s.
- Swift/Rust cluster: dynamic `await import("swift:…")` is now detected (was `from` only) and
  `rust:` helpers (Windows-only) resolve to rejecting stubs → the 13 Swift/Rust extensions convert;
  Color Picker (Raycast core) installed and verified live (`asyar-color-picker-live.png`).

## 2026-09-03 — store wave closed
- **3242 / 3248 converted (99.8 %), 3242 published** as GitHub Releases in `MeNass-Co/asyar-raycast-store`,
  `index.json` live (contents API, body via `--input`: a 2 MB argv hit E2BIG). Local `shim/out` empty.
- The 6 dead ones and why (not worth more converter work):
  - `comet`: imports `@raycast/utils/dist/handle-error-toast-action`, a private file that no longer exists in @raycast/utils.
  - `date-converter`: imports `@total-typescript/ts-reset` (types-only package, no runtime).
  - `opencode-sessions`: package.json pins `@opencode-ai/sdk ^1.17`, npm resolves 1.18.27 whose `v2` export map has no `createOpencode` at the path esbuild picks (types file) — upstream breakage.
  - `pm2`: `@pm2/blessed` deep-imports `blessed/lib/colors`, not installed (pm2's own optional dep tree).
  - `transform`: `html2pug` is a GitHub dependency shipped without its `dist/` build.
  - `vortex`: deep import `@cashu/cashu-ts/dist/lib/es6/utils`, path removed in cashu-ts 2.9.
- Chains: rebuild-and-publish, after-publish (messages republished with the fixed shim), final-fails
  all finished; the two follow-ups crashed only on the index step (same E2BIG), now fixed and re-run.

## 2026-09-03 evening — System+ window commands, Accessibility, MBP
- Accessibility for asyar granted (TCC=2). ⌘⇧L on a real selection verified: text replaced in place.
- Window commands rewritten around `bin/axwin` (Swift, AX API). Two findings that cost the afternoon:
  1. While the launcher is open, **no process is `frontmost`** (asyar owns the menu bar, loginwindow is
     "front"): the target is the first normal window in CGWindowList z-order whose AX twin has a size.
  2. On the MBA with the lid closed, **AX to the target app dies ~8 s after activation** (-25205 on
     every attribute, even System Events -1719). Not a System+ bug: on the MBP (screen on) the same
     commands move/resize correctly (Top Center Sixth, Move Right, Make Smaller/Larger, Maximize
     Height, Next Display all measured). Window tests belong on the MBP.
- Open: Toggle Fullscreen (AXFullScreen write returns -25200 on TextEdit even when active; probing).
- MBP (`mbpn.local`) synced: repo clone `~/Developer/raycast-to-asyar-mba`, theme active, System+ 1.2,
  Search Menu Items, messages/mail/translate/color-picker from the store index, 55 agents, script
  commands `system` category. `campaign/install-on-mac.sh` reproduces this on any Mac.

## 2026-09-03 night — Lunar theme
- New theme package `theme/com.nassim.lunar` (the 1:1 Raycast theme stays as-is). Lunar rules applied:
  cool near-black surfaces (#0B0D12 → #16192 2), silver text ramp (#ECF0F6 / #96A0B2 / #606A7C),
  ONE accent = Instrument Cyan `rgb(47,214,194)` (caret, primary fill, focus ring, ext icon), moonlit
  selection tint `rgba(196,220,255,.11)` instead of grey, cool soft shadows, cyan haze on the ⌘K popup.
  Dark text on the cyan fill (10.8:1); secondary text 7.3:1; tertiary 3.5:1 (labels only).
- Metrics untouched (Raycast 40 pt rows, Inter, JetBrains Mono). Active on MBA + MBP.
- Shim view.css: last hardcoded greys routed through host tokens, so converted extensions follow any theme.
- Captures + before/after sheet: `iCloud temp/asyar-handoff/theme/lunar-*.png`.
- Switch back to the Raycast look: `appearance.activeTheme = com.nassim.raycast` in settings.dat (Asyar quit).
