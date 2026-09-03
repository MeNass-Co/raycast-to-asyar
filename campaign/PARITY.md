# Raycast → Asyar parity map (2026-09-03)

Goal: every Raycast native capability reachable in Asyar, looking and feeling native.
Three delivery channels, in order of preference:
1. **Asyar built-in** already covers it → nothing to do.
2. **Native Asyar extension** (Tier 2, Svelte/TS, worker-only when no UI) → ship in `native/`.
3. **Converted store extension** via rc2asyar → the campaign.

## Raycast System commands (manual.raycast.com/system-commands) → status
| Raycast command | Asyar | Delivery |
|---|---|---|
| Sleep, Restart, Shut Down, Log Out, Lock Screen | built-in `system` (sleep, hibernate, lockScreen, logOut, restart, shutDown) | done |
| **Empty Trash** | ✅ System+ | `com.nassim.systemplus` (Finder AppleScript, native confirm dialog, pref "warn before emptying") — live-verified |
| Open Trash | ✅ System+ | system-plus: `open ~/.Trash` |
| Sleep Displays | ✅ System+ | system-plus: `pmset displaysleepnow` |
| Show Screen Saver | ✅ System+ | system-plus: `open -a ScreenSaverEngine` |
| Show Desktop | ✅ System+ | system-plus: AppleScript `tell application "System Events" to key code 103` (F11 mission control) fallback `open -a Finder` + hide others |
| Hide All Apps Except Frontmost | ✅ System+ | system-plus: System Events `set visible of every process whose frontmost is false to false` |
| Quit All Apps / Except Frontmost | ✅ System+ | system-plus: System Events quit loop (skip Finder, asyar) |
| Eject All Disks | ✅ System+ | system-plus: Finder `eject (every disk whose ejectable is true)` |
| Set Volume 0/25/50/75/100, Turn Volume Up/Down, Toggle Mute | ✅ System+ | system-plus: `osascript -e 'set volume output volume N'` / `output muted` |
| Toggle System Appearance | ✅ System+ | system-plus: System Events `tell appearance preferences to set dark mode to not dark mode` |
| Toggle Hidden Files | ✅ System+ | system-plus: `defaults write com.apple.finder AppleShowAllFiles` + `killall Finder` |
| Toggle Bluetooth | ✅ System+ (blueutil, else opens the Bluetooth pane) | system-plus: needs `blueutil` (brew) → declare as optional; fall back to opening System Settings pane |
| Toggle Stage Manager | ✅ System+ | system-plus: `defaults write com.apple.WindowManager GloballyEnabled -bool` + restart WindowManager |
| Dismiss Notifications | ✅ System+ | system-plus: System Events click "Clear All" in Notification Center (best effort) |

## Other Raycast core extensions → Asyar
| Raycast | Asyar | Gap |
|---|---|---|
| Clipboard History | built-in | none |
| Snippets | built-in | none |
| Quicklinks | built-in (portals) | none |
| Calculator | built-in | none |
| File Search | built-in | none |
| Window Management | built-in | none |
| Floating Notes / Notes | built-in notes + sticky | none |
| Emoji & Symbols | official ext `org.asyar.emoji` | none |
| Kill Process | official ext `org.asyar.kill-process` | none |
| Search Menu Items | `com.nassim.menu-items` (native/menu-items, Raycast-API ext converted by rc2asyar; 2-level menu walk, shortcuts, click to run) | done — needs Accessibility for asyar |
| Calendar / Reminders / Contacts | store: `calendar`, `apple-reminders`, `contacts` (converted) | campaign |
| Dictionary / Translate | `raycast.gebeto.translate` converted + installed (live-verified), `raycast.drchai.dictionary` built | done |
| Screenshots | store: `screenshots` | campaign |
| Color Picker | store: `color-picker` | campaign |
| Focus | System+ `Toggle Do Not Disturb`, `Start/End Focus Session` (DND via signed Shortcuts, hides other apps, timer + notification) | done (no website blocking) |
| Raycast AI / Quick AI / AI Commands / Presets | Asyar agents: 14 stock AI Commands (`rc-ai-*`, silent, ⌘⇧L/⌘⇧E) + 39 ray.so presets (`rc-preset-*`) seeded, DeepSeek key | done — `selection` input needs Accessibility for asyar (Nassim: one toggle) |
| Browser Bookmarks / Tabs | Asyar browser ext + store `browser-bookmarks` | campaign |
| Script Commands | `shim/cli/rc-scripts.mjs`: 825/825 scripts of raycast/script-commands converted (`scripts/raycast/<category>/`, flattened one level); `system` category registered in Asyar and indexed (88) | done |

## Distribution without transiting his disk
Asyar installs from GitHub Releases (`asyar publish` = GitHub Release with a `.asyar` zip). The store
campaign output goes to a **GitHub org repo per extension is too many**; instead one repo
`MeNass-Co/asyar-raycast-store` with a Release per extension tag (`<id>@<version>`) holding the
`.asyar`. Build in CI (GitHub Actions on the MBA is not needed): the MBA runs the campaign, but
artifacts are uploaded straight to the Release with `gh release upload` from `shim/out/` and the
local copy deleted. The `--install` path stays for dev only.

## Raycast Pro → Asyar (2026-09-03)
| Pro feature | Asyar | Status |
|---|---|---|
| Raycast AI (Quick AI, AI Chat, AI Commands, Presets, AI Extensions/tools) | agents (chat + silent) on his DeepSeek key; converted store tools callable by agents; MCP servers | done |
| Always-on ChatGPT / model picker | provider list per agent (DeepSeek v4 flash/pro/vision) | done (his keys) |
| Translator | Google Translate converted (`Quick Translate`, `Translate`, `Translate Form`, instant copy/paste) + `Translate to French/English` silent agents | done |
| Cloud Sync | Asyar `cloud_sync_*` tables exist (E2EE) — not configured | later |
| Clipboard History, Snippets, Quicklinks, Notes, Window Management, Calculator, File Search | built-in | done |
| Custom Themes | `com.nassim.raycast` 1:1 theme (measured) | done |
| Focus | System+ DND + Focus Session | partial (no app/website blocking) |
| Window Management extras (Next/Previous Display, Toggle Fullscreen, Make Larger/Smaller, Maximize Height/Width, Move, Center Sixths) | System+ 1.1 | done — needs Accessibility for asyar |
