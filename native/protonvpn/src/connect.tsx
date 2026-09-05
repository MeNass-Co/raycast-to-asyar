import { Action, ActionPanel, Color, Icon, List, closeMainWindow, showHUD, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { City, Country, flagOf, isInstalled, loadColor, protonax, readCatalogue, Status } from "./lib";

function CityList({ country }: { country: Country }) {
  return (
    <List navigationTitle={`${flagOf(country.code)} ${country.name}`} searchBarPlaceholder={`Cities in ${country.name}…`}>
      <List.Item
        icon={Icon.Bolt}
        title={`Fastest in ${country.name}`}
        subtitle={`${country.servers} servers`}
        accessories={[{ tag: { value: `${country.load}% load`, color: loadColor(country.load) } }]}
        actions={<ActionPanel><Action title={`Connect to ${country.name}`} icon={Icon.Globe} onAction={() => connect(country)} /></ActionPanel>}
      />
      <List.Section title="Cities">
        {country.cities.map((city) => (
          <List.Item
            key={city.name}
            icon={Icon.Pin}
            title={city.name}
            subtitle={`${city.servers} servers`}
            accessories={[{ tag: { value: `${city.load}% load`, color: loadColor(city.load) } }]}
            actions={<ActionPanel><Action title={`Connect to ${city.name}`} icon={Icon.Globe} onAction={() => connect(country, city)} /></ActionPanel>}
          />
        ))}
      </List.Section>
    </List>
  );
}

/** Keep the view alive while the helper works (closing it would tear the view's sidecar down mid-connect);
 *  show an animated toast, then close with a HUD once the tunnel is up. */
async function connect(country: Country, city?: City) {
  const target = city ? `${city.name}, ${country.name}` : country.name;
  const toast = await showToast({ style: Toast.Style.Animated, title: `Connecting to ${target}…` });
  try {
    const s: Status = await protonax("connect", country.name, ...(city ? [city.name] : []));
    if (s.ok && s.connected) { await toast.hide(); await closeMainWindow(); await showHUD(`Proton VPN: ${s.header} · ${s.ip}`); }
    else { toast.style = Toast.Style.Failure; toast.title = `Could not reach ${target}`; toast.message = s.header; }
  } catch (e) {
    toast.style = Toast.Style.Failure; toast.title = "Proton VPN"; toast.message = String(e).slice(0, 120);
  }
}

export default function Command() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isInstalled()) { setError("Proton VPN is not installed on this Mac"); setCountries([]); return; }
    readCatalogue().then(setCountries).catch((e) => { setError(String(e)); setCountries([]); });
    protonax("status").then(setStatus).catch(() => setStatus(null));
  }, []);
  const current = status?.connected ? status.header.split(" ")[0] : null;
  const features = (c: Country) => [c.free ? "Free" : "", c.secureCore ? "Secure Core" : "", c.p2p ? "P2P" : "", c.streaming ? "Streaming" : "", c.tor ? "Tor" : ""].filter(Boolean).join(" · ");
  return (
    <List isLoading={countries === null} searchBarPlaceholder="Search countries…" navigationTitle="Proton VPN">
      {error ? <List.EmptyView icon={Icon.ExclamationMark} title="Proton VPN" description={error} /> : null}
      {status ? (
        <List.Section title="Current connection">
          <List.Item
            icon={status.connected ? { source: Icon.Shield, tintColor: Color.Green } : { source: Icon.ShieldSlash ?? Icon.Shield, tintColor: Color.Red }}
            title={status.connected ? status.header : "Not connected"}
            subtitle={status.connected ? `${status.ip} · ${status.protocol}` : `IP ${status.ip}`}
            accessories={status.connected ? [{ text: status.load }] : []}
            actions={
              <ActionPanel>
                {status.connected
                  ? <Action title="Disconnect" icon={Icon.XMarkCircle} style={Action.Style.Destructive} onAction={async () => { const t = await showToast({ style: Toast.Style.Animated, title: "Disconnecting…" }); const s = await protonax("disconnect"); await t.hide(); await closeMainWindow(); await showHUD(s.connected ? "Proton VPN: still connected" : "Proton VPN: disconnected"); }} />
                  : <Action title="Quick Connect" icon={Icon.Bolt} onAction={async () => { const t = await showToast({ style: Toast.Style.Animated, title: "Connecting…" }); const s = await protonax("quick"); await t.hide(); await closeMainWindow(); await showHUD(s.connected ? `Proton VPN: ${s.header}` : "Proton VPN: connection failed"); }} />}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      <List.Section title={countries ? `All locations (${countries.length})` : "All locations"}>
        {(countries ?? []).map((c) => (
          <List.Item
            key={c.code}
            icon={flagOf(c.code)}
            title={c.name}
            subtitle={features(c)}
            keywords={[c.code, ...c.cities.map((x) => x.name)]}
            accessories={[
              ...(current === c.name ? [{ icon: { source: Icon.CheckCircle, tintColor: Color.Green }, tooltip: "Connected" }] : []),
              { text: `${c.servers}`, icon: Icon.HardDrive, tooltip: `${c.servers} servers` },
              { tag: { value: `${c.load}%`, color: loadColor(c.load) }, tooltip: "Average load" },
            ]}
            actions={
              <ActionPanel>
                <Action title={`Connect to ${c.name}`} icon={Icon.Globe} onAction={() => connect(c)} />
                {c.cities.length > 1 ? <Action.Push title="Choose City…" icon={Icon.Pin} target={<CityList country={c} />} shortcut={{ modifiers: ["cmd"], key: "return" }} /> : null}
                <Action.CopyToClipboard title="Copy Country Code" content={c.code} shortcut={{ modifiers: ["cmd"], key: "c" }} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
