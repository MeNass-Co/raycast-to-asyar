import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const BUNDLE_ID = "com.gamemac.www";
const STORE = join(homedir(), "Library", "Application Support", "com.gamemac.www", "gamehub", "game_container_store.json");

export interface Game { id: string; name: string; platform: string; platformAppId: string | null; localGameId: string | null; updatedAt: number }

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
    out.push({ id, name: String(b.game_name ?? id), platform: String(b.platform ?? "local"), platformAppId: b.platform_app_id ? String(b.platform_app_id) : null, localGameId: b.local_game_id ? String(b.local_game_id) : null, updatedAt: Number(b.updated_at ?? 0) });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** gamehub://launch/<platform>/<id> — verified with steam/814380 (Sekiro) on 2026-09-05. */
export function launchUrl(g: Game): string {
  const id = g.platform === "local" ? g.localGameId ?? g.id : g.platformAppId ?? g.id;
  return `gamehub://launch/${g.platform}/${id}`;
}

export const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => execFile(cmd, args, (e, out) => (e ? rej(e) : res(String(out).trim()))));
