# Fairmeter — Brand & Design System

The style guide for this project. It is deliberately a **style guide with tokens**, not an
enterprise design system: one owner, one codebase, no Figma, no Storybook, no other
consumers. Sections that a multi-team system would need — component tokens, a token
pipeline, versioning and contribution policy, print colour spaces, a full 11-step colour
ramp — are consciously left out, and the omissions are recorded at the end so nobody
re-litigates them.

**Source of truth is the code.** `app/src/styles.css` holds the tokens; this file explains
them and states the rules the CSS cannot express. If the two disagree, the CSS is right and
this file is stale.

**Status:** §3 Colour, §4 Type and §2 Logo are **pending the direction pick** — see the
marked block in each. Everything else is decided and applies regardless.

---

## 1. Personality

Four adjectives, each with what it rules out. These are the tie-breakers when a design
decision has no obvious answer.

| It is | It is not |
|---|---|
| **Exact** — figures line up, totals reconcile, nothing is approximated in the interface any more than in the engine | not clinical; exactness should feel reassuring, not cold |
| **Plain-spoken** — says "unaccounted units", not "variance"; explains itself in the words a neighbour would use | not chatty, not jokey; nobody wants personality in a bill |
| **Unshowy** — the design's job is to make a number believable, so it stays out of the way | not bland; one signature element is allowed to be memorable |
| **Even-handed** — visibly fair to every household, with no party's numbers privileged | not neutral to the point of hiding problems; the residual and the drift are shown loudly |

The product is used to settle money between people who live in the same building and will
see each other tomorrow. Everything below serves one goal: **the person receiving the
number should be able to check it and believe it.**

**Audience.** One person operates the app — the household that holds the connection. The
other households never open it; they receive a WhatsApp message or a printed sheet. So the
output surfaces (§10) carry as much design weight as the app itself.

---

## 2. Logo & favicon

### 2.1 Construction

**Combination mark:** a symbol plus the wordmark "Fairmeter", set in the display face.

Two marks only:

| Mark | Composition | Used for |
|---|---|---|
| **Primary lockup** | symbol + wordmark, horizontal, symbol height = cap height × 1.6 | app header, print statement header, README |
| **Submark** | symbol alone | favicon, app icon, any square or ≤32px space |

No stacked variant, no tagline lockup, no monogram. If the primary doesn't fit, the submark
is the answer.

### 2.2 Colour variants

Two, not five: **full colour** and **single colour** (currentColor, for print and any
one-ink context). No greyscale variant, no CMYK, no Pantone — this never goes to a
commercial press.

### 2.3 Rules

- **Clear space:** the height of the symbol, on all four sides. Nothing intrudes.
- **Minimum size:** symbol 16px; full lockup 96px wide. Below that, use the submark.
- **Wordmark:** "Fairmeter" is one word, capital F, no camel case, no space. Never
  retype it in a different face — it is set in the display face at a defined weight, and
  that is the mark.
- **Don't:** stretch, rotate, recolour outside the two variants, add shadows, or place on a
  background that drops below 3:1 against the symbol.

### 2.4 Deliverables

`.svg` only, checked into `app/src/assets/`, plus an inline React component so the mark
inherits theme tokens. A single `favicon.svg` (browsers scale it); one 180px `.png` for
iOS home-screen. No `.ai`, `.eps` or `.pdf` masters.

> **⏳ Pending the direction pick.** Candidate symbols, all built on a 32×32 grid and all
> tested at 16px in `#design`:
>
> | Direction | Symbol |
> |---|---|
> | Instrument panel | rounded panel enclosing a two-segment ratio rail, with a pulse dot |
> | Columnar ledger | ruled page with two column lines and a red check mark across it |
> | Wiring code | cable cross-section — sheath circle containing three coloured cores |

---

## 3. Colour

### 3.1 Structure

One accent, one alert, one positive, and a short neutral scale. **Six neutrals, not ten** —
this UI has a page, a card, a sunk input, a border, muted text and primary text, and that is
all it has.

Active hues on any one screen: **two, at most three.** The household colours in the
breakdown table are the only place a third appears.

### 3.2 Semantic roles

Every one of these must be defined in both light and dark. Components reference these names
and never a primitive.

| Token | Role |
|---|---|
| `--surface` | page ground |
| `--surface-raised` | cards, the sheets the content sits on |
| `--surface-sunk` | inputs, read-only computed outputs, stat tiles |
| `--text` | primary text and figures |
| `--text-muted` | labels, units, hints, provenance notes |
| `--border` | dividers, table rules, input outlines |
| `--border-strong` | the totals rule under the table; anything that must read as a boundary |
| `--accent` | primary action, the live figure, the ratio rail's first segment |
| `--accent-ink` | text on `--accent` |
| `--alert` | warnings, negative residual, the failed-conservation line |
| `--alert-soft` | the fill behind an alert block |
| `--ok` | the conservation check when it passes |
| `--focus` | keyboard focus ring — may equal `--accent` but is named separately so it can be changed without touching buttons |
| `--seg-1..3` | household identity colours in the rail and table |

### 3.3 Distribution

Roughly 60 / 30 / 10 — neutral ground, raised surfaces, accent. **Accent stays near 10%.**
The moment every number is accent-coloured, none of them is emphasised.

### 3.4 Accessibility

Non-negotiable, and checked per pair in **both** themes:

- Body text and figures: **≥ 4.5:1** against their surface.
- Large text (≥ 19px or bold ≥ 15px) and the focus ring: **≥ 3:1**.
- `--text-muted` is the usual failure — it must clear 4.5:1, not merely look grey enough.
- Disabled controls may drop below, but must not be the only cue that something is disabled.
- **Colour is never the only signal.** The conservation line carries ✓ or ✗ *and* words. A
  warning carries an icon glyph *and* text. Household colours always sit beside the
  household's name.

### 3.5 Format

Hex only, in this file and in CSS. No RGB/HSL duplicates to keep in sync, no print colour
spaces.

> **⏳ Pending the direction pick.** Full light and dark sets for all three candidates are
> live in `#design`; the chosen one gets transcribed here as a table of role → light hex →
> dark hex, with the measured contrast ratio for every text-on-surface pair.

---

## 4. Typography

### 4.1 Roles

Three, and every one earns its place:

- **Display** — wordmark, page title, section headings. Carries the personality; used at
  four sizes at most.
- **Body** — prose, labels, hints, buttons. Optimised for 13–15px on a phone.
- **Figures (mono)** — every number in the product: money, units, percentages, dates,
  readings. Non-negotiable, because columns of money must align on the decimal point and
  a proportional face makes 1,116.00 and 744.00 look like different lengths of the same
  thing.

Each role needs a **fallback stack** ending in a system font, so the app is fully usable
before webfonts land or if they never do.

### 4.2 The ramp

Seven steps. If the size you want isn't here, the layout is wrong — don't add a step.

| Level | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | 30px | 700 | 1.10 | −0.02em | wordmark, page title |
| `title` | 22px | 700 | 1.20 | −0.015em | the split, major section titles |
| `section` | 18px | 600 | 1.25 | −0.01em | card headings |
| `eyebrow` | 12px | 600 | 1.30 | 0.12em, uppercase | sub-headings inside a card |
| `body` | 15px | 400 | 1.55 | 0 | prose, inputs, buttons |
| `small` | 13px | 400 | 1.50 | 0 | labels, table cells, hints |
| `micro` | 11px | 500 | 1.40 | 0.02em | provenance, unit suffixes, favicon captions |

**Responsive:** `display` drops to 24px and `title` to 19px below 600px. Nothing else
changes — the ramp is already small enough for a phone.

**Minimum body size is 15px.** Nothing that a household has to read to understand a charge
goes below 13px.

### 4.3 Numerals — the rule that matters most here

- `font-variant-numeric: tabular-nums` on **every** element containing a figure. Already the
  case for tables and stats; it must extend to inputs and inline amounts.
- Money: always two decimals, always Indian digit grouping — `₹1,860.00`, never `₹1,860`.
  Implemented once in `formatRupees()` (`engine/money.ts`, `en-IN`); nothing formats money
  by hand.
- Units: integer when whole, otherwise two decimals — `161`, `96.60`. `fmtUnits()` owns
  this.
- Percentages: one decimal, always — `60.0%`.
- Negatives use the minus sign `−` (U+2212), not a hyphen, so they align in a column.
- Drift and day counts carry an explicit sign: `+4 d`, `−2 d`.
- Dates: ISO (`2026-07-21`) in inputs; `21 Jul 2026` in prose and output. Never `dd/mm/yy` —
  that ambiguity is exactly what the storage migration exists to clean up.

> **⏳ Pending the direction pick.** Candidate pairings, all specimened in `#design`:
> Instrument → Archivo / Public Sans / JetBrains Mono · Ledger → Fraunces / Public Sans /
> Roboto Mono · Wiring → Bricolage Grotesque / Hanken Grotesk / DM Mono.

---

## 5. Iconography

**There is no icon set, and that is the decision.** This product asks people to trust
numbers; words are less ambiguous than glyphs and survive being pasted into a chat app.

The complete inventory of permitted marks:

- `✓` and `✗` in the conservation line
- `!` in a warning block
- `←` `→` for navigation between cycles
- the brand symbol

Anything else is a text label. If a genuine icon need appears later, take it from **Lucide**
at 24×24, 1.5px stroke, outline only, and record the addition here.

---

## 6. Layout, spacing & shape

### 6.1 Spacing scale

4px base. Every margin, padding and gap comes from this scale.

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` ·
`--space-5: 24px` · `--space-6: 32px` · `--space-7: 48px` · `--space-8: 64px`

### 6.2 Layout

Three full-bleed bands — the sticky top bar, the hero, the footer — each carrying its own
ground, with one shared measure inside them: `.page`, `max-width: 1180px`, centred, and
the only thing that sets horizontal padding.

Between the hero and the footer sits the working area. On desktop it is two columns:
the form, and beside it the answer panel, stuck to the top of the viewport so a reading
typed in is seen landing on somebody's share. Below the two columns, at full width because
they are wide tables: the breakdown and the history.

Inside a card, fields still flow in `repeat(auto-fit, minmax(200px, 1fr))`, which is what
makes the form collapse cleanly on a phone without breakpoint work.

### 6.3 Breakpoints

Three. `600px` (phone → tablet), `900px` (the hero goes two-column) and `1024px`
(→ desktop). Below 600px the layout is one column and `.field.wide` stops spanning.
Below 1024px the answer panel cannot sit beside the form, so it follows it and a fixed
bottom bar carries the total until you reach it.

### 6.4 Radius & elevation

`--radius-sm` (inputs, small controls) · `--radius-md` (cards, tiles) · `--radius-pill`
(999px, used only if the direction calls for it).

Two shadows, no more: `--shadow-raised` for cards that need to lift off the page, and
`--shadow-overlay` for the two things that float over it — the hero's specimen card and
the fixed bottom bar on a phone.

**There is still no z-index scale**, and two literals rather than a scale is deliberate:
the sticky top bar is `20`, the bottom bar is `30`, and there is nothing else. The app has
no modals, dropdowns or toasts. If a third stacking thing appears, add the scale then.

> **⏳ Radius values are direction-dependent:** Instrument 4px, Ledger 2px, Wiring 14px.

---

## 7. Tokens

### 7.1 Two layers, not three

1. **Primitive** — raw values, named for what they are: `--slate-900`, `--space-4`.
2. **Semantic** — named for their job, referencing primitives: `--surface`, `--text-muted`.

**No component layer.** With ten components in one stylesheet, `--button-bg-primary:
var(--accent)` is indirection with no payoff.

### 7.2 Rules

- Components reference **semantic tokens only**. A raw hex or a primitive name appearing
  outside the token block at the top of `styles.css` is a bug.
- Theming is a **redefinition of semantic tokens only**. Primitives never change between
  light and dark; the mapping does.
- Both themes are defined explicitly. Dark mode is a `prefers-color-scheme` block today; if
  a manual toggle is added, it must set an attribute on the root and both mechanisms must
  agree.
- Naming: `--{role}` for semantics, `--{family}-{step}` for colour primitives, `--{group}-{n}`
  for scales. Lower-case, hyphenated, no prefix — one small stylesheet with no third-party
  CSS to collide with.

---

## 8. Components

The complete inventory. Each is a CSS class in `styles.css`; **states are the part worth
writing down**, because that is where the bugs are.

| Component | Variants | States that must be styled |
|---|---|---|
| Button | primary, ghost, danger | default, hover, **focus-visible**, active, disabled |
| Text / number input | default, wide | default, focus, invalid, disabled, placeholder |
| Select | — | default, focus, disabled |
| Checkbox / radio | — | unchecked, checked, focus, disabled; label is part of the hit area |
| Field | label + control + hint | normal, error (message below, not a tooltip) |
| Computed output | read-only | default only — must be visibly *not* an input |
| Card / section | default, issues | default |
| Household row | metered, unmetered | default, being removed |
| Stat tile | default, strong, warn | default |
| Breakdown table | — | header, sub-header, account-level row, totals row, horizontal scroll |
| Ratio rail *(signature)* | — | default; degrades to the table alone if a household has zero units |
| Warning list | — | default |
| Conservation line | ok, bad | default |
| Provenance note | verified, indicative | default |
| History list | — | default, **empty** |

**Empty states are components too.** History with nothing saved says what to do next, not
"No cycles." Same for a result that can't be computed yet — the "Before this can be
calculated" card is the empty state of the result, and it lists what's missing.

**Loading states are not needed.** Everything is synchronous and local; there is nothing to
wait for. Don't add spinners.

---

## 9. Motion

Almost none, deliberately.

- One duration: `--dur: 160ms`. One easing: `--ease: cubic-bezier(0.2, 0, 0, 1)`.
- Permitted: focus ring, button hover, the ratio rail growing on first render, smooth scroll
  when a cycle is loaded from history.
- Not permitted: entrance animations on content, number count-ups (a figure that animates
  toward its value undermines the one thing this product sells), scroll-triggered reveals.
- `prefers-reduced-motion: reduce` disables all of the above, including the smooth scroll.

---

## 10. Voice, and the two surfaces that aren't the screen

### 10.1 Terminology — enforced

| Use | Never |
|---|---|
| household | tenant, occupant, party, unit |
| sub-meter | private meter, secondary meter |
| common meter / shared load | society meter, general meter |
| unaccounted units | residual *(fine in code and docs, not in the UI)*, loss, difference |
| official meter | main meter, utility meter, DISCOM meter |
| cycle | period, month *(a cycle is often two months)* |
| share | portion, split amount |
| provider / plan | vendor, package, scheme |

"Tenant" is banned in the model and the interface: a property may be occupied entirely by
renters with an absent owner (D-08). It may appear in historical documents only.

### 10.2 Writing rules

- **Sentence case everywhere.** Buttons, headings, labels, table headers.
- **Buttons say what happens:** "Save this cycle", "Copy message for Ground floor",
  "Print / Save as PDF". Never "Submit", "OK", "Go".
- **Vocabulary is stable through a flow.** The button that says "Save this cycle" produces
  "Saved ✓", and the thing it saved is called a cycle everywhere afterwards.
- **Errors say what happened and what to do.** "Present reading is below the previous one —
  check the sub-meter." Not "Invalid input." No apologies, no "Oops".
- **Warnings explain the consequence.** "Sub-meters were read 4 days after the official
  meter. Readings have been interpolated to the bill's window." — the fact, then what was
  done about it.
- **Never claim more precision than exists.** A rate that didn't come from a tariff order is
  labelled indicative, in the UI, in those words.

### 10.3 The WhatsApp message

This is a first-class product surface with no visual design at all — only words, in someone
else's app, on someone else's phone.

- **Plain text only.** No markdown tables; `*bold*` is the only formatting WhatsApp renders
  reliably.
- **Under ~15 lines**, so it doesn't get collapsed behind "Read more".
- **Self-contained.** It must make sense to someone who has never seen Fairmeter: the
  household's units, what's included in them, each charge, the total, and the bill total for
  context.
- **The claim travels with it.** The message states the household's share of the total, so
  the recipient can sanity-check the proportion without the app.
- Implemented in `app/src/export/text.ts` — that file is the single owner of this surface.

### 10.4 The printed statement

- **Print is always light**, whatever the screen theme. A dark direction inverts entirely at
  `@media print`; it never prints its screen colours.
- Interactive chrome is removed (`.print-hide`), the container goes full-bleed, tables stop
  scrolling horizontally and wrap instead, cards lose borders and padding.
- Cards do not break across pages (`break-inside: avoid`).
- The sheet must be **legible in one ink** — nothing may depend on colour, because it will
  be photocopied. Household identity colours degrade to labels.
- It carries: the lockup, the provider and cycle, the full breakdown table, and the
  conservation line. Someone should be able to hand it over and defend it without the app
  open.

---

## 11. Accessibility floor

Six rules. Not a WCAG conformance claim — a floor that is actually held.

1. Contrast per §3.4, verified in both themes.
2. **Visible focus on every interactive element**, never `outline: none` without a
   replacement that clears 3:1.
3. **Fully keyboard operable.** Nothing is mouse-only. Tab order follows the document.
4. **Touch targets ≥ 44×44px** including padding — the app is used one-handed on a phone.
5. `prefers-reduced-motion` respected (§9).
6. **Semantic HTML.** Real `<table>` for the breakdown with proper `<th>` scope, real
   `<label>` tied to every control, headings in order, `aria-live` on the copy confirmation.
   Meaning never lives in colour alone.

---

## 12. Ownership

One owner. Code is canonical. **Decisions go in `DECISIONS.md`** — it already serves as the
changelog and is where a rationale belongs; this file records the *result*, not the debate.
No versioning scheme, no contribution process, no docs site.

The design lab — candidate directions rendered with the reference bill's real figures —
did its job: direction **2a, "Warm ledger"** was chosen and is what `app/src/styles.css`
now implements. The lab itself has been retired to `discard/design-lab/` (D-16). It was
never meant to ship, and while it did it was reachable in production from a footer link
and the `#design` hash, carrying about a third of the CSS bundle with it.

---

## Deliberately omitted

So these don't get proposed again as gaps:

- Mission, vision, positioning statement, competitive scan — §1's four adjectives do the
  work those were for.
- Secondary/stacked logo, monogram, greyscale variant, `.eps`/`.ai`/`.pdf` masters, CMYK and
  Pantone specs, co-branding rules.
- 9–11 step colour ramps; RGB/HSL duplicates of every hex.
- An icon library (§5 states why).
- Photography, illustration, and image treatment standards — there are no images.
- A 12-column grid; a z-index scale.
- Component tokens; Style Dictionary, Tokens Studio, Figma Variables.
- Storybook, a component sandbox, per-component documentation pages.
- Semantic versioning, changelog automation, PR checklists, contribution guidelines, review
  cadence.
- Loading and skeleton states — nothing in this app is asynchronous.

---

## Open before this file is complete

1. **Pick a direction** in `#design`. That resolves §2 (symbol), §3 (all hexes), §4 (all
   three faces) and the radius values in §6.4.
2. Transcribe the chosen palette here with **measured** contrast ratios, not assumed ones.
3. Rebuild `app/src/styles.css` on the token structure in §7, and rename the app's `<h1>`
   and `index.html` `<title>` to Fairmeter.
