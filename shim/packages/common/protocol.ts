// Wire protocol between an Asyar iframe (view or worker role) and its Node sidecar.
// Transport: newline-delimited JSON over the sidecar's stdio.

export type Role = 'view' | 'worker';

/** A serialised React host element produced by the sidecar's reconciler. */
export interface RNode {
  /** Host element type, e.g. "List", "List.Item", "Action.Push", "#text". */
  type: string;
  /** Props with functions replaced by `{ $cb: id }` markers and React children removed. */
  props: Record<string, unknown>;
  children: RNode[];
  /** Stable key for reconciliation in the view (reconciler instance id). */
  k: number;
}

export interface CallbackRef { $cb: number }
export const isCallbackRef = (v: unknown): v is CallbackRef =>
  !!v && typeof v === 'object' && typeof (v as CallbackRef).$cb === 'number';

export interface ToastState {
  id: number;
  style: 'SUCCESS' | 'FAILURE' | 'ANIMATED';
  title: string;
  message?: string;
  primaryAction?: { title: string; cb: number };
  secondaryAction?: { title: string; cb: number };
}

export interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  icon?: unknown;
  primaryAction?: { title: string; style?: string };
  dismissAction?: { title: string; style?: string };
}

/** Messages the client (iframe) sends to the sidecar. */
export type ClientMsg =
  | {
      t: 'init';
      role: Role;
      extensionId: string;
      extensionName: string;
      ownerOrAuthorName: string;
      preferences: Record<string, unknown>;
      appearance: 'light' | 'dark';
    }
  | {
      t: 'run';
      runId: number;
      commandId: string;
      mode: 'view' | 'no-view' | 'menu-bar';
      launchType: 'userInitiated' | 'background';
      arguments?: Record<string, unknown>;
      launchContext?: Record<string, unknown>;
      draftValues?: Record<string, unknown>;
      fallbackText?: string;
      preferences?: Record<string, unknown>;
    }
  | { t: 'cb'; id: number; args: unknown[] }
  | { t: 'search'; text: string }
  | { t: 'submit' }
  | { t: 'nav'; depth: number }
  | { t: 'alert-result'; id: number; confirmed: boolean }
  | { t: 'host-result'; callId: number; result?: unknown; error?: string }
  | { t: 'tool'; callId: number; toolId: string; args: unknown }
  | { t: 'prefs'; preferences: Record<string, unknown> }
  | { t: 'attach'; commandId: string; depth: number; fresh: boolean }
  | { t: 'stop' };

/** Messages the sidecar sends to the client. */
export type SidecarMsg =
  | { t: 'ready' }
  | { t: 'attached'; needRun: boolean; depth: number }
  | {
      t: 'render';
      /** Navigation stack; the last entry is visible. Each entry is one root element. */
      stack: { id: number; title?: string; tree: RNode | null }[];
      toasts: ToastState[];
    }
  | { t: 'host'; callId: number; method: HostMethod; params: unknown }
  | { t: 'alert'; alert: AlertRequest }
  | { t: 'tool-result'; callId: number; result?: unknown; error?: string }
  | { t: 'run-done'; runId: number; error?: string }
  | { t: 'log'; level: 'log' | 'warn' | 'error'; text: string }
  | { t: 'menubar'; commandId: string; tree: RNode | null };

export type HostMethod =
  | 'hideWindow'
  | 'popToRoot'
  | 'navPush'
  | 'navPop'
  | 'clearSearchBar'
  | 'pasteText'
  | 'launchCommand'
  | 'showHUD'
  | 'openPreferences'
  | 'accessory'
  | 'setSubtitle';

export const APP_DATA_DIR_MAC = 'Library/Application Support/org.asyar.app';
export const SHIM_DIR = 'raycast-shim';
