import { closeMainWindow, showHUD } from "@raycast/api";
import { clickSub, ensureRunning, subItems } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try {
    // Menu labels vary slightly between versions; match case-insensitively on the item's start.
    const items = await subItems("Disable");
    const target = items.find((i) => i.toLowerCase().startsWith("until sunrise".toLowerCase())) ?? "until sunrise";
    await clickSub("Disable", target);
    await showHUD("f.lux disabled until sunrise");
  } catch (e) {
    await showHUD(`f.lux: ${String(e).slice(0, 90)}`);
  }
}
