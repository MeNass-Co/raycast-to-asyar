import { closeMainWindow, showHUD } from "@raycast/api";
import { fmtRemaining, isActive, remaining } from "./lib";
export default async function Command() {
  await closeMainWindow();
  if (!(await isActive())) { await showHUD("Amphetamine: no active session"); return; }
  await showHUD(`Amphetamine: active · ${fmtRemaining(await remaining())} left`);
}
