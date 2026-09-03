// Raycast 1.x API names still used by older store extensions.
import { Action, ActionPanel } from './components';
import { Toast, Image, Keyboard, Alert } from './api-core';
import { runtime } from './runtime';
import type { ReactNode } from 'react';

export const ToastStyle = Toast.Style;
export type KeyboardShortcut = { modifiers: string[]; key: string };
export const PushAction = Action.Push;
export const OpenInBrowserAction = Action.OpenInBrowser;
export const CopyToClipboardAction = Action.CopyToClipboard;
export const PasteAction = Action.Paste;
export const OpenAction = Action.Open;
export const OpenWithAction = Action.OpenWith;
export const ShowInFinderAction = Action.ShowInFinder;
export const TrashAction = Action.Trash;
export const SubmitFormAction = Action.SubmitForm;
export const ActionPanelSection = ActionPanel.Section;
export const ActionPanelSubmenu = ActionPanel.Submenu;
/** Raycast 1.x: extensions called `render(<Command />)` themselves. */
export function render(el: ReactNode): void { runtime.mountRoot(el); }
export function randomId(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
export const preferences: Record<string, { value: unknown }> = new Proxy({}, { get: (_t, k) => ({ value: runtime.preferences[k as string] }) });
