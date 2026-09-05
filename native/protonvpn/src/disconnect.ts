import { closeMainWindow, showHUD } from "@raycast/api";
import { protonax } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    const before = await protonax("status");
    if (!before.connected) { await showHUD("Proton VPN: already disconnected"); return; }
    const s = await protonax("disconnect");
    await showHUD(s.connected ? "Proton VPN: still connected" : "Proton VPN: disconnected");
  } catch (e) { await showHUD(`Proton VPN: ${String(e).slice(0, 90)}`); }
}
