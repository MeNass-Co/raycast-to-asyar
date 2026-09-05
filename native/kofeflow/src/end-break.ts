import { closeMainWindow, showHUD } from "@raycast/api";
import { isBreak, isBreakDone, press, primary, screen, secondary, statusOf } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    const s = await screen();
    if (isBreak(s)) { await showHUD(`Kofe Flow: ${statusOf(await press(secondary(s, 1), "skip break"))}`); return; }
    if (isBreakDone(s)) { await showHUD(`Kofe Flow: ${statusOf(await press(primary(s), "start focus"))}`); return; }
    await showHUD(`Kofe Flow: ${statusOf(s)}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
