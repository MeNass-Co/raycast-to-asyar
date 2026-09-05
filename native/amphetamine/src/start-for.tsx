import { Action, ActionPanel, Icon, List, closeMainWindow, showHUD } from "@raycast/api";
import { amph } from "./lib";

const CHOICES: { title: string; duration: number; interval: "minutes" | "hours" }[] = [
  { title: "15 minutes", duration: 15, interval: "minutes" },
  { title: "30 minutes", duration: 30, interval: "minutes" },
  { title: "1 hour", duration: 1, interval: "hours" },
  { title: "2 hours", duration: 2, interval: "hours" },
  { title: "4 hours", duration: 4, interval: "hours" },
  { title: "8 hours", duration: 8, interval: "hours" },
  { title: "12 hours", duration: 12, interval: "hours" },
];

export default function Command() {
  async function start(c: (typeof CHOICES)[number]) {
    await closeMainWindow();
    await amph(`start new session with options {duration:${c.duration}, interval:${c.interval}, displaySleepAllowed:false}`);
    await showHUD(`Amphetamine: awake for ${c.title}`);
  }
  return (
    <List searchBarPlaceholder="Keep awake for…">
      {CHOICES.map((c) => (
        <List.Item key={c.title} icon={Icon.Clock} title={c.title} actions={<ActionPanel><Action title="Start Session" icon={Icon.Play} onAction={() => start(c)} /></ActionPanel>} />
      ))}
    </List>
  );
}
