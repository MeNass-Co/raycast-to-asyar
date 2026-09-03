// Client-side bridge used by both iframes: spawns node with a tiny bootstrap, streams the sidecar
// bundle over stdin, then exchanges newline JSON. A view iframe that reloads (host navigation)
// re-attaches to the still-running sidecar instead of spawning a new one.
import type { IShellService, ShellHandle } from 'asyar-sdk/contracts';
import { LineDecoder } from './lines';
import type { ClientMsg, SidecarMsg } from './protocol';

export interface BridgeOptions {
  shell: IShellService;
  nodePath: string;
  /** Loads the sidecar bundle source (CommonJS). Only called when spawning. */
  loadBundle: () => Promise<string>;
  onMessage: (m: SidecarMsg) => void;
  onExit: (code?: number, error?: string) => void;
}

// Reads one base64 line (the bundle) from stdin, compiles it as a CommonJS module, then hands the
// rest of stdin to the sidecar. Kept on one line so it survives `-e`.
const BOOT = "const fs=require('fs'),os=require('os'),path=require('path');const LOG=os.homedir()+'/Library/Logs/org.asyar.app/rc-sidecar.log';const dbg=t=>{try{fs.appendFileSync(LOG,new Date().toISOString()+' '+t+'\\n')}catch{}};process.on('uncaughtException',e=>dbg('boot uncaught '+(e&&e.stack||e)));process.on('exit',c=>dbg('boot exit '+c));let s='';process.stdin.setEncoding('utf8');const onData=d=>{s+=d;const i=s.indexOf('\\n');if(i<0)return;process.stdin.removeListener('data',onData);const src=Buffer.from(s.slice(0,i),'base64').toString('utf8');const rest=s.slice(i+1);const dir=path.join(os.tmpdir(),'rc-sidecar-'+process.pid);fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,'sidecar.mjs');fs.writeFileSync(f,src);dbg('bundle written '+src.length);if(rest)process.stdin.unshift(rest);import('file://'+f).then(()=>dbg('bundle loaded')).catch(e=>{dbg('bundle import failed '+(e&&e.stack||e));process.exit(1)});};process.stdin.on('data',onData);process.stdin.on('end',()=>dbg('stdin end'));";

export class Bridge {
  private handle?: ShellHandle;
  private ready?: Promise<void>;
  private bundleSent = false;
  private queue: string[] = [];
  spawnId?: string;
  constructor(private o: BridgeOptions) {}

  private b64(s: string): string { return btoa(unescape(encodeURIComponent(s))); }

  /** Spawn a new sidecar. */
  start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const h = this.o.shell.spawn({ program: this.o.nodePath, args: ['-e', BOOT] });
      this.handle = h;
      this.spawnId = h.spawnId;
      this.wire(h, resolve, reject);
      this.o.loadBundle().then(async (src) => { await this.writeRetry(this.b64(src) + '\n'); this.bundleSent = true; for (const q of this.queue.splice(0)) await this.writeRetry(q); }).catch(reject);
    });
    return this.ready;
  }

  /** Re-attach to a running sidecar by spawnId; resolves once the sidecar answers `attach`. */
  attach(spawnId: string, intent: { commandId: string; depth: number; fresh: boolean }): Promise<{ needRun: boolean; depth: number }> {
    return new Promise((resolve, reject) => {
      this.ready = Promise.resolve();
      const h = this.o.shell.attach(spawnId);
      this.handle = h;
      this.spawnId = spawnId;
      this.wire(h, () => {}, reject, (m) => { if (m.t === 'attached') resolve({ needRun: m.needRun, depth: m.depth }); });
      this.bundleSent = true;
      this.writeRetry(JSON.stringify({ t: 'attach', ...intent } satisfies ClientMsg) + '\n').catch(reject);
      setTimeout(() => reject(new Error('attach timeout')), 4000);
    });
  }

  private wire(h: ShellHandle, resolve: () => void, reject: (e: Error) => void, tap?: (m: SidecarMsg) => void) {
    const dec = new LineDecoder();
    let readyFired = false;
    h.onChunk(({ stream, data }) => {
      if (stream === 'stderr') { this.o.onMessage({ t: 'log', level: 'warn', text: 'stderr: ' + data }); return; }
      dec.push(data + '\n', (line) => {
        let m: SidecarMsg; try { m = JSON.parse(line); } catch { console.warn('[sidecar] bad line', line.slice(0, 200)); return; }
        if (m.t === 'ready' && !readyFired) { readyFired = true; resolve(); }
        tap?.(m);
        this.o.onMessage(m);
      });
    });
    h.onError((e) => { this.ready = undefined; this.handle = undefined; reject(new Error(`${e.code}: ${e.message}`)); this.o.onExit(undefined, e.message); });
    h.onDone((code) => { this.ready = undefined; this.handle = undefined; this.o.onExit(code); });
  }

  private registered = false;
  /** The host registers the spawn asynchronously; wait for it to appear in shell.list() before writing. */
  private async writeRetry(data: string): Promise<void> {
    if (!this.handle) throw new Error('sidecar handle gone');
    if (!this.registered) {
      for (let i = 0; i < 100; i++) {
        const live = await this.o.shell.list().catch(() => []);
        if (live.some((d) => d.spawnId === this.spawnId)) { this.registered = true; break; }
        await new Promise((r) => setTimeout(r, 40));
      }
    }
    let lastErr: unknown;
    for (let i = 0; i < 10; i++) {
      if (!this.handle) throw new Error('sidecar handle gone');
      try { await this.handle.write(data); return; } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 80)); }
    }
    throw lastErr;
  }

  send(m: ClientMsg): void {
    if (!this.handle) { console.warn('[bridge] send with no handle', m.t); return; }
    const line = JSON.stringify(m) + '\n';
    if (!this.bundleSent) { this.queue.push(line); return; }
    void this.writeRetry(line).catch((e) => console.error('[bridge] write failed', e));
  }

  stop(): void { try { this.send({ t: 'stop' }); this.handle?.abort(); } catch { /* ignore */ } this.handle = undefined; this.ready = undefined; this.bundleSent = false; this.registered = false; this.queue = []; }
  get alive() { return !!this.handle; }
}
