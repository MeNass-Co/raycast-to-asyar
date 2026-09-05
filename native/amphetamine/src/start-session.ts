import { closeMainWindow, showHUD } from "@raycast/api";
import { amph } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await amph("start new session");
  await showHUD("Amphetamine: session started (no time limit)");
}
