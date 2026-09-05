import { Action, ActionPanel, Icon, List, showHUD } from "@raycast/api";
import { useEffect, useState } from "react";
import { activeModeKey, deepLink, readModes, type Mode } from "./lib";

const LANG: Record<string, string> = { fr: "Français", en: "English", nl: "Nederlands", de: "Deutsch", es: "Español", it: "Italiano" };

export default function Command() {
  const [modes, setModes] = useState<Mode[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setModes(readModes());
    activeModeKey().then(setActive).finally(() => setLoading(false));
  }, []);
  async function select(m: Mode) {
    await deepLink(`mode?key=${encodeURIComponent(m.key)}`);
    setActive(m.key);
    await showHUD(`Superwhisper mode: ${m.name}`);
  }
  return (
    <List isLoading={loading} searchBarPlaceholder="Search Superwhisper modes…">
      {modes.map((m) => (
        <List.Item
          key={m.key}
          icon={m.key === active ? Icon.CheckCircle : Icon.Circle}
          title={m.name}
          subtitle={[LANG[m.language ?? ""] ?? m.language, m.languageModelID].filter(Boolean).join(" · ")}
          accessories={m.key === active ? [{ text: "Active" }] : []}
          actions={
            <ActionPanel>
              <Action title="Activate Mode" icon={Icon.CheckCircle} onAction={() => select(m)} />
              <Action title="Open Settings" icon={Icon.Gear} onAction={() => deepLink("settings")} shortcut={{ modifiers: ["cmd"], key: "," }} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
