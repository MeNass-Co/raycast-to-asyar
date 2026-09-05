import { Action, ActionPanel, Icon, List, closeMainWindow, showHUD } from "@raycast/api";
import { useEffect, useState } from "react";
import { launchUrl, readGames, run, type Game } from "./lib";

const PLATFORM: Record<string, string> = { steam: "Steam", epic: "Epic Games", gog: "GOG", local: "Local" };

export default function Command() {
  const [games, setGames] = useState<Game[]>([]);
  useEffect(() => setGames(readGames()), []);
  async function launch(g: Game) {
    await closeMainWindow();
    await run("/usr/bin/open", [launchUrl(g)]);
    await showHUD(`Launching ${g.name.replace(/™/g, "")}…`);
  }
  return (
    <List searchBarPlaceholder="Search your GameHub library…">
      {games.length === 0 ? <List.EmptyView icon={Icon.GameController} title="No games in GameHub yet" description="Install a game in GameHub and it will show up here." /> : null}
      {games.map((g) => (
        <List.Item
          key={g.id}
          icon={Icon.GameController}
          title={g.name.replace(/™/g, "")}
          subtitle={PLATFORM[g.platform] ?? g.platform}
          accessories={g.platformAppId ? [{ text: `#${g.platformAppId}` }] : []}
          actions={
            <ActionPanel>
              <Action title="Launch Game" icon={Icon.Play} onAction={() => launch(g)} />
              <Action.CopyToClipboard title="Copy Launch Link" content={launchUrl(g)} shortcut={{ modifiers: ["cmd"], key: "c" }} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
