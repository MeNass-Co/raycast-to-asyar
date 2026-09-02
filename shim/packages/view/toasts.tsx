import React from 'react';
import type { ToastState } from '../common/protocol';
import type { Invoke } from './tree';

export function Toasts({ toasts, invoke }: { toasts: ToastState[]; invoke: Invoke }) {
  if (!toasts.length) return null;
  const t = toasts[toasts.length - 1];
  return (
    <div className={`rc-toast rc-toast-${t.style.toLowerCase()}`}>
      <span className="rc-toast-dot">{t.style === 'ANIMATED' ? <span className="rc-spinner rc-spinner-sm" /> : null}</span>
      <span className="rc-toast-title">{t.title}</span>
      {t.message ? <span className="rc-toast-msg">{t.message}</span> : null}
      {t.primaryAction ? <button className="rc-toast-btn" onClick={() => invoke(t.primaryAction!.cb)}>{t.primaryAction.title}</button> : null}
      {t.secondaryAction ? <button className="rc-toast-btn" onClick={() => invoke(t.secondaryAction!.cb)}>{t.secondaryAction.title}</button> : null}
    </div>
  );
}
