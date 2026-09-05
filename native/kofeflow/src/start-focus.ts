import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, isBreak, isRunning, pressButton, statusLine } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try {
    const s = await statusLine();
    if (isRunning(s)) { await showHUD(`Kofe Flow: ${s}`); return; }
    // Break screen offers "Start focus"-like buttons; idle/paused screens put Start/Resume first.
    const after = await pressButton([/start|resume|focus/i], isBreak(s) ? 1 : 1);
    await showHUD(`Kofe Flow: ${after}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
