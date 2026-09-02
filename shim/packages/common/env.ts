export interface ShimConfig {
  extensionId: string;
  extensionName: string;
  ownerOrAuthorName: string;
  nodePath: string;
  /** Raycast command name → { mode, component } */
  commands: Record<string, { mode: 'view' | 'no-view' | 'menu-bar'; title: string; interval?: string }>;
  tools: string[];
}
export function extensionIdFromLocation(fallback: string): string {
  const host = window.location.hostname;
  return host === 'localhost' || host === 'asyar-extension.localhost'
    ? window.location.pathname.split('/').filter(Boolean)[0] || fallback
    : host || fallback;
}
