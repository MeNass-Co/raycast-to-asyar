// ImageLike → <img>/<svg>/emoji element.
import React from 'react';
import { RAYCAST_ICONS } from './icons';

export const COLORS: Record<string, string> = {
  'raycast-blue': '#0A84FF', 'raycast-green': '#30D158', 'raycast-magenta': '#FF375F', 'raycast-orange': '#FF9F0A',
  'raycast-purple': '#BF5AF2', 'raycast-red': '#FF453A', 'raycast-yellow': '#FFD60A',
  'raycast-primary-text': 'var(--text-primary)', 'raycast-secondary-text': 'var(--text-secondary)',
};
/** Resolved host appearance: follows the launcher's data-theme, else the OS. */
export function hostAppearance(): 'light' | 'dark' {
  try {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch { return 'dark'; }
}
export function colorOf(c: unknown, appearance: 'light' | 'dark' = hostAppearance()): string | undefined {
  if (!c) return undefined;
  if (typeof c === 'string') return COLORS[c] ?? c;
  if (typeof c === 'object') { const d = c as { light?: string; dark?: string }; return appearance === 'light' ? d.light : d.dark; }
  return undefined;
}

let extensionId = '';
export const setImageContext = (id: string) => { extensionId = id; };
// Text glyph, not an icon name/path: pictographs, flags (regional indicators), keycaps/ZWJ sequences,
// and bare symbols/punctuation (Raycast's "Unicode Symbols": !, $, ², µ, -, _ …). Icon names start with
// an ASCII letter (magnifying-glass-16, icon.png), so those never match.
export const isEmoji = (s: string) => s.length <= 16 && !/^(https?:|data:|asyar-|\/)/.test(s)
  && (/^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{S}\p{P}]/u.test(s) || /[\uFE0F\u20E3\u200D]/.test(s) || (s.length <= 2 && !/^[A-Za-z0-9]+$/.test(s)));

function sourceUrl(src: unknown): string | undefined {
  if (typeof src !== 'string') { const d = src as { light?: string; dark?: string } | undefined; return d ? sourceUrl(d.dark ?? d.light) : undefined; }
  if (/^(https?:|data:|asyar-)/.test(src)) return src;
  if (src.startsWith('/')) return `asyar-icon://localhost/${src.replace(/\//g, '_')}.png`;
  if (src.endsWith('-16') && RAYCAST_ICONS[src]) return undefined;
  return `asyar-extension://${extensionId}/assets/${src}`;
}

export function Img({ value, size = 16, className = '', tint }: { value: unknown; size?: number; className?: string; tint?: string }) {
  if (value === undefined || value === null || value === false) return null;
  const v = value as string | { source?: unknown; mask?: string; tintColor?: unknown; fileIcon?: string; value?: unknown; tooltip?: string };
  if (typeof v === 'object' && 'value' in v && v.value !== undefined && !('source' in v)) return <span title={v.tooltip}><Img value={v.value} size={size} className={className} tint={tint} /></span>;
  const style: React.CSSProperties = { width: size, height: size };
  if (typeof v === 'object' && v.fileIcon) return <img className={`rc-img ${className}`} style={style} src={`asyar-icon://localhost/${v.fileIcon.replace(/\//g, '_')}.png`} alt="" onError={hideOnError} />;
  const source = typeof v === 'string' ? v : v.source;
  const mask = typeof v === 'object' ? v.mask : undefined;
  const color = tint ?? colorOf(typeof v === 'object' ? v.tintColor : undefined);
  if (typeof source === 'string' && RAYCAST_ICONS[source]) {
    return <span className={`rc-icon ${className}`} style={{ ...style, color }} dangerouslySetInnerHTML={{ __html: RAYCAST_ICONS[source] }} />;
  }
  if (typeof source === 'string' && isEmoji(source)) return <span className={`rc-emoji ${className}`} style={{ fontSize: size * 0.85, width: size, height: size }}>{source}</span>;
  const url = sourceUrl(source);
  if (!url) return null;
  return <img className={`rc-img ${className} ${mask === 'circle' ? 'rc-mask-circle' : mask === 'roundedRectangle' ? 'rc-mask-rounded' : ''}`} style={style} src={url} alt="" onError={hideOnError} />;
}
const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; };
