// Sidecar entry: runs inside Node, reads ClientMsg lines on stdin, writes SidecarMsg lines on stdout.
// The converter appends a generated `manifest` of command/tool modules (see cli/rc2asyar.mjs).
import React from 'react';
import { runtime } from '../api-node/runtime';
import { LineDecoder } from '../common/lines';
import type { ClientMsg, SidecarMsg } from '../common/protocol';

export interface CommandModule { default: unknown; }
export interface ToolModule { default: (input: unknown) => Promise<unknown> | unknown; confirmation?: (input: unknown) => Promise<unknown> | unknown; }
export interface SidecarBundle {
  commands: Record<string, () => Promise<CommandModule>>;
  tools: Record<string, () => Promise<ToolModule>>;
}

const write = (m: SidecarMsg) => { process.stdout.write(JSON.stringify(m) + '\n'); };
runtime.send = write;

// Route console.* to the client so Asyar's log service sees it, and keep stdout clean for protocol.
for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const) {
  const l = level === 'info' || level === 'debug' ? 'log' : level;
  console[level] = (...a: unknown[]) => write({ t: 'log', level: l, text: a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? (x.stack ?? x.message) : safeJson(x))).join(' ') });
}
function safeJson(x: unknown) { try { return JSON.stringify(x); } catch { return String(x); } }
process.on('uncaughtException', (e) => write({ t: 'log', level: 'error', text: 'uncaught: ' + (e?.stack ?? e) }));
process.on('unhandledRejection', (e) => write({ t: 'log', level: 'error', text: 'unhandled: ' + ((e as Error)?.stack ?? e) }));

export function start(bundle: SidecarBundle): void {
  const dec = new LineDecoder();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => dec.push(chunk, (line) => { let m: ClientMsg; try { m = JSON.parse(line); } catch { return; } void dispatch(m); }));
  process.stdin.on('end', () => process.exit(0));
  write({ t: 'ready' });

  async function dispatch(m: ClientMsg) {
    switch (m.t) {
      case 'init':
        runtime.role = m.role; runtime.extensionId = m.extensionId; runtime.extensionName = m.extensionName;
        runtime.ownerOrAuthorName = m.ownerOrAuthorName; runtime.preferences = m.preferences; runtime.appearance = m.appearance;
        (globalThis as Record<string, unknown>).__rcExtensionId = m.extensionId;
        return;
      case 'run': {
        runtime.currentCommand = { id: m.commandId, mode: m.mode, launchType: m.launchType, launchContext: m.launchContext };
        if (m.preferences) runtime.preferences = m.preferences;
        try {
          const loader = bundle.commands[m.commandId];
          if (!loader) throw new Error(`unknown command ${m.commandId}`);
          const mod = await loader();
          const Command = mod.default as unknown;
          const launchProps = { arguments: m.arguments ?? {}, launchContext: m.launchContext, draftValues: m.draftValues, fallbackText: m.fallbackText, launchType: m.launchType };
          if (m.mode === 'no-view') {
            if (typeof Command === 'function') await (Command as (p: unknown) => unknown)(launchProps);
          } else {
            runtime.mountRoot(React.createElement(Command as React.ComponentType<Record<string, unknown>>, launchProps as Record<string, unknown>));
          }
          write({ t: 'run-done', runId: m.runId });
        } catch (e) {
          write({ t: 'run-done', runId: m.runId, error: String((e as Error)?.stack ?? e) });
        }
        return;
      }
      case 'tool': {
        try {
          const loader = bundle.tools[m.toolId];
          if (!loader) throw new Error(`unknown tool ${m.toolId}`);
          const mod = await loader();
          runtime.currentCommand = { id: m.toolId, mode: 'no-view', launchType: 'userInitiated' };
          const result = await mod.default(m.args);
          write({ t: 'tool-result', callId: m.callId, result });
        } catch (e) {
          write({ t: 'tool-result', callId: m.callId, error: String((e as Error)?.message ?? e) });
        }
        return;
      }
      case 'attach': {
        const same = runtime.currentCommand?.id === m.commandId && runtime.nav.depth() > 0;
        let needRun = !same;
        if (same) {
          if (m.depth < runtime.nav.depth()) runtime.nav.trimTo(m.depth);
          else if (m.depth === runtime.nav.depth()) needRun = m.fresh;
          else needRun = true;
        }
        write({ t: 'attached', needRun, depth: runtime.nav.depth() });
        if (!needRun) runtime.scheduleRender();
        return;
      }
      case 'stop': runtime.unmountAll(); process.exit(0);
      default: await runtime.handle(m);
    }
  }
}
