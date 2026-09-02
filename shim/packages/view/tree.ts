// Helpers over the serialised RNode tree.
import type { RNode } from '../common/protocol';
import { isCallbackRef } from '../common/protocol';

export const slotOf = (n: RNode | null | undefined, name: string): RNode | undefined => n?.children.find((c) => c.type === '$' + name);
export const slotChild = (n: RNode | null | undefined, name: string): RNode | undefined => slotOf(n, name)?.children[0];
export const realChildren = (n: RNode | null | undefined): RNode[] => (n?.children ?? []).filter((c) => !c.type.startsWith('$'));
export const textOf = (n: RNode): string => n.children.filter((c) => c.type === '#text').map((c) => String(c.props.text ?? '')).join('');

export type Invoke = (cbId: number, ...args: unknown[]) => void;
export const cbId = (v: unknown): number | undefined => (isCallbackRef(v) ? v.$cb : undefined);

export interface Shortcut { modifiers: string[]; key: string }
export function normShortcut(s: unknown): Shortcut | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const o = s as Record<string, unknown>;
  if (o.macOS) return normShortcut(o.macOS);
  if (!Array.isArray(o.modifiers) || typeof o.key !== 'string') return undefined;
  return { modifiers: o.modifiers as string[], key: o.key };
}
const KEYMAP: Record<string, string> = { return: 'Enter', enter: 'Enter', delete: 'Backspace', backspace: 'Backspace', deleteForward: 'Delete', tab: 'Tab', arrowUp: 'ArrowUp', arrowDown: 'ArrowDown', arrowLeft: 'ArrowLeft', arrowRight: 'ArrowRight', pageUp: 'PageUp', pageDown: 'PageDown', home: 'Home', end: 'End', space: ' ', escape: 'Escape' };
export function matchesShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }, s: Shortcut): boolean {
  const want = new Set(s.modifiers.map((m) => (m === 'cmd' ? 'meta' : m === 'opt' || m === 'alt' ? 'alt' : m)));
  if (want.has('meta') !== e.metaKey || want.has('ctrl') !== e.ctrlKey || want.has('alt') !== e.altKey || want.has('shift') !== e.shiftKey) return false;
  const k = KEYMAP[s.key] ?? s.key;
  return e.key.toLowerCase() === k.toLowerCase();
}
export function shortcutLabel(s: Shortcut): string {
  const mods = s.modifiers.map((m) => ({ cmd: '⌘', ctrl: '⌃', opt: '⌥', alt: '⌥', shift: '⇧', windows: '⊞' }[m] ?? m)).join('');
  const key = ({ return: '↩', enter: '↩', delete: '⌫', backspace: '⌫', deleteForward: '⌦', tab: '⇥', arrowUp: '↑', arrowDown: '↓', arrowLeft: '←', arrowRight: '→', space: '␣', escape: '⎋' } as Record<string, string>)[s.key] ?? s.key.toUpperCase();
  return mods + key;
}

/** Flatten an ActionPanel node into ordered sections of actions. */
export interface FlatAction { node: RNode; title: string; shortcut?: Shortcut; style?: string; submenu?: FlatSection[]; kind?: string }
export interface FlatSection { title?: string; actions: FlatAction[] }
export function flattenActions(panel: RNode | undefined): FlatSection[] {
  if (!panel) return [];
  const sections: FlatSection[] = [];
  let loose: FlatAction[] = [];
  const pushLoose = () => { if (loose.length) { sections.push({ actions: loose }); loose = []; } };
  const toAction = (n: RNode): FlatAction | null => {
    if (n.type === 'Action') return { node: n, title: String(n.props.title ?? ''), shortcut: normShortcut(n.props.shortcut), style: n.props.style as string | undefined, kind: n.props.kind as string | undefined };
    if (n.type === 'ActionPanel.Submenu') return { node: n, title: String(n.props.title ?? ''), shortcut: normShortcut(n.props.shortcut), submenu: flattenActions(n) };
    return null;
  };
  for (const c of realChildren(panel)) {
    if (c.type === 'ActionPanel.Section') { pushLoose(); sections.push({ title: c.props.title as string | undefined, actions: realChildren(c).map(toAction).filter((a): a is FlatAction => !!a) }); }
    else { const a = toAction(c); if (a) loose.push(a); }
  }
  pushLoose();
  return sections.filter((s) => s.actions.length);
}
export const primaryAction = (sections: FlatSection[]): FlatAction | undefined => sections[0]?.actions[0];
