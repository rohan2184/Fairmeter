import { Mark } from './Mark';
import { ThemeToggle } from './ThemeToggle';

export interface StepState {
  id: string;
  label: string;
  done: boolean;
  /** Skippable steps never show as unfinished — they show as skipped. */
  optional?: boolean;
}

interface Props {
  steps: StepState[];
}

/**
 * The frame's one persistent element: the name, where you are in the form, and
 * the theme. It stays put while the form scrolls, so the answer panel on the
 * right and the step you are on are always both reachable.
 *
 * The chips are anchors, not buttons: they work with the keyboard, with the
 * back button, and without JS, and each carries its own completion state so the
 * bar doubles as the progress read-out.
 */
export function TopBar({ steps }: Props) {
  return (
    <header className="topbar print-hide">
      <div className="page topbar-inner">
        <a className="lockup" href="#top">
          <Mark size={22} />
          <span>Fairmeter</span>
        </a>

        <nav className="steps-nav" aria-label="Sections of the form">
          {steps.map((s) => (
            <a key={s.id} className={`step-chip${s.done ? ' done' : ''}`} href={`#${s.id}`}>
              <span className="step-tick" aria-hidden="true">
                {s.done ? '✓' : s.optional ? '·' : '○'}
              </span>
              {s.label}
            </a>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
