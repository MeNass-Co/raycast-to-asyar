# Store campaign — agent brief (DeepSeek workers)

Goal: make `rc2asyar` convert every Raycast store extension. You work on ONE batch of
extensions. You never edit an extension's `src/`. Every fix goes into the shim
(`~/Developer/raycast-to-asyar/shim/packages/**` or `cli/rc2asyar.mjs`).

Commands:
- Convert one: `cd ~/Developer/raycast-to-asyar/shim && node cli/rc2asyar.mjs ../store/extensions/<name> --id raycast.<owner>.<name>`
- Batch report: `node cli/store-convert.mjs --only a,b,c --jobs 3` → `shim/store-report.json`
- Sidecar smoke test (no Asyar needed): `python3 /tmp/rc-test.py <command> 10` from the out dir,
  or `python3 /tmp/rc-tool.py <extId> <toolId> '<json>' 30` for AI tools.

Taxonomy for each extension (write it in your report, one line per extension):
- READY: converts, sidecar renders the first view command (or runs a no-view command) with no error.
- ALMOST: converts, but a runtime error appears in the sidecar log. Quote the shortest decisive line.
- SALVAGEABLE: build fails on a missing shim API (unknown `@raycast/api` export, `swift:` package,
  Node-only module in the view). Name the export.
- DEAD: needs Raycast-only infra (Raycast AI Pro models, Raycast account OAuth, BrowserExtension, WindowManagement).

Rules: do not install into Asyar (`--install`) and never restart Asyar; the main session owns the
live app. Do not touch `theme/`. Report in `campaign/reports/<batch>.md`. If you find nothing to
fix in a batch, say so and name the extensions you inspected.
