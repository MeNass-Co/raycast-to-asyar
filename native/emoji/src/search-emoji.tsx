import { Action, ActionPanel, Clipboard, Grid, LocalStorage, getPreferenceValues, showHUD } from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import data from "./emoji.json";

// Dataset: Raycast's own emoji.json (2462 entries; s = string, c = category, n = name, a = aliases,
// k = keywords, st = supports skin tone). Loaded once, indexed once, searched in-process — no Fuse,
// no worker round-trip, no persisted cache.
type Raw = { s: string; c: string; n: string; a: string[]; k: string[]; st?: boolean };
type Entry = Raw & { id: string; name: string; aliases: string[]; keywords: string[]; words: string[] };
type Prefs = { primaryAction?: "paste" | "copy"; skinTone?: string };

const CATEGORY_TITLE: Record<string, string> = {
  smileys_people: "Smileys & People",
  animals_nature: "Animals & Nature",
  food_drink: "Food & Drink",
  travel_places: "Travel & Places",
  activity: "Activity",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
  unicode_symbols: "Unicode Symbols",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_TITLE);

const TONES: { value: string; title: string; mod: string }[] = [
  { value: "default", title: "Default", mod: "" },
  { value: "light", title: "Light", mod: "\u{1F3FB}" },
  { value: "mediumLight", title: "Medium-Light", mod: "\u{1F3FC}" },
  { value: "medium", title: "Medium", mod: "\u{1F3FD}" },
  { value: "mediumDark", title: "Medium-Dark", mod: "\u{1F3FE}" },
  { value: "dark", title: "Dark", mod: "\u{1F3FF}" },
];

// Apply a skin-tone modifier: it follows the first human component of a ZWJ sequence, replacing its
// text/emoji variation selector (U+FE0F), which cannot coexist with a modifier.
function withTone(s: string, mod: string): string {
  if (!mod) return s;
  const parts = s.split("‍");
  parts[0] = parts[0].replace(/️/g, "") + mod;
  return parts.join("‍");
}

const ENTRIES: Entry[] = (data as { emoji: Raw[] }).emoji.map((e, i) => {
  const name = e.n.toLowerCase();
  return {
    ...e,
    id: `e${i}`,
    name,
    aliases: e.a.map((a) => a.toLowerCase()),
    keywords: e.k.map((k) => k.toLowerCase()),
    words: name.split(/[\s-]+/),
  };
});
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

// Ranking, per query term (every term must match): exact name/alias > name prefix > alias prefix >
// name-word prefix > keyword prefix > substring anywhere. Plain symbols rank below pictographic emoji
// on ties, like Raycast. Ties keep dataset order (Raycast's curated order).
function scoreOne(e: Entry, t: string): number {
  if (e.name === t || e.aliases.includes(t)) return 100;
  if (e.name.startsWith(t)) return 60;
  if (e.aliases.some((a) => a.startsWith(t))) return 50;
  if (e.words.some((w) => w.startsWith(t))) return 40;
  if (e.keywords.some((k) => k.startsWith(t))) return 30;
  if (e.name.includes(t) || e.keywords.some((k) => k.includes(t)) || e.aliases.some((a) => a.includes(t))) return 10;
  return 0;
}
const MAX_RESULTS = 200;
function search(query: string): Entry[] {
  const terms = query.trim().toLowerCase().replace(/^:|:$/g, "").split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  // Typing (or pasting) an emoji itself finds it.
  const literal = ENTRIES.filter((e) => terms.some((t) => t === e.s));
  if (literal.length) return literal;
  const scored: { e: Entry; s: number; i: number }[] = [];
  for (let i = 0; i < ENTRIES.length; i++) {
    const e = ENTRIES[i];
    let total = 0;
    for (const t of terms) {
      const s = scoreOne(e, t);
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) scored.push({ e, s: total - (e.c === "unicode_symbols" ? 5 : 0), i });
  }
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, MAX_RESULTS).map((x) => x.e);
}

const RECENTS_KEY = "recents-v1";
const RECENTS_MAX = 24;

export default function Command() {
  const prefs = getPreferenceValues<Prefs>();
  const primary = prefs.primaryAction === "copy" ? "copy" : "paste";
  const tone = TONES.find((t) => t.value === prefs.skinTone) ?? TONES[0];
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  // Selection lives in a ref: the actions are declared once on the Grid root, so moving the cursor
  // never re-renders 2,462 cells through the sidecar bridge.
  const selectedId = useRef<string | null>(null);

  useEffect(() => {
    LocalStorage.getItem(RECENTS_KEY).then((v) => { if (typeof v === "string") { try { setRecents(JSON.parse(v)); } catch { /* ignore */ } } });
  }, []);

  const results = useMemo(() => search(query), [query]);
  const searching = query.trim().length > 0;
  const display = (e: Entry) => (e.st ? withTone(e.s, tone.mod) : e.s);

  async function remember(e: Entry) {
    const next = [e.id, ...recents.filter((r) => r !== e.id)].slice(0, RECENTS_MAX);
    setRecents(next);
    await LocalStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  }
  function current(): Entry | null {
    return (selectedId.current && BY_ID.get(selectedId.current)) || null;
  }
  async function paste(mod?: string) {
    const e = current(); if (!e) return;
    const text = mod === undefined ? display(e) : withTone(e.s, mod);
    await remember(e);
    await Clipboard.paste(text);
  }
  async function copy(mod?: string) {
    const e = current(); if (!e) return;
    const text = mod === undefined ? display(e) : withTone(e.s, mod);
    await remember(e);
    await Clipboard.copy(text);
    await showHUD(`Copied ${text}`);
  }

  const actions = (
    <ActionPanel>
      <ActionPanel.Section>
        {primary === "paste" ? (
          <>
            <Action title="Paste" icon="clipboard-16" onAction={() => paste()} />
            <Action title="Copy" icon="copy-clipboard-16" onAction={() => copy()} shortcut={{ modifiers: ["cmd"], key: "c" }} />
          </>
        ) : (
          <>
            <Action title="Copy" icon="copy-clipboard-16" onAction={() => copy()} />
            <Action title="Paste" icon="clipboard-16" onAction={() => paste()} shortcut={{ modifiers: ["cmd"], key: "v" }} />
          </>
        )}
      </ActionPanel.Section>
      <ActionPanel.Section title="Skin Tone">
        <ActionPanel.Submenu title="Paste with Skin Tone" icon="person-16" shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}>
          {TONES.map((t) => (
            <Action key={t.value} title={`${withTone("\u{1F44B}", t.mod)}  ${t.title}`} onAction={() => paste(t.mod)} />
          ))}
        </ActionPanel.Submenu>
        <ActionPanel.Submenu title="Copy with Skin Tone" icon="person-16">
          {TONES.map((t) => (
            <Action key={t.value} title={`${withTone("\u{1F44B}", t.mod)}  ${t.title}`} onAction={() => copy(t.mod)} />
          ))}
        </ActionPanel.Submenu>
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action title="Copy Name" icon="text-16" onAction={async () => { const e = current(); if (e) { await Clipboard.copy(e.n); await showHUD(`Copied “${e.n}”`); } }} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} />
      </ActionPanel.Section>
    </ActionPanel>
  );

  const cell = (e: Entry) => <Grid.Item key={e.id} id={e.id} content={{ value: display(e), tooltip: e.n }} />;

  return (
    <Grid
      columns={8}
      inset={Grid.Inset.Small}
      filtering={false}
      onSearchTextChange={setQuery}
      onSelectionChange={(id) => { selectedId.current = id; }}
      searchBarPlaceholder="Search emoji & symbols…"
      actions={actions}
    >
      {searching ? (
        results.length ? results.map(cell) : <Grid.EmptyView title="No emoji found" description="Try a name, an alias like :+1: or a keyword" icon="magnifying-glass-16" />
      ) : (
        <>
          {recents.length ? (
            <Grid.Section title="Recently Used">{recents.map((id) => BY_ID.get(id)).filter((e): e is Entry => !!e).map(cell)}</Grid.Section>
          ) : null}
          {CATEGORY_ORDER.map((c) => (
            <Grid.Section key={c} title={CATEGORY_TITLE[c]}>{ENTRIES.filter((e) => e.c === c).map(cell)}</Grid.Section>
          ))}
        </>
      )}
    </Grid>
  );
}
