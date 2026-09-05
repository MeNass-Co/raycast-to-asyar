import { Action, ActionPanel, Icon, List, Toast, showHUD, showToast } from "@raycast/api";
import { useEffect, useState } from "react";
import { readProfiles, protonax, isInstalled } from "./lib";

export default function Command() {
  const [profiles, setProfiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { readProfiles().then(setProfiles).catch((e) => { setError(String(e).replace(/^Error: /, "")); setProfiles([]); }); }, []);
  const icon = (n: string) => (/fastest/i.test(n) ? Icon.Bolt : /random/i.test(n) ? Icon.Shuffle : /stealth/i.test(n) ? Icon.EyeDisabled : Icon.Star);
  return (
    <List isLoading={profiles === null} searchBarPlaceholder="Search profiles…" navigationTitle="Proton VPN profiles">
      {!isInstalled() ? <List.EmptyView icon={Icon.ExclamationMark} title="Proton VPN is not installed on this Mac" /> : error ? <List.EmptyView icon={Icon.ExclamationMark} title="Proton VPN" description={error} /> : null}
      {(profiles ?? []).map((p) => (
        <List.Item key={p} icon={icon(p)} title={p} actions={
          <ActionPanel>
            <Action title={`Connect with ${p}`} icon={Icon.Globe} onAction={async () => {
              const t = await showToast({ style: Toast.Style.Animated, title: `Connecting with ${p}…` });
              try { const s = await protonax("profile", p); await t.hide(); await showHUD(s.connected ? `Proton VPN: ${s.header} · ${s.ip}` : "Proton VPN: connection failed"); }
              catch (e) { t.style = Toast.Style.Failure; t.title = "Proton VPN"; t.message = String(e).slice(0, 120); }
            }} />
          </ActionPanel>
        } />
      ))}
    </List>
  );
}
