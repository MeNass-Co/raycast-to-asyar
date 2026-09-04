// Gaming Mode — one command, one toggle. Worker-only (no UI), same Tier-2 pattern as
// com.nassim.systemplus: every action is a shell call through ShellService, feedback is a HUD.
//
// This is a port of Nassim's two Raycast script commands (`Gaming Mode ON` / `Gaming Mode OFF`,
// originally ~/raycast-scripts/gaming-mode-{on,off}.sh + _gamemode-lib.sh). The zsh is shipped
// verbatim in scripts/ and executed as-is rather than translated: it leans hard on zsh-only syntax
// (${0:A:h}, *.plist(N), ${var:l}, ${(j:, :)a}, typeset -A) that a rewrite would break silently.
//
// ON  = snapshot every running /Applications app + every non-Apple user LaunchAgent, then quit
//       everything outside the KEEP list (AppleScript quit first so apps flush state, then TERM,
//       then KILL) and bootout the swept agents.
// OFF = restore: bootstrap the agents back, then reopen the union of macOS login items and the
//       snapshot, hidden and staggered.
//
// State is the scripts' own contract — ~/.local/state/gamemode/apps.txt exists exactly while a
// sweep is outstanding (OFF rotates it to .last). That file is the truth for which way to toggle;
// ~/.asyar-gaming-mode is mirrored alongside it so the mode is greppable from anywhere.
import { ExtensionContext as WorkerExtensionContext, extensionBridge } from 'asyar-sdk/worker';
import type { Extension, ExtensionContext, IShellService, IFeedbackService, ILogService } from 'asyar-sdk/contracts';
import manifest from '../manifest.json';

const ZSH = '/bin/zsh';
declare const __SCRIPTS__: string; // absolute path of the installed scripts/ dir, injected by build.mjs
const STATE_APPS = '$HOME/.local/state/gamemode/apps.txt';
const FLAG = '$HOME/.asyar-gaming-mode';

class GamingMode implements Extension {
  private ctx!: ExtensionContext;
  private shell!: IShellService;
  private feedback!: IFeedbackService;
  private log!: ILogService;
  private busy = false;

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
  private zsh(cmd: string) { return this.run(ZSH, ['-c', cmd]); }
  private hud(t: string) { return this.feedback.showHUD(t); }

  /** A sweep is outstanding exactly while the snapshot the OFF script consumes still exists. */
  private async isOn(): Promise<boolean> {
    return (await this.zsh(`test -f ${STATE_APPS} && echo 1 || echo 0`).catch(() => '0')).trim() === '1';
  }

  /** The one line worth putting on screen, taken from the script's own report. */
  private summary(out: string, on: boolean): string {
    const line = (re: RegExp) => out.split('\n').map((l) => l.trim()).find((l) => re.test(l));
    if (on) {
      const swept = line(/^\d+ processes · \d+ MB/);
      const free = line(/^free memory /);
      return swept ? `Gaming Mode on — ${swept}${free ? `, ${free.replace('free memory ', 'free ')}` : ''}` : 'Gaming Mode on — already clean';
    }
    const back = line(/^reopened /);
    return back ? `Gaming Mode off — ${back}` : 'Gaming Mode off — restored';
  }

  async executeCommand(commandId: string): Promise<unknown> {
    if (commandId !== 'toggle-gaming-mode') { this.log.warn(`[gaming-mode] unknown command ${commandId}`); return undefined; }
    if (this.busy) { await this.hud('Gaming Mode is still working…'); return undefined; }
    this.busy = true;
    try {
      const goingOn = !(await this.isOn());
      await this.hud(goingOn ? 'Gaming Mode: sweeping…' : 'Gaming Mode: restoring…');
      const script = `${__SCRIPTS__}/gaming-mode-${goingOn ? 'on' : 'off'}.sh`;
      const out = await this.zsh(`${JSON.stringify(script)} </dev/null 2>&1`);
      this.log.info(`[gaming-mode] ${goingOn ? 'ON' : 'OFF'}\n${out}`);
      // Mirror the mode into a flag file. The scripts' own state dir stays the source of truth.
      await this.zsh(goingOn ? `touch ${FLAG}` : `rm -f ${FLAG}`).catch(() => {});
      await this.hud(this.summary(out, goingOn));
    } catch (e) {
      const msg = (e as Error).message;
      this.log.error(`[gaming-mode] ${commandId}: ${msg}`);
      await this.hud(`Gaming Mode failed: ${msg.slice(0, 120)}`).catch(() => {});
      await this.feedback.sendBackground({ title: 'Gaming Mode', body: msg.slice(0, 200) }).catch(() => {});
    } finally {
      this.busy = false;
    }
    return undefined;
  }
  onUnload = () => {};
}

const extensionId = window.location.hostname === 'localhost' || window.location.hostname === 'asyar-extension.localhost'
  ? window.location.pathname.split('/').filter(Boolean)[0] || 'com.nassim.gamingmode'
  : window.location.hostname || 'com.nassim.gamingmode';
const workerContext = new WorkerExtensionContext();
workerContext.setExtensionId(extensionId);
const impl = new GamingMode();
extensionBridge.registerManifest(manifest as never);
extensionBridge.registerExtensionImplementation(extensionId, impl);
extensionBridge.initializeExtensions();
