// Handles `host` RPC requests coming from the sidecar (closeMainWindow, paste, launchCommand…).
import type { ExtensionContext, IFeedbackService, IClipboardHistoryService, IInteropService, IOpenerService, IExtensionManager } from 'asyar-sdk/contracts';
import type { SidecarMsg } from '../common/protocol';
import type { Bridge } from '../common/bridge';

type HostMsg = Extract<SidecarMsg, { t: 'host' }>;

export class HostCalls {
  /** Set by the view to handle view-only methods (navPop, popToRoot, clearSearchBar, form, accessory). */
  viewHandlers: Partial<Record<string, (params: unknown) => Promise<unknown> | unknown>> = {};
  constructor(private ctx: ExtensionContext, private role: 'view' | 'worker', private bridge: () => Bridge, private extensionId: string) {}

  async handle(m: HostMsg): Promise<void> {
    let result: unknown; let error: string | undefined;
    try { result = await this.run(m.method, m.params as Record<string, unknown>); } catch (e) { error = String((e as Error)?.message ?? e); }
    this.bridge().send({ t: 'host-result', callId: m.callId, result, error });
  }

  private async run(method: string, p: Record<string, unknown>): Promise<unknown> {
    const vh = this.viewHandlers[method];
    if (vh) return vh(p);
    switch (method) {
      case 'hideWindow': {
        if (p.popToRootType !== 'suspended') this.viewHandlers.popToRoot?.({});
        this.ctx.hideLauncher?.();
        if (this.role === 'worker') window.parent.postMessage({ type: 'asyar:window:hide' }, '*');
        return;
      }
      case 'showHUD': {
        const fb = this.ctx.getService<IFeedbackService>('feedback');
        await fb.showHUD(String(p.title ?? ''));
        if (p.popToRootType !== 'suspended') this.viewHandlers.popToRoot?.({});
        this.ctx.hideLauncher?.();
        return;
      }
      case 'pasteText': {
        const clip = this.ctx.getService<IClipboardHistoryService>('clipboard');
        await clip.writeToClipboard({ id: 'rc', type: 'text', content: String(p.text ?? ''), createdAt: Date.now(), favorite: false } as never);
        this.ctx.hideLauncher?.();
        await new Promise((r) => setTimeout(r, 150));
        await clip.simulatePaste();
        return;
      }
      case 'launchCommand': {
        const interop = this.ctx.getService<IInteropService>('interop');
        const extId = p.extensionName ? `raycast.${slug(String(p.ownerOrAuthorName ?? ''))}.${slug(String(p.extensionName))}` : this.extensionId;
        await interop.launchCommand(extId, String(p.name), { arguments: p.arguments ?? {}, launchContext: p.context ?? undefined, __launchType: p.type });
        return;
      }
      case 'openPreferences': {
        const em = this.ctx.getService<IExtensionManager>('extensions');
        em.navigateToView('settings/extensions');
        return;
      }
      case 'createQuicklink': {
        const opener = this.ctx.getService<IOpenerService>('opener');
        const q = p as { link?: string; name?: string };
        await opener.openUrl(`asyar://portals/new?url=${encodeURIComponent(q.link ?? '')}&name=${encodeURIComponent(q.name ?? '')}`).catch(() => {});
        return;
      }
      case 'createSnippet': return;
      case 'updateCommandMetadata': {
        const cmds = this.ctx.getService<import('asyar-sdk/contracts').ICommandService>('commands');
        const id = `cmd_${this.extensionId}_${String(p.commandId ?? '')}`;
        await cmds.updateCommandMetadata(id, { subtitle: (p.subtitle as string | null) ?? undefined }).catch(() => {});
        return;
      }
      case 'aiAsk': throw new Error('AI.ask: no provider wired yet');
      case 'browserTabs': return [];
      default: throw new Error(`unknown host method ${method}`);
    }
  }
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^[^a-z]+/, '') || 'x';
