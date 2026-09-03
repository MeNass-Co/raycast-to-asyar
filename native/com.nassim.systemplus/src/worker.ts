// System+ — Raycast's System commands, native to Asyar. Worker-only: every command is a shell
// call through ShellService; feedback is a HUD or a confirm dialog.
import { ExtensionContext as WorkerExtensionContext, extensionBridge } from 'asyar-sdk/worker';
import type { Extension, ExtensionContext, IShellService, IFeedbackService, ILogService, IOpenerService } from 'asyar-sdk/contracts';
import manifest from '../manifest.json';

const OSA = '/usr/bin/osascript';
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
  /** Do Not Disturb has no public CLI: run the user's Shortcut ("Toggle Do Not Disturb" / "Do Not Disturb On" / "Do Not Disturb Off",
   *  each = the Shortcuts "Set Focus" action). Missing shortcut → HUD with the recipe and open Shortcuts. Returns the new state when known. */
  private async dnd(mode: 'toggle' | 'on' | 'off'): Promise<boolean | null> {
    const name = mode === 'toggle' ? 'Toggle Do Not Disturb' : mode === 'on' ? 'Do Not Disturb On' : 'Do Not Disturb Off';
    try { await this.run('/usr/bin/shortcuts', ['run', name]); }
    catch { await this.hud(`Create a Shortcut named "${name}" (Set Focus → Do Not Disturb)`); await this.run('/usr/bin/open', ['-a', 'Shortcuts']).catch(() => {}); return null; }
    const active = await this.osa('do shell script "grep -c donotdisturb.mode.default ~/Library/DoNotDisturb/DB/Assertions.json || true"').catch(() => '');
    return mode === 'toggle' ? Number(active) > 0 : mode === 'on';
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
        default: this.log.warn(`[system+] unknown command ${commandId}`);
      }
    } catch (e) {
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
