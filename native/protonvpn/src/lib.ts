import { environment } from "@raycast/api";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const BUNDLE_ID = "ch.protonvpn.mac";
/** Proton VPN keeps its whole server catalogue in a GRDB SQLite file (refreshed by the app every few minutes). */
export const DB = path.join(homedir(), "Library/Containers/ch.protonvpn.mac/Data/Library/Application Support/database.sqlite");
const PROTONAX = path.join(environment.assetsPath, "protonax");

export const isInstalled = () => existsSync("/Applications/ProtonVPN.app");

export type Status = { header: string; ip: string; protocol: string; load: string; connected: boolean; ok?: boolean };

const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, { maxBuffer: 64 << 20 }, (e, out, err) => (e ? rej(new Error(String(err || e.message).trim())) : res(String(out).trim()))));

/** assets/protonax drives the Proton VPN window through the Accessibility API (works while the app is hidden). */
export async function protonax(...args: string[]): Promise<Status> {
  if (!isInstalled()) throw new Error("Proton VPN is not installed on this Mac");
  return JSON.parse(await run(PROTONAX, args)) as Status;
}

export type Country = { code: string; name: string; servers: number; load: number; cities: City[]; secureCore: boolean; tor: boolean; p2p: boolean; streaming: boolean; free: boolean };
export type City = { name: string; servers: number; load: number };

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
/** Proton uses "UK" where ISO says "GB". */
const isoOf = (code: string) => (code === "UK" ? "GB" : code);
export const countryName = (code: string) => { try { return regionNames.of(isoOf(code)) ?? code; } catch { return code; } };
export const flagOf = (code: string) => [...isoOf(code)].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");

type Row = { c: string; city: string | null; n: number; load: number; feat: number; tier: number };

/** Reads the catalogue with the sqlite3 CLI (read-only, JSON). node:sqlite would need the flag on older Nodes. */
export async function readCatalogue(): Promise<Country[]> {
  if (!existsSync(DB)) return [];
  // The app groups servers under the "city" row it shows: a US state, else the city. Names must match the app's
  // row labels exactly (protonax presses them), so prefer state, then translatedCity, then city.
  const sql = `select l.exitCountryCode c, coalesce(nullif(l.state, ''), nullif(l.translatedCity, ''), l.city) city, count(*) n, round(avg(ls.load)) load, max(l.feature) feat, min(l.tier) tier
    from logical l join logicalStatus ls on ls.logicalId = l.id
    where l.entryCountryCode = l.exitCountryCode and (l.gatewayName is null or l.gatewayName = '') and ls.status = 1
    group by 1, 2 order by 1, 2`;
  const out = await run("/usr/bin/sqlite3", ["-readonly", "-json", DB, sql]);
  const rows = (out ? (JSON.parse(out) as Row[]) : []);
  const byCode = new Map<string, Country>();
  for (const r of rows) {
    let c = byCode.get(r.c);
    if (!c) { c = { code: r.c, name: countryName(r.c), servers: 0, load: 0, cities: [], secureCore: false, tor: false, p2p: false, streaming: false, free: false }; byCode.set(r.c, c); }
    c.servers += r.n;
    c.load += r.load * r.n;
    if (r.city) c.cities.push({ name: r.city, servers: r.n, load: r.load });
    if (r.feat & 1) c.secureCore = true;
    if (r.feat & 2) c.tor = true;
    if (r.feat & 4) c.p2p = true;
    if (r.feat & 8) c.streaming = true;
    if (r.tier === 0) c.free = true;
  }
  const list = [...byCode.values()].map((c) => ({ ...c, load: c.servers ? Math.round(c.load / c.servers) : 0 }));
  // Secure Core entries are separate logicals (feature bit 1) whose entry country differs; flag countries that have them.
  const sc = await run("/usr/bin/sqlite3", ["-readonly", DB, "select distinct exitCountryCode from logical where (feature & 1) > 0"]).catch(() => "");
  const scSet = new Set(sc.split("\n").map((s) => s.trim()).filter(Boolean));
  for (const c of list) c.secureCore = scSet.has(c.code);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export const loadColor = (load: number) => (load < 40 ? "#4caf50" : load < 75 ? "#ffb300" : "#e53935");

/** Profile names as the app lists them (built-ins first, then the user's). Read through protonax so the source of truth is the app. */
export async function readProfiles(): Promise<string[]> {
  if (!isInstalled()) return [];
  const out = await run(PROTONAX, ["profiles"]);
  return JSON.parse(out) as string[];
}
