import { closeMainWindow } from "@raycast/api";
import { deepLink } from "./lib";
export default async function Command() {
  await closeMainWindow();
  await deepLink("record");
}
