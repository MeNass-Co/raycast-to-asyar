import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, statusLine } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    await ensureRunning();
    await showHUD(`Kofe Flow: ${await statusLine()}`); } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
