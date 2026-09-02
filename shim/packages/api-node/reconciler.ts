// React host renderer that serialises the Raycast element tree into plain RNode objects.
import Reconciler from 'react-reconciler';
import { DefaultEventPriority, NoEventPriority } from 'react-reconciler/constants.js';
import type { ReactNode } from 'react';
import type { RNode } from '../common/protocol';

export interface Instance {
  id: number;
  type: string;
  props: Record<string, unknown>;
  children: Instance[];
  text?: string;
}
export interface Container {
  id: number;
  root: Instance | null;
  children: Instance[];
  onCommit: () => void;
}

let nextId = 1;
const create = (type: string, props: Record<string, unknown>): Instance => ({ id: nextId++, type, props, children: [] });

/** Function registry: (instanceId, propName) → stable callback id. */
export class CallbackRegistry {
  private byKey = new Map<string, number>();
  private fns = new Map<number, Function>();
  private seq = 1;
  register(instanceId: number, prop: string, fn: Function): number {
    const key = `${instanceId}:${prop}`;
    let id = this.byKey.get(key);
    if (id === undefined) {
      id = this.seq++;
      this.byKey.set(key, id);
    }
    this.fns.set(id, fn);
    return id;
  }
  registerAnon(fn: Function): number {
    const id = this.seq++;
    this.fns.set(id, fn);
    return id;
  }
  get(id: number): Function | undefined {
    return this.fns.get(id);
  }
  /** Drop callbacks not present in `live`. */
  sweep(live: Set<number>): void {
    for (const id of [...this.fns.keys()]) if (!live.has(id)) this.fns.delete(id);
    for (const [k, id] of [...this.byKey]) if (!live.has(id)) this.byKey.delete(k);
  }
}

const hostConfig: Reconciler.HostConfig<string, Record<string, unknown>, Container, Instance, Instance, never, never, never, Instance, null, never, number, number, null> = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  noTimeout: -1,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  getRootHostContext: () => null,
  getChildHostContext: () => null,
  getPublicInstance: (i) => i,
  prepareForCommit: () => null,
  resetAfterCommit: (c) => c.onCommit(),
  preparePortalMount: () => {},
  shouldSetTextContent: () => false,
  createInstance: (type, props) => create(type, props),
  createTextInstance: (text) => ({ id: nextId++, type: '#text', props: {}, children: [], text }),
  appendInitialChild: (p, c) => { p.children.push(c); },
  finalizeInitialChildren: () => false,
  appendChild: (p, c) => { p.children.push(c); },
  appendChildToContainer: (c, i) => { c.children.push(i); c.root = c.children[0] ?? null; },
  insertBefore: (p, c, before) => { const i = p.children.indexOf(before); p.children.splice(i < 0 ? p.children.length : i, 0, c); },
  insertInContainerBefore: (c, i, before) => { const k = c.children.indexOf(before); c.children.splice(k < 0 ? c.children.length : k, 0, i); c.root = c.children[0] ?? null; },
  removeChild: (p, c) => { const i = p.children.indexOf(c); if (i >= 0) p.children.splice(i, 1); },
  removeChildFromContainer: (c, i) => { const k = c.children.indexOf(i); if (k >= 0) c.children.splice(k, 1); c.root = c.children[0] ?? null; },
  commitTextUpdate: (t, _o, n) => { t.text = n; },
  commitUpdate: (i, _type, _old, next) => { i.props = next; },
  clearContainer: (c) => { c.children = []; c.root = null; },
  detachDeletedInstance: () => {},
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  // React 19 additions
  NotPendingTransition: null,
  HostTransitionContext: { $$typeof: Symbol.for('react.context'), Consumer: null, Provider: null, _currentValue: null, _currentValue2: null, _threadCount: 0 } as never,
  setCurrentUpdatePriority: (p: number) => { currentPriority = p; },
  getCurrentUpdatePriority: () => currentPriority,
  resolveUpdatePriority: () => (currentPriority !== NoEventPriority ? currentPriority : DefaultEventPriority),
  resetFormInstance: () => {},
  requestPostPaintCallback: () => {},
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,
  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
};
let currentPriority: number = NoEventPriority;

export const reconciler = Reconciler(hostConfig as never);

export interface Root {
  container: Container;
  fiberRoot: unknown;
  render(el: ReactNode): void;
  unmount(): void;
}

let containerSeq = 1;
export function createRoot(onCommit: () => void): Root {
  const container: Container = { id: containerSeq++, root: null, children: [], onCommit };
  const onErr = (e: unknown) => console.error('[raycast-shim] uncaught', (e as Error)?.stack ?? String(e));
  const fiberRoot = (reconciler.createContainer as unknown as (...a: unknown[]) => unknown)(container, 0, null, false, null, 'rc', onErr, onErr, onErr, () => {});
  return {
    container,
    fiberRoot,
    render(el) { reconciler.updateContainer(el, fiberRoot as never, null, null); },
    unmount() { reconciler.updateContainer(null, fiberRoot as never, null, null); },
  };
}

/** Serialise an instance tree, replacing function props with callback refs. */
export function serialize(inst: Instance, cbs: CallbackRegistry, live: Set<number>): RNode {
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inst.props)) {
    if (k === 'children') continue;
    props[k] = serializeValue(v, inst.id, k, cbs, live);
  }
  if (inst.type === '#text') props.text = inst.text;
  return { type: inst.type, props, children: inst.children.map((c) => serialize(c, cbs, live)), k: inst.id };
}

function serializeValue(v: unknown, instId: number, path: string, cbs: CallbackRegistry, live: Set<number>): unknown {
  if (typeof v === 'function') {
    const id = cbs.register(instId, path, v);
    live.add(id);
    return { $cb: id };
  }
  if (v instanceof Date) return { $date: v.getTime() };
  if (Array.isArray(v)) return v.map((x, i) => serializeValue(x, instId, `${path}[${i}]`, cbs, live));
  if (v && typeof v === 'object') {
    if ((v as { $$typeof?: unknown }).$$typeof) return undefined; // stray React element in a prop
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = serializeValue(x, instId, `${path}.${k}`, cbs, live);
    return o;
  }
  return v;
}
