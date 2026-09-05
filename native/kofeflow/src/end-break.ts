import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, isBreak, pressButton, statusLine } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    await ensureRunning();
    const s = await statusLine();
    if (!isBreak(s)) { await showHUD(`Kofe Flow: ${s}`); return; }
    // Break screen: prefer an explicit end/skip/done button, else the first one.
    await showHUD(`Kofe Flow: ${await pressButton([/end|skip|done|finish|stop|dismiss/i, /start|focus|resume/i], 1)}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
