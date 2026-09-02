import React, { useMemo } from 'react';
import { marked } from 'marked';
marked.setOptions({ gfm: true, breaks: true });
export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => marked.parse(source) as string, [source]);
  return <div className="rc-markdown" dangerouslySetInnerHTML={{ __html: html }} onClick={(e) => { const a = (e.target as HTMLElement).closest('a'); if (a) { e.preventDefault(); window.open(a.href); } }} />;
}
