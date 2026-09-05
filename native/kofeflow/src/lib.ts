import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
const osa = (s: string) => run("/usr/bin/osascript", ["-e", s]);

export const BUNDLE_ID = "com.rahulmfg.kofeflow";
export async function ensureRunning(): Promise<void> {
  await run("/usr/bin/open", ["-g", "-b", BUNDLE_ID]);
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

const OPEN = `click menu bar item 1 of menu bar 2
  delay 0.8`;

export async function readPopover(): Promise<Popover> {
  const out = await osa(`tell application "System Events" to tell process "Kofe Flow"
  ${OPEN}
  set ts to {}
  set bs to {}
  repeat with e in (entire contents of window 1)
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
        if lbl is "" or lbl is "missing value" then
          try
            set lbl to (help of e as string)
          end try
        end if
        set end of bs to lbl
      end if
    end try
  end repeat
  key code 53
  set AppleScript's text item delimiters to "\\n"
  return (ts as string) & "\\n@@\\n" & (bs as string)
end tell`);
  const [t, b] = out.split("\n@@\n");
  const clean = (s: string) => s.split("\n").map((x) => x.trim()).filter((x) => x && x !== "missing value");
  return { texts: clean(t ?? ""), buttons: (b ?? "").split("\n").map((x) => x.trim()) };
}

/** Click the n-th (1-based) button found anywhere in the popover; returns the status line afterwards. */
export async function pressButtonIndex(n: number): Promise<string> {
  await osa(`tell application "System Events" to tell process "Kofe Flow"
  ${OPEN}
  set i to 0
  repeat with e in (entire contents of window 1)
    try
      if role of e is "AXButton" then
        set i to i + 1
        if i is ${n} then
          click e
          exit repeat
        end if
      end if
    end try
  end repeat
  delay 0.5
  key code 53
end tell`);
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
