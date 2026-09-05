import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, isBreak, pressButton, statusLine } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    await ensureRunning();
    const s = await statusLine();
    if (isBreak(s)) { await showHUD(`Kofe Flow: ${s}`); return; }
    await showHUD(`Kofe Flow: ${await pressButton([/break/i], 3)}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
