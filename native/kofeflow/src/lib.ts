import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
const osa = (s: string) => run("/usr/bin/osascript", ["-e", s]);

export const BUNDLE_ID = "com.rahulmfg.kofeflow";

/**
 * Kofe Flow (4.7) has no URL scheme, no scripting dictionary and its App Intents are not exposed.
 * Its menu-bar popover is not reachable through Accessibility (0 AX windows, off-screen CG layer).
 * The only scriptable surface is the **Dashboard window** (1200×860, tabs Timer / Analytics / Settings),
 * which the app opens on launch and `open -b` re-opens. Timer tab layouts (probed 2026-09-05):
 *   running        : "Deep work is running."  buttons: [wide]                       wide = Pause
 *   paused         : "Focus is paused."       buttons: [wide, small-L, small-R]     wide = Resume, small-L = Take a break, small-R = Resume too
 *   break          : "Take a short break."    buttons: [wide, small]                wide = Pause break, small = Skip break → fresh focus
 *   break paused   : "Break is paused."       buttons: [wide, small]                wide = Resume break, small = Skip break
 *   break complete : "Break complete"         buttons: [b1, b2] (no tabs)           b1 = Start focus
 * Action buttons carry no help/name (description "button"); tabs carry help "Timer|Analytics|Settings",
 * the share button help "Share today's focus card", window chrome has description "close button" etc.
 * So: walk the tree, keep only anonymous "button"s, pick the widest as primary, the rest by x.
 */
type Btn = { help: string; desc: string; width: number; x: number; index: number };
export type Screen = { texts: string[]; buttons: Btn[] };

const WALK = `on walk(e, ts, bs)
  tell application "System Events"
    try
      set r to role of e
      if r is "AXStaticText" then set end of ts to (value of e as string)
      if r is "AXButton" then
        set h to ""
        try
          set h to (help of e as string)
        end try
        if h is "missing value" then set h to ""
        set d to ""
        try
          set d to (description of e as string)
        end try
        set wd to 0
        set px to 0
        try
          set sz to size of e
          set wd to item 1 of sz
        end try
        try
          set ps to position of e
          set px to item 1 of ps
        end try
        set end of bs to {h, d, wd, px, e}
      end if
      repeat with c in (UI elements of e)
        my walk(c, ts, bs)
      end repeat
    end try
  end tell
end walk
tell application "System Events" to tell process "Kofe Flow"
  set w to window 1
end tell
set ts to {}
set bs to {}
walk(w, ts, bs)`;

export async function ensureWindow(): Promise<void> {
  try {
    await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
  } catch {
    throw new Error("Kofe Flow is not installed on this Mac");
  }
  for (let i = 0; i < 10; i++) {
    const n = await osa(`tell application "System Events" to tell process "Kofe Flow" to count windows`).catch(() => "0");
    if (Number(n) > 0) return;
    if (i === 3) await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Kofe Flow dashboard window did not open");
}

export async function readScreen(): Promise<Screen> {
  const out = await osa(`${WALK}
set rows to {}
repeat with b in bs
  set end of rows to (item 1 of b) & "|" & (item 2 of b) & "|" & (item 3 of b) & "|" & (item 4 of b)
end repeat
set AppleScript's text item delimiters to "\\n"
return "T:" & (ts as string) & "\\n@@\\n" & (rows as string)`);
  const [t, b] = out.split("\n@@\n");
  const texts = (t ?? "").replace(/^T:/, "").split("\n").map((s) => s.trim()).filter((s) => s && s !== "missing value" && s !== "Kofe Flow");
  const buttons = (b ?? "").split("\n").filter(Boolean).map((line, i) => {
    const [help, desc, width, x] = line.split("|");
    return { help, desc, width: Number(width) || 0, x: Number(x) || 0, index: i + 1 };
  });
  return { texts, buttons };
}

/** Anonymous action buttons in document order: [wide primary, small…]. The wide one always comes first. */
export const actions = (s: Screen) => s.buttons.filter((b) => !b.help && b.desc === "button");
export const primary = (s: Screen) => actions(s)[0];
export const secondary = (s: Screen, n: number) => actions(s)[n];

export async function clickIndex(index: number): Promise<void> {
  await osa(`${WALK}
tell application "System Events"
  if (count of bs) >= ${index} then click item 5 of item ${index} of bs
end tell
delay 0.7`);
}

/** Make sure the Timer tab is showing (tabs are absent on the "Break complete" screen — that is fine). */
export async function showTimerTab(s: Screen): Promise<Screen> {
  const tab = s.buttons.find((b) => b.help === "Timer");
  if (!tab) return s;
  await clickIndex(tab.index);
  return readScreen();
}

export const statusOf = (s: Screen) => s.texts.slice(0, 2).join(" ") || "no status";
export const isRunning = (s: Screen) => /running/i.test(statusOf(s));
export const isPaused = (s: Screen) => /paused/i.test(statusOf(s));
export const isBreakDone = (s: Screen) => /break complete/i.test(statusOf(s));
export const isBreak = (s: Screen) => /break/i.test(statusOf(s)) && !isBreakDone(s);

export async function screen(): Promise<Screen> {
  await ensureWindow();
  return showTimerTab(await readScreen());
}
export async function press(btn: Btn | undefined, what: string): Promise<Screen> {
  if (!btn) throw new Error(`no ${what} button on this screen`);
  await clickIndex(btn.index);
  return readScreen();
}
