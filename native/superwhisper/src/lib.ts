import { execFile } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const BUNDLE_ID = "com.superduper.superwhisper";
export const ROOT = join(homedir(), "Documents", "superwhisper");
export const MODES_DIR = join(ROOT, "modes");
export const RECORDINGS_DIR = join(ROOT, "recordings");

export const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, { maxBuffer: 16 << 20 }, (e, out) => (e ? rej(e) : res(String(out).trim()))));

export const osa = (script: string) => run("/usr/bin/osascript", ["-e", script]);

/** Open a superwhisper:// deep link (record, settings, mode?key=…). */
export const deepLink = (path: string) => run("/usr/bin/open", ["-b", BUNDLE_ID, `superwhisper://${path}`]);

/** Click an item of Superwhisper's menu bar menu by exact title (needs Accessibility). */
export async function clickMenuItem(title: string): Promise<void> {
  await osa(`tell application "System Events" to tell process "superwhisper"
  click menu bar item 1 of menu bar 2
  delay 0.4
  click menu item "${title.replace(/"/g, '\\"')}" of menu 1 of menu bar item 1 of menu bar 2
end tell`);
}

export interface Mode {
  key: string;
  name: string;
  language?: string;
  languageModelID?: string;
  voiceModelID?: string;
  description?: string;
}

export function readModes(): Mode[] {
  if (!existsSync(MODES_DIR)) return [];
  return readdirSync(MODES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const j = JSON.parse(readFileSync(join(MODES_DIR, f), "utf8"));
        return { key: j.key ?? f.replace(/\.json$/, ""), name: j.name ?? j.key ?? f, language: j.language, languageModelID: j.languageModelID, voiceModelID: j.voiceModelID, description: j.description };
      } catch {
        return null;
      }
    })
    .filter((m): m is Mode => !!m)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function activeModeKey(): Promise<string | null> {
  try {
    return await run("/usr/bin/defaults", ["read", BUNDLE_ID, "activeModeKey"]);
  } catch {
    return null;
  }
}

export interface Recording {
  folder: string;
  timestamp: number;
  modeName: string;
  appName: string;
  rawResult: string;
  llmResult: string;
  result: string;
  duration: number;
  modelName: string;
}

export function readRecordings(limit = 200): Recording[] {
  if (!existsSync(RECORDINGS_DIR)) return [];
  const dirs = readdirSync(RECORDINGS_DIR)
    .filter((d) => /^\d+$/.test(d))
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, limit);
  const out: Recording[] = [];
  for (const d of dirs) {
    const metaPath = join(RECORDINGS_DIR, d, "meta.json");
    try {
      if (!statSync(metaPath).isFile()) continue;
      const m = JSON.parse(readFileSync(metaPath, "utf8"));
      out.push({
        folder: d,
        timestamp: Number(d) * 1000,
        modeName: m.modeName ?? "",
        appName: m.promptContext?.applicationContext?.name ?? "",
        rawResult: (m.rawResult ?? "").trim(),
        llmResult: (m.llmResult ?? "").trim(),
        result: (m.result ?? m.llmResult ?? m.rawResult ?? "").trim(),
        duration: Number(m.duration ?? 0),
        modelName: m.modelName ?? "",
      });
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

export function fmtWhen(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
}
