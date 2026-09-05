import { closeMainWindow, showHUD } from "@raycast/api";
import { screen, statusOf } from "./lib";
export default async function Command() {
  await closeMainWindow();
  try { await showHUD(`Kofe Flow: ${statusOf(await screen())}`); } catch (e) { await showHUD(`Kofe Flow: ${String(e).slice(0, 90)}`); }
}
