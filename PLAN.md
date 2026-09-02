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
