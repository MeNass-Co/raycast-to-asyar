import { closeMainWindow, showHUD } from "@raycast/api";
import { clickTop, ensureRunning } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try { await clickTop("Options"); } catch (e) { await showHUD(`f.lux: ${String(e).slice(0, 90)}`); }
}
