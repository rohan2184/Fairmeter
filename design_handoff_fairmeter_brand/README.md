# Handoff: Fairmeter brand system — direction 2a "Warm ledger"

## Overview

Fairmeter splits one official electricity bill between the households sharing a connection
and proves the shares add back to the bill exactly. The brand direction is now **settled**:
2a, "Warm ledger" — a cream ledger sheet in warm olive-black ink, one clay accent, square
corners, a ledger serif for display type.

This bundle closes the three blocks that were pending in `BRAND.md` (§2 symbol, §3 colour,
§4 typography, plus §6.4 radius/shadow) and shows them applied to the real reference bill.
The work to do is: rebuild `app/src/styles.css` on this token structure, draw the mark,
swap the three faces in.

## About the design files

`Fairmeter Brand Book.dc.html` is a **design reference created in HTML** — a specimen sheet
showing intended colour, type and shape, not production code to copy. Open it in a browser
(it needs the sibling `support.js`; no build step, no network beyond Google Fonts).

The task is **not** to port that file. It is to implement the tokens and rules it documents
in the Fairmeter app's own environment — a single `app/src/styles.css` in the existing
React/TS codebase, per §7 of `BRAND.md`. The specimen sheet uses inline styles because of
how it was authored; **the app must not.** Components reference semantic CSS custom
properties only.

## Fidelity

**High fidelity.** Every colour is a final measured hex, every type step is final, radius
and shadow are final. Recreate exactly. The one thing deliberately left as prose rather
than pixels: the app's screen layouts, which already exist and are not being redesigned
here — this is a re-skin onto a settled token set.

## Source of truth

`BRAND.md` (in this bundle) is canonical for every value below and contains the full
rationale, the voice/terminology rules (§10), and the accessibility floor (§11). Where this
README and `BRAND.md` differ, `BRAND.md` wins. Once implemented, **the CSS becomes canonical**
and `BRAND.md` documents it.

---

## Design tokens

### Two layers, no component layer

1. **Primitive** — raw values, named for what they are. Only legal inside the token block at
   the top of `styles.css`.
2. **Semantic** — named for their job, referencing primitives. Everything else uses only
   these.

A raw hex or a primitive name appearing anywhere outside that token block is a bug.
Theming is a redefinition of **semantic tokens only** — primitives never change between
light and dark, the mapping does.

### Primitives

```css
--cream-050: #fdfbf6;  /* paper white, warm      */
--cream-100: #f2ece1;  /* the ledger sheet       */
--cream-200: #ebe3d2;  /* sunk cream             */
--sand-300:  #d6cdba;  /* hairline               */
--sand-400:  #c3b48f;  /* ruled line             */
--ink-600:   #635e50;  /* warm grey ink          */
--ink-900:   #23281f;  /* the ink — olive-black, never #000 */
--clay-500:  #b6602f;  /* accent hue, full brightness — DECORATIVE FILL ONLY */
--clay-600:  #a8551f;  /* the accent, text- and fill-safe */
--clay-700:  #8e461a;  /* accent pressed         */
--olive-500: #6b7a4a;  /* second household / positive fill */
--olive-700: #5b6a3c;  /* positive as text       */
--slate-600: #3f6470;  /* third household        */
--red-600:   #b23a2b;  /* alert                  */
--red-050:   #f8e6e1;  /* alert fill             */

/* dark-theme primitives */
--ink-950:   #191b16;
--ink-850:   #23261e;
--ink-975:   #131510;
--sand-050:  #f0ece1;
--sand-200:  #a8a291;
--ink-700:   #3a3d33;
--ink-500:   #5c604f;
--clay-300:  #d98a4e;
--olive-300: #a3b573;
--slate-300: #7fb0bd;
--red-400:   #e8735c;
--red-950:   #3a221d;
```

### Semantic map — light (the default)

Ratios are measured, not assumed, each against the surface the token is actually used on.

| Token | Value | Measured |
|---|---|---|
| `--surface` | `#f2ece1` | page ground |
| `--surface-raised` | `#fdfbf6` | cards |
| `--surface-sunk` | `#ebe3d2` | inputs, computed outputs, stat tiles |
| `--text` | `#23281f` | 14.5:1 on raised · 12.8:1 on surface · 11.7:1 on sunk |
| `--text-muted` | `#635e50` | 6.3 / 5.5 / 5.1:1 — clears 4.5 on **all three** surfaces |
| `--border` | `#d6cdba` | non-text |
| `--border-strong` | `#c3b48f` | non-text — totals rule, real boundaries |
| `--accent` | `#a8551f` | 5.1:1 on raised · 4.5:1 on surface |
| `--accent-ink` | `#fdfbf6` | 5.1:1 on accent |
| `--accent-hover` | `#8e461a` | 6.9:1 on raised |
| `--alert` | `#b23a2b` | 5.8:1 on raised · 4.9:1 on alert-soft |
| `--alert-soft` | `#f8e6e1` | fill behind an alert block |
| `--ok` | `#5b6a3c` | 5.7:1 on raised |
| `--focus` | `#a8551f` | 4.5:1 on surface (floor 3:1) — named separately from accent on purpose |
| `--seg-1` | `#a8551f` | white label on it 5.3:1 |
| `--seg-2` | `#6b7a4a` | white label on it 4.7:1 |
| `--seg-3` | `#3f6470` | white label on it 6.4:1 |

**Trap to avoid:** `#b6602f` (`--clay-500`) appears in the original direction swatch strip
but is only 4.3:1 on raised. It is **not permitted for text** — decorative fills and hover
washes only. `--accent` is `#a8551f`, which clears 4.5:1 both as ink on cream and as ground
under cream. One accent usable in both directions beats two that each work one way.

### Semantic map — dark

Same role names, remapped primitives, defined explicitly (not derived).

| Token | Value | Measured |
|---|---|---|
| `--surface` | `#191b16` | — |
| `--surface-raised` | `#23261e` | — |
| `--surface-sunk` | `#131510` | — |
| `--text` | `#f0ece1` | 13.0:1 on raised · 14.7:1 on surface |
| `--text-muted` | `#a8a291` | 6.0 / 6.8:1 |
| `--border` | `#3a3d33` | non-text |
| `--border-strong` | `#5c604f` | non-text |
| `--accent` | `#d98a4e` | 5.6:1 on raised |
| `--accent-ink` | `#1a1610` | 6.5:1 on accent |
| `--alert` | `#e8735c` | 5.2:1 on raised |
| `--alert-soft` | `#3a221d` | — |
| `--ok` | `#a3b573` | 6.9:1 on raised |
| `--focus` | `#d98a4e` | 6.4:1 on surface |
| `--seg-1..3` | `#d98a4e` `#a3b573` `#7fb0bd` | dark ink label on each, ≥ 6.0:1 |

Dark mode is a `prefers-color-scheme: dark` block today. If a manual toggle is added it must
set an attribute on the root and **both mechanisms must agree**. Household hues keep their
identity across themes: clay, olive, slate, in that order — a household that is clay on
screen is clay in every cycle and in one ink is labelled by name with no colour dependency.

### Distribution

Roughly 60 / 30 / 10 — neutral ground, raised surfaces, accent. Accent stays near 10%.
Two active hues per screen, at most three (the breakdown table's household colours are the
only place a third appears).

### Typography

| Role | Face | Weights | Fallback stack |
|---|---|---|---|
| Display | **Fraunces** (opsz 9–144) | 600 only | `"Fraunces", "Iowan Old Style", Georgia, "Times New Roman", serif` |
| Body | **Instrument Sans** | 400, 500, 600 | `"Instrument Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif` |
| Figures | **DM Mono** | 400, 500 | `"DM Mono", ui-monospace, "SF Mono", "Roboto Mono", Consolas, monospace` |

**Five font files, latin subset, `display: swap`, no italics** — nothing in this product is
emphasised by slant. Fraunces was confirmed over Bricolage Grotesque: it contrasts with the
neutral body face and makes the printed statement read as a document, where a second
grotesque would compete with Instrument Sans and lose its personality at 18–22px.

The ramp — seven steps. If the size you want isn't here, the layout is wrong; don't add one.

| Level | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | 30px | 700 | 1.10 | −0.02em | wordmark, page title |
| `title` | 22px | 700 | 1.20 | −0.015em | the split, major section titles |
| `section` | 18px | 600 | 1.25 | −0.01em | card headings |
| `eyebrow` | 12px | 600 | 1.30 | 0.12em, uppercase | sub-headings in a card |
| `body` | 15px | 400 | 1.55 | 0 | prose, inputs, buttons |
| `small` | 13px | 400 | 1.50 | 0 | labels, table cells, hints |
| `micro` | 11px | 500 | 1.40 | 0.02em | provenance, unit suffixes |

Responsive: `display` → 24px and `title` → 19px below 600px. Nothing else changes.
Minimum body size 15px; nothing a household must read to understand a charge goes below 13px.

**Numerals — the rule that matters most.** `font-variant-numeric: tabular-nums` on *every*
element containing a figure, inputs and inline amounts included. Money: two decimals,
`en-IN` grouping, always — `₹1,860.00`, never `₹1,860`; owned by `formatRupees()` in
`engine/money.ts` and formatted nowhere else. Units: integer when whole else two decimals
(`fmtUnits()`). Percentages: one decimal, always. Negatives use U+2212 `−`, not a hyphen, so
columns align. Drift and day counts carry an explicit sign (`+4 d`, `−2 d`). Dates: ISO in
inputs, `21 Jul 2026` in prose and output, never `dd/mm/yy`.

### Spacing, layout, shape

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

--radius-sm: 2px;   /* inputs, buttons, small controls */
--radius-md: 2px;   /* cards, tiles */
/* --radius-pill: unused — the direction is a ruled sheet, and a ruled sheet has corners */

--shadow-raised:  0 1px 2px rgba(35, 40, 31, 0.06);
--shadow-overlay: 0 8px 24px rgba(35, 40, 31, 0.14);  /* defined, currently unused */

--dur: 160ms;
--ease: cubic-bezier(0.2, 0, 0, 1);
```

2px rather than 0 only so a 1px border doesn't look chipped at the join. The ratio rail and
the breakdown table are square, full stop. Cards separate by their border and paper tone,
not by a lift. There is **no z-index scale** — the app has no modals, dropdowns or toasts.

Layout: single column, `max-width: 1040px`, centred, no grid system. Inside a card, fields
flow `repeat(auto-fit, minmax(200px, 1fr))`, which is what collapses the form cleanly on a
phone without breakpoint work. Two breakpoints only: `600px` and `1024px`; below 600px one
column and `.field.wide` stops spanning.

---

## The mark — build this

**"Totals rule."** Two unequal blocks standing on one heavy rule that spans exactly their
combined width. Three rectangles, no curves, on a 32×32 grid:

| Part | Geometry | Fill |
|---|---|---|
| Left block (larger share) | x 4, y 6, w 12, h 16 | `--accent` `#a8551f` |
| Right block (smaller share) | x 18, y 12, w 10, h 10 | `--seg-2` `#6b7a4a` |
| Totals rule | x 4, y 25, w 24, h 3 | `--text` `#23281f` |

Block gap 2px; rule weight 3px; gap between blocks and rule 3px. The 6px height step between
the blocks is **fixed** and must not be redrawn to track a real split — the mark is not a
chart.

Why it is this: the product's claim drawn literally — two unequal parts, one rule, and the
rule is neither longer nor shorter than the parts it carries. It is also the same shape as
the ratio rail and the totals rule under the breakdown table.

Deliverables, `.svg` only, in `app/src/assets/`:

- `symbol.svg` — the three rectangles above.
- `lockup.svg` — symbol at cap-height × 1.6 (25px symbol against the 30px `display` step)
  + "Fairmeter" in Fraunces 600, −0.02em, gap = half the symbol width.
- `favicon.svg` — the symbol; browsers scale it. Plus one 180px `.png` for iOS home screen.
- An **inline React component** for the symbol so the mark inherits `--accent`, `--seg-2`
  and `--text` from theme tokens rather than hard-coding fills. This is what makes the dark
  variant and the one-ink print variant free.

Two marks only — primary lockup and submark. No stacked variant, no tagline lockup, no
monogram; if the primary doesn't fit, the submark is the answer. Two colour variants only —
full colour and single colour (`currentColor`). Clear space = the height of the symbol on
all four sides. Minimum size: symbol 16px, full lockup 96px wide. In one ink the blocks
separate by the gap and the height step, not by colour — which is what the photocopied
statement needs.

---

## Components — states are the part that matters

The complete inventory, each a CSS class in `styles.css`. Every state listed must be styled:

| Component | Variants | States |
|---|---|---|
| Button | primary, ghost, danger | default, hover, **focus-visible**, active, disabled |
| Text / number input | default, wide | default, focus, invalid, disabled, placeholder |
| Select | — | default, focus, disabled |
| Checkbox / radio | — | unchecked, checked, focus, disabled; **label is part of the hit area** |
| Field | label + control + hint | normal, error (message below, never a tooltip) |
| Computed output | read-only | default — must be visibly *not* an input |
| Card / section | default, issues | default |
| Household row | metered, unmetered | default, being removed |
| Stat tile | default, strong, warn | default |
| Breakdown table | — | header, sub-header, account row, totals row, horizontal scroll |
| Ratio rail *(signature)* | — | default; degrades to the table alone if a household has zero units |
| Warning list | — | default |
| Conservation line | ok, bad | default |
| Provenance note | verified, indicative | default |
| History list | — | default, **empty** |

**Empty states are components.** History with nothing saved says what to do next, not "No
cycles." The "Before this can be calculated" card is the empty state of the result and lists
what's missing.

**Loading states are not needed and must not be added.** Everything is synchronous and
local. No spinners, no skeletons.

Reference implementations to match, all visible in the specimen sheet:

- **Primary button** — `--accent` ground, `--accent-ink` label, `body` 15px/500,
  `--radius-sm`, 12px 18px padding, `min-height: 44px`, hover `--accent-hover`,
  focus `outline: 2px solid var(--focus); outline-offset: 2px`.
- **Ghost button** — transparent, `1px solid var(--border-strong)`, `--text` label,
  hover fills `--surface-sunk`.
- **Input / computed output** — `--surface-sunk` ground, `1px solid var(--border-strong)`,
  DM Mono 15px tabular. The computed output shares the fill but has no focus state and no
  caret; make the difference visible.
- **Warning block** — `--alert-soft` ground, `3px solid var(--alert)` left edge, `!` glyph
  in DM Mono + the words. Never colour alone.
- **Ratio rail** — flex row, 34px tall, `3px` gaps, one segment per household filled
  `--seg-N` with an `--accent-ink` DM Mono 12px label carrying name, percentage and amount.
  Square corners. Grows on first render (the one permitted content animation).
- **Breakdown table** — real `<table>` with `<th scope>`. Header row rules off with
  `1px solid var(--text)`; zebra rows fill `--surface`; column separators
  `1px solid var(--border-strong)`; the totals row rules off with `2px solid var(--text)`
  and its label is `title`-weight Fraunces. Charge labels are plain-language with the
  formula beneath in `micro` `--text-muted` ("Keeping the connection / ₹70/kW × 2 months").
- **Conservation line** — `--ok` text, `✓` glyph *and* the sentence: "The two shares add up
  to ₹1,860.00 — exactly the bill total." Failing variant uses `--alert` and `✗`.

## Iconography

**There is no icon set, and that is the decision.** The complete permitted inventory: `✓`
`✗` in the conservation line, `!` in a warning, `←` `→` for cycle navigation, and the brand
symbol. Everything else is a text label. If a genuine icon need appears, take it from Lucide
at 24×24, 1.5px stroke, outline only, and record the addition in `BRAND.md`.

## Motion

One duration (`--dur: 160ms`), one easing (`--ease`). Permitted: focus ring, button hover,
the ratio rail growing on first render, smooth scroll when a cycle loads from history.
**Not permitted:** entrance animations on content, scroll reveals, and above all **number
count-ups** — a figure that animates toward its value undermines the one thing this product
sells. `prefers-reduced-motion: reduce` disables all of the above including the smooth scroll.

## Accessibility floor — held, not aspirational

1. Contrast per the tables above, verified in both themes.
2. Visible focus on every interactive element. Never `outline: none` without a replacement
   clearing 3:1.
3. Fully keyboard operable; tab order follows the document.
4. Touch targets ≥ 44×44px including padding — used one-handed on a phone.
5. `prefers-reduced-motion` respected.
6. Semantic HTML: real `<table>` with `<th scope>`, real `<label>` per control, headings in
   order, `aria-live` on the copy confirmation. **Colour is never the only signal.**

## Voice — enforce in the UI strings you touch

Sentence case everywhere. Buttons say what happens ("Save this cycle", "Copy message for
Ground floor", "Print / Save as PDF") — never "Submit", "OK", "Go". Vocabulary stays stable
through a flow: the button that says "Save this cycle" produces "Saved ✓". Errors state what
happened and what to do ("Present reading is below the previous one — check the sub-meter."),
no apologies, no "Oops". Warnings give the fact then what was done about it.

Terminology is enforced — **household** never tenant/occupant/party; **sub-meter** never
private/secondary meter; **common meter / shared load** never society/general meter;
**unaccounted units** never variance/loss/difference (residual is fine in code, not in the
UI); **official meter** never main/utility/DISCOM meter; **cycle** never period/month;
**share** never portion/split amount; **provider / plan** never vendor/package/scheme.
"Tenant" is banned from the model and the interface.

## The two surfaces that aren't the screen

**WhatsApp message** (`app/src/export/text.ts` owns it, and nothing else writes it): plain
text only, `*bold*` is the sole formatting, under ~15 lines so it isn't collapsed behind
"Read more", self-contained enough for someone who has never seen Fairmeter, and it states
the household's share of the total so the recipient can check the proportion without the app.

**Printed statement:** print is **always light**, whatever the screen theme — a dark session
must invert entirely at `@media print` and never print its screen colours. Interactive chrome
removed (`.print-hide`), container full-bleed, tables wrap instead of scrolling, cards lose
borders and padding, `break-inside: avoid`. It must be legible in one ink because it will be
photocopied: household colours degrade to labels. It carries the lockup, provider and cycle,
the full breakdown table, and the conservation line.

---

## Work to do, in order

1. Rebuild `app/src/styles.css` on the two-layer token structure — primitives block, light
   semantic map, `prefers-color-scheme: dark` remap, then component classes referencing
   semantic names only.
2. Draw `symbol.svg`, `lockup.svg`, `favicon.svg` from the geometry table + the inline React
   component so the mark inherits tokens.
3. Swap the three faces in, drop the old font links, confirm no table reflows on swap
   (the fallback stacks are metric-checked for this).
4. Rename the app's `<h1>` and `index.html` `<title>` to Fairmeter.
5. Re-measure in the browser the two ratios sitting exactly on 4.5:1 — `--accent` on
   `--surface`, and `--seg-2` under a white label — since anti-aliasing at 11px is where a
   nominal pass stops being a real one. If either fails in situ, darken the primitive, not
   the rule.

Out of scope, deliberately, and recorded in `BRAND.md` under "Deliberately omitted" so it
doesn't get proposed as a gap: component tokens, a token pipeline, Storybook, versioning,
an icon library, a 12-column grid, a z-index scale, loading/skeleton states, CMYK/Pantone,
9–11 step colour ramps.

## Files in this bundle

- `README.md` — this document; self-sufficient for implementation.
- `BRAND.md` — the full brand & design system, canonical for every value here, plus the
  rationale, the rejected symbol directions, and the omissions list.
- `Fairmeter Brand Book.dc.html` — the specimen sheet: mark at 16/32/dark/one-ink, both
  colour maps with ratios, type specimens at real sizes, control states, and the breakdown
  card built with the reference bill's actual figures (₹1,860.00 across 161 units,
  60.0% / 40.0%). Design reference — do not port its inline styles.
- `support.js` — runtime the specimen sheet needs to open in a browser. Not part of the app.
