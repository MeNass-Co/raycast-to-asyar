import { closeMainWindow, showHUD } from "@raycast/api";
import { isBreak, isBreakDone, isRunning, press, primary, screen, secondary, statusOf } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    let s = await screen();
    if (isBreak(s) || isBreakDone(s)) { await showHUD(`Kofe Flow: ${statusOf(s)}`); return; }
    if (isRunning(s)) s = await press(primary(s), "pause"); // break lives on the paused screen
    await showHUD(`Kofe Flow: ${statusOf(await press(secondary(s, 1), "break"))}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
