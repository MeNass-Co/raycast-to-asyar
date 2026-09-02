import React from 'react';
import type { RNode } from '../common/protocol';
import { realChildren, slotChild, cbId, type Invoke } from './tree';
import { Img, colorOf } from './image';
import { Markdown } from './markdown';

export function DetailView({ root, invoke }: { root: RNode; invoke: Invoke }) {
  const md = root.props.markdown as string | null | undefined;
  const meta = slotChild(root, 'metadata');
  return (
    <div className={`rc-detail ${meta ? 'rc-detail-with-meta' : ''}`}>
      <div className="rc-detail-main">{md ? <Markdown source={md} /> : null}</div>
      {meta ? <div className="rc-detail-meta"><Metadata node={meta} invoke={invoke} /></div> : null}
    </div>
  );
}

export function Metadata({ node, invoke }: { node: RNode; invoke: Invoke }) {
  return (
    <div className="rc-meta">
      {realChildren(node).map((c) => {
        switch (c.type) {
          case 'Detail.Metadata.Label': {
            const t = c.props.text as string | { value: string; color?: unknown } | undefined;
            const value = typeof t === 'object' && t ? t.value : t;
            const color = typeof t === 'object' && t ? colorOf(t.color) : undefined;
            return <div key={c.k} className="rc-meta-row"><span className="rc-meta-title">{String(c.props.title ?? '')}</span><span className="rc-meta-value" style={{ color }}>{c.props.icon ? <Img value={c.props.icon} size={16} /> : null}{value ? <span>{String(value)}</span> : null}</span></div>;
          }
          case 'Detail.Metadata.Link':
            return <div key={c.k} className="rc-meta-row"><span className="rc-meta-title">{String(c.props.title ?? '')}</span><a className="rc-meta-link" href={String(c.props.target)} onClick={(e) => { e.preventDefault(); window.open(String(c.props.target)); }}>{String(c.props.text ?? c.props.target)}</a></div>;
          case 'Detail.Metadata.Separator':
            return <div key={c.k} className="rc-meta-sep" />;
          case 'Detail.Metadata.TagList':
            return <div key={c.k} className="rc-meta-row"><span className="rc-meta-title">{String(c.props.title ?? '')}</span><span className="rc-meta-tags">{realChildren(c).map((t) => { const color = colorOf(t.props.color); const cb = cbId(t.props.onAction); return <span key={t.k} className="rc-tag" style={color ? { color, background: `color-mix(in srgb, ${color} 15%, transparent)` } : undefined} onClick={cb !== undefined ? () => invoke(cb) : undefined}>{t.props.icon ? <Img value={t.props.icon} size={12} /> : null}{String(t.props.text ?? '')}</span>; })}</span></div>;
          default: return null;
        }
      })}
    </div>
  );
}
