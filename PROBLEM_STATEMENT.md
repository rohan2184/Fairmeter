# Fairmeter — Problem Statement

**Fairmeter** splits one official electricity bill between the households sharing the
connection, using readings from private sub-meters, and proves that the shares add back to
the bill exactly — to the paisa.

> One bill, split to the paisa.

The name is the promise and the method in one word: the split is derived from what the
meters actually measured, and it is fair because every household is charged by the same
rule, with the parts of the bill nobody metered made visible rather than buried.

*(This document defines the problem and the shape of the solution. The domain model and
calculation contract live in [`SPEC.md`](./SPEC.md); every policy choice and its reasoning
lives in [`DECISIONS.md`](./DECISIONS.md).)*

---

## 1. Context

A single residential or commercial property has **one official utility connection** (in the
reference case, Torrent Power, Ahmedabad) with **one official meter**. The property is
occupied by several **households**, each with its own separate living or working area.

A household is the unit of the model — never "tenant". The property may be occupied
entirely by renters with an absent owner, or by the owner plus renters, or by family
sharing a building. Who holds the deed does not change the arithmetic. What matters is that
a household is a party that owes money (D-08).

To track consumption, **private sub-meters** are installed — typically one per household.
These sub-meters are unofficial: the utility does not read them, does not bill against
them, and they carry no tariff of their own. They produce a raw
`present reading − previous reading = units consumed` number and nothing else.

The utility bills **only against the official meter**. That single bill therefore bundles
every household's consumption together, wrapped in a layered charge structure — slab-based
energy rates, fixed charges, fuel-price surcharge, government duty, arrears, penalties,
rounding.

Someone has to turn that one number into several. Today that someone does it by hand.

## 2. The problem

Every billing cycle, whoever holds the connection must work out how much of the official
bill each household owes. This is done manually — usually as a rough "units × some rate"
guess — and it is consistently wrong, because:

1. **Naïve unit-rate division is inaccurate.** Dividing the bill total by total units and
   multiplying by a household's units ignores that different components scale differently.
2. **Slab tariffs are non-linear.** For slab-based tariffs (e.g. RGP: 0–50 @ ₹3.20,
   51–200 @ ₹3.95, remaining @ ₹5.00), one household's *marginal* units are not worth the
   same as another's *first* units. There is no single "price per unit" to apply.
3. **Fixed charges are not consumption-linked.** ₹70/kW/month is payable regardless of
   usage. Whether a household pays a share, and on what basis (equal split vs. pro-rata by
   units), is a policy decision the manual method never makes consistently.
4. **Surcharges are percentage-based and compounding.** FPPAS is charged as a % of
   (energy + fixed + base FPPAS); government duty is then charged as a % of *that*
   subtotal. Any per-household figure must be grown through the same multiplicative chain,
   not added flat.
5. **Non-consumption line items pollute the total.** Previous dues, delayed payment
   charges, other debits/credits, and the "rounded down, carried forward" adjustment belong
   to the *account*, not to any household's meter — but they sit inside the amount actually
   payable.
6. **Sub-meters never sum to the official meter.** Common-area load (lights, pump,
   staircase), meter tolerance, and reading-date mismatch mean
   `official units ≠ Σ sub-meter units`. This residual must be attributed somewhere,
   deliberately.
7. **Billing periods are irregular.** The reference bill covers a 60-day cycle, so fixed
   charges are ×2 months. And the sub-meters are read on a different day from the official
   meter, with the gap moving from cycle to cycle.
8. **No record is kept.** Each cycle restarts from zero. Previous readings are re-typed
   from memory or a paper slip, disputes cannot be settled with history, and arithmetic
   errors go undetected because nothing is ever reconciled.

The result is friction: sometimes the collector under-charges and silently absorbs the
difference; sometimes over-charges and a household disputes it. Neither side can verify the
number.

Measured on the owner's own spreadsheet — seven cycles of real history — the two structural
errors (splitting the fixed charge equally, and charging the motor to one floor) came to
₹163.26 mischarged to a single household. That is the size of the problem in one building.

## 3. Reference bill anatomy

From the sample bill (`100113210.pdf`, Torrent Power, July 2026, Non-RGP Commercial, single
phase, 1.000 kW sanctioned load, 60-day billing mode):

| # | Component | Basis | Amount (₹) |
|---|-----------|-------|-----------:|
| A | Energy charges | 161 units × ₹4.60/unit | 740.60 |
| B | Fixed charges | ₹70/kW/month × 1 kW × 2 months | 140.00 |
| C | Base FPPAS | 161 units × ₹3.72/unit | 598.92 |
| D | FPPAS charges | 3.40% × (A+B+C) = 3.40% × 1,479.52 | 50.30 |
| E | **Total energy charges without govt duty** | A+B+C+D | **1,529.82** |
| F | Government duty | 20% × E (Commercial slab) | 305.96 |
| G | **Bill amount including govt duty** | E+F | **1,835.78** |
| H | Previous dues | account-level | 0.23 |
| I | Delayed payment charges | account-level | 30.28 |
| J | **Amount due** | G+H+I | **1,866.29** |
| K | **Payable (rounded down)** | balance carried to next bill | **1,860.00** |

Meter: present 1936 − previous 1775 = 161 units, multiplier ×1.00.

Government duty varies by category: Residential 15%, Commercial 20%, Industrial 10%,
Religious 15%, Hostel 11.25%.

Key structural insight: **A, B, C are the base; D and F are multipliers applied on top;
H, I, K are account-level and consumption-independent.** A correct split must allocate
A, B, C per household, then apply the same D and F percentages to each household's
subtotal — which is mathematically equivalent to allocating E and G in proportion to each
household's share of the base, and guarantees the parts sum back to the whole.

---

## 4. What Fairmeter does

Fairmeter is a browser application. It has no account, no server, and nothing to install.
Once per billing cycle the person holding the connection does this:

**1. Picks the utility and tariff plan.** Torrent Power (Ahmedabad & Gandhinagar), the four
GUVNL discoms (UGVCL, MGVCL, PGVCL, DGVCL), MSEDCL Maharashtra, BSES Delhi, or a custom
utility. Choosing a plan generates the form: the fields that appear, their labels, their
pre-filled rates and their units all come from the plan's charge list. Every pre-filled
figure carries its provenance — a plan whose rates did not come from a regulator's tariff
order is labelled **indicative** on screen, so nobody mistakes a plausible default for a
verified one.

**2. Enters the official bill.** Meter previous and present readings, multiplier, billing
days and months, sanctioned load, and each rate off the printed bill. Then any account-level
items — previous dues, delayed payment charges, other debits or credits, and the rounding
adjustment. The app recomputes the bill from those inputs and shows the total, so a typo in
a rate is visible immediately as a total that does not match the paper bill.

**3. Enters the households.** Each household is either **metered** (has a sub-meter, so it
gets previous and present readings) or **unmetered** (no sub-meter — it absorbs whatever the
sub-meters did not account for). Any number of households; at most one unmetered.

**4. Enters shared meters, if any.** A pump, lift, borewell or porch light on its own
sub-meter is **not a household** — it is measured shared load. Its units are real and
metered, but nobody owes them individually, so they are redistributed across the households
by an explicit policy (D-09).

**5. Enters reading dates, if known.** The date the utility read the official meter, and the
date the sub-meters were read. These are optional; supplying them switches on window
alignment (§5.2) and is the difference between a split that drifts and one that does not.

**6. Reads the result.** A per-household breakdown: units consumed and where they came
from (own + shared + unaccounted), share of every single charge line, and the final amount
payable — with a check line that states, in words, that the shares add up to the bill total
exactly. Warnings appear for anything the arithmetic cannot decide on its own: a negative
residual, an implausibly large unaccounted block, a reading-date drift, an extrapolation
beyond the readings supplied.

**7. Sends it.** A WhatsApp-ready message per household (or one summary for the group), a
printable statement, and a saved cycle. Saving matters: the next cycle starts with this
cycle's present readings already in place as its previous readings, and this cycle's
previous readings retained as the *prior*, which is what makes date alignment exact rather
than an estimate.

**8. Keeps history.** Every saved cycle is listed with its totals, can be reloaded, rolled
forward, exported as JSON for backup, and re-imported. Seven cycles of the building's real
history — restated under Fairmeter's rules — ship as an importable seed file.

---

## 5. How it works

The calculation is a pure function: bill in, shares out. No storage, no DOM, no clock. That
is what makes it testable against the reference bill's exact printed figures, and what will
let a backend be added later without touching a line of it.

### 5.1 The provider profile becomes a bill

A utility is **data, not code**. `engine/providers/registry.ts` holds a profile per utility;
each profile holds tariff plans; each plan is an **ordered list of charge templates**, and a
template is one of six kinds:

| Kind | Basis | Example |
|------|-------|---------|
| `perUnit` | rate × units | energy at ₹4.60/unit; base FPPAS at ₹3.72/unit |
| `slabPerUnit` | tiered rates × units | RGP: 0–50 @ ₹3.20, 51–200 @ ₹3.95, rest @ ₹5.00 |
| `flat` | a fixed amount | a carried total, meter rent |
| `perKwPerMonth` | rate × sanctioned load × months | ₹70/kW/month × 1 kW × 2 |
| `perInstallationPerMonth` | rate × months | GUVNL rural fixed charge |
| `percentOfSubtotal` | % of named earlier components | FPPAS 3.40%; govt duty 20% |

`providers/build.ts` walks that list in order, resolves each template against the entered
rates and readings, and emits a resolved bill: a component list with an amount in **integer
paise** for each. Because `percentOfSubtotal` names the components it applies to, the
compounding chain from §3 (D over A+B+C, then F over A+B+C+D) is expressed declaratively
rather than hard-coded — which is exactly why adding a new utility means adding an entry to
the registry and a section to `PROVIDERS.md`, not writing new arithmetic.

Slab tariffs are evaluated **once, over the whole official reading**, and the resulting
energy charge is then split pro-rata like everything else — so every household pays the same
blended rate and nobody is arbitrarily assigned the cheap first slab (D-11). Slab widths are
per month, so they are multiplied by the number of billing months.

### 5.2 Sub-meter readings are lined up with the bill's window

The utility reads the official meter on its own schedule; the sub-meters get read whenever
somebody is free — days later, and a different number of days later each cycle. In the
owner's own records the reading day walked 1 Oct → 3 Dec → 4 Feb → 7 Apr → 11 Jun. Left
uncorrected, that drift moved roughly ₹217 onto one floor over four cycles.

The naïve fix — scaling a sub-meter's units by `billDays / meterDays` — is wrong, and
Fairmeter refuses it. Scaling *discards* the extra days permanently: the units consumed in
the overlap are neither billed this cycle nor carried into the next, so consecutive cycles
no longer sum to what the meter actually recorded.

Instead (`engine/align.ts`, D-13) each meter is treated as what it physically is: a
**cumulative curve**, sampled at the dates it was read — the *prior* reading, the previous
reading, and the present reading. Linear interpolation between those samples gives the
meter's value at any date in between, and the curve is evaluated at the bill's own two
reading dates. The difference between those two evaluations is the household's units *for
the bill's window*.

Two properties follow, and both are pinned by tests:

- **Telescoping.** Because each cycle ends where the next begins, consecutive cycles sum to
  the true total consumption. Nothing is lost at a boundary and nothing is double-counted.
- **Graceful absence.** Dates are optional everywhere. With no dates supplied, alignment
  returns the raw `present − previous` delta and behaviour is identical to not having the
  feature at all.

The prior reading — the reading *before* last — is what makes this exact rather than an
extrapolation, so a saved cycle carries it forward automatically. Where alignment has to
reach beyond the readings supplied, the result is still produced but flagged as an
extrapolation.

### 5.3 Three kinds of meter, and they are not interchangeable

- **Household sub-meter** — a party that owes money. Its aligned units are its own.
- **Common meter** — measured shared load: pump, lift, staircase, porch light. Real,
  metered, but owed by nobody individually. Its units are redistributed across the
  households by `commonPolicy` (D-09).
- **The residual** — `official units − every meter above`. This is unknown *by
  construction*: unmetered rooms, common load with no meter on it, meter tolerance, and
  reading lag all land here. If exactly one household is unmetered, the residual is that
  household's consumption by definition. If every household is metered, it is split by
  `residualPolicy`, and a large residual raises a warning because it means something is
  drawing power that nothing is measuring (D-08).

Conflating any two of these produces a defensible-looking number that is wrong, which is
precisely the failure mode of the spreadsheet Fairmeter replaces.

### 5.4 The bill collapses to a single ratio

Every component of the bill is apportioned by **one consumption ratio** per household:

```
units_i = own aligned units + share of common units + share of residual units
ratio_i = units_i / total official units
```

That ratio divides everything — energy, fixed charges, base FPPAS, the percentage
surcharges, government duty, previous dues, delayed payment charges, and the rounding
adjustment (D-01, D-02, D-04). It is a deliberate, defensible choice rather than a
simplification: because the surcharges are percentages of components that are themselves
already split by the ratio, applying the ratio to the final total gives the identical
answer, and it is the version a household can check in their head.

A consequence worth stating plainly: **the composition of the bill does not change any
household's share.** Whether the fixed charge is ₹50 or ₹140 only moves the bill total; each
household still pays `ratio × total`. The spreadsheet's error was never the stale ₹50
constant — it was splitting that charge equally instead of by the ratio.

### 5.5 Money is integer paise, and the parts always sum to the whole

Every amount in the engine is an integer number of paise. No floats touch money.

Splitting a component across households uses the **largest-remainder method**
(`engine/money.ts`): give each household the floor of its exact share, then hand out the
leftover paise one at a time to the largest fractional remainders. This guarantees that each
component's parts sum back to that component exactly, and therefore that the household totals
sum back to the bill total exactly. No remainder is ever silently dropped; where one has to
land somewhere, it lands somewhere stated.

The engine's test suite pins this against the reference bill's printed figures and against
conservation cases designed to break naïve rounding.

### 5.6 Validation, then output

Before calculating, the engine reports what it cannot proceed with — missing readings, a
present reading below the previous one, more than one unmetered household. After
calculating, it reports what it can proceed with but a human should look at: negative
residual, an unexplained block of units when every household is metered, reading-date drift,
extrapolation beyond supplied readings, and a total that does not match the paper bill.

Output is then four views of the same result (D-07): the on-screen breakdown table,
WhatsApp-ready text per household or for the group, a printable statement, and the history
list over saved cycles.

### 5.7 Storage stays out of the engine's way

Persistence is browser-local in v1 and a backend later (D-03). The engine depends on no
storage at all; the UI talks to a `CycleStore` interface with a localStorage implementation
behind it. Saved data is plain JSON, exportable and importable, with a migration step that
upgrades older records (for instance, converting legacy `dd/mm/yy` dates to ISO) on read.
Swapping localStorage for an API is a matter of writing a second implementation of one
interface.

---

## 6. Non-negotiable correctness properties

- **Conservation.** `Σ(all household shares) = official bill total`, exactly, to the paisa.
  Rounding differences are absorbed by a stated rule and shown, never silently dropped.
- **Explainability.** Every number must be traceable to a formula that can be read aloud and
  defended to the household paying it. No black boxes.
- **Residual visibility.** `official units − Σ sub-meter units` is surfaced explicitly, with
  its attribution stated, never hidden inside somebody's share.
- **Determinism.** The same inputs produce the same output, always. The engine has no clock
  and no randomness.
- **Honest provenance.** A tariff figure that did not come from a regulator's tariff order is
  labelled indicative in the interface. Rates are never invented.

## 7. Scope

### In scope (v1)
- One official meter; 1..N households, at most one of them unmetered.
- Flat-rate and slab-based energy tariffs.
- Fixed charges, base FPPAS, percentage surcharges, government duty.
- Metered shared load (pump, lift, common lighting) as its own meter kind.
- Account-level items — previous dues, DPC, other debits/credits, rounding — under an
  explicit policy.
- Sub-meter reading dates and window alignment against the bill's own reading dates.
- Multiple utilities as data: Torrent Power, the four GUVNL discoms, MSEDCL, BSES Delhi, and
  a custom profile.
- Per-household breakdown, WhatsApp text, printable statement, saved history with JSON
  export/import.

### Out of scope (v1)
- Scraping or auto-importing bills from a utility portal.
- Multi-connection or multi-property portfolios.
- Payment collection, reminders, or settlement tracking.
- Household-facing logins — one person runs the app and shares the result.
- Time-of-use tariffs: they would need time-of-day sub-meter data that does not exist.
- Per-household subsidies as a modelled concept; they are entered as an account-level credit.

## 8. Open questions

Decisions are tracked and answered in [`DECISIONS.md`](./DECISIONS.md) — D-01 through D-13
are settled. What remains open:

1. **Shared-load policy.** Should a common meter's units be divided pro-rata by consumption
   or split equally between households? Currently defaults to pro-rata; on the seeded
   history the choice moves roughly ₹2 per cycle.
2. **GUVNL residential electricity duty.** Sources disagree (15% / 7.5% / 10%); the
   commercial 20% is consistent across sources. The profile stays marked indicative until
   the GERC tariff order can be read directly.
3. **Backend phase.** Deferred, not cancelled — the engine/storage separation exists so it
   can happen without a rewrite.
