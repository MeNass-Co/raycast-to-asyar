import { closeMainWindow, showHUD } from "@raycast/api";
import { clickSub, ensureRunning, subItems } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try {
    // When f.lux is disabled its "Disable" submenu shows a checked entry; clicking it again re-enables.
    const items = await subItems("Disable");
    const target = items.find((i) => /enable|for an hour|until sunrise/i.test(i)) ?? items[0];
    if (!target) throw new Error("no Disable entries");
    await clickSub("Disable", target);
    await showHUD("f.lux enabled");
  } catch (e) {
    await showHUD(`f.lux: ${String(e).slice(0, 90)}`);
  }
}
