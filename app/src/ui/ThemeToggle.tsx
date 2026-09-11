import { useTheme, type ThemeMode } from './themeMode';

const LABELS: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'system', label: 'System' },
];

/**
 * Three segments on one rule — words rather than a sun and a moon, because §5
 * rules out an icon set and a pinned theme has to say which one it is pinned to.
 */
export function ThemeToggle() {
  const [mode, setMode] = useTheme();
  return (
    <div className="theme-toggle print-hide" role="group" aria-label="Colour theme">
      {LABELS.map((t) => (
        <button
          key={t.mode}
          type="button"
          className="segment"
          aria-pressed={mode === t.mode}
          onClick={() => setMode(t.mode)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
