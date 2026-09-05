import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { clickMenuItem, fmtDuration, fmtWhen, readRecordings, type Recording } from "./lib";

export default function Command() {
  const [items, setItems] = useState<Recording[]>([]);
  useEffect(() => setItems(readRecordings()), []);
  return (
    <List isShowingDetail searchBarPlaceholder="Search transcriptions…">
      {items.map((r) => (
        <List.Item
          key={r.folder}
          icon={Icon.Microphone}
          title={r.result.slice(0, 80) || "(empty)"}
          subtitle={fmtWhen(r.timestamp)}
          keywords={[r.modeName, r.appName]}
          accessories={[{ text: r.modeName }]}
          detail={
            <List.Item.Detail
              markdown={r.llmResult ? `### Result\n${r.llmResult}\n\n### Raw\n${r.rawResult || "_—_"}` : `### Result\n${r.rawResult || "_—_"}`}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="When" text={fmtWhen(r.timestamp)} />
                  <List.Item.Detail.Metadata.Label title="Mode" text={r.modeName || "—"} />
                  <List.Item.Detail.Metadata.Label title="App" text={r.appName || "—"} />
                  <List.Item.Detail.Metadata.Label title="Duration" text={fmtDuration(r.duration)} />
                  <List.Item.Detail.Metadata.Label title="Model" text={r.modelName || "—"} />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <Action.Paste title="Paste Result" content={r.result} />
              <Action.CopyToClipboard title="Copy Result" content={r.result} shortcut={{ modifiers: ["cmd"], key: "c" }} />
              {r.rawResult && r.rawResult !== r.result ? <Action.CopyToClipboard title="Copy Raw Transcript" content={r.rawResult} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} /> : null}
              <Action title="Open History Window" icon={Icon.AppWindow} onAction={() => clickMenuItem("History...")} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
