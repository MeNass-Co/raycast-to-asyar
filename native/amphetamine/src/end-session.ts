import { closeMainWindow, showHUD } from "@raycast/api";
import { amph, isActive } from "./lib";
export default async function Command() {
  await closeMainWindow();
  if (!(await isActive())) { await showHUD("Amphetamine: no active session"); return; }
  await amph("end session");
  await showHUD("Amphetamine: session ended");
}
