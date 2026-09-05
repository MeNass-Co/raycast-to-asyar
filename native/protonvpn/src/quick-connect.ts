import { closeMainWindow, showHUD } from "@raycast/api";
import { protonax } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    const before = await protonax("status");
    if (before.connected) { await showHUD(`Proton VPN: already connected to ${before.header}`); return; }
    await showHUD("Proton VPN: connecting…");
    const s = await protonax("quick");
    await showHUD(s.connected ? `Proton VPN: connected to ${s.header}` : "Proton VPN: connection failed");
  } catch (e) { await showHUD(`Proton VPN: ${String(e).slice(0, 90)}`); }
}
