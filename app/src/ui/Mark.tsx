/**
 * The brand mark, inline, so it inherits the theme's semantic tokens instead
 * of hard-coding fills — which is what makes the dark variant and the one-ink
 * print variant free (BRAND.md §2.5). Geometry is the 32×32 table verbatim:
 * two unequal blocks on one rule that spans exactly their combined width.
 *
 * Two colour variants only: full colour, and single colour via `currentColor`.
 */

interface MarkProps {
  /** Rendered size in px. 25 is the lockup size against the 30px display step. */
  size?: number;
  /** Single-colour variant — every part takes the inherited text colour. */
  oneInk?: boolean;
}

export function Mark({ size = 25, oneInk = false }: MarkProps) {
  const block = oneInk ? 'currentColor' : 'var(--accent)';
  const second = oneInk ? 'currentColor' : 'var(--seg-2)';
  const rule = oneInk ? 'currentColor' : 'var(--text)';
  return (
    <svg
      className="symbol"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="6" width="12" height="16" fill={block} />
      <rect x="18" y="12" width="10" height="10" fill={second} />
      <rect x="4" y="25" width="24" height="3" fill={rule} />
    </svg>
  );
}
