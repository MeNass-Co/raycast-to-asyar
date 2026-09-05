import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, isRunning, pressButton, statusLine } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    await ensureRunning();
    const s = await statusLine();
    if (!isRunning(s)) { await showHUD(`Kofe Flow: ${s}`); return; }
    await showHUD(`Kofe Flow: ${await pressButton([/pause/i], 2)}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
