import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
const osa = (s: string) => run("/usr/bin/osascript", ["-e", s]);
const q = (s: string) => s.replace(/"/g, '\\"');

/** f.lux has no scripting dictionary or URL scheme: drive its menu bar menu through Accessibility. */
export async function clickTop(item: string): Promise<void> {
  await osa(`tell application "System Events" to tell process "Flux"
  click menu bar item 1 of menu bar 2
  delay 0.3
  click menu item "${q(item)}" of menu 1 of menu bar item 1 of menu bar 2
end tell`);
}
export async function clickSub(parent: string, item: string): Promise<void> {
  await osa(`tell application "System Events" to tell process "Flux"
  click menu bar item 1 of menu bar 2
  delay 0.3
  click menu item "${q(item)}" of menu 1 of menu item "${q(parent)}" of menu 1 of menu bar item 1 of menu bar 2
end tell`);
}
/** Names of the items under a submenu, so we can find e.g. the enabled/disable entry. */
export async function subItems(parent: string): Promise<string[]> {
  const out = await osa(`tell application "System Events" to tell process "Flux"
  click menu bar item 1 of menu bar 2
  delay 0.3
  set n to name of every menu item of menu 1 of menu item "${q(parent)}" of menu 1 of menu bar item 1 of menu bar 2
  key code 53
  return n
end tell`);
  return out.split(", ").map((s) => s.trim()).filter((s) => s && s !== "missing value");
}
export async function ensureRunning(): Promise<void> {
  await run("/usr/bin/open", ["-g", "-a", "Flux"]);
}
