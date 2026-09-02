// Sidecar runtime: owns the navigation stack, toasts, host RPC and the render loop.
import type { ReactNode } from 'react';
import { createRoot, serialize, CallbackRegistry, type Root } from './reconciler';
import type { SidecarMsg, ClientMsg, RNode, ToastState, HostMethod } from '../common/protocol';

type Send = (m: SidecarMsg) => void;

interface StackEntry { id: number; root: Root; onPop?: () => void; title?: string }

class Runtime {
  send: Send = () => {};
  role: 'view' | 'worker' = 'view';
  extensionId = '';
  extensionName = '';
  ownerOrAuthorName = '';
  preferences: Record<string, unknown> = {};
  appearance: 'light' | 'dark' = 'dark';
  currentCommand: { id: string; mode: 'view' | 'no-view' | 'menu-bar'; launchType: string; launchContext?: Record<string, unknown> } | null = null;

  readonly cbs = new CallbackRegistry();
  private stack: StackEntry[] = [];
  private toasts: ToastState[] = [];
  private renderScheduled = false;
  private hostCalls = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private hostSeq = 1;
  private alerts = new Map<number, (ok: boolean) => void>();
  private alertSeq = 1;
  searchText = '';
  private searchListeners = new Set<(t: string) => void>();

  // ── navigation ─────────────────────────────────────────────────────────
  private entrySeq = 1;
  readonly nav = {
    push: (el: ReactNode, onPop?: () => void) => {
      const id = this.entrySeq++;
      const root = createRoot(() => this.scheduleRender());
      this.stack.push({ id, root, onPop });
      root.render(el);
      this.scheduleRender();
    },
    pop: () => {
      if (this.stack.length <= 1) { void this.host('popToRoot', {}); return; }
      const e = this.stack.pop()!;
      e.root.unmount();
      e.onPop?.();
      this.scheduleRender();
    },
    popToRoot: () => {
      while (this.stack.length > 1) { const e = this.stack.pop()!; e.root.unmount(); e.onPop?.(); }
      this.scheduleRender();
    },
    depth: () => this.stack.length,
    trimTo: (n: number) => { while (this.stack.length > Math.max(1, n)) { const e = this.stack.pop()!; e.root.unmount(); e.onPop?.(); } this.scheduleRender(); },
  };

  mountRoot(el: ReactNode): void {
    for (const e of this.stack) e.root.unmount();
    this.stack = [];
    this.nav.push(el);
  }
  unmountAll(): void {
    for (const e of this.stack) e.root.unmount();
    this.stack = [];
  }

  // ── rendering ──────────────────────────────────────────────────────────
  scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    queueMicrotask(() => { this.renderScheduled = false; this.flush(); });
  }
  private flush(): void {
    const live = new Set<number>();
    const stack = this.stack.map((e) => {
      const inst = e.root.container.root;
      const tree: RNode | null = inst ? serialize(inst, this.cbs, live) : null;
      const title = tree?.props?.navigationTitle as string | undefined;
      return { id: e.id, title, tree };
    });
    for (const t of this.toasts) { if (t.primaryAction) live.add(t.primaryAction.cb); if (t.secondaryAction) live.add(t.secondaryAction.cb); }
    for (const id of this.pinned) live.add(id);
    this.cbs.sweep(live);
    this.send({ t: 'render', stack, toasts: this.toasts });
  }
  /** Callbacks that must survive sweeps (menu-bar items, toast actions). */
  pinned = new Set<number>();

  // ── toasts ─────────────────────────────────────────────────────────────
  private toastSeq = 1;
  toastCreate(): number { return this.toastSeq++; }
  toastUpsert(t: ToastState): void {
    const i = this.toasts.findIndex((x) => x.id === t.id);
    if (i >= 0) this.toasts[i] = t; else this.toasts.push(t);
    this.scheduleRender();
  }
  toastRemove(id: number): void {
    this.toasts = this.toasts.filter((x) => x.id !== id);
    this.scheduleRender();
  }

  // ── host RPC ───────────────────────────────────────────────────────────
  host(method: HostMethod | string, params: unknown): Promise<unknown> {
    const callId = this.hostSeq++;
    return new Promise((resolve, reject) => {
      this.hostCalls.set(callId, { resolve, reject });
      this.send({ t: 'host', callId, method: method as HostMethod, params });
    });
  }
  alert(a: Omit<import('../common/protocol').AlertRequest, 'id'>): Promise<boolean> {
    const id = this.alertSeq++;
    return new Promise((resolve) => { this.alerts.set(id, resolve); this.send({ t: 'alert', alert: { id, ...a } }); });
  }
  formCommand(fieldId: string, cmd: 'focus' | 'reset'): void { void this.host('form', { fieldId, cmd }); }

  onSearch(fn: (t: string) => void): () => void { this.searchListeners.add(fn); return () => this.searchListeners.delete(fn); }

  // ── inbound ────────────────────────────────────────────────────────────
  async handle(m: ClientMsg): Promise<void> {
    switch (m.t) {
      case 'cb': {
        const fn = this.cbs.get(m.id);
        if (!fn) { this.send({ t: 'log', level: 'warn', text: `stale callback ${m.id}` }); return; }
        try { await fn(...m.args); } catch (e) { this.send({ t: 'log', level: 'error', text: `callback ${m.id}: ${(e as Error)?.stack ?? e}` }); }
        return;
      }
      case 'search': this.searchText = m.text; for (const l of this.searchListeners) l(m.text); return;
      case 'nav': {
        // The view reports its own depth after a host Escape; align the stack.
        while (this.stack.length > Math.max(1, m.depth)) { const e = this.stack.pop()!; e.root.unmount(); e.onPop?.(); }
        this.scheduleRender();
        return;
      }
      case 'alert-result': { const r = this.alerts.get(m.id); this.alerts.delete(m.id); r?.(m.confirmed); return; }
      case 'host-result': {
        const p = this.hostCalls.get(m.callId); this.hostCalls.delete(m.callId);
        if (!p) return;
        m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
        return;
      }
      case 'prefs': this.preferences = m.preferences; return;
      default: return;
    }
  }
}

export const runtime = new Runtime();
