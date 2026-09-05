import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, pressPopoverButton, status } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try {
    const s = await status();
    if (!/running/i.test(s)) { await showHUD(`Kofe Flow: ${s}`); return; }
    await showHUD(`Kofe Flow: ${await pressPopoverButton(2)}`);
  } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
