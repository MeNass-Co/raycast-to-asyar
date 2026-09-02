// Raycast UI components as host elements. Element-valued props (actions, detail,
// metadata, searchBarAccessory, target…) are moved into typed slot children so the
// serialiser never meets a React element inside props.
import React, { createElement as h, type ReactNode, type ReactElement, forwardRef } from 'react';
import { runtime } from './runtime';
import { Clipboard, open, trash, showInFinder, showToast, Toast } from './api-core';

type AnyProps = Record<string, unknown> & { children?: ReactNode };

function slot(name: string, el: unknown): ReactElement | null {
  return el === undefined || el === null || el === false ? null : h('$' + name, { key: '$' + name }, el as ReactNode);
}
function host(type: string, props: AnyProps, slots: Record<string, unknown> = {}, children?: ReactNode) {
  const rest: AnyProps = { ...props };
  delete rest.children;
  for (const k of Object.keys(slots)) delete rest[k];
  const kids: ReactNode[] = [];
  for (const [k, v] of Object.entries(slots)) { const s = slot(k, v); if (s) kids.push(s); }
  if (children !== undefined) kids.push(children);
  return h(type, rest, ...kids);
}

// ── List ────────────────────────────────────────────────────────────────
function ListFn(p: AnyProps) { return host('List', p, { actions: p.actions, searchBarAccessory: p.searchBarAccessory }, p.children); }
function ListItem(p: AnyProps) { return host('List.Item', p, { actions: p.actions, detail: p.detail }); }
function ListSection(p: AnyProps) { return host('List.Section', p, {}, p.children); }
function ListEmptyView(p: AnyProps) { return host('List.EmptyView', p, { actions: p.actions }); }
function ListDropdown(p: AnyProps) { return host('List.Dropdown', p, {}, p.children); }
function ListDropdownItem(p: AnyProps) { return host('List.Dropdown.Item', p); }
function ListDropdownSection(p: AnyProps) { return host('List.Dropdown.Section', p, {}, p.children); }
function ListItemDetail(p: AnyProps) { return host('List.Item.Detail', p, { metadata: p.metadata }); }
export const List = Object.assign(ListFn, {
  Item: Object.assign(ListItem, { Detail: Object.assign(ListItemDetail, { Metadata: undefined as unknown }) }),
  Section: ListSection,
  EmptyView: ListEmptyView,
  Dropdown: Object.assign(ListDropdown, { Item: ListDropdownItem, Section: ListDropdownSection }),
});

// ── Grid ────────────────────────────────────────────────────────────────
function GridFn(p: AnyProps) { return host('Grid', p, { actions: p.actions, searchBarAccessory: p.searchBarAccessory }, p.children); }
function GridItem(p: AnyProps) { return host('Grid.Item', p, { actions: p.actions }); }
function GridSection(p: AnyProps) { return host('Grid.Section', p, {}, p.children); }
export const Grid = Object.assign(GridFn, {
  Item: GridItem, Section: GridSection, EmptyView: ListEmptyView,
  Dropdown: List.Dropdown,
  Inset: { Zero: 'zero', Small: 'sm', Medium: 'md', Large: 'lg' },
  ItemSize: { Small: 'small', Medium: 'medium', Large: 'large' },
  Fit: { Contain: 'contain', Fill: 'fill' },
  AspectRatio: { One: '1', ThreeToTwo: '3/2', TwoToThree: '2/3', FourToThree: '4/3', ThreeToFour: '3/4', SixteenToNine: '16/9', NineToSixteen: '9/16' },
});

// ── Detail ──────────────────────────────────────────────────────────────
function DetailFn(p: AnyProps) { return host('Detail', p, { actions: p.actions, metadata: p.metadata }); }
function Metadata(p: AnyProps) { return host('Detail.Metadata', p, {}, p.children); }
function MetadataLabel(p: AnyProps) { return host('Detail.Metadata.Label', p); }
function MetadataLink(p: AnyProps) { return host('Detail.Metadata.Link', p); }
function MetadataSeparator(p: AnyProps) { return host('Detail.Metadata.Separator', p); }
function MetadataTagList(p: AnyProps) { return host('Detail.Metadata.TagList', p, {}, p.children); }
function MetadataTagListItem(p: AnyProps) { return host('Detail.Metadata.TagList.Item', p); }
const MetadataNS = Object.assign(Metadata, { Label: MetadataLabel, Link: MetadataLink, Separator: MetadataSeparator, TagList: Object.assign(MetadataTagList, { Item: MetadataTagListItem }) });
export const Detail = Object.assign(DetailFn, { Metadata: MetadataNS });
(List.Item.Detail as { Metadata: unknown }).Metadata = MetadataNS;

// ── Form ────────────────────────────────────────────────────────────────
function FormFn(p: AnyProps) { return host('Form', p, { actions: p.actions, searchBarAccessory: p.searchBarAccessory }, p.children); }
const field = (type: string) => forwardRef(function Field(p: AnyProps, ref) {
  React.useImperativeHandle(ref, () => ({
    focus: () => runtime.formCommand(p.id as string, 'focus'),
    reset: () => runtime.formCommand(p.id as string, 'reset'),
  }), [p.id]);
  return host(type, p, {}, p.children);
});
export const Form = Object.assign(FormFn, {
  TextField: field('Form.TextField'),
  PasswordField: field('Form.PasswordField'),
  TextArea: field('Form.TextArea'),
  Checkbox: field('Form.Checkbox'),
  DatePicker: Object.assign(field('Form.DatePicker'), { Type: { Date: 'date', DateTime: 'date_time' }, isFullDay: (d?: Date | null) => !!d && d.getHours() === 0 && d.getMinutes() === 0 }),
  Dropdown: Object.assign(field('Form.Dropdown'), { Item: (p: AnyProps) => host('Form.Dropdown.Item', p), Section: (p: AnyProps) => host('Form.Dropdown.Section', p, {}, p.children) }),
  TagPicker: Object.assign(field('Form.TagPicker'), { Item: (p: AnyProps) => host('Form.TagPicker.Item', p) }),
  FilePicker: field('Form.FilePicker'),
  Separator: (p: AnyProps) => host('Form.Separator', p),
  Description: (p: AnyProps) => host('Form.Description', p),
  LinkAccessory: (p: AnyProps) => host('Form.LinkAccessory', p),
});

// ── ActionPanel / Action ────────────────────────────────────────────────
function ActionPanelFn(p: AnyProps) { return host('ActionPanel', p, {}, p.children); }
function ActionPanelSection(p: AnyProps) { return host('ActionPanel.Section', p, {}, p.children); }
function ActionPanelSubmenu(p: AnyProps) { return host('ActionPanel.Submenu', p, {}, p.children); }
export const ActionPanel = Object.assign(ActionPanelFn, { Section: ActionPanelSection, Submenu: ActionPanelSubmenu, Item: undefined as unknown });

const ActionStyle = { Regular: 'regular', Destructive: 'destructive' } as const;
function ActionFn(p: AnyProps) { return host('Action', p); }
function ActionPush(p: AnyProps) {
  const { target, onPush, onPop, ...rest } = p as AnyProps & { target: ReactNode; onPush?: () => void; onPop?: () => void };
  return host('Action', { ...rest, kind: 'push', onAction: () => { onPush?.(); runtime.nav.push(target, onPop); } });
}
function ActionSubmitForm(p: AnyProps) {
  const { onSubmit, ...rest } = p as AnyProps & { onSubmit?: (v: unknown) => unknown };
  return host('Action', { title: 'Submit', ...rest, kind: 'submit', onAction: async (values: unknown) => { const r = await onSubmit?.(values); return r; } });
}
function ActionCopy(p: AnyProps) {
  const { content, onCopy, transient, concealed, ...rest } = p as AnyProps & { content: unknown; onCopy?: (c: unknown) => void };
  return host('Action', { title: 'Copy to Clipboard', icon: 'copy-clipboard-16', ...rest, kind: 'copy', onAction: async () => { await Clipboard.copy(content as string, { transient: transient as boolean, concealed: concealed as boolean }); onCopy?.(content); await showToast({ style: Toast.Style.Success, title: 'Copied to Clipboard' }); } });
}
function ActionPaste(p: AnyProps) {
  const { content, onPaste, ...rest } = p as AnyProps & { content: unknown; onPaste?: (c: unknown) => void };
  return host('Action', { title: 'Paste in Active App', icon: 'clipboard-16', ...rest, kind: 'paste', onAction: async () => { await Clipboard.paste(content as string); onPaste?.(content); } });
}
function ActionOpen(p: AnyProps) {
  const { target, application, onOpen, ...rest } = p as AnyProps & { target: string; application?: unknown; onOpen?: (t: string) => void };
  return host('Action', { title: 'Open', icon: 'arrow-ne-16', ...rest, kind: 'open', onAction: async () => { await open(target, application as string); onOpen?.(target); } });
}
function ActionOpenInBrowser(p: AnyProps) {
  const { url, onOpen, ...rest } = p as AnyProps & { url: string; onOpen?: (u: string) => void };
  return host('Action', { title: 'Open in Browser', icon: 'globe-01-16', ...rest, kind: 'open', onAction: async () => { await open(url); onOpen?.(url); } });
}
function ActionOpenWith(p: AnyProps) {
  const { path, onOpen, ...rest } = p as AnyProps & { path: string; onOpen?: (u: string) => void };
  return host('Action', { title: 'Open With…', icon: 'app-window-16', ...rest, kind: 'open', onAction: async () => { await open(path); onOpen?.(path); } });
}
function ActionShowInFinder(p: AnyProps) {
  const { path, onShow, ...rest } = p as AnyProps & { path: string; onShow?: (u: string) => void };
  return host('Action', { title: 'Show in Finder', icon: 'finder-16', ...rest, kind: 'finder', onAction: async () => { await showInFinder(path); onShow?.(path); } });
}
function ActionTrash(p: AnyProps) {
  const { paths, onTrash, ...rest } = p as AnyProps & { paths: string | string[]; onTrash?: (u: unknown) => void };
  return host('Action', { title: 'Move to Trash', icon: 'trash-16', style: 'destructive', ...rest, kind: 'trash', onAction: async () => { await trash(paths); onTrash?.(paths); } });
}
function ActionCreateQuicklink(p: AnyProps) {
  const { quicklink, ...rest } = p as AnyProps & { quicklink: { link: string; name?: string } };
  return host('Action', { title: 'Create Quicklink', icon: 'link-16', ...rest, kind: 'quicklink', onAction: async () => { await runtime.host('createQuicklink', quicklink); } });
}
function ActionCreateSnippet(p: AnyProps) {
  const { snippet, ...rest } = p as AnyProps & { snippet: unknown };
  return host('Action', { title: 'Create Snippet', icon: 'snippets-16', ...rest, kind: 'snippet', onAction: async () => { await runtime.host('createSnippet', snippet); } });
}
function ActionToggleQuickLook(p: AnyProps) { return host('Action', { title: 'Quick Look', icon: 'eye-16', ...p, kind: 'quicklook' }); }
function ActionPickDate(p: AnyProps) {
  const { onChange, ...rest } = p as AnyProps & { onChange: (d: Date | null) => void };
  return host('Action', { title: 'Pick Date', icon: 'calendar-16', ...rest, kind: 'pickdate', onAction: (iso?: string) => onChange(iso ? new Date(iso) : null) });
}
export const Action = Object.assign(ActionFn, {
  Style: ActionStyle,
  Push: ActionPush, SubmitForm: ActionSubmitForm, CopyToClipboard: ActionCopy, Paste: ActionPaste,
  Open: ActionOpen, OpenInBrowser: ActionOpenInBrowser, OpenWith: ActionOpenWith, ShowInFinder: ActionShowInFinder,
  Trash: ActionTrash, CreateQuicklink: ActionCreateQuicklink, CreateSnippet: ActionCreateSnippet,
  ToggleQuickLook: ActionToggleQuickLook, PickDate: Object.assign(ActionPickDate, { Type: { Date: 'date', DateTime: 'date_time' } }),
  InstallMCPServer: (p: AnyProps) => host('Action', { title: 'Install MCP Server', ...p, kind: 'noop' }),
});
(ActionPanel as { Item: unknown }).Item = Action;
export const ActionPanelItem = Action, ActionPanelSection_ = ActionPanel.Section, ActionPanelSubmenu_ = ActionPanel.Submenu;

// ── MenuBarExtra ────────────────────────────────────────────────────────
function MenuBarExtraFn(p: AnyProps) { return host('MenuBarExtra', p, {}, p.children); }
export const MenuBarExtra = Object.assign(MenuBarExtraFn, {
  Item: (p: AnyProps) => host('MenuBarExtra.Item', p, { alternate: p.alternate }),
  Separator: (p: AnyProps) => host('MenuBarExtra.Separator', p),
  Section: (p: AnyProps) => host('MenuBarExtra.Section', p, {}, p.children),
  Submenu: (p: AnyProps) => host('MenuBarExtra.Submenu', p, {}, p.children),
});
