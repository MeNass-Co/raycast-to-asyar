import { closeMainWindow, showHUD } from "@raycast/api";
import { protonax } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try {
    const s = await protonax("status");
    await showHUD(s.connected ? `Proton VPN: ${s.header} · ${s.ip} · ${s.protocol} · ${s.load}` : `Proton VPN: not connected (IP ${s.ip})`);
  } catch (e) { await showHUD(`Proton VPN: ${String(e).slice(0, 90)}`); }
}
