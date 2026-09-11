import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'fairmeter:theme';

/** The two grounds, for the browser chrome. Must track --surface (BRAND.md §3.7–3.8). */
const CHROME: Record<'light' | 'dark', string> = {
  light: '#f2ece1', // --cream-100
  dark: '#191b16', // --ink-950
};

const isMode = (v: unknown): v is ThemeMode =>
  v === 'light' || v === 'dark' || v === 'system';

export function readTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(KEY);
    return isMode(stored) ? stored : 'system';
  } catch {
    // Private mode, or storage blocked. Following the system is the right default.
    return 'system';
  }
}

/**
 * The whole mechanism: an attribute on the root, and nothing else.
 *
 * "system" removes the attribute rather than writing a resolved value, so the
 * `prefers-color-scheme` block in the stylesheet takes over and the page keeps
 * following the OS afterwards without anything here listening for the change.
 */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);

  // The <meta> pair in index.html is media-switched, which is right for
  // "system" and wrong for a pinned theme — so a pinned theme sets both to the
  // one colour it actually paints.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((m) => {
    const media = m.getAttribute('media');
    m.content =
      mode === 'system'
        ? media?.includes('dark')
          ? CHROME.dark
          : CHROME.light
        : CHROME[mode];
  });
}

/** Kept in state so the control can show which of the three is in force. */
export function useTheme(): [ThemeMode, (next: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readTheme);

  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Not persisting is survivable; the page is already correct for this visit.
    }
  }, [mode]);

  return [mode, setMode];
}
