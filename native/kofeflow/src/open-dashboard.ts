import { closeMainWindow } from "@raycast/api";
import { execFile } from "node:child_process";
import { BUNDLE_ID } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await new Promise<void>((res) => execFile("/usr/bin/open", ["-b", BUNDLE_ID], () => res()));
}
