import { execFile } from "node:child_process";
const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
export const amph = (cmd: string) => run("/usr/bin/osascript", ["-e", `tell application "Amphetamine" to ${cmd}`]);
export async function isActive(): Promise<boolean> {
  return (await amph("session is active")) === "true";
}
export async function remaining(): Promise<number> {
  const s = await amph("session time remaining");
  return Number(s);
}
export function fmtRemaining(seconds: number): string {
  if (seconds < 0) return "no time limit";
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
