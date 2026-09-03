// Worker iframe: always-on. Owns the tool sidecar (AI tools), background (no-view) commands,
// scheduled menu-bar refreshes, and registers ⌘K actions / handlers that must outlive the view.
import { ExtensionContext as WorkerExtensionContext, extensionBridge } from 'asyar-sdk/worker';
import type { Extension, ExtensionContext, IShellService, ILogService, IFeedbackService, IToolsService, IStatusBarService, IStatusBarItem, IOpenerService } from 'asyar-sdk/contracts';
import { Bridge } from '../common/bridge';
import type { SidecarMsg, RNode } from '../common/protocol';
import { isCallbackRef } from '../common/protocol';
import { extensionIdFromLocation, type ShimConfig } from '../common/env';
import { HostCalls } from '../view/host-calls';

async function loadSidecarSource(): Promise<string> { const r = await fetch(new URL('sidecar.cjs', window.location.href).toString()); if (!r.ok) throw new Error('sidecar.cjs ' + r.status); return r.text(); }

declare const __SHIM_CONFIG__: ShimConfig;
declare const __MANIFEST__: Record<string, unknown>;

class Worker implements Extension {
  private ctx!: ExtensionContext;
  private log!: ILogService;
  private bridge?: Bridge;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private seq = 1;
  private hostCalls!: HostCalls;
  private menuTrees = new Map<string, RNode | null>();

  async initialize(ctx: ExtensionContext) {
    this.ctx = ctx;
    this.log = ctx.getService<ILogService>('log');
    this.hostCalls = new HostCalls(ctx, 'worker', () => this.bridge!, extensionId);
    const tools = ctx.getService<IToolsService>('tools');
    const manifestTools = (__MANIFEST__.tools as { id: string; name: string; description: string; parameters: Record<string, unknown> }[]) ?? [];
    this.log.info(`[rc-worker] initialize: registering ${manifestTools.length} tools`);
    for (const t of manifestTools) {
      try { await Promise.race([tools.registerTool(t, async (args) => this.callTool(t.id, args)), new Promise((_, rej) => setTimeout(() => rej(new Error('registerTool timeout')), 8000))]); this.log.info(`[rc-worker] registered ${t.id}`); }
      catch (e) { this.log.error(`[rc-worker] registerTool ${t.id} failed: ${e}`); }
    }
    // listTools needs `tools:register`, which the manifest declares only when the extension ships tools.
    const listed = __SHIM_CONFIG__.tools.length ? await tools.listTools().catch((e) => { this.log.warn('[rc-worker] listTools failed ' + e); return []; }) : [];
    this.log.info(`[raycast-shim] worker ready, ${manifestTools.length} tools registered; registry has ${listed.filter((t) => typeof t.source === 'object' && 'extensionId' in t.source && t.source.extensionId === extensionId).length} for this extension`);
  }
  async activate() {}
  async deactivate() { this.bridge?.stop(); }
  async search() { return []; }

  private ensureBridge(): Promise<Bridge> {
    if (this.bridge?.alive) return this.bridge.start().then(() => this.bridge!);
    const shell = this.ctx.getService<IShellService>('shell');
    this.bridge = new Bridge({
      shell, nodePath: __SHIM_CONFIG__.nodePath, loadBundle: loadSidecarSource,
      onMessage: (m) => this.onMessage(m),
      onExit: (code, err) => { this.log.warn(`[raycast-shim] worker sidecar exited ${code ?? ''} ${err ?? ''}`); for (const p of this.pending.values()) p.reject(new Error('sidecar exited')); this.pending.clear(); },
    });
    const b = this.bridge;
    return b.start().then(() => {
      b.send({ t: 'init', role: 'worker', extensionId: __SHIM_CONFIG__.extensionId, extensionName: __SHIM_CONFIG__.extensionName, ownerOrAuthorName: __SHIM_CONFIG__.ownerOrAuthorName, preferences: this.prefs(), appearance: 'dark' });
      return b;
    });
  }
  private prefs(commandId?: string): Record<string, unknown> {
    const p = { ...(this.ctx.preferences.values as unknown as Record<string, unknown>) } as Record<string, unknown> & { commands?: Record<string, Record<string, unknown>> };
    const cmdPrefs = commandId ? p.commands?.[commandId] : undefined;
    delete p.commands;
    const d = __SHIM_CONFIG__.prefDefaults;
    return { ...d.global, ...(commandId ? d.commands[commandId] : undefined), ...p, ...(cmdPrefs ?? {}) };
  }

  private async callTool(toolId: string, args: unknown): Promise<unknown> {
    const b = await this.ensureBridge();
    const callId = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(callId, { resolve, reject });
      b.send({ t: 'tool', callId, toolId, args });
      setTimeout(() => { if (this.pending.has(callId)) { this.pending.delete(callId); reject(new Error('tool timeout')); } }, 120_000);
    });
  }

  private onMessage(m: SidecarMsg) {
    switch (m.t) {
      case 'tool-result': { const p = this.pending.get(m.callId); this.pending.delete(m.callId); if (!p) return; m.error ? p.reject(new Error(m.error)) : p.resolve(m.result); return; }
      case 'run-done': { const p = this.pending.get(m.runId); this.pending.delete(m.runId); if (!p) return; m.error ? p.reject(new Error(m.error)) : p.resolve(undefined); return; }
      case 'host': void this.hostCalls.handle(m); return;
      case 'log': (m.level === 'error' ? this.log.error : m.level === 'warn' ? this.log.warn : this.log.info).call(this.log, '[sidecar] ' + m.text); return;
      case 'render': this.renderMenuBar(m.stack[m.stack.length - 1]?.tree ?? null); return;
      case 'alert': { const fb = this.ctx.getService<IFeedbackService>('feedback'); void fb.confirmAlert({ title: m.alert.title, message: m.alert.message ?? '', confirmText: m.alert.primaryAction?.title, cancelText: m.alert.dismissAction?.title, variant: m.alert.primaryAction?.style === 'destructive' ? 'danger' : 'default' }).then((ok) => this.bridge?.send({ t: 'alert-result', id: m.alert.id, confirmed: ok })); return; }
      default: return;
    }
  }

  /** Background (no-view) and menu-bar commands run here. */
  async executeCommand(commandId: string, args?: Record<string, unknown>): Promise<unknown> {
    const cmd = __SHIM_CONFIG__.commands[commandId];
    if (!cmd) return;
    const b = await this.ensureBridge();
    const runId = this.seq++;
    this.currentMenuCommand = cmd.mode === 'menu-bar' ? commandId : this.currentMenuCommand;
    return new Promise((resolve, reject) => {
      this.pending.set(runId, { resolve, reject });
      b.send({ t: 'run', runId, commandId, mode: cmd.mode, launchType: (args?.__launchType as 'userInitiated' | 'background') ?? 'userInitiated', arguments: (args?.arguments as Record<string, unknown>) ?? {}, launchContext: args?.launchContext as Record<string, unknown> | undefined, preferences: this.prefs(commandId) });
    });
  }
  private currentMenuCommand: string | null = null;

  // ── MenuBarExtra → Asyar status bar ────────────────────────────────────
  private renderMenuBar(tree: RNode | null) {
    if (!this.currentMenuCommand) return;
    const statusBar = this.ctx.getService<IStatusBarService>('statusBar');
    const id = `rc-${this.currentMenuCommand}`;
    if (!tree || tree.type !== 'MenuBarExtra') { if (this.menuTrees.has(id)) { statusBar.unregisterItem(id); this.menuTrees.delete(id); } return; }
    // Asyar validates status-bar ids: no ':' and unique among siblings; React keys (n.k) may contain ':' and
    // sections flatten into the parent's sibling list, so build ids from a per-level counter instead.
    const seen = new Set<string>();
    const sid = (n: RNode) => { let base = `${id}-${String(n.k ?? '').replace(/[^A-Za-z0-9_-]/g, '_')}`; let c = base, i = 1; while (seen.has(c)) c = `${base}_${i++}`; seen.add(c); return c; };
    const toItems = (nodes: RNode[]): IStatusBarItem[] => nodes.flatMap((n): IStatusBarItem[] => {
      if (n.type === 'MenuBarExtra.Item') return [{ id: sid(n), text: [n.props.title, n.props.subtitle].filter(Boolean).join('  ') || ' ', icon: iconOf(n.props.icon), onClick: () => { const cb = n.props.onAction; if (isCallbackRef(cb)) this.bridge?.send({ t: 'cb', id: cb.$cb, args: [{ type: 'left-click' }] }); } }];
      if (n.type === 'MenuBarExtra.Separator') return [{ separator: true }];
      if (n.type === 'MenuBarExtra.Section') return [...(n.props.title ? [{ text: String(n.props.title), enabled: false }] : []), ...toItems(n.children)];
      if (n.type === 'MenuBarExtra.Submenu') return [{ id: sid(n), text: String(n.props.title ?? ''), submenu: toItems(n.children) }];
      return [];
    });
    const item: IStatusBarItem = { id, text: tree.props.title ? String(tree.props.title) : '', icon: iconOf(tree.props.icon) ?? (typeof __MANIFEST__.icon === 'string' && !__MANIFEST__.icon.includes('/') ? __MANIFEST__.icon : '💬'), submenu: toItems(tree.children) };
    try { if (this.menuTrees.has(id)) statusBar.updateItem(id, item); else statusBar.registerItem(item); }
    catch (e) { this.log.warn(`[rc-worker] status bar item rejected: ${(e as Error).message}`); return; }
    this.menuTrees.set(id, tree);
  }

  onUnload = () => { this.bridge?.stop(); };
}

function iconOf(v: unknown): string | undefined {
  if (typeof v === 'string' && !v.endsWith('-16')) return v;
  return undefined;
}

const extensionId = extensionIdFromLocation(__SHIM_CONFIG__.extensionId);
const workerContext = new WorkerExtensionContext();
workerContext.setExtensionId(extensionId);
try { workerContext.getService<ILogService>('log').info('[rc-worker] boot ' + extensionId); } catch (e) { /* ignore */ }
window.addEventListener('error', (e) => { try { workerContext.getService<ILogService>('log').error('[rc-worker] error ' + (e.error?.stack ?? e.message)); } catch { /* ignore */ } });
window.addEventListener('unhandledrejection', (e) => { try { workerContext.getService<ILogService>('log').error('[rc-worker] rejection ' + ((e.reason as Error)?.stack ?? e.reason)); } catch { /* ignore */ } });
const impl = new Worker();
extensionBridge.registerManifest(__MANIFEST__ as never);
extensionBridge.registerExtensionImplementation(extensionId, impl);
impl.initialize(workerContext as unknown as ExtensionContext).catch((e) => { try { workerContext.getService<ILogService>('log').error('[rc-worker] initialize failed ' + ((e as Error)?.stack ?? e)); } catch { /* ignore */ } });
