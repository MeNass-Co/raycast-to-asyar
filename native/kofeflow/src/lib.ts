import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
const osa = (s: string) => run("/usr/bin/osascript", ["-e", s]);

export const BUNDLE_ID = "com.rahulmfg.kofeflow";
export async function ensureRunning(): Promise<void> {
  await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
}
/** Kofe Flow's menu bar popover: three buttons in its scroll area = Start/Resume, Pause, Break (probed 2026-09-05). */
export type Button = 1 | 2 | 3;
export async function pressPopoverButton(n: Button): Promise<string> {
  return osa(`tell application "System Events" to tell process "Kofe Flow"
  click menu bar item 1 of menu bar 2
  delay 0.6
  click button ${n} of scroll area 1 of group 1 of window 1
  delay 0.5
  set s to value of static text 2 of scroll area 1 of group 1 of window 1
  key code 53
  return s
end tell`);
}
/** Current status line ("Deep work is running.", "Focus is paused.", …). */
export async function status(): Promise<string> {
  return osa(`tell application "System Events" to tell process "Kofe Flow"
  click menu bar item 1 of menu bar 2
  delay 0.6
  set s to value of static text 2 of scroll area 1 of group 1 of window 1
  key code 53
  return s
end tell`);
}
