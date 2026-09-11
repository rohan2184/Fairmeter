/**
 * Design lab — dev-only, not part of the product.
 *
 * Three candidate visual directions for Fairmeter, each rendered as a working
 * screen with the reference bill's real numbers, so the choice is made by
 * looking at the actual product rather than at swatches. Reached from the
 * "Design lab" button in the header, or at #design.
 */

import { useState, type ReactNode } from 'react';
import { SAMPLE } from './sample';
import './lab.css';

type DirId = 'instrument' | 'ledger' | 'wiring';
type Mode = 'light' | 'dark';

interface Swatch {
  role: string;
  light: string;
  dark: string;
  use: string;
}

interface Direction {
  id: DirId;
  name: string;
  canonical: Mode;
  source: string;
  thesis: string;
  rationale: ReactNode;
  risk: string;
  fonts: { display: string; body: string; mono: string };
  swatches: Swatch[];
  mark: (size: number) => ReactNode;
}

const DIRECTIONS: Direction[] = [
  {
    id: 'instrument',
    name: 'Instrument panel',
    canonical: 'dark',
    source: 'The energy meter itself — graphite enclosure, LCD readout, the red pulse LED.',
    thesis:
      'The engine’s claim is exactness: integer paise, largest-remainder allocation, shares that sum back to the bill with nothing dropped. This direction dresses the app as the measuring instrument that claim deserves — a sunk LCD window for every figure, hairline rules, nothing decorative.',
    rationale: (
      <>
        The signature is the <b>ratio rail</b>: one horizontal bar, segmented by household, sitting
        directly under the header. It is the single consumption ratio that D-01 divides every charge
        by — so the one bar literally explains the whole document, and it repeats as a 3&nbsp;px
        sliver at the head of each charge row.
      </>
    ),
    risk: 'Dark-first means the print statement needs its own light treatment. Figures are monospace everywhere, which is right for money and slightly cold for prose.',
    fonts: { display: 'Archivo (semi-expanded)', body: 'Public Sans', mono: 'JetBrains Mono' },
    swatches: [
      { role: 'panel', light: '#e4e9e4', dark: '#0f1513', use: 'page ground' },
      { role: 'surface', light: '#f5f7f4', dark: '#19221f', use: 'cards' },
      { role: 'ink', light: '#101815', dark: '#e8efea', use: 'text' },
      { role: 'muted', light: '#5d6b64', dark: '#7d8c85', use: 'labels, units' },
      { role: 'readout', light: '#35633a', dark: '#b6d94c', use: 'live figures, primary action' },
      { role: 'pulse', light: '#c02f1d', dark: '#ff4a38', use: 'warnings only — never decoration' },
    ],
    mark: (s) => (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--l-card)" stroke="var(--l-line)" strokeWidth="1.5" />
        <rect x="6" y="13" width="20" height="6" rx="1" fill="var(--l-seg3)" />
        <rect x="6" y="13" width="12" height="6" rx="1" fill="var(--l-accent)" />
        <circle cx="25" cy="7.5" r="2.2" fill="var(--l-alert)" />
      </svg>
    ),
  },
  {
    id: 'ledger',
    name: 'Columnar ledger',
    canonical: 'light',
    source: 'The accountant’s green columnar pad — and the handwritten register this app replaces.',
    thesis:
      'The product is a reckoning between neighbours, and it has to survive being printed and handed over. This direction makes the screen and the paper the same document: ruled columns, dense ink, one red pen for anything that needs a human decision.',
    rationale: (
      <>
        The signature is <b>real ruled columns</b> behind the breakdown table — the alternating
        band and the vertical rule are the pad, not a zebra-stripe effect. The residual, the one
        number nobody measured, is marked in red the way you would circle it by hand.
      </>
    ),
    risk: 'Warm paper plus a serif display is close to a well-worn look; the green columnar rule and the cool ink are what keep it from being generic. Serif numerals are avoided — figures stay monospace.',
    fonts: { display: 'Fraunces', body: 'Public Sans', mono: 'Roboto Mono' },
    swatches: [
      { role: 'paper', light: '#edf1e9', dark: '#121a14', use: 'page ground' },
      { role: 'sheet', light: '#fbfcf9', dark: '#1a231b', use: 'cards' },
      { role: 'ink', light: '#1b2a20', dark: '#e7ede5', use: 'text' },
      { role: 'muted', light: '#6b7a6e', dark: '#8b9a8c', use: 'labels' },
      { role: 'rule', light: '#9fbe9b', dark: '#3c5540', use: 'column lines, bands' },
      { role: 'carry', light: '#c0392b', dark: '#e4685c', use: 'residual, warnings — the red pen' },
    ],
    mark: (s) => (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2" y="2" width="28" height="28" rx="2" fill="var(--l-card)" stroke="var(--l-rule)" strokeWidth="1.5" />
        <path d="M12 2v28M21 2v28" stroke="var(--l-rule)" strokeWidth="1.5" />
        <path d="M6.5 18.5l4.5 5L26 8" fill="none" stroke="var(--l-alert)" strokeWidth="3" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    id: 'wiring',
    name: 'Wiring code',
    canonical: 'light',
    source: 'Indian house wiring colours — live brown, neutral blue, earth green.',
    thesis:
      'The hardest thing to follow in this app is one household across four surfaces: the form, the table, the WhatsApp message and the print-out. This direction gives each household a wire colour and never lets it change, so you can trace a household by colour alone.',
    rationale: (
      <>
        The signature is the <b>three-core cross-section</b> — the split drawn as the cable that
        actually feeds the building. Colour does real work here: it is an identity channel, not
        decoration, so it is always paired with the household name (colour is never the only cue).
      </>
    ),
    risk: 'The palette is bold and only works if household colours are assigned once and never reused. It also caps out around five or six households before the colours stop being distinguishable.',
    fonts: { display: 'Bricolage Grotesque', body: 'Hanken Grotesk', mono: 'DM Mono' },
    swatches: [
      { role: 'ground', light: '#f5f4f0', dark: '#15171c', use: 'page ground' },
      { role: 'ink', light: '#14161a', dark: '#eceef0', use: 'text' },
      { role: 'live', light: '#8c4a2f', dark: '#d08a63', use: 'household 1, primary action' },
      { role: 'neutral', light: '#1d4e89', dark: '#7ba6de', use: 'household 2' },
      { role: 'earth', light: '#3e7a3a', dark: '#86c57f', use: 'household 3 / shared load' },
      { role: 'caution', light: '#e5b93c', dark: '#e5b93c', use: 'warnings' },
    ],
    mark: (s) => (
      <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14.2" fill="var(--l-card)" stroke="var(--l-ink)" strokeWidth="2" />
        <circle cx="16" cy="9.6" r="5" fill="var(--l-seg1)" />
        <circle cx="10.4" cy="19.4" r="5" fill="var(--l-seg2)" />
        <circle cx="21.6" cy="19.4" r="5" fill="var(--l-seg3)" />
      </svg>
    ),
  },
];

export function DesignLab({ onExit }: { onExit: () => void }) {
  const [override, setOverride] = useState<Mode | null>(null);

  return (
    <div className="lab">
      <div className="lab-bar">
        <button onClick={onExit}>← Back to the app</button>
        <strong>Fairmeter · design lab</strong>
        <span className="spacer" />
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            onClick={() =>
              document.getElementById(`dir-${d.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            {d.name}
          </button>
        ))}
        <button aria-pressed={override === null} onClick={() => setOverride(null)}>
          Canonical
        </button>
        <button aria-pressed={override === 'light'} onClick={() => setOverride('light')}>
          Light
        </button>
        <button aria-pressed={override === 'dark'} onClick={() => setOverride('dark')}>
          Dark
        </button>
      </div>

      <div className="lab-intro">
        <h1>Three directions for Fairmeter</h1>
        <p>
          Each one is rendered with the reference bill’s real figures — 161 units, ₹1,860.00
          payable, split 60/40 between two metered households carrying a shared pump and 19
          unaccounted units. Every column below adds back to the bill exactly, so you are judging
          the design against the numbers it will actually have to carry.
        </p>
        <p>
          <em>Canonical</em> shows each direction in the mode it was designed for. Light and Dark
          force both, to check that neither falls apart. Pick one and I’ll write it up as{' '}
          <code>BRAND.md</code> and rebuild the app’s CSS on it.
        </p>
      </div>

      {DIRECTIONS.map((d) => (
        <section className="lab-section" id={`dir-${d.id}`} key={d.id}>
          <h2>
            <b>{d.name}</b> — {d.source}
          </h2>
          <p className="lab-thesis">
            {d.thesis} <em>Trade-off:</em> {d.risk}
          </p>
          <div className="dir" data-dir={d.id} data-mode={override ?? d.canonical}>
            <Identity dir={d} mode={override ?? d.canonical} />
            <div className="pane">
              <p className="pane-title">Palette</p>
              <div className="swatches">
                {d.swatches.map((s) => (
                  <div className="swatch" key={s.role}>
                    <div className="chip" style={{ background: (override ?? d.canonical) === 'dark' ? s.dark : s.light }} />
                    <div className="meta">
                      <span className="role">{s.role}</span>
                      <span className="hex">{(override ?? d.canonical) === 'dark' ? s.dark : s.light}</span>
                      <span className="use">{s.use}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pane">
              <p className="pane-title">Type</p>
              <div className="type-spec">
                <div className="spec">
                  <span className="spec-role">Display</span>
                  <p className="spec-name">{d.fonts.display}</p>
                  <p className="spec-sample spec-display">The split for July 2026</p>
                </div>
                <div className="spec">
                  <span className="spec-role">Body</span>
                  <p className="spec-name">{d.fonts.body}</p>
                  <p className="spec-sample spec-body">
                    Sub-meters were read four days after the utility read the official meter.
                    Readings have been interpolated to the bill’s window, so nothing is lost
                    between cycles.
                  </p>
                </div>
                <div className="spec">
                  <span className="spec-role">Figures</span>
                  <p className="spec-name">{d.fonts.mono}</p>
                  <p className="spec-sample spec-mono">
                    ₹1,116.00
                    <br />
                    96.6 u · 60.0%
                    <br />
                    0123456789
                  </p>
                </div>
              </div>
            </div>
            <Screen dir={d} />
            <FormFragment dir={d} />
          </div>
        </section>
      ))}

      <div className="lab-foot">
        <p>
          Nothing here is wired to the engine — the figures are a fixed sample in{' '}
          <code>src/ui/design/sample.ts</code>. Once you pick a direction this page can stay as a
          living style reference or be deleted; it costs nothing in the production bundle either
          way, since it is only reachable from the dev button.
        </p>
      </div>
    </div>
  );
}

function Identity({ dir, mode }: { dir: Direction; mode: Mode }) {
  return (
    <div className="id-block">
      <div>
        <div className="lockup">
          {dir.mark(48)}
          <span className="wordmark">
            <span className="mk-fair">Fair</span>
            <span className="mk-meter">meter</span>
          </span>
        </div>
        <p className="tagline">One bill, split to the paisa.</p>
        <p className="rationale">{dir.rationale}</p>
      </div>
      <div>
        <p className="pane-title">Favicon · {mode}</p>
        <div className="favicons">
          {[64, 32, 16].map((s) => (
            <div className="favicon-cell" key={s}>
              {dir.mark(s)}
              <span>{s}px</span>
            </div>
          ))}
        </div>
        <div className="favicons">
          <div className="favicon-chrome">
            {dir.mark(16)}
            <span>Fairmeter</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Screen({ dir }: { dir: Direction }) {
  const [a, b] = SAMPLE.households;
  return (
    <div className="pane">
      <p className="pane-title">The split</p>
      <div className="screen">
        <div className="scr-head">
          <h3>The split · {SAMPLE.billingMonth}</h3>
          <span className="meta">
            {SAMPLE.provider} · {SAMPLE.plan}
          </span>
        </div>

        {dir.id === 'wiring' ? (
          <div className="cable">
            <svg width="104" height="104" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="14.6" fill="var(--l-card)" stroke="var(--l-ink)" strokeWidth="1.2" />
              <circle cx="16" cy="10.4" r="5.4" fill="var(--l-seg1)" />
              <circle cx="10.6" cy="19.6" r="4.6" fill="var(--l-seg2)" />
              <circle cx="21.8" cy="19.6" r="3" fill="var(--l-seg3)" />
            </svg>
            <p className="cable-legend">
              Ground floor <b>96.6 u · 60.0%</b>
              <br />
              First floor <b>64.4 u · 40.0%</b>
              <br />
              Shared pump <b>12 u</b>, divided by the same ratio
            </p>
          </div>
        ) : null}

        <div className="rail-wrap">
          <div className="rail">
            <span className="s1" style={{ width: '60%' }} />
            <span className="s2" style={{ width: '40%' }} />
          </div>
          <div className="rail-key">
            <span>
              <i style={{ background: 'var(--l-seg1)' }} />
              {a.name} <b>{a.pct}%</b> · ₹{a.total}
            </span>
            <span>
              <i style={{ background: 'var(--l-seg2)' }} />
              {b.name} <b>{b.pct}%</b> · ₹{b.total}
            </span>
          </div>
        </div>

        <div className="scr-warn">
          <span className="pip">!</span>
          <span>{SAMPLE.warning}</span>
        </div>

        <div className="scr-stats">
          <Stat k="Official units" v={SAMPLE.officialUnits} />
          <Stat k="Sub-meters" v={SAMPLE.meteredUnits} />
          <Stat k="Shared" v={SAMPLE.commonUnits} />
          <Stat k="Unaccounted" v={SAMPLE.residual} />
          <Stat k="Reading drift" v={SAMPLE.driftDays} flag />
          <Stat k="Bill total" v={`₹${SAMPLE.payable}`} hero />
        </div>

        <div className="scr-table-wrap">
          <table className="scr-table">
            <thead>
              <tr>
                <th>Charge</th>
                <th className="num c1">{a.name}</th>
                <th className="num c2">{b.name}</th>
                <th className="num">Bill</th>
              </tr>
              <tr className="sub">
                <th>Units</th>
                <th className="num c1">
                  {a.units} <span className="pct">· {a.pct}%</span>
                </th>
                <th className="num c2">
                  {b.units} <span className="pct">· {b.pct}%</span>
                </th>
                <th className="num">{SAMPLE.officialUnits}</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE.lines.map((l) => (
                <tr key={l.label} className={l.accountLevel ? 'acct' : undefined}>
                  <td>{l.label}</td>
                  <td className="num c1">{l.ground}</td>
                  <td className="num c2">{l.first}</td>
                  <td className="num">{l.bill}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Share payable</th>
                <th className="num c1">₹{a.total}</th>
                <th className="num c2">₹{b.total}</th>
                <th className="num">₹{SAMPLE.payable}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="scr-check">✓ Shares add up to ₹{SAMPLE.payable} — exactly the bill total, to the paisa.</p>

        <div className="scr-actions">
          <button className="btn">Copy summary for everyone</button>
          <button className="btn ghost">Copy message for Ground floor</button>
          <button className="btn ghost">Print / Save as PDF</button>
        </div>
      </div>
    </div>
  );
}

function FormFragment({ dir }: { dir: Direction }) {
  return (
    <div className="pane">
      <p className="pane-title">Entering a cycle</p>
      <div className="scr-form">
        <div className="fld">
          <label htmlFor={`${dir.id}-a`}>Billing month</label>
          <div className="box" id={`${dir.id}-a`}>
            July 2026
          </div>
        </div>
        <div className="fld">
          <label htmlFor={`${dir.id}-b`}>
            Official meter · previous <em>21 May</em>
          </label>
          <div className="box" id={`${dir.id}-b`}>
            1775
          </div>
        </div>
        <div className="fld">
          <label htmlFor={`${dir.id}-c`}>
            Official meter · present <em>21 Jul</em>
          </label>
          <div className="box focus" id={`${dir.id}-c`}>
            1936
          </div>
        </div>
        <div className="fld">
          <label htmlFor={`${dir.id}-d`}>
            Ground floor sub-meter <em>read 25 Jul</em>
          </label>
          <div className="box" id={`${dir.id}-d`}>
            78
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, hero, flag }: { k: string; v: string; hero?: boolean; flag?: boolean }) {
  return (
    <div className={`scr-stat${hero ? ' hero' : ''}${flag ? ' flag' : ''}`}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
