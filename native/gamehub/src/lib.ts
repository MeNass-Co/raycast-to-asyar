import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const BUNDLE_ID = "com.gamemac.www";
const APP = join(homedir(), "Library", "Application Support", "com.gamemac.www");
const STORE = join(APP, "gamehub", "game_container_store.json");
const ICONS = join(APP, "icons");

export interface Game {
  id: string; name: string; platform: string; platformAppId: string | null; localGameId: string | null;
  gamePath: string | null; updatedAt: number; createdAt: number;
  /** Local artwork as a data: URI (Steam library cache when present, else GameHub's own icon), else null.
   *  Absolute file paths do not render in the launcher (they map to the app icon cache), so we inline the bytes. */
  artwork: string | null; sizeOnDisk: number | null; installDir: string | null;
}

export const PLATFORM: Record<string, string> = { steam: "Steam", epic: "Epic Games", gog: "GOG", local: "Local" };
export const cleanName = (n: string) => n.replace(/[™®]/g, "").trim();

/** Steam keeps header/library art per app id under appcache/librarycache; GameHub's bottle is a full Steam client. */
function steamArtwork(appId: string, gamePath: string | null): string | null {
  const roots = [
    join(homedir(), "Library", "Application Support", "CrossOver", "Bottles", "Steam", "drive_c", "Program Files (x86)", "Steam"),
    gamePath ?? "",
  ].filter(Boolean);
  for (const r of roots) {
    for (const f of ["header.jpg", "library_600x900.jpg", "logo.png"]) {
      const p = join(r, "appcache", "librarycache", appId, f);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function dataUri(file: string): string | null {
  try { const b = readFileSync(file); const mime = file.endsWith(".png") ? "image/png" : "image/jpeg"; return `data:${mime};base64,${b.toString("base64")}`; } catch { return null; }
}

/** Steam appmanifest_<id>.acf → SizeOnDisk + installdir (searched in the bottle and in the game's own library path). */
function steamManifest(appId: string, gamePath: string | null): { sizeOnDisk: number | null; installDir: string | null } {
  const libs = [gamePath ? join(gamePath, "steamapps") : "", join(homedir(), "Library", "Application Support", "CrossOver", "Bottles", "Steam", "drive_c", "Program Files (x86)", "Steam", "steamapps")].filter(Boolean);
  for (const lib of libs) {
    const f = join(lib, `appmanifest_${appId}.acf`);
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8");
    const size = /"SizeOnDisk"\s+"(\d+)"/.exec(txt)?.[1];
    const dir = /"installdir"\s+"([^"]+)"/.exec(txt)?.[1];
    return { sizeOnDisk: size ? Number(size) : null, installDir: dir ? join(lib, "common", dir) : null };
  }
  return { sizeOnDisk: null, installDir: null };
}

/** GameHub's container store lists every game it has set up (one binding per game). */
export function readGames(): Game[] {
  if (!existsSync(STORE)) return [];
  const d = JSON.parse(readFileSync(STORE, "utf8"));
  const seen = new Set<string>();
  const out: Game[] = [];
  for (const b of d.bindings ?? []) {
    const id = String(b.game_id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const platform = String(b.platform ?? "local");
    const platformAppId = b.platform_app_id ? String(b.platform_app_id) : null;
    const gamePath = b.game_path ? String(b.game_path) : null;
    const name = String(b.game_name ?? id);
    const iconFile = join(ICONS, `${name}.png`);
    const artPath = (platform === "steam" && platformAppId ? steamArtwork(platformAppId, gamePath) : null) ?? (existsSync(iconFile) ? iconFile : null);
    const art = artPath ? dataUri(artPath) : null;
    const m = platform === "steam" && platformAppId ? steamManifest(platformAppId, gamePath) : { sizeOnDisk: null, installDir: null };
    out.push({ id, name, platform, platformAppId, localGameId: b.local_game_id ? String(b.local_game_id) : null, gamePath, updatedAt: Number(b.updated_at ?? 0), createdAt: Number(b.created_at ?? 0), artwork: art, ...m });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** gamehub://launch/<platform>/<id> — verified with steam/814380 (Sekiro) on 2026-09-05. */
export function launchUrl(g: Game): string {
  const id = g.platform === "local" ? g.localGameId ?? g.id : g.platformAppId ?? g.id;
  return `gamehub://launch/${g.platform}/${id}`;
}
export const storeUrl = (g: Game) => (g.platform === "steam" && g.platformAppId ? `https://store.steampowered.com/app/${g.platformAppId}` : null);

export const fmtSize = (n: number | null) => (n == null ? null : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);
export const fmtAgo = (ts: number) => { if (!ts) return ""; const d = (Date.now() / 1000 - ts) / 86400; return d < 1 ? "today" : d < 2 ? "yesterday" : d < 30 ? `${Math.round(d)} d ago` : `${Math.round(d / 30)} mo ago`; };

export const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));

/** Is a game process alive under CrossOver/Wine right now? (best effort: match the install dir's exe folder name). */
export async function runningGames(): Promise<Set<string>> {
  try {
    const ps = await run("/bin/ps", ["-axo", "command"]);
    const set = new Set<string>();
    for (const g of readGames()) { const key = g.installDir ? g.installDir.split("/").pop() ?? "" : cleanName(g.name); if (key && ps.includes(key)) set.add(g.id); }
    return set;
  } catch { return new Set(); }
}
