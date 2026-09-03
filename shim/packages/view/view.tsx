// View iframe entry: Asyar SDK wiring, sidecar bridge, host key routing, React mount.
import 'asyar-sdk/tokens.css';
import './view.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionContext, extensionBridge, searchBarAccessory } from 'asyar-sdk/view';
import type { Extension, IExtensionManager, IShellService, ILogService, IStorageService, IExtensionManager as IEM, IActionService } from 'asyar-sdk/contracts';
import { ActionContext } from 'asyar-sdk/contracts';
import type { FlatSection, FlatAction } from './app';
import { Bridge } from '../common/bridge';
import type { SidecarMsg, ToastState, AlertRequest } from '../common/protocol';
import { extensionIdFromLocation, type ShimConfig } from '../common/env';
import { HostCalls } from './host-calls';
import { App, type AppState, type HostApi, type StackEntry } from './app';
import { setImageContext } from './image';
import type { FormHandle } from './form';

const SPAWN_KEY = 'rc:view:spawnId';
const MOD: Record<string, string> = { cmd: 'Super', ctrl: 'Control', opt: 'Alt', alt: 'Alt', shift: 'Shift' };
const KEY: Record<string, string> = { return: 'Enter', enter: 'Enter', delete: 'Backspace', backspace: 'Backspace', deleteForward: 'Delete', tab: 'Tab', arrowUp: 'ArrowUp', arrowDown: 'ArrowDown', arrowLeft: 'ArrowLeft', arrowRight: 'ArrowRight', space: 'Space', escape: 'Escape' };
function toHostShortcut(s: { modifiers: string[]; key: string }): string { return [...s.modifiers.map((m) => MOD[m] ?? m), KEY[s.key] ?? s.key.toUpperCase()].join('+'); }
async function loadSidecarSource(): Promise<string> { const r = await fetch(new URL('sidecar.cjs', window.location.href).toString()); if (!r.ok) throw new Error('sidecar.cjs ' + r.status); return r.text(); }

declare const __SHIM_CONFIG__: ShimConfig;
declare const __MANIFEST__: Record<string, unknown>;

const extensionId = extensionIdFromLocation(__SHIM_CONFIG__.extensionId);
setImageContext(extensionId);
const context = new ExtensionContext();
context.setExtensionId(extensionId);

class ViewShell implements Extension {
  private em!: IExtensionManager;
  private log!: ILogService;
  private storage!: IStorageService;
  private actions!: IActionService;
  private registeredActionIds: string[] = [];
  private bridge?: Bridge;
  private hostCalls!: HostCalls;
  private state: AppState = { stack: [], toasts: [], searchText: '' };
  private reactRoot = createRoot(document.getElementById('app')!);
  private keySeq = 0;
  private accessoryListeners = new Set<(v: string) => void>();
  private formHandle: FormHandle | null = null;
  private runSeq = 1;
  private activeCommand: string | null = null;

  async initialize(ctx: ExtensionContext) {
    this.em = ctx.getService<IEM>('extensions');
    this.log = ctx.getService<ILogService>('log');
    this.storage = ctx.getService<IStorageService>('storage');
    this.actions = ctx.getService<IActionService>('actions');
    this.hostCalls = new HostCalls(ctx, 'view', () => this.bridge!, extensionId);
    this.hostCalls.viewHandlers = {
      popToRoot: () => { this.em.goBack(); },
      navPop: () => { this.em.goBack(); },
      clearSearchBar: () => { window.parent.postMessage({ type: 'asyar:extension:keydown', payload: { key: 'Escape', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false } }, '*'); },
      form: (p) => { const q = p as { fieldId: string; cmd: 'focus' | 'reset' }; this.formHandle?.[q.cmd](q.fieldId); },
      accessory: (p) => searchBarAccessory.set(p as never),
      setSubtitle: (p) => this.em.setActiveViewSubtitle(String((p as { subtitle?: string }).subtitle ?? '') || null),
    };
    searchBarAccessory.onChange((v) => { for (const l of this.accessoryListeners) l(v); });
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent) return;
      const { type, payload } = e.data ?? {};
      if (type === 'asyar:view:search') { this.state = { ...this.state, searchText: String(payload?.query ?? '') }; this.render(); }
      else if (type === 'asyar:view:keydown' && payload) { this.log.info(`[rc-view] hostKey ${payload.key}`); this.state = { ...this.state, hostKey: { ...payload, seq: ++this.keySeq } }; this.render(); setTimeout(() => { const sel = document.querySelector('.rc-row[data-selected="true"]'); this.log.info(`[rc-dom] after key sel="${(sel?.textContent ?? '').slice(0, 60)}" depth=${this.state.stack.length}`); }, 150); }
    });
    (window as unknown as { __rcLog?: (m: string) => void }).__rcLog = (m) => this.log.info('[rc-dbg] ' + m);
    this.render();
    // The host mounts view.html?view=<component> and does not dispatch executeCommand to Tier 2 views.
    const view = new URLSearchParams(window.location.search).get('view');
    if (view && __SHIM_CONFIG__.commands[view]) void this.executeCommand(view);
  }
  async activate() {}
  async deactivate() {}

  private prefs(): Record<string, unknown> {
    // `.values` only: spreading the facade itself leaks its `proxy`/`values` fields into the extension's preferences.
    const p = { ...(context.preferences.values as unknown as Record<string, unknown>) } as Record<string, unknown> & { commands?: Record<string, Record<string, unknown>> };
    const cmdPrefs = this.activeCommand ? p.commands?.[this.activeCommand] : undefined;
    delete p.commands;
    const d = __SHIM_CONFIG__.prefDefaults;
    return { ...d.global, ...(this.activeCommand ? d.commands[this.activeCommand] : undefined), ...p, ...(cmdPrefs ?? {}) };
  }

  /** Returns the bridge and whether the command must be (re)run. Reuses a live sidecar when possible. */
  private ensureBridge(commandId: string): Promise<{ b: Bridge; needRun: boolean }> {
    const shell = context.getService<IShellService>('shell');
    if (this.bridge?.alive) return Promise.resolve({ b: this.bridge, needRun: true });
    this.bridge = new Bridge({
      shell, nodePath: __SHIM_CONFIG__.nodePath, loadBundle: loadSidecarSource,
      onMessage: (m) => this.onMessage(m),
      onExit: (code, err) => { this.log.warn(`[raycast-shim] view sidecar exited ${code ?? ''} ${err ?? ''}`); void this.storage.delete(SPAWN_KEY); this.bridge = undefined; this.state = { ...this.state, stack: [], toasts: [] }; this.render(); },
    });
    const b = this.bridge;
    return (async () => {
      const prev = await this.storage.get(SPAWN_KEY);
      if (prev) {
        const live = (await shell.list()).some((d) => d.spawnId === prev);
        if (live) {
          try { const r = await b.attach(prev, { commandId, depth: 0, fresh: true }); this.log.info(`[rc-view] attached to ${prev} needRun=${r.needRun}`); return { b, needRun: r.needRun }; }
          catch (e) { this.log.warn('[raycast-shim] attach failed, respawning: ' + e); this.bridge = undefined; return this.ensureBridge(commandId); }
        }
      }
      await b.start();
      await this.storage.set(SPAWN_KEY, b.spawnId!);
      b.send({ t: 'init', role: 'view', extensionId, extensionName: __SHIM_CONFIG__.extensionName, ownerOrAuthorName: __SHIM_CONFIG__.ownerOrAuthorName, preferences: this.prefs(), appearance: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' });
      return { b, needRun: true };
    })();
  }

  private onMessage(m: SidecarMsg) {
    switch (m.t) {
      case 'render': {
        this.state = { ...this.state, stack: m.stack as StackEntry[], toasts: m.toasts as ToastState[] }; this.render();
        const top = m.stack[m.stack.length - 1]?.tree; const kids = top?.children.filter((c) => !c.type.startsWith('$')).length ?? 0;
        this.log.info(`[rc-view] render depth=${m.stack.length} root=${top?.type ?? 'null'} kids=${kids} toasts=${m.toasts.map((t) => t.style + ':' + t.title + (t.message ? ' ' + t.message : '')).join(' | ')}`);
        setTimeout(() => { const rows = document.querySelectorAll('.rc-row'); const sel = document.querySelector('.rc-row[data-selected="true"]'); this.log.info(`[rc-dom] rows=${rows.length} imgs=${document.querySelectorAll('.rc-row img').length} svg=${document.querySelectorAll('.rc-row svg').length} sel="${(sel?.textContent ?? '').slice(0, 80)}" h=${document.body.clientHeight}`); }, 200);
        return;
      }
      case 'host': void this.hostCalls.handle(m); return;
      case 'alert': this.state = { ...this.state, alert: m.alert as AlertRequest }; this.render(); return;
      case 'log': (m.level === 'error' ? this.log.error : m.level === 'warn' ? this.log.warn : this.log.info).call(this.log, '[sidecar] ' + m.text.slice(0, 600)); return;
      case 'ready': this.log.info('[rc-view] sidecar ready'); return;
      case 'run-done': if (m.error) this.log.error('[raycast-shim] run failed: ' + m.error); return;
      default: return;
    }
  }

  /** Host calls this for each view-mode command; the component name equals the command id. */
  async executeCommand(commandId: string, args?: Record<string, unknown>): Promise<unknown> {
    const cmd = __SHIM_CONFIG__.commands[commandId];
    if (!cmd) return;
    this.activeCommand = commandId;
    this.state = { ...this.state, stack: [], toasts: [], searchText: '' };
    this.render();
    this.log.info(`[rc-view] executeCommand ${commandId}`);
    const { b, needRun } = await this.ensureBridge(commandId);
    if (needRun) b.send({ t: 'run', runId: this.runSeq++, commandId, mode: 'view', launchType: 'userInitiated', arguments: (args?.arguments as Record<string, unknown>) ?? {}, launchContext: args?.launchContext as Record<string, unknown> | undefined, preferences: this.prefs() });
    return { type: 'view', viewPath: `${extensionId}/${commandId}` };
  }

  async viewActivated(viewPath: string) {
    const commandId = viewPath.split('/')[1];
    if (commandId && commandId !== this.activeCommand) await this.executeCommand(commandId);
  }
  async viewDeactivated() {}

  private host: HostApi = {
    invoke: (id, ...args) => this.bridge?.send({ t: 'cb', id, args }),
    search: (text) => this.bridge?.send({ t: 'search', text }),
    setAccessory: (options, value) => { if (!options) { void searchBarAccessory.clear().catch(() => {}); return; } void searchBarAccessory.set({ options, value }).catch((e) => this.log.warn('accessory set failed ' + e)); },
    onAccessoryChange: (fn) => { this.accessoryListeners.add(fn); return () => this.accessoryListeners.delete(fn); },
    setActionLabel: (label) => this.em.setActiveViewActionLabel(label),
    setSubtitle: (s) => this.em.setActiveViewSubtitle(s),
    navDepth: (d) => this.bridge?.send({ t: 'nav', depth: d }),
    pop: () => this.bridge?.send({ t: 'nav', depth: this.state.stack.length - 1 }),
    alertResult: (id, ok) => { this.bridge?.send({ t: 'alert-result', id, confirmed: ok }); this.state = { ...this.state, alert: undefined }; this.render(); },
    registerFormHandle: (h) => { this.formHandle = h; },
    syncActions: (sections, run) => this.syncActions(sections, run),
    storeGet: (k) => this.storage.get(k),
    storeSet: (k, v) => this.storage.set(k, v),
  };

  /** Mirror the current ActionPanel into Asyar's ⌘K drawer (skipping the primary, which sits on Enter). */
  private syncActions(sections: FlatSection[], run: (a: FlatAction) => void) {
    for (const id of this.registeredActionIds) this.actions.unregisterAction(id);
    this.registeredActionIds = [];
    let n = 0;
    sections.forEach((sec, si) => sec.actions.forEach((a, ai) => {
      const id = `rc-${si}-${ai}-${a.node.k}`;
      const shortcut = a.shortcut ? toHostShortcut(a.shortcut) : (si === 0 && ai === 0 ? 'Enter' : undefined);
      this.actions.registerAction({ id, title: a.title + (a.submenu ? ' ›' : ''), icon: typeof a.node.props.icon === 'string' && !a.node.props.icon.endsWith('-16') ? a.node.props.icon : undefined, extensionId, category: sec.title ?? (si === 0 ? __SHIM_CONFIG__.extensionName : 'More'), context: ActionContext.EXTENSION_VIEW, shortcut, destructive: a.style === 'destructive', execute: () => { run(a); } });
      this.registeredActionIds.push(id); n++;
    }));
    return n;
  }
  private render() { this.reactRoot.render(<App state={this.state} host={this.host} />); }
  onUnload = () => { this.bridge?.stop(); };
}

const impl = new ViewShell();
extensionBridge.registerManifest(__MANIFEST__ as never);
extensionBridge.registerExtensionImplementation(extensionId, impl);
void impl.initialize(context);
window.parent.postMessage({ type: 'asyar:extension:loaded', extensionId }, '*');
