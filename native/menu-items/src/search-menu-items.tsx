import { Action, ActionPanel, Icon, List, showHUD, showToast, Toast } from "@raycast/api";
import { execFile } from "node:child_process";
import { useEffect, useState } from "react";

type Item = { path: string[]; enabled: boolean; shortcut?: string };

function osa(script: string): Promise<string> {
  return new Promise((res, rej) => execFile("/usr/bin/osascript", ["-e", script], { maxBuffer: 8 << 20 }, (e, out) => (e ? rej(e) : res(out.trim()))));
}

// Walk the frontmost app's menu bar two levels deep. Returns one line per leaf: "Menu\tSubmenu\tItem\tenabled\tcmdchar\tmods".
const WALK = `
on esc(t)
  if t is missing value then return ""
  return t as text
end esc
tell application "System Events"
  set p to first process whose frontmost is true
  set appName to name of p
  set out to appName & linefeed
  tell p
    repeat with m in menu bar items of menu bar 1
      set mn to name of m
      if mn is not "Apple" then
        try
          repeat with i in menu items of menu 1 of m
            set n to name of i
            if n is not missing value and n is not "" then
              set subs to {}
              try
                set subs to menu items of menu 1 of i
              end try
              if (count of subs) > 0 then
                repeat with s in subs
                  set sn to name of s
                  if sn is not missing value and sn is not "" then
                    set out to out & mn & tab & n & tab & sn & tab & (enabled of s) & tab & my esc(value of attribute "AXMenuItemCmdChar" of s) & tab & my esc(value of attribute "AXMenuItemCmdModifiers" of s) & linefeed
                  end if
                end repeat
              else
                set out to out & mn & tab & "" & tab & n & tab & (enabled of i) & tab & my esc(value of attribute "AXMenuItemCmdChar" of i) & tab & my esc(value of attribute "AXMenuItemCmdModifiers" of i) & linefeed
              end if
            end if
          end repeat
        end try
      end if
    end repeat
  end tell
  return out
end tell`;

function shortcutOf(ch: string, mods: string): string | undefined {
  if (!ch) return undefined;
  const m = Number(mods); // AX modifier mask: 0=⌘ 1=⇧⌘ 2=⌥⌘ 3=⌥⇧⌘ 4=⌃⌘ 8=⌃⇧⌘? (bits: 1 shift, 2 option, 4 control, 8 no-command)
  const parts: string[] = [];
  if (m & 4) parts.push("⌃");
  if (m & 2) parts.push("⌥");
  if (m & 1) parts.push("⇧");
  if (!(m & 8)) parts.push("⌘");
  return parts.join("") + ch.toUpperCase();
}

function clickScript(path: string[]): string {
  const q = (s: string) => JSON.stringify(s);
  const [menu, sub, item] = path;
  const target = sub ? `menu item ${q(item)} of menu 1 of menu item ${q(sub)} of menu 1 of menu bar item ${q(menu)} of menu bar 1` : `menu item ${q(item)} of menu 1 of menu bar item ${q(menu)} of menu bar 1`;
  return `tell application "System Events" to tell (first process whose frontmost is true) to click ${target}`;
}

export default function Command() {
  const [app, setApp] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    osa(WALK)
      .then((out) => {
        const [first, ...lines] = out.split("\n");
        setApp(first);
        setItems(
          lines
            .filter(Boolean)
            .map((l) => l.split("\t"))
            .map(([menu, sub, item, enabled, ch, mods]) => ({ path: [menu, sub, item].filter(Boolean), enabled: enabled === "true", shortcut: shortcutOf(ch, mods) })),
        );
      })
      .catch((e) => showToast({ style: Toast.Style.Failure, title: "Could not read the menu bar", message: String(e.message ?? e).slice(0, 120) }))
      .finally(() => setLoading(false));
  }, []);
  return (
    <List isLoading={loading} searchBarPlaceholder={app ? `Search ${app} menu items…` : "Search menu items…"}>
      {items.map((it, i) => (
        <List.Item
          key={i}
          icon={it.enabled ? Icon.ChevronRight : Icon.Minus}
          title={it.path[it.path.length - 1]}
          subtitle={it.path.slice(0, -1).join(" › ")}
          accessories={it.shortcut ? [{ text: it.shortcut }] : []}
          keywords={it.path}
          actions={
            <ActionPanel>
              <Action
                title="Run Menu Item"
                icon={Icon.Play}
                onAction={async () => {
                  try { await osa(clickScript(it.path)); await showHUD(it.path.join(" › ")); }
                  catch (e) { await showToast({ style: Toast.Style.Failure, title: "Menu item failed", message: String((e as Error).message).slice(0, 120) }); }
                }}
              />
              <Action.CopyToClipboard title="Copy Menu Path" content={it.path.join(" › ")} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
