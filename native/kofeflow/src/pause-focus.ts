import { closeMainWindow, showHUD } from "@raycast/api";
import { isRunning, press, primary, screen, statusOf } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    const s = await screen();
    if (!isRunning(s)) { await showHUD(`Kofe Flow: ${statusOf(s)}`); return; }
    await showHUD(`Kofe Flow: ${statusOf(await press(primary(s), "pause"))}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
