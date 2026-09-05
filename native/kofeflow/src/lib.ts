import { environment } from "@raycast/api";
import { execFile } from "node:child_process";
import path from "node:path";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out, err) => (e ? rej(new Error(String(err || e.message).trim())) : res(String(out).trim()))));

export const BUNDLE_ID = "com.rahulmfg.kofeflow";

/**
 * Kofe Flow (4.7) has no URL scheme, no scripting dictionary and its App Intents are not exposed.
 * Its menu-bar popover is not reachable through Accessibility (0 AX windows, off-screen CG layer).
 * The only scriptable surface is the **Dashboard window** (tabs Timer / Analytics / Settings), which the
 * app opens on launch and `open -g -b` re-opens without stealing focus. Timer-tab layouts (probed 2026-09-05),
 * anonymous action buttons in document order, the wide one first:
 *   running        "Deep work is running."   [Pause]
 *   paused         "Focus is paused."        [Resume, Take a break, Resume]
 *   break          "Take a short break."     [Pause break, Skip break → fresh focus]
 *   break paused   "Break is paused."        [Resume break, Skip break]
 *   break complete "Break complete"          [Start focus, …]  (no tabs on that screen)
 * Reading the tree through AppleScript takes 2–3 s; assets/kofeax (Swift, AX API) does it in ~0.2 s.
 */
type Btn = { help: string; desc: string; w: number; x: number; index: number };
export type Screen = { texts: string[]; buttons: Btn[] };

const KOFEAX = path.join(environment.assetsPath, "kofeax");

async function ax(args: string[]): Promise<Screen> {
  const out = await run(KOFEAX, args);
  const d = JSON.parse(out) as { texts: string[]; buttons: Omit<Btn, "index">[] };
  return { texts: d.texts.filter((t) => t && t !== "Kofe Flow"), buttons: d.buttons.map((b, i) => ({ ...b, index: i + 1 })) };
}

export async function ensureWindow(): Promise<void> {
  try {
    await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
  } catch {
    throw new Error("Kofe Flow is not installed on this Mac");
  }
  for (let i = 0; i < 12; i++) {
    try { await ax(["read"]); return; } catch { /* window not up yet */ }
    if (i === 4) await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Kofe Flow dashboard window did not open");
}

export const readScreen = () => ax(["read"]);
/** Anonymous action buttons in document order: [wide primary, small…]. */
export const actions = (s: Screen) => s.buttons.filter((b) => !b.help && b.desc === "button");
export const primary = (s: Screen) => actions(s)[0];
export const secondary = (s: Screen, n: number) => actions(s)[n];

export async function clickIndex(index: number): Promise<Screen> {
  return ax(["click", String(index)]);
}
/** Make sure the Timer tab is showing (tabs are absent on the "Break complete" screen — that is fine). */
export async function showTimerTab(s: Screen): Promise<Screen> {
  const tab = s.buttons.find((b) => b.help === "Timer");
  return tab ? clickIndex(tab.index) : s;
}

export const statusOf = (s: Screen) => s.texts.slice(0, 2).join(" ") || "no status";
export const isRunning = (s: Screen) => /running/i.test(statusOf(s));
export const isPaused = (s: Screen) => /focus is paused/i.test(statusOf(s));
export const isBreakDone = (s: Screen) => /break complete/i.test(statusOf(s));
export const isBreak = (s: Screen) => /break/i.test(statusOf(s)) && !isBreakDone(s);

export async function screen(): Promise<Screen> {
  await ensureWindow();
  return showTimerTab(await readScreen());
}
export async function press(btn: Btn | undefined, what: string): Promise<Screen> {
  if (!btn) throw new Error(`no ${what} button on this screen`);
  return clickIndex(btn.index);
}
