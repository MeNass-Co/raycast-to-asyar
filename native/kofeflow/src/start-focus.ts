import { closeMainWindow, showHUD } from "@raycast/api";
import { isBreak, isRunning, press, primary, screen, secondary, statusOf } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    const s = await screen();
    if (isRunning(s)) { await showHUD(`Kofe Flow: ${statusOf(s)}`); return; }
    // paused → Resume (wide) · break → Skip break (small) · break complete / idle → Start (wide / first)
    const after = isBreak(s) ? await press(secondary(s, 1), "skip break") : await press(primary(s), "start");
    await showHUD(`Kofe Flow: ${statusOf(after)}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
