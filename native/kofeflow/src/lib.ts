import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
const osa = (s: string) => run("/usr/bin/osascript", ["-e", s]);

export const BUNDLE_ID = "com.rahulmfg.kofeflow";
export async function ensureRunning(): Promise<void> {
  try {
    await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
  } catch {
    throw new Error("Kofe Flow is not installed on this Mac");
  }
}

/**
 * Kofe Flow has no URL scheme and no scripting dictionary; its App Intents are not exposed to Shortcuts
 * on this machine. The only surface is the menu bar popover, whose element tree changes with the state:
 *   idle / running / paused → scroll area › [status texts, 3 buttons: Start-or-Resume, Pause, Break]
 *   break complete          → group › [ "Break complete", "Nice reset…", 2 unnamed buttons ]
 * So never address buttons by a fixed path: open the popover, read every static text and every button
 * wherever they sit, then pick the button by its label (name / description / help), falling back to index.
 */
export type Popover = { texts: string[]; buttons: string[] };

// `entire contents` of the popover window comes back empty (probed 2026-09-05); a recursive walk over
// `UI elements` is what works. Handlers must live outside the `tell process` block.
const WALK = `on walk(e, ts, bs)
  tell application "System Events"
    try
      set r to role of e
      if r is "AXStaticText" then set end of ts to (value of e as string)
      if r is "AXButton" then
        set lbl to ""
        try
          set lbl to (name of e as string)
        end try
        if lbl is "" or lbl is "missing value" then
          try
            set lbl to (description of e as string)
          end try
        end if
        set end of bs to {lbl, e}
      end if
      repeat with c in (UI elements of e)
        my walk(c, ts, bs)
      end repeat
    end try
  end tell
end walk
tell application "System Events" to tell process "Kofe Flow"
  click menu bar item 1 of menu bar 2
  delay 0.9
  set w to window 1
end tell
set ts to {}
set bs to {}
walk(w, ts, bs)
set labels to {}
repeat with b in bs
  set end of labels to item 1 of b
end repeat`;

const FINISH = `set AppleScript's text item delimiters to "||"
return "T:" & (ts as string) & "@@B:" & (labels as string)`;

function parse(out: string): Popover {
  const [t, b] = out.split("@@B:");
  const split = (x: string) => x.split("||").map((v) => v.trim()).filter((v) => v && v !== "missing value");
  return { texts: split((t ?? "").replace(/^T:/, "")), buttons: (b ?? "").split("||").map((v) => v.trim()) };
}

export async function readPopover(): Promise<Popover> {
  const out = await osa(`${WALK}
tell application "System Events" to key code 53
${FINISH}`);
  return parse(out);
}

/** Click the n-th (1-based) button found in the popover, then return the fresh status line. */
export async function pressButtonIndex(n: number): Promise<string> {
  await osa(`${WALK}
tell application "System Events"
  if (count of bs) >= ${n} then click item 2 of item ${n} of bs
  delay 0.8
  try
    key code 53
  end try
end tell
return "ok"`);
  return statusLine();
}

/** Click the first button whose label matches one of the patterns; else the fallback index. */
export async function pressButton(patterns: RegExp[], fallbackIndex: number): Promise<string> {
  const { buttons } = await readPopover();
  const idx = buttons.findIndex((b) => patterns.some((p) => p.test(b)));
  return pressButtonIndex(idx >= 0 ? idx + 1 : fallbackIndex);
}

export async function statusLine(): Promise<string> {
  const { texts } = await readPopover();
  return texts.slice(0, 2).join(" ") || "no status";
}
export const isRunning = (s: string) => /running|deep work|focus(ing)? (is )?(on|active)/i.test(s) && !/paused/i.test(s);
export const isPaused = (s: string) => /paused/i.test(s);
export const isBreak = (s: string) => /break/i.test(s);
