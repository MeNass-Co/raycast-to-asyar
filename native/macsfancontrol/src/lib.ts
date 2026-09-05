import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
const osa = (s: string) => run("/usr/bin/osascript", ["-e", s]);
export const BUNDLE_ID = "com.crystalidea.macsfancontrol";
export async function ensureRunning(): Promise<void> {
  await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
}
/** Menu bar menu (probed 2026-09-05): "Fan presets:" → "Automatic", "Full blast". The status item title is the temperature, so address it by index. */
export async function clickPreset(item: "Automatic" | "Full blast"): Promise<void> {
  await osa(`tell application "System Events" to tell process "Macs Fan Control"
  click menu bar item 1 of menu bar 2
  delay 0.4
  click menu item "${item}" of menu 1 of menu bar item 1 of menu bar 2
end tell`);
}
export async function activePreset(): Promise<string> {
  try { return await run("/usr/bin/defaults", ["read", BUNDLE_ID, "ActivePreset"]); } catch { return ""; }
}
