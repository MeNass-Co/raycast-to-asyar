import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { RNode } from '../common/protocol';
import { realChildren, cbId, type Invoke } from './tree';
import { Img } from './image';

export type FormValues = Record<string, unknown>;
export interface FormHandle { values: () => FormValues; focus: (id: string) => void; reset: (id: string) => void; validate: () => boolean }

/** Controlled/uncontrolled hybrid: the sidecar owns `value` when provided, else the view keeps local state. */
export const FormView = forwardRef<FormHandle, { root: RNode; invoke: Invoke; draft?: FormValues }>(function FormView({ root, invoke, draft }, ref) {
  const fields = realChildren(root).filter((c) => c.type.startsWith('Form.') && c.type !== 'Form.Separator' && c.type !== 'Form.Description' && c.type !== 'Form.LinkAccessory');
  const [local, setLocal] = useState<FormValues>(() => {
    const o: FormValues = {};
    for (const f of fields) { const id = String(f.props.id); o[id] = draft?.[id] ?? f.props.value ?? f.props.defaultValue ?? defaultFor(f.type); }
    return o;
  });
  const inputs = useRef(new Map<string, HTMLElement>());
  const get = (f: RNode) => { const id = String(f.props.id); return f.props.value !== undefined ? unwrap(f.props.value) : local[id]; };
  const set = (f: RNode, v: unknown) => {
    const id = String(f.props.id);
    setLocal((s) => ({ ...s, [id]: v }));
    const cb = cbId(f.props.onChange); if (cb !== undefined) invoke(cb, v instanceof Date ? { $date: v.getTime() } : v);
  };
  useImperativeHandle(ref, () => ({
    values: () => { const o: FormValues = {}; for (const f of fields) o[String(f.props.id)] = get(f); return o; },
    focus: (id) => inputs.current.get(id)?.focus(),
    reset: (id) => { const f = fields.find((x) => String(x.props.id) === id); if (f) set(f, f.props.defaultValue ?? defaultFor(f.type)); },
    validate: () => fields.every((f) => !f.props.error),
  }));
  useEffect(() => { const first = fields.find((f) => f.props.autoFocus) ?? fields[0]; if (first) setTimeout(() => inputs.current.get(String(first.props.id))?.focus(), 30); }, []);

  return (
    <div className="rc-form">
      {realChildren(root).map((f) => {
        const id = String(f.props.id ?? f.k);
        const title = f.props.title as string | undefined;
        const error = f.props.error as string | undefined;
        const info = f.props.info as string | undefined;
        const reg = (el: HTMLElement | null) => { if (el) inputs.current.set(id, el); };
        const onFocus = () => { const cb = cbId(f.props.onFocus); if (cb !== undefined) invoke(cb, { type: 'focus', target: { id, value: get(f) } }); };
        const onBlur = () => { const cb = cbId(f.props.onBlur); if (cb !== undefined) invoke(cb, { type: 'blur', target: { id, value: get(f) } }); };
        const wrap = (control: React.ReactNode, extra?: React.ReactNode) => (
          <div key={f.k} className={`rc-field ${error ? 'rc-field-error' : ''}`}>
            <label className="rc-field-title" htmlFor={'f-' + id} title={info}>{title ?? ''}</label>
            <div className="rc-field-control">{control}{error ? <div className="rc-field-err">{error}</div> : info ? <div className="rc-field-info">{info}</div> : null}{extra}</div>
          </div>
        );
        switch (f.type) {
          case 'Form.TextField': case 'Form.PasswordField':
            return wrap(<input ref={reg} id={'f-' + id} type={f.type === 'Form.PasswordField' ? 'password' : 'text'} className="rc-input" placeholder={f.props.placeholder as string} value={String(get(f) ?? '')} onChange={(e) => set(f, e.target.value)} onFocus={onFocus} onBlur={onBlur} />);
          case 'Form.TextArea':
            return wrap(<textarea ref={reg} id={'f-' + id} className="rc-input rc-textarea" placeholder={f.props.placeholder as string} value={String(get(f) ?? '')} onChange={(e) => set(f, e.target.value)} onFocus={onFocus} onBlur={onBlur} rows={4} />);
          case 'Form.Checkbox':
            return wrap(<label className="rc-checkbox"><input ref={reg} id={'f-' + id} type="checkbox" checked={!!get(f)} onChange={(e) => set(f, e.target.checked)} onFocus={onFocus} onBlur={onBlur} /><span>{String(f.props.label ?? '')}</span></label>);
          case 'Form.DatePicker': {
            const v = get(f) as Date | null | undefined; const dt = v instanceof Date ? v : v ? new Date(v as never) : null;
            const isDateTime = f.props.type === 'date_time';
            return wrap(<input ref={reg} id={'f-' + id} type={isDateTime ? 'datetime-local' : 'date'} className="rc-input" value={dt ? toInput(dt, isDateTime) : ''} onChange={(e) => set(f, e.target.value ? new Date(e.target.value) : null)} onFocus={onFocus} onBlur={onBlur} />);
          }
          case 'Form.Dropdown': {
            const opts: { value: string; title: string; icon?: unknown; section?: string }[] = [];
            for (const c of realChildren(f)) { if (c.type === 'Form.Dropdown.Section') for (const it of realChildren(c)) opts.push({ value: String(it.props.value), title: String(it.props.title), icon: it.props.icon, section: c.props.title as string }); else if (c.type === 'Form.Dropdown.Item') opts.push({ value: String(c.props.value), title: String(c.props.title), icon: c.props.icon }); }
            const cur = String(get(f) ?? '');
            const curOpt = opts.find((o) => o.value === cur);
            const shown = curOpt ?? (cur === '' ? opts[0] : undefined);
            if (!curOpt && shown && f.props.value === undefined) queueMicrotask(() => set(f, shown.value));
            return wrap(<span className="rc-select-wrap">{shown?.icon ? <Img value={shown.icon} size={16} className="rc-select-icon" /> : null}<select ref={reg as never} id={'f-' + id} className="rc-input rc-select" value={shown?.value ?? ''} onChange={(e) => set(f, e.target.value)} onFocus={onFocus} onBlur={onBlur}>{!shown ? <option value="">{String(f.props.placeholder ?? '')}</option> : null}{groupOptions(opts)}</select></span>);
          }
          case 'Form.TagPicker': {
            const items = realChildren(f).filter((c) => c.type === 'Form.TagPicker.Item');
            const cur = (get(f) as string[] | undefined) ?? [];
            return wrap(<div className="rc-tagpicker">{items.map((it) => { const v = String(it.props.value); const on = cur.includes(v); return <button key={it.k} type="button" className={`rc-tag rc-tag-btn ${on ? 'rc-tag-on' : ''}`} onClick={() => set(f, on ? cur.filter((x) => x !== v) : [...cur, v])}>{it.props.icon ? <Img value={it.props.icon} size={12} /> : null}{String(it.props.title)}</button>; })}</div>);
          }
          case 'Form.FilePicker': {
            const cur = (get(f) as string[] | undefined) ?? [];
            return wrap(<div className="rc-filepicker"><input ref={reg} id={'f-' + id} type="text" className="rc-input" placeholder="Paste a path…" value={cur.join(', ')} onChange={(e) => set(f, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} onFocus={onFocus} onBlur={onBlur} /></div>);
          }
          case 'Form.Separator': return <div key={f.k} className="rc-form-sep" />;
          case 'Form.Description': return <div key={f.k} className="rc-field"><span className="rc-field-title">{String(f.props.title ?? '')}</span><div className="rc-field-control rc-description">{String(f.props.text ?? '')}</div></div>;
          default: return null;
        }
      })}
    </div>
  );
});

function groupOptions(opts: { value: string; title: string; section?: string }[]) {
  const groups = new Map<string | undefined, typeof opts>();
  for (const o of opts) { const g = groups.get(o.section) ?? []; g.push(o); groups.set(o.section, g); }
  return [...groups].map(([s, os]) => s ? <optgroup key={s} label={s}>{os.map((o) => <option key={o.value} value={o.value}>{o.title}</option>)}</optgroup> : os.map((o) => <option key={o.value} value={o.value}>{o.title}</option>));
}
const defaultFor = (t: string) => (t === 'Form.Checkbox' ? false : t === 'Form.TagPicker' || t === 'Form.FilePicker' ? [] : t === 'Form.DatePicker' ? null : '');
const unwrap = (v: unknown) => (v && typeof v === 'object' && '$date' in (v as object) ? new Date((v as { $date: number }).$date) : v);
const toInput = (d: Date, dt: boolean) => { const p = (n: number) => String(n).padStart(2, '0'); const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; return dt ? `${s}T${p(d.getHours())}:${p(d.getMinutes())}` : s; };
