import { closeMainWindow, showHUD } from "@raycast/api";
import { clickPreset, ensureRunning } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try { await clickPreset("Automatic"); await showHUD("Fans: automatic"); } catch (e) { await showHUD(`Macs Fan Control: ${String(e).slice(0, 90)}`); }
}
