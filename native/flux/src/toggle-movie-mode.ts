import { closeMainWindow, showHUD } from "@raycast/api";
import { clickSub, ensureRunning, subItems } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await ensureRunning();
  try {
    // Menu labels vary slightly between versions; match case-insensitively on the item's start.
    const items = await subItems("Color Effects");
    const target = items.find((i) => i.toLowerCase().startsWith("Movie mode".toLowerCase())) ?? "Movie mode";
    await clickSub("Color Effects", target);
    await showHUD("f.lux Movie mode toggled");
  } catch (e) {
    await showHUD(`f.lux: ${String(e).slice(0, 90)}`);
  }
}
