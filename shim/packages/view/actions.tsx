// ⌘K action panel (Raycast-style popover) and the shortcut dispatcher.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatSection, FlatAction } from './tree';
import { shortcutLabel } from './tree';
import { Img } from './image';

export function ActionPanelPopup({ sections, onRun, onClose }: { sections: FlatSection[]; onRun: (a: FlatAction) => void; onClose: () => void }) {
  const [path, setPath] = useState<FlatAction[]>([]);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = path.length ? path[path.length - 1].submenu ?? [] : sections;
  const flat = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { section?: string; a: FlatAction }[] = [];
    for (const s of current) for (const a of s.actions) if (!q || a.title.toLowerCase().includes(q)) out.push({ section: s.title, a });
    return out;
  }, [current, query]);
  useEffect(() => { inputRef.current?.focus(); }, [path]);
  useEffect(() => { setSel(0); }, [query, path]);
  const run = (a: FlatAction) => { if (a.submenu) { setPath([...path, a]); setQuery(''); } else onRun(a); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = flat[sel]; if (f) run(f.a); }
    else if (e.key === 'Escape' || (e.key === 'k' && e.metaKey)) { e.preventDefault(); e.stopPropagation(); if (path.length) { setPath(path.slice(0, -1)); setQuery(''); } else onClose(); }
    else if (e.key === 'Backspace' && !query && path.length) { e.preventDefault(); setPath(path.slice(0, -1)); }
    else {
      for (const f of flat) if (f.a.shortcut && matches(e, f.a.shortcut)) { e.preventDefault(); run(f.a); return; }
    }
  };
  let lastSection: string | undefined | null = null;
  return (
    <div className="rc-ap-backdrop" onMouseDown={onClose}>
      <div className="rc-ap" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="rc-ap-list">
          {flat.map((f, i) => {
            const header = f.section !== lastSection && f.section ? <div className="rc-ap-section">{f.section}</div> : null;
            lastSection = f.section;
            return (
              <React.Fragment key={i}>
                {header}
                <div className={`rc-ap-item ${f.a.style === 'destructive' ? 'rc-ap-destructive' : ''}`} data-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(f.a)}>
                  <Img value={f.a.node.props.icon} size={16} className="rc-ap-icon" />
                  <span className="rc-ap-title">{f.a.title}</span>
                  {f.a.submenu ? <span className="rc-ap-chevron">›</span> : null}
                  {i === 0 && !path.length && !query ? <kbd className="rc-kbd">↩</kbd> : f.a.shortcut ? <span className="rc-ap-shortcut">{shortcutLabel(f.a.shortcut).split('').map((c, k) => <kbd key={k} className="rc-kbd">{c}</kbd>)}</span> : null}
                </div>
              </React.Fragment>
            );
          })}
          {!flat.length ? <div className="rc-ap-empty">No matching actions</div> : null}
        </div>
        <div className="rc-ap-search">
          {path.length ? <span className="rc-ap-crumb">{path[path.length - 1].title} ›</span> : null}
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for actions…" />
        </div>
      </div>
    </div>
  );
}

import { matchesShortcut as matches } from './tree';
export { matches };
