import type { ReactNode } from 'react';

interface Props {
  /** Step number in the ledger's running order. Set as an eyebrow, not in the title. */
  step?: number | string;
  title: string;
  /** One sentence. If it needs two, it belongs in a Disclosure. */
  lede?: ReactNode;
  /** Right-aligned controls on the title line. */
  actions?: ReactNode;
  /** Anchor target, so the step bar can jump to this card. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * One card of the sheet: eyebrow, title, at most one line of explanation.
 *
 * The step number lives in the eyebrow rather than inside the display-face
 * heading so the headings themselves read as a list of things, and so a
 * renumbering never touches the copy.
 */
export function Section({ step, title, lede, actions, id, className, children }: Props) {
  return (
    <section id={id} className={className ? `card ${className}` : 'card'}>
      <div className="card-head">
        <div className="card-headings">
          {step !== undefined && <p className="step">Step {step}</p>}
          <h2>{title}</h2>
          {lede && <p className="lede">{lede}</p>}
        </div>
        {actions && <div className="card-actions print-hide">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
