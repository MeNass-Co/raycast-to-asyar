import React, { useEffect, useMemo, useRef } from 'react';
import type { RNode } from '../common/protocol';
import { realChildren, slotChild, textOf, type Invoke } from './tree';
import { Img, colorOf } from './image';
import { Markdown } from './markdown';
import { Metadata } from './detail';

export interface Row { kind: 'section' | 'item'; node: RNode; id: string; title: string; keywords: string; sectionIndex: number }

export function collectRows(root: RNode, filterText: string, enableFiltering: boolean): Row[] {
  const rows: Row[] = [];
  let sectionIndex = 0;
  const q = filterText.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  const matches = (r: Row) => !enableFiltering || !terms.length || terms.every((t) => (r.title + ' ' + r.keywords).toLowerCase().includes(t));
  const pushItem = (n: RNode, si: number) => {
    const title = typeof n.props.title === 'object' && n.props.title ? String((n.props.title as { value: string }).value) : String(n.props.title ?? '');
    const subtitle = typeof n.props.subtitle === 'object' && n.props.subtitle ? String((n.props.subtitle as { value?: string }).value ?? '') : String(n.props.subtitle ?? '');
    const kw = [subtitle, ...((n.props.keywords as string[]) ?? [])].join(' ');
    const r: Row = { kind: 'item', node: n, id: String(n.props.id ?? n.k), title, keywords: kw, sectionIndex: si };
    if (matches(r)) rows.push(r);
  };
  for (const c of realChildren(root)) {
    if (c.type === 'List.Section' || c.type === 'Grid.Section') {
      const start = rows.length;
      const si = sectionIndex++;
      for (const it of realChildren(c)) if (it.type === 'List.Item' || it.type === 'Grid.Item') pushItem(it, si);
      if (rows.length > start && (c.props.title || c.props.subtitle)) rows.splice(start, 0, { kind: 'section', node: c, id: 'sec' + c.k, title: String(c.props.title ?? ''), keywords: '', sectionIndex: si });
    } else if (c.type === 'List.Item' || c.type === 'Grid.Item') pushItem(c, sectionIndex);
  }
  return rows;
}

function AccessoryView({ a }: { a: Record<string, unknown> }) {
  const tooltip = a.tooltip as string | undefined;
  const parts: React.ReactNode[] = [];
  if (a.tag !== undefined && a.tag !== null) {
    const tag = a.tag as string | { value: string; color?: unknown };
    const value = typeof tag === 'object' ? tag.value : tag;
    const color = typeof tag === 'object' ? colorOf(tag.color) : undefined;
    parts.push(<span key="tag" className="rc-tag" style={color ? { color, background: `color-mix(in srgb, ${color} 15%, transparent)` } : undefined}>{String(value)}</span>);
  }
  if (a.date) { const d = a.date as { $date: number } | string; const dt = new Date(typeof d === 'object' ? d.$date : d); parts.push(<span key="date" className="rc-acc-text">{fmtDate(dt)}</span>); }
  if (a.text !== undefined && a.text !== null) {
    const t = a.text as string | { value?: string; color?: unknown };
    const value = typeof t === 'object' ? t.value : t;
    const color = typeof t === 'object' ? colorOf(t.color) : undefined;
    if (value) parts.push(<span key="text" className="rc-acc-text" style={{ color }}>{String(value)}</span>);
  }
  if (a.icon) parts.push(<Img key="icon" value={a.icon} size={16} className="rc-acc-icon" />);
  if (!parts.length) return null;
  return <span className="rc-accessory" title={tooltip}>{parts}</span>;
}
function fmtDate(d: Date): string {
  const now = new Date(); const diff = now.getTime() - d.getTime();
  const day = 86_400_000;
  if (Math.abs(diff) < day && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * day && diff > 0) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function ListView({ root, rows, selected, onSelect, onActivate, isLoading, invoke }: { root: RNode; rows: Row[]; selected: number; onSelect: (i: number) => void; onActivate: () => void; isLoading: boolean; invoke: Invoke }) {
  const isGrid = root.type === 'Grid';
  const showingDetail = !!root.props.isShowingDetail;
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  const sel = rows[selected];
  const detail = sel?.kind === 'item' ? slotChild(sel.node, 'detail') : undefined;
  const empty = realChildren(root).find((c) => c.type === 'List.EmptyView');
  const columns = Number(root.props.columns ?? 5);

  if (!rows.length) {
    return (
      <div className="rc-empty">
        {isLoading ? <div className="rc-spinner" /> : <>
          <Img value={empty?.props.icon ?? 'magnifying-glass-16'} size={40} className="rc-empty-icon" />
          <div className="rc-empty-title">{String(empty?.props.title ?? 'No results')}</div>
          {empty?.props.description ? <div className="rc-empty-desc">{String(empty.props.description)}</div> : null}
        </>}
      </div>
    );
  }
  return (
    <div className={`rc-split ${showingDetail && !isGrid ? 'rc-split-detail' : ''}`}>
      <div ref={listRef} className={isGrid ? 'rc-grid' : 'rc-list'} style={isGrid ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>
        {rows.map((r, i) => r.kind === 'section'
          ? <div key={r.id} className="rc-section-header"><span>{r.title}</span>{r.node.props.subtitle ? <span className="rc-section-sub">{String(r.node.props.subtitle)}</span> : null}</div>
          : isGrid ? <GridCell key={r.id} r={r} selected={i === selected} onSelect={() => onSelect(i)} onActivate={onActivate} />
          : <ListRow key={r.id} r={r} selected={i === selected} onSelect={() => onSelect(i)} onActivate={onActivate} />)}
      </div>
      {showingDetail && !isGrid ? <div className="rc-detail-pane">{detail ? <ItemDetail node={detail} invoke={invoke} /> : null}</div> : null}
    </div>
  );
}

function ListRow({ r, selected, onSelect, onActivate }: { r: Row; selected: boolean; onSelect: () => void; onActivate: () => void }) {
  const p = r.node.props;
  const subtitle = typeof p.subtitle === 'object' && p.subtitle ? (p.subtitle as { value?: string }).value : (p.subtitle as string | undefined);
  const titleTip = typeof p.title === 'object' && p.title ? (p.title as { tooltip?: string }).tooltip : undefined;
  const accessories = (p.accessories as Record<string, unknown>[] | undefined) ?? [];
  const legacy: Record<string, unknown>[] = [];
  if (p.accessoryTitle) legacy.push({ text: p.accessoryTitle });
  if (p.accessoryIcon) legacy.push({ icon: p.accessoryIcon });
  return (
    <div className="rc-row" data-selected={selected} onMouseEnter={onSelect} onClick={onSelect} onDoubleClick={onActivate}>
      {p.icon ? <Img value={p.icon} size={20} className="rc-row-icon" /> : <span className="rc-row-icon rc-row-icon-empty" />}
      <span className="rc-row-title" title={titleTip ?? undefined}>{r.title}</span>
      {subtitle ? <span className="rc-row-subtitle">{subtitle}</span> : null}
      <span className="rc-row-spacer" />
      {[...accessories, ...legacy].map((a, i) => <AccessoryView key={i} a={a} />)}
    </div>
  );
}

function GridCell({ r, selected, onSelect, onActivate }: { r: Row; selected: boolean; onSelect: () => void; onActivate: () => void }) {
  const p = r.node.props;
  const content = p.content as unknown;
  const c = content && typeof content === 'object' && 'value' in (content as object) ? (content as { value: unknown }).value : content;
  const color = c && typeof c === 'object' && 'color' in (c as object) ? colorOf((c as { color: unknown }).color) : undefined;
  return (
    <div className="rc-cell" data-selected={selected} onMouseEnter={onSelect} onClick={onSelect} onDoubleClick={onActivate}>
      <div className="rc-cell-content" style={color ? { background: color } : undefined}>{color ? null : <Img value={c} size={48} />}</div>
      {r.title ? <div className="rc-cell-title">{r.title}</div> : null}
      {p.subtitle ? <div className="rc-cell-subtitle">{String(p.subtitle)}</div> : null}
    </div>
  );
}

export function ItemDetail({ node, invoke }: { node: RNode; invoke: Invoke }) {
  const md = node.props.markdown as string | null | undefined;
  const meta = slotChild(node, 'metadata');
  return (
    <div className="rc-item-detail">
      {node.props.isLoading ? <div className="rc-progress" /> : null}
      {md ? <Markdown source={md} /> : null}
      {meta ? <Metadata node={meta} invoke={invoke} /> : null}
    </div>
  );
}
export { textOf };
