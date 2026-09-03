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
| **Empty Trash** | missing | native ext `com.nassim.system-plus` (Finder AppleScript, confirm dialog, pref "warn before emptying") |
| Open Trash | missing | system-plus: `open ~/.Trash` |
| Sleep Displays | missing | system-plus: `pmset displaysleepnow` |
| Show Screen Saver | missing | system-plus: `open -a ScreenSaverEngine` |
| Show Desktop | missing | system-plus: AppleScript `tell application "System Events" to key code 103` (F11 mission control) fallback `open -a Finder` + hide others |
| Hide All Apps Except Frontmost | missing | system-plus: System Events `set visible of every process whose frontmost is false to false` |
| Quit All Apps / Except Frontmost | missing | system-plus: System Events quit loop (skip Finder, asyar) |
| Eject All Disks | missing | system-plus: Finder `eject (every disk whose ejectable is true)` |
| Set Volume 0/25/50/75/100, Turn Volume Up/Down, Toggle Mute | missing | system-plus: `osascript -e 'set volume output volume N'` / `output muted` |
| Toggle System Appearance | missing | system-plus: System Events `tell appearance preferences to set dark mode to not dark mode` |
| Toggle Hidden Files | missing | system-plus: `defaults write com.apple.finder AppleShowAllFiles` + `killall Finder` |
| Toggle Bluetooth | missing | system-plus: needs `blueutil` (brew) → declare as optional; fall back to opening System Settings pane |
| Toggle Stage Manager | missing | system-plus: `defaults write com.apple.WindowManager GloballyEnabled -bool` + restart WindowManager |
| Dismiss Notifications | missing | system-plus: System Events click "Clear All" in Notification Center (best effort) |

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
| Search Menu Items | missing | native ext (System Events menu bar walk) — later |
| Calendar / Reminders / Contacts | store: `calendar`, `apple-reminders`, `contacts` (converted) | campaign |
| Dictionary / Translate | store: `dictionary`, `google-translate` (official ext exists) | campaign |
| Screenshots | store: `screenshots` | campaign |
| Color Picker | store: `color-picker` | campaign |
| Focus | Raycast-only (subscription) | dead |
| Raycast AI / Quick AI | Asyar agents + MCP | done (different UX) |
| Browser Bookmarks / Tabs | Asyar browser ext + store `browser-bookmarks` | campaign |
| Script Commands | Asyar scripts (`@asyar.*` headers) | converter for Raycast script-commands repo — later |

## Distribution without transiting his disk
Asyar installs from GitHub Releases (`asyar publish` = GitHub Release with a `.asyar` zip). The store
campaign output goes to a **GitHub org repo per extension is too many**; instead one repo
`MeNass-Co/asyar-raycast-store` with a Release per extension tag (`<id>@<version>`) holding the
`.asyar`. Build in CI (GitHub Actions on the MBA is not needed): the MBA runs the campaign, but
artifacts are uploaded straight to the Release with `gh release upload` from `shim/out/` and the
local copy deleted. The `--install` path stays for dev only.
