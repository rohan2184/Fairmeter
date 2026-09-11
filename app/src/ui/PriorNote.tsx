/**
 * The reading before last, shown read-only (D-13).
 *
 * It is carried forward automatically when a cycle is rolled on, never typed —
 * but it changes the numbers, so it has to be visible. With it the aligner
 * interpolates this bill's opening date; without it, it extrapolates and says
 * so in a warning.
 */
export function PriorNote({ prior, date }: { prior: string; date: string }) {
  if (prior.trim() === '' || date.trim() === '') return null;
  return (
    <p className="hint prior-note">
      Reading before last: <strong>{prior}</strong> on {date} — carried from the previous
      cycle, and what makes this cycle's window alignment exact rather than an estimate.
    </p>
  );
}
