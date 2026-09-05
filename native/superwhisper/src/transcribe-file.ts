import { closeMainWindow, showHUD } from "@raycast/api";
import { clickMenuItem } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    await clickMenuItem("Transcribe File...");
  } catch (e) {
    await showHUD(`Superwhisper: ${String(e).slice(0, 80)}`);
  }
}
