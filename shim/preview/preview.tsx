// Standalone preview: renders the view App with a captured render JSON and a stub host. For headless screenshots.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../packages/view/view.css';
import { App, type AppState } from '../packages/view/app';
declare const __RENDER__: { stack: AppState['stack']; toasts: AppState['toasts'] };
declare const __THEME__: Record<string, string>;
for (const [k, v] of Object.entries(__THEME__)) document.documentElement.style.setProperty(k, v);
const q = new URLSearchParams(location.search);
const state: AppState = { stack: __RENDER__.stack, toasts: __RENDER__.toasts, searchText: q.get('q') ?? '' };
const noop = () => {};
const host = { invoke: noop, search: noop, setAccessory: noop, onAccessoryChange: () => () => {}, setActionLabel: noop, setSubtitle: noop, navDepth: noop, pop: noop, syncActions: noop, alertResult: noop, registerFormHandle: noop, storeGet: async () => null, storeSet: async () => {} };
createRoot(document.getElementById('app')!).render(<App state={state} host={host} />);
(window as unknown as { __dbg: unknown }).__dbg = { items: state.stack[state.stack.length - 1]?.tree?.children.filter((c) => c.type === 'List.Item').length };
if (q.get('key')) setTimeout(() => { for (const k of q.get('key')!.split(',')) window.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey: k === 'k', bubbles: true })); }, 50);
