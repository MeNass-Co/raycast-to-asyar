import { closeMainWindow, showHUD } from "@raycast/api";
import { ensureRunning, pressPopoverButton } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try { await showHUD(`Kofe Flow: ${await pressPopoverButton(3)}`); } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
