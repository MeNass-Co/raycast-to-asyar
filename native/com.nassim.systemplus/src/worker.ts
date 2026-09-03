// System+ — Raycast's System commands, native to Asyar. Worker-only: every command is a shell
// call through ShellService; feedback is a HUD or a confirm dialog.
import { ExtensionContext as WorkerExtensionContext, extensionBridge } from 'asyar-sdk/worker';
import type { Extension, ExtensionContext, IShellService, IFeedbackService, ILogService, IOpenerService } from 'asyar-sdk/contracts';
import manifest from '../manifest.json';

const OSA = '/usr/bin/osascript';
declare const __AXWIN__: string; // absolute path of bin/axwin, injected by build.mjs
const q = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

class SystemPlus implements Extension {
  private ctx!: ExtensionContext;
  private shell!: IShellService;
  private feedback!: IFeedbackService;
  private log!: ILogService;

  async initialize(ctx: ExtensionContext) {
    this.ctx = ctx;
    this.shell = ctx.getService<IShellService>('shell');
    this.feedback = ctx.getService<IFeedbackService>('feedback');
    this.log = ctx.getService<ILogService>('log');
  }
  async activate() {}
  async deactivate() {}

  /** Run a program, collect stdout, reject on non-zero exit. */
  private run(program: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const h = this.shell.spawn({ program, args });
      let out = ''; let err = '';
      h.onChunk((c) => { if (c.stream === 'stdout') out += c.data + '\n'; else err += c.data + '\n'; });
      h.onDone((code) => (code === 0 || code === undefined ? resolve(out.trim()) : reject(new Error(err.trim() || `${program} exited ${code}`))));
      h.onError((e) => reject(new Error(e.message)));
    });
  }
  private osa(script: string) { return this.run(OSA, ['-e', script]); }
  private hud(t: string) { return this.feedback.showHUD(t); }

  private focusTimer: ReturnType<typeof setTimeout> | undefined;
  /** Do Not Disturb has no public CLI. State = a `storeAssertionRecords` entry for the default DND mode in
   *  ~/Library/DoNotDisturb/DB/Assertions.json; switching runs the user's "Do Not Disturb On" / "Do Not Disturb Off"
   *  Shortcuts (each = the Shortcuts "Set Focus" action). Missing shortcut → HUD recipe + open Shortcuts. */
  private async dndActive(): Promise<boolean> {
    const py = "import json,os;d=json.load(open(os.path.expanduser('~/Library/DoNotDisturb/DB/Assertions.json')))['data'][0];print(int(any(r.get('assertionDetails',{}).get('assertionDetailsModeIdentifier')=='com.apple.donotdisturb.mode.default' for r in d.get('storeAssertionRecords',[]))))";
    const out = await this.osa(`do shell script ${q(`/usr/bin/python3 -c ${JSON.stringify(py)}`)}`).catch(() => '0');
    return out.trim() === '1';
  }
  private async dnd(mode: 'toggle' | 'on' | 'off'): Promise<boolean | null> {
    const on = mode === 'toggle' ? !(await this.dndActive()) : mode === 'on';
    const name = on ? 'Do Not Disturb On' : 'Do Not Disturb Off';
    // `shortcuts run` reads its input from stdin when stdin is a pipe (Asyar keeps it open) → run it through
    // osascript with stdin closed, and with a timeout so a missing shortcut cannot hang the worker.
    try { await this.osa(`do shell script ${q(`/usr/bin/shortcuts run ${JSON.stringify(name)} </dev/null 2>&1`)}`).then((out) => { if (/Couldn.t find shortcut/i.test(out)) throw new Error(out); }); }
    catch { await this.hud(`Create a Shortcut named "${name}" (Set Focus → Do Not Disturb)`); await this.run('/usr/bin/open', ['-a', 'Shortcuts']).catch(() => {}); return null; }
    return on;
  }
  // ---- Window management extras (Raycast parity). The launcher is a non-activating panel, so the
  //      frontmost process is still the user's app; System Events reads/writes its window bounds.
  // ---- Window management extras (Raycast parity) via bin/axwin (Accessibility API on the app owning the
  //      topmost normal window; asyar's own panel is excluded). Needs Accessibility for asyar.
  private axwin(...args: string[]): Promise<{ app: string; x: number; y: number; w: number; h: number }> {
    return this.run(__AXWIN__, args).then((r) => { const [app, x, y, w, h] = r.trim().split('|'); return { app, x: +x, y: +y, w: +w, h: +h }; });
  }
  private frontWindow() { return this.axwin('get'); }
  private async setFrontWindow(x: number, y: number, w: number, h: number) { await this.axwin('set', String(Math.round(x)), String(Math.round(y)), String(Math.round(w)), String(Math.round(h))); }
  /** Visible frames of every display in top-left window coordinates (menu bar excluded). */
  private async screens(): Promise<{ x: number; y: number; w: number; h: number }[]> {
    const js = `ObjC.import("AppKit");const S=$.NSScreen.screens;const main=S.objectAtIndex(0).frame;const out=[];for(let i=0;i<S.count;i++){const f=S.objectAtIndex(i).visibleFrame;out.push({x:f.origin.x,y:main.size.height-(f.origin.y+f.size.height),w:f.size.width,h:f.size.height})}JSON.stringify(out)`;
    return JSON.parse(await this.run(OSA, ['-l', 'JavaScript', '-e', js]));
  }
  private screenOf(win: { x: number; y: number; w: number; h: number }, screens: { x: number; y: number; w: number; h: number }[]) {
    const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
    const i = screens.findIndex((s) => cx >= s.x && cx < s.x + s.w && cy >= s.y && cy < s.y + s.h);
    return i >= 0 ? i : 0;
  }
  private async resizeAround(factor: number) {
    const f = await this.frontWindow(); const w = f.w * factor, h = f.h * factor;
    await this.setFrontWindow(f.x - (w - f.w) / 2, f.y - (h - f.h) / 2, w, h);
  }
  private async nudge(dx: number, dy: number) { const f = await this.frontWindow(); await this.setFrontWindow(f.x + dx, f.y + dy, f.w, f.h); }
  private async toDisplay(step: 1 | -1) {
    const f = await this.frontWindow(); const sc = await this.screens();
    if (sc.length < 2) { await this.hud('Only one display'); return; }
    const from = sc[this.screenOf(f, sc)], to = sc[(this.screenOf(f, sc) + step + sc.length) % sc.length];
    const rx = (f.x - from.x) / from.w, ry = (f.y - from.y) / from.h, rw = Math.min(1, f.w / from.w), rh = Math.min(1, f.h / from.h);
    await this.setFrontWindow(to.x + rx * to.w, to.y + ry * to.h, rw * to.w, rh * to.h);
  }
  private async sixth(row: 'top' | 'bottom') {
    const f = await this.frontWindow(); const sc = await this.screens(); const s = sc[this.screenOf(f, sc)];
    await this.setFrontWindow(s.x + s.w / 3, row === 'top' ? s.y : s.y + s.h / 2, s.w / 3, s.h / 2);
  }
  private async maxAxis(axis: 'w' | 'h') {
    const f = await this.frontWindow(); const sc = await this.screens(); const s = sc[this.screenOf(f, sc)];
    if (axis === 'h') await this.setFrontWindow(f.x, s.y, f.w, s.h); else await this.setFrontWindow(s.x, f.y, s.w, f.h);
  }
  private async volume(): Promise<number> { return Number(await this.osa('output volume of (get volume settings)')) || 0; }
  private async setVolume(n: number) { await this.osa(`set volume output volume ${Math.max(0, Math.min(100, n))}`); await this.hud(`Volume ${Math.max(0, Math.min(100, n))}%`); }

  async executeCommand(commandId: string): Promise<unknown> {
    try {
      switch (commandId) {
        case 'empty-trash': {
          const warn = this.ctx.preferences.warnBeforeEmptyingTrash !== false;
          const count = Number(await this.osa('tell application "Finder" to count items of trash')) || 0;
          if (count === 0) { await this.hud('Trash is already empty'); return; }
          if (warn) {
            // Native dialog: the launcher window may be hidden (hotkey/deeplink), so an in-window
            // confirm would never be seen. Finder's own sheet reads exactly like Raycast's.
            const r = await this.osa(`display dialog ${q(`Are you sure you want to permanently erase the ${count} item${count === 1 ? '' : 's'} in the Trash?`)} with title "Empty Trash" buttons {"Cancel", "Empty Trash"} default button "Empty Trash" cancel button "Cancel" with icon caution`).catch(() => 'cancel');
            if (!/Empty Trash/.test(r)) return;
          }
          await this.osa('tell application "Finder" to empty trash');
          await this.hud('Trash Emptied');
          return;
        }
        case 'open-trash': await this.run('/usr/bin/open', [`${await this.osa('POSIX path of (path to home folder)')}.Trash`]); return;
        case 'sleep-displays': await this.run('/usr/bin/pmset', ['displaysleepnow']); return;
        case 'show-screen-saver': await this.run('/usr/bin/open', ['-a', 'ScreenSaverEngine']); return;
        case 'show-desktop': await this.osa('tell application "System Events" to set visible of every process whose visible is true and name is not "Finder" to false'); await this.osa('tell application "Finder" to activate'); return;
        case 'hide-all-except-frontmost': await this.osa('tell application "System Events" to set visible of every process whose frontmost is false and name is not "Finder" to false'); await this.hud('Other apps hidden'); return;
        case 'quit-all-apps': case 'quit-all-except-frontmost': {
          const keepFront = commandId === 'quit-all-except-frontmost';
          const script = `tell application "System Events"
  set apps to name of every process whose background only is false and name is not "Finder" and name is not "asyar"${keepFront ? ' and frontmost is false' : ''}
end tell
repeat with a in apps
  try
    tell application a to quit
  end try
end repeat
return count of apps`;
          const n = await this.osa(script); await this.hud(`Quit ${n} app${n === '1' ? '' : 's'}`); return;
        }
        case 'eject-all-disks': { const n = await this.osa('tell application "Finder"\n set ds to every disk whose ejectable is true\n set c to count of ds\n eject ds\n return c\nend tell'); await this.hud(n === '0' ? 'No disks to eject' : `Ejected ${n} disk${n === '1' ? '' : 's'}`); return; }
        case 'toggle-mute': { const muted = (await this.osa('output muted of (get volume settings)')) === 'true'; await this.osa(`set volume output muted ${!muted}`); await this.hud(muted ? 'Unmuted' : 'Muted'); return; }
        case 'volume-up': await this.setVolume((await this.volume()) + 10); return;
        case 'volume-down': await this.setVolume((await this.volume()) - 10); return;
        case 'volume-0': await this.setVolume(0); return;
        case 'volume-25': await this.setVolume(25); return;
        case 'volume-50': await this.setVolume(50); return;
        case 'volume-75': await this.setVolume(75); return;
        case 'volume-100': await this.setVolume(100); return;
        case 'toggle-appearance': { const dark = await this.osa('tell application "System Events" to tell appearance preferences\n set dark mode to not dark mode\n return dark mode\nend tell'); await this.hud(dark === 'true' ? 'Dark Mode' : 'Light Mode'); return; }
        case 'toggle-hidden-files': { const cur = (await this.run('/usr/bin/defaults', ['read', 'com.apple.finder', 'AppleShowAllFiles']).catch(() => '0')).trim().toUpperCase(); const next = cur === '1' || cur === 'TRUE' || cur === 'YES' ? 'FALSE' : 'TRUE'; await this.run('/usr/bin/defaults', ['write', 'com.apple.finder', 'AppleShowAllFiles', '-bool', next]); await this.run('/usr/bin/killall', ['Finder']); await this.hud(next === 'TRUE' ? 'Hidden files shown' : 'Hidden files hidden'); return; }
        case 'toggle-stage-manager': { const cur = (await this.run('/usr/bin/defaults', ['read', 'com.apple.WindowManager', 'GloballyEnabled']).catch(() => '0')).trim(); const next = cur === '1' ? 'false' : 'true'; await this.run('/usr/bin/defaults', ['write', 'com.apple.WindowManager', 'GloballyEnabled', '-bool', next]); await this.hud(next === 'true' ? 'Stage Manager on' : 'Stage Manager off'); return; }
        case 'toggle-bluetooth': {
          const ok = await this.run('/usr/bin/osascript', ['-e', 'do shell script "test -x /opt/homebrew/bin/blueutil && /opt/homebrew/bin/blueutil -p toggle && /opt/homebrew/bin/blueutil -p"']).catch(() => null);
          if (ok === null) { await this.ctx.getService<IOpenerService>('opener').openPath('x-apple.systempreferences:com.apple.BluetoothSettings').catch(() => this.run('/usr/bin/open', ['x-apple.systempreferences:com.apple.BluetoothSettings'])); return; }
          await this.hud(ok.trim() === '1' ? 'Bluetooth on' : 'Bluetooth off'); return;
        }
        case 'dismiss-notifications': await this.osa('tell application "System Events" to tell process "NotificationCenter"\n try\n click (every button of every group of every scroll area of every window whose description is "Clear All" or name is "Clear All")\n end try\nend tell').catch(() => {}); await this.osa('tell application "System Events" to tell process "NotificationCenter" to try\n perform action "AXPress" of (every button whose description contains "Clear" or description contains "Close") of (every window)\nend try').catch(() => {}); return;
        case 'toggle-do-not-disturb': { const on = await this.dnd('toggle'); if (on !== null) await this.hud(on ? 'Do Not Disturb on' : 'Do Not Disturb off'); return; }
        case 'start-focus-session': {
          const mins = Math.max(1, Number((this.ctx.preferences.values as { focusMinutes?: string }).focusMinutes) || 25);
          if (this.focusTimer) { clearTimeout(this.focusTimer); this.focusTimer = undefined; }
          await this.osa('tell application "System Events" to set visible of every process whose frontmost is false and name is not "Finder" to false').catch(() => {});
          await this.dnd('on');
          this.focusTimer = setTimeout(() => { void (async () => { this.focusTimer = undefined; await this.dnd('off'); await this.feedback.sendBackground({ title: 'Focus session complete', body: `${mins} minutes are up. Nice work.` }).catch(() => {}); })(); }, mins * 60_000);
          await this.hud(`Focus: ${mins} min`); return;
        }
        case 'end-focus-session': { if (this.focusTimer) { clearTimeout(this.focusTimer); this.focusTimer = undefined; } await this.dnd('off'); await this.hud('Focus session ended'); return; }
        case 'toggle-fullscreen': await this.axwin('fullscreen'); return;
        case 'make-larger': await this.resizeAround(1.1); return;
        case 'make-smaller': await this.resizeAround(1 / 1.1); return;
        case 'maximize-height': await this.maxAxis('h'); return;
        case 'maximize-width': await this.maxAxis('w'); return;
        case 'move-left': await this.nudge(-50, 0); return;
        case 'move-right': await this.nudge(50, 0); return;
        case 'move-up': await this.nudge(0, -50); return;
        case 'move-down': await this.nudge(0, 50); return;
        case 'next-display': await this.toDisplay(1); return;
        case 'previous-display': await this.toDisplay(-1); return;
        case 'top-center-sixth': await this.sixth('top'); return;
        case 'bottom-center-sixth': await this.sixth('bottom'); return;
        default: this.log.warn(`[system+] unknown command ${commandId}`);
      }
    } catch (e) {
      this.log.error(`[system+] ${commandId}: ${(e as Error).message}`);
      if (/assistive access|not allowed assistive|-25211/.test((e as Error).message)) {
        // System Events UI scripting runs under Asyar's TCC identity: Asyar needs Accessibility (one-time toggle).
        await this.hud('Grant Accessibility to Asyar (System Settings → Privacy & Security → Accessibility)');
        await this.run('/usr/bin/open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility']).catch(() => {});
        return undefined;
      }
      this.log.error(`[system+] ${commandId}: ${(e as Error).message}`);
      await this.feedback.sendBackground({ title: 'System+', body: `${commandId}: ${(e as Error).message.slice(0, 200)}` }).catch(() => {});
    }
    return undefined;
  }
  onUnload = () => {};
}

const extensionId = window.location.hostname === 'localhost' || window.location.hostname === 'asyar-extension.localhost'
  ? window.location.pathname.split('/').filter(Boolean)[0] || 'com.nassim.systemplus'
  : window.location.hostname || 'com.nassim.systemplus';
const workerContext = new WorkerExtensionContext();
workerContext.setExtensionId(extensionId);
const impl = new SystemPlus();
extensionBridge.registerManifest(manifest as never);
extensionBridge.registerExtensionImplementation(extensionId, impl);
extensionBridge.initializeExtensions();
