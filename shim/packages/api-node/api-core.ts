// Non-UI @raycast/api surface, running in the Node sidecar.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { runtime } from './runtime';
import enums from './enums.json' with { type: 'json' };

const APP_DATA = path.join(os.homedir(), 'Library/Application Support/org.asyar.app');
export const shimRoot = () => path.join(APP_DATA, 'raycast-shim', runtime.extensionId);
/** Installed extension directory (assets/, package.json, bin/). */
export const extensionDir = () => (globalThis as Record<string, unknown>).__rcExtensionDir as string | undefined ?? path.join(APP_DATA, 'extensions', runtime.extensionId);
const ensure = (p: string) => { fs.mkdirSync(p, { recursive: true }); return p; };

// ── enums ───────────────────────────────────────────────────────────────
export const Icon = enums.Icon as Record<string, string>;
export const Color = Object.assign({ ...enums.Color }, { Brown: { light: '#A0522D', dark: '#A0522D' } }) as Record<string, unknown>;
export const LaunchType = enums.LaunchType as { UserInitiated: 'userInitiated'; Background: 'background' };
export const PopToRootType = enums.PopToRootType as Record<string, string>;
export const ImageMask = enums.ImageMask as { Circle: 'circle'; RoundedRectangle: 'roundedRectangle' };
export const Image = { Mask: ImageMask };
export const AlertActionStyle = enums.AlertActionStyle_2 as Record<string, string>;
export const Alert = { ActionStyle: AlertActionStyle };
const ToastStyle = { Success: 'SUCCESS', Failure: 'FAILURE', Animated: 'ANIMATED' } as const;

// ── environment ─────────────────────────────────────────────────────────
export const environment = {
  get raycastVersion() { return '1.104.25'; },
  get ownerOrAuthorName() { return runtime.ownerOrAuthorName; },
  get extensionName() { return runtime.extensionName; },
  get entryPointType() { return 'command' as const; },
  get entryPointName() { return runtime.currentCommand?.id ?? ''; },
  get entryPointMode() { return runtime.currentCommand?.mode ?? 'view'; },
  get commandName() { return runtime.currentCommand?.id ?? ''; },
  get commandMode() { return runtime.currentCommand?.mode ?? 'view'; },
  get assetsPath() { return path.join(extensionDir(), 'assets'); },
  get supportPath() { return ensure(path.join(shimRoot(), 'support')); },
  get isDevelopment() { return false; },
  get appearance() { return runtime.appearance; },
  get theme() { return runtime.appearance; },
  get textSize() { return 'medium' as const; },
  get launchType() { return runtime.currentCommand?.launchType ?? 'userInitiated'; },
  get launchContext() { return runtime.currentCommand?.launchContext; },
  canAccess: () => true,
};

export function getPreferenceValues<T = Record<string, unknown>>(): T {
  return { ...runtime.preferences } as T;
}

// ── Toast ───────────────────────────────────────────────────────────────
export class Toast {
  static Style = ToastStyle;
  private id = runtime.toastCreate();
  private opts: { title: string; message?: string; style?: string; primaryAction?: { title: string; onAction: (t: Toast) => void }; secondaryAction?: { title: string; onAction: (t: Toast) => void } };
  constructor(opts: Toast['opts']) { this.opts = { ...opts }; }
  get style() { return this.opts.style as never; } set style(s) { this.opts.style = s; this.push(); }
  get title() { return this.opts.title; } set title(t) { this.opts.title = t; this.push(); }
  get message() { return this.opts.message; } set message(m) { this.opts.message = m; this.push(); }
  get primaryAction() { return this.opts.primaryAction; } set primaryAction(a) { this.opts.primaryAction = a; this.push(); }
  get secondaryAction() { return this.opts.secondaryAction; } set secondaryAction(a) { this.opts.secondaryAction = a; this.push(); }
  private cbIds: number[] = [];
  private push() {
    for (const id of this.cbIds) runtime.pinned.delete(id);
    this.cbIds = [];
    const act = (a?: { title: string; onAction: (t: Toast) => void }) => {
      if (!a) return undefined;
      const cb = runtime.cbs.registerAnon(() => a.onAction(this));
      runtime.pinned.add(cb); this.cbIds.push(cb);
      return { title: a.title, cb };
    };
    runtime.toastUpsert({ id: this.id, style: (this.opts.style ?? 'SUCCESS') as never, title: this.opts.title, message: this.opts.message, primaryAction: act(this.opts.primaryAction), secondaryAction: act(this.opts.secondaryAction) });
  }
  async show() { this.push(); }
  async hide() { for (const id of this.cbIds) runtime.pinned.delete(id); runtime.toastRemove(this.id); }
}
export async function showToast(a: Toast['opts'] | string, title?: string, message?: string): Promise<Toast> {
  const opts = typeof a === 'string' ? { style: a, title: title ?? '', message } : a;
  const t = new Toast(opts);
  await t.show();
  return t;
}
export async function showHUD(title: string, options?: { clearRootSearch?: boolean; popToRootType?: string }) {
  await runtime.host('showHUD', { title, ...options });
}

// ── window / navigation ─────────────────────────────────────────────────
export async function closeMainWindow(options?: { clearRootSearch?: boolean; popToRootType?: string }) {
  await runtime.host('hideWindow', options ?? {});
}
export async function popToRoot(options?: { clearSearchBar?: boolean }) {
  runtime.nav.popToRoot();
  await runtime.host('popToRoot', options ?? {});
}
export async function clearSearchBar(options?: { forceScrollToTop?: boolean }) { await runtime.host('clearSearchBar', options ?? {}); }
export function useNavigation() { return { push: runtime.nav.push, pop: runtime.nav.pop }; }
export async function confirmAlert(options: { title: string; message?: string; icon?: unknown; primaryAction?: { title: string; style?: string; onAction?: () => void }; dismissAction?: { title: string; style?: string; onAction?: () => void } }): Promise<boolean> {
  const ok = await runtime.alert({ title: options.title, message: options.message, icon: options.icon, primaryAction: options.primaryAction && { title: options.primaryAction.title, style: options.primaryAction.style }, dismissAction: options.dismissAction && { title: options.dismissAction.title, style: options.dismissAction.style } });
  if (ok) options.primaryAction?.onAction?.(); else options.dismissAction?.onAction?.();
  return ok;
}
export async function launchCommand(options: { name: string; type: string; arguments?: unknown; context?: unknown; extensionName?: string; ownerOrAuthorName?: string; fallbackText?: string }) {
  await runtime.host('launchCommand', options);
}
export async function openExtensionPreferences() { await runtime.host('openPreferences', {}); }
/** Raycast: update the subtitle shown next to the command in the root search. */
export async function updateCommandMetadata(metadata: { subtitle?: string | null }) { await runtime.host('updateCommandMetadata', { commandId: runtime.currentCommand?.id, subtitle: metadata?.subtitle ?? null }); }
export async function clearSearchBarAndPopToRoot() { await popToRoot({ clearSearchBar: true }); }
export async function openCommandPreferences() { await runtime.host('openPreferences', { command: runtime.currentCommand?.id }); }

// ── shell helpers ───────────────────────────────────────────────────────
const run = (cmd: string, args: string[]) => new Promise<string>((res, rej) => execFile(cmd, args, { maxBuffer: 64 << 20 }, (e, out) => (e ? rej(e) : res(out))));
const osa = (script: string) => run('/usr/bin/osascript', ['-e', script]);
const q = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

export async function open(target: string, application?: string | { path?: string; name?: string; bundleId?: string }) {
  const args: string[] = [];
  if (application) {
    const a = typeof application === 'string' ? application : application.path ?? application.bundleId ?? application.name ?? '';
    if (a) { if (a.includes('/') || a.endsWith('.app')) args.push('-a', a); else if (a.includes('.')) args.push('-b', a); else args.push('-a', a); }
  }
  args.push(target);
  await run('/usr/bin/open', args);
}
export async function trash(paths: string | string[]) {
  const list = (Array.isArray(paths) ? paths : [paths]).map((p) => `POSIX file ${q(String(p))}`).join(', ');
  await osa(`tell application "Finder" to delete {${list}}`);
}
export async function showInFinder(p: string) { await run('/usr/bin/open', ['-R', String(p)]); }
export async function getSelectedText(): Promise<string> {
  const before = await Clipboard.readText();
  await osa('tell application "System Events" to keystroke "c" using command down');
  await new Promise((r) => setTimeout(r, 120));
  const t = await Clipboard.readText();
  if (before !== undefined) await Clipboard.copy(before);
  if (!t) throw new Error('Unable to get selected text');
  return t;
}
export async function getSelectedFinderItems(): Promise<{ path: string }[]> {
  const out = await osa('tell application "Finder" to set sel to selection as alias list\nset o to ""\nrepeat with a in sel\nset o to o & POSIX path of a & linefeed\nend repeat\nreturn o');
  return out.split('\n').filter(Boolean).map((p) => ({ path: p }));
}
export async function getApplications(_path?: string) {
  const out = await run('/usr/bin/mdfind', ["kMDItemContentType == 'com.apple.application-bundle'"]);
  return out.split('\n').filter((p) => p.startsWith('/Applications') || p.startsWith('/System/Applications')).map((p) => ({ name: path.basename(p, '.app'), path: p }));
}
export async function getDefaultApplication(p: string) { return { name: 'Default', path: p }; }
export async function getFrontmostApplication() {
  const out = await osa('tell application "System Events" to get {name, bundle identifier, POSIX path of application file} of first application process whose frontmost is true');
  const [name, bundleId, p] = out.trim().split(', ');
  return { name, bundleId, path: p };
}
export function captureException(e: unknown) { runtime.send({ t: 'log', level: 'error', text: String((e as Error)?.stack ?? e) }); }
export function captureMemorySnapshot() {}

// ── Clipboard ───────────────────────────────────────────────────────────
type Content = string | number | { text: string } | { file: string } | { html: string; text?: string };
const contentText = (c: Content) => (typeof c === 'object' ? ('text' in c ? c.text ?? '' : 'file' in c ? c.file : '') : String(c));
export const Clipboard = {
  async copy(content: Content, _options?: { transient?: boolean; concealed?: boolean }) {
    if (typeof content === 'object' && 'file' in content) {
      await osa(`set the clipboard to (POSIX file ${q(content.file)})`);
      return;
    }
    await new Promise<void>((res, rej) => { const p = execFile('/usr/bin/pbcopy', (e) => (e ? rej(e) : res())); p.stdin!.end(contentText(content)); });
  },
  async paste(content: Content) {
    await runtime.host('pasteText', { text: contentText(content) });
  },
  async clear() { await this.copy(''); },
  async readText(): Promise<string | undefined> { try { return await run('/usr/bin/pbpaste', []); } catch { return undefined; } },
  async read(): Promise<{ text: string; file?: string; html?: string }> { return { text: (await this.readText()) ?? '' }; },
};
export const copyTextToClipboard = (t: string) => Clipboard.copy(t);
export const clearClipboard = () => Clipboard.clear();

// ── LocalStorage (per extension, JSON file) ─────────────────────────────
const lsFile = () => path.join(ensure(shimRoot()), 'local-storage.json');
const lsRead = (): Record<string, unknown> => { try { return JSON.parse(fs.readFileSync(lsFile(), 'utf8')); } catch { return {}; } };
const lsWrite = (o: Record<string, unknown>) => fs.writeFileSync(lsFile(), JSON.stringify(o));
export const LocalStorage = {
  async allItems() { return lsRead(); },
  async getItem(k: string) { return lsRead()[k]; },
  async setItem(k: string, v: unknown) { const o = lsRead(); o[k] = v; lsWrite(o); },
  async removeItem(k: string) { const o = lsRead(); delete o[k]; lsWrite(o); },
  async clear() { lsWrite({}); },
};
export const getLocalStorageItem = LocalStorage.getItem, setLocalStorageItem = LocalStorage.setItem, removeLocalStorageItem = LocalStorage.removeItem;
export const clearLocalStorage = LocalStorage.clear;
export const allLocalStorageItems = LocalStorage.allItems;

// ── Cache (synchronous, file-backed, LRU by capacity) ───────────────────
export class Cache {
  static get STORAGE_DIRECTORY_NAME() { return 'cache'; }
  static get DEFAULT_CAPACITY() { return 10 * 1024 * 1024; }
  private dir: string;
  private capacity: number;
  private subs = new Set<(k: string | undefined, d: string | undefined) => void>();
  constructor(options?: { namespace?: string; directory?: string; capacity?: number }) {
    this.dir = ensure(path.join(options?.directory ?? shimRoot(), Cache.STORAGE_DIRECTORY_NAME, options?.namespace ?? ''));
    this.capacity = options?.capacity ?? Cache.DEFAULT_CAPACITY;
    // React's useSyncExternalStore calls `subscribe` detached from the instance.
    for (const k of ['get', 'has', 'set', 'remove', 'clear', 'subscribe'] as const) (this as unknown as Record<string, unknown>)[k] = (this[k] as Function).bind(this);
  }
  get storageDirectory() { return this.dir; }
  private file(k: string) { return path.join(this.dir, encodeURIComponent(k)); }
  get(k: string): string | undefined { try { return fs.readFileSync(this.file(k), 'utf8'); } catch { return undefined; } }
  has(k: string) { return fs.existsSync(this.file(k)); }
  get isEmpty() { return fs.readdirSync(this.dir).length === 0; }
  set(k: string, data: string) { fs.writeFileSync(this.file(k), data); this.maintain(); this.notify(k, data); }
  remove(k: string) { try { fs.unlinkSync(this.file(k)); this.notify(k, undefined); return true; } catch { return false; } }
  clear(o?: { notifySubscribers: boolean }) { for (const f of fs.readdirSync(this.dir)) fs.unlinkSync(path.join(this.dir, f)); if (o?.notifySubscribers !== false) this.notify(undefined, undefined); }
  subscribe(fn: (k: string | undefined, d: string | undefined) => void) { this.subs.add(fn); return () => this.subs.delete(fn); }
  private notify(k: string | undefined, d: string | undefined) { for (const s of this.subs) s(k, d); }
  private maintain() {
    const files = fs.readdirSync(this.dir).map((f) => { const p = path.join(this.dir, f); const st = fs.statSync(p); return { p, size: st.size, m: st.mtimeMs }; });
    let total = files.reduce((a, f) => a + f.size, 0);
    files.sort((a, b) => a.m - b.m);
    for (const f of files) { if (total <= this.capacity) break; fs.unlinkSync(f.p); total -= f.size; }
  }
}

// ── AI ──────────────────────────────────────────────────────────────────
export const AI = {
  Model: enums.AIModel as Record<string, string>,
  ask(prompt: string, options?: { creativity?: unknown; model?: string; signal?: AbortSignal }) {
    const listeners: ((c: string) => void)[] = [];
    const p = runtime.host('aiAsk', { prompt, model: options?.model }).then((r) => { const text = String(r ?? ''); for (const l of listeners) l(text); return text; });
    return Object.assign(p, { on: (_e: 'data', l: (c: string) => void) => { listeners.push(l); } });
  },
};

// ── Tool namespace (confirmation type helper only) ──────────────────────
export const Tool = {};

// ── misc ────────────────────────────────────────────────────────────────
export const Keyboard = {
  Shortcut: {
    Common: {
      Copy: { modifiers: ['cmd', 'shift'], key: 'c' }, CopyDeeplink: { modifiers: ['cmd', 'shift'], key: 'c' }, CopyName: { modifiers: ['cmd', 'shift'], key: '.' }, CopyPath: { modifiers: ['cmd', 'shift'], key: ',' },
      Save: { modifiers: ['cmd'], key: 's' }, Duplicate: { modifiers: ['cmd'], key: 'd' }, Edit: { modifiers: ['cmd'], key: 'e' }, MoveDown: { modifiers: ['cmd', 'shift'], key: 'arrowDown' }, MoveUp: { modifiers: ['cmd', 'shift'], key: 'arrowUp' },
      New: { modifiers: ['cmd'], key: 'n' }, Open: { modifiers: ['cmd'], key: 'o' }, OpenWith: { modifiers: ['cmd', 'shift'], key: 'o' }, Pin: { modifiers: ['cmd', 'shift'], key: 'p' }, Refresh: { modifiers: ['cmd'], key: 'r' },
      Remove: { modifiers: ['ctrl'], key: 'x' }, RemoveAll: { modifiers: ['ctrl', 'shift'], key: 'x' }, ToggleQuickLook: { modifiers: ['cmd'], key: 'y' },
    },
  },
};
export const BrowserExtension = {
  async getContent(): Promise<string> { throw new Error('BrowserExtension is not available in Asyar'); },
  async getTabs(): Promise<unknown[]> { return runtime.host('browserTabs', {}) as Promise<unknown[]>; },
};
export const WindowManagement = {
  DesktopType: { User: 'User', FullScreen: 'FullScreen' },
  async getDesktops() { return []; }, async getActiveWindow() { throw new Error('WindowManagement is not available'); }, async getWindowsOnActiveDesktop() { return []; }, async setWindowBounds() {},
};
export class OAuth {
  static RedirectMethod = { Web: 'web', App: 'app', AppURI: 'appURI', ClientIdMetadataDocument: 'clientIdMetadataDocument' };
  static PKCEClient = class { constructor(public options: unknown) {} async authorizationRequest(): Promise<never> { throw new Error('OAuth is not implemented in the shim yet'); } async authorize(): Promise<never> { throw new Error('OAuth is not implemented in the shim yet'); } async setTokens() {} async getTokens() { return undefined; } async removeTokens() {} };
}
