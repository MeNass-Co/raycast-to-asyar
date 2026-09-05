import { Action, ActionPanel, Color, Icon, List, closeMainWindow, showHUD } from "@raycast/api";
import { useEffect, useState } from "react";
import { BUNDLE_ID, cleanName, fmtAgo, fmtSize, launchUrl, PLATFORM, readGames, run, runningGames, storeUrl, type Game } from "./lib";

export default function Command() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());
  useEffect(() => { setGames(readGames()); runningGames().then(setRunning); }, []);

  async function launch(g: Game) {
    await closeMainWindow();
    await showHUD(`Launching ${cleanName(g.name)}…`);
    try { await run("/usr/bin/open", ["-g", launchUrl(g)]); } catch (e) { await showHUD(`GameHub: ${String(e).slice(0, 80)}`); }
  }

  return (
    <List isLoading={games === null} isShowingDetail={!!games?.length} searchBarPlaceholder="Search your GameHub library…" navigationTitle="GameHub">
      {games && games.length === 0 ? <List.EmptyView icon={Icon.GameController} title="No games in GameHub yet" description="Install a game in GameHub and it will show up here." actions={<ActionPanel><Action title="Open GameHub" icon={Icon.AppWindow} onAction={() => run("/usr/bin/open", ["-b", BUNDLE_ID])} /></ActionPanel>} /> : null}
      {(games ?? []).map((g) => {
        const isRunning = running.has(g.id);
        const size = fmtSize(g.sizeOnDisk);
        return (
          <List.Item
            key={g.id}
            icon={g.artwork ? { source: g.artwork } : Icon.GameController}
            title={cleanName(g.name)}
            keywords={[g.platform, PLATFORM[g.platform] ?? "", g.platformAppId ?? ""]}
            accessories={[
              ...(isRunning ? [{ tag: { value: "Running", color: Color.Green } }] : []),
              { text: PLATFORM[g.platform] ?? g.platform },
            ]}
            detail={
              <List.Item.Detail
                markdown={g.artwork ? `![${cleanName(g.name)}](${g.artwork})` : `# ${cleanName(g.name)}`}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Platform" text={PLATFORM[g.platform] ?? g.platform} />
                    {g.platformAppId ? <List.Item.Detail.Metadata.Label title="App ID" text={g.platformAppId} /> : null}
                    {size ? <List.Item.Detail.Metadata.Label title="Size on disk" text={size} /> : null}
                    <List.Item.Detail.Metadata.Label title="Last updated" text={fmtAgo(g.updatedAt)} />
                    <List.Item.Detail.Metadata.Label title="Added" text={fmtAgo(g.createdAt)} />
                    {g.installDir ? <List.Item.Detail.Metadata.Label title="Install folder" text={g.installDir.replace(/^\/Users\/[^/]+/, "~")} /> : null}
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label title="Status" text={isRunning ? "Running" : "Not running"} icon={isRunning ? { source: Icon.CircleFilled, tintColor: Color.Green } : Icon.Circle} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action title={isRunning ? "Switch to Game" : "Launch Game"} icon={Icon.Play} onAction={() => launch(g)} />
                {g.installDir ? <Action.ShowInFinder title="Show Install Folder" path={g.installDir} shortcut={{ modifiers: ["cmd"], key: "f" }} /> : null}
                {storeUrl(g) ? <Action.OpenInBrowser title="Open Steam Store Page" url={storeUrl(g)!} shortcut={{ modifiers: ["cmd"], key: "s" }} /> : null}
                <Action title="Open GameHub" icon={Icon.AppWindow} shortcut={{ modifiers: ["cmd"], key: "o" }} onAction={async () => { await closeMainWindow(); await run("/usr/bin/open", ["-b", BUNDLE_ID]); }} />
                <Action.CopyToClipboard title="Copy Launch Link" content={launchUrl(g)} shortcut={{ modifiers: ["cmd"], key: "c" }} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
