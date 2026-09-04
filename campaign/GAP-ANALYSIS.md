# Asyar vs native Raycast — gap analysis (2026-09-04)

Scope: aesthetics at every level (except the Settings screen) and features. Excludes what batch 1-4 already shipped
(native Liquid Glass, periwinkle Lunar + Lunar Light, SF Pro, Raycast icons, "Command"/"AI Extension" labels, glass
pills, show-more removed, scripts hidden, auto-dismiss feedback, clipboard blob: preview, per-extension AI icons,
alias symbols, trigger search, no menu bar). Citations are file:line in `asyar/asyar-launcher/` or `theme/`.

## A. Aesthetic gaps (excluding Settings)

| Surface | Gap | Fix | Effort | Prio |
|---|---|---|---|---|
| Glass corners | `NSGlassEffectView` radius = **12px** but the window mask = **20px** (`window.rs:48` vs `:782`). Each corner leaks a wedge; only the CSS tint covers it, so the corners lose the real refractive glass. | `12.0_f64` → `20.0_f64` | S | **P1** |
| ⌘K action panel | Every theme ships a hand-tuned `--shadow-popup` with the Raycast `inset 0 1px 0` top rim, but the panel reads `--shadow-launcher-popup`, which is NOT themeable (absent from `THEME_VAR_NAMES`, `themeVariables.ts`). So the panel never gets the rim. | Point `.launcher-popup` at `--shadow-popup` (1 line, `style.css:774`) | S | **P1** |
| ⌘K panel | **No open/close animation** — instant mount/unmount. A ready `popupScale` (120ms, scale 0.96) sits unused in `lib/transitions.ts:35`. | Apply `popupScale` | S | **P1** |
| Window shell | No 1px light top rim (Raycast signature). Nothing draws a CSS shadow on `.app-root`/`html`. | Add inset top-rim shadow to the shell | S | P2 |
| List row | Title and subtitle are **both 13px** (`style.css:858`, `LauncherListRow.svelte:91`) — no size hierarchy; Raycast differentiates. | Subtitle → `--font-size-sm` (12) + `--text-tertiary` | S | P2 |
| ⌘K panel | Section titles are computed (`groupActionsForDisplay` returns `category`) then thrown away; only a hairline divider survives (`ActionListPopup.svelte:174`). Raycast shows the titles. | Render `category` | S | P2 |
| ⌘K panel | No **submenus** — `ApplicationAction` is flat (`actionService.svelte.ts:69`). | Add a children field + drill-in | M | P3 |
| Toasts | No style variants (Success/Failure/Animated), no action buttons, **never auto-dismiss** (`ToastHost.svelte`). Severity + 5s auto-dismiss live on the separate `FeedbackBar` instead. Raycast's toast carries all three. | Add variants + auto-dismiss to the toast | M | P2 |
| ⌘K panel glass | `.launcher-popup` stacks an 80% fill + `blur(60px) saturate(200%)` ON TOP of the native glass (`style.css:769`) — reads muddy. | Drop the CSS blur, let the native glass show | S | P2 |
| Motion (whole shell) | Summon, dismiss, grow, shrink are all hard cuts (`setFrame … animate: NO`, alpha flip). Raycast animates. Window grow is deliberate (atomic-commit engineering); the cheap wins are the ⌘K panel and a summon fade. | Panel + summon animation | S-M | P2 |
| Window grow | Window is binary 480/96 and cropped; Raycast grows the panel row-by-row with the result count. | Animated height driven by row count | L | P3 |
| Colours (light) | `colorOf` defaults to the **dark** variant, so a light-theme extension renders dark-mode `Color.*` (`image.tsx:10`). Now that Lunar Light exists this is visible. | Pass the resolved appearance | S | P2 |
| Cleanups | Satoshi font ships and is used nowhere; Lunar registers 5 Inter faces it never selects; `#f78c6c` syntax colour is theme-blind (`style.css:1774`); app-icon `border-radius:4px` shaves full-bleed icons (`LauncherListRow.svelte:137`). | Delete dead font weight; fix the two colours | S | P3 |

## B. Feature gaps

**Missing outright**
- **Fallback commands** — no "no results → offer these" list. Only a single hardcoded "Search files for X" row.
- **"Suggestions" section header** — frecency ranking exists (`ranker.rs`, 6 tiers) but the top hits are not headered; sections are only Scripts / Agents / Commands.
- **"Files" section in root** — one synthetic row, not a Files section (`file_search_fallback.rs`).
- **Multi-display window moves** — 16 presets, but no next/previous-display command.
- **Snippet placeholders** — `{cursor}`, `{snippet}` nesting, and argument prompts are absent; so is snippet **export** and **folders**.
- **Quicklink browser/app picker** and per-quicklink default argument.
- **Clipboard retention window** — history is unbounded; only Clear trims it.
- **Dictation, Translator, Emoji picker, Screenshots search, Menu-items search, Focus sessions** — none.

**Partial / different shape**
- **File content search** is an explicit "Search Everywhere" action (mdfind), not ambient.
- **Script modes** — only `inline` is wired; `silent`/`compact`/`fullOutput` are parsed and stored, not rendered.
- **Color Picker** and **Kill Process** exist as Rust + SDK capabilities but have **no built-in command UI**.
- **SDK view gaps that break real extensions** (highest user impact):
  - `Action.PickDate` silently returns `null` (`app.tsx:131`) — snooze/schedule actions look like they fire, set nothing. Worst kind of bug.
  - `Form.FilePicker` is a "Paste a path…" text box — no dialog, no drag-drop (`form.tsx:74`).
  - `searchBarPlaceholder` can't be set at all (platform gap) — every list loses its guiding placeholder.
  - Search-bar dropdown flattens section headers and drops item icons (`app.tsx:79`).
  - Infinite scroll advances only on keyboard selection, never the mouse wheel (`app.tsx:170`).
  - Quick Look (⌘Y) previews images only; PDF/doc/video → empty overlay.
  - `AI.ask` throws (no provider wired); `Action.CreateSnippet` is a silent no-op.
  - MenuBarExtra disabled by policy — **intentional** (Nassim wants no menu bar).

**Present in Asyar, NOT in Raycast** (worth keeping in mind): first-class MCP client, AI extension builder,
runs tracker, E2EE per-category cloud sync, encryption at rest + secret redaction, sticky notes as real OS windows,
manifest-declared walkthrough habit system, timers, and the Raycast importer.

## C. Top 10 next moves (visible impact ÷ effort)

1. **Glass corner radius 12 → 20** — the corners stop leaking. One token. (S)
2. **Point `.launcher-popup` at `--shadow-popup`** — the ⌘K panel gets the Raycast top rim, per theme. (S)
3. **Animate the ⌘K panel** with the already-written `popupScale`. (S)
4. **Fix `Action.PickDate`** — stops silent data loss in reminder/task/snooze extensions. (S)
5. **Row title/subtitle size hierarchy** — subtitle to 12px + tertiary. (S)
6. **Render action-panel section titles** — the data already exists. (S)
7. **`colorOf` light/dark fix** — light-theme extensions stop showing dark colours. (S)
8. **Auto-dismiss toasts + Success/Failure variants.** (M)
9. **Files section + Suggestions header** in root search. (M)
10. **`Form.FilePicker` native dialog** and a **clipboard retention** setting. (M)

Stretch, if we chase Raycast's signature: animate the window height with the result count (L).
