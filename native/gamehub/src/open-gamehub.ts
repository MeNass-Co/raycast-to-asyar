import { closeMainWindow } from "@raycast/api";
import { BUNDLE_ID, run } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await run("/usr/bin/open", ["-b", BUNDLE_ID]);
}
