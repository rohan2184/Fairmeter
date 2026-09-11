# Decisions Log

Tracks every policy/design decision for the Electricity Bill Share Calculator.
See [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md) for context.

Status legend: ✅ Decided · ⏳ Pending · 🔁 Revisit later

---

## ✅ Decided

### D-01 — Fixed charges are split pro-rata by units
**Status:** ✅ Decided (2026-08-15)

Fixed charges (₹70/kW/month × sanctioned load × months — ₹140.00 in the reference bill)
are apportioned in the **same ratio as consumption**, not equally per party.

**Rationale:** keeps one single ratio driving the whole bill, is trivial to explain to a
tenant, and a low-usage tenant is not penalised.
**Consequence:** a tenant with zero consumption in a cycle pays ₹0 toward the connection.
Accepted.

---

### D-02 — Account-level items are shared pro-rata
**Status:** ✅ Decided (2026-08-15)

Previous dues (₹0.23), delayed payment charges (₹30.28) and the round-down adjustment
(−₹6.29) are **rolled into the total and split by the same consumption ratio** as
everything else.

**Rationale:** owner's explicit preference — one uniform rule, no carve-outs, simplest
possible explanation.
**Consequence:** a tenant can pay a small share of a late-payment penalty they did not
cause. Accepted by the owner.
**Note:** the breakdown output must still *itemise* these lines per party so a tenant can
see exactly what they are being charged for.

---

### D-03 — Persistence: browser-local history now, backend later
**Status:** ✅ Decided (2026-08-15) · 🔁 Revisit when backend is introduced

v1 stores bill history in **browser local storage** (no login, no server). Next cycle
auto-fills each meter's *previous* reading from the last saved cycle's *present* reading.

A full backend (accounts, cross-device history, tenant records) is a **planned future
phase**, not v1.

**Implication for v1 architecture:** the calculation engine and the storage layer must be
cleanly separated from the start, so swapping local storage for an API is a drop-in
change and not a rewrite. Data must also be **exportable/importable as JSON** so nothing
is lost in the migration.

---

### D-04 — Derived consequence: the bill collapses to a single ratio
**Status:** ✅ Decided (implied by D-01 + D-02)

Because *every* component — energy, fixed, base FPPAS, FPPAS %, govt duty, arrears, DPC,
rounding — is apportioned by consumption, each party's share is:

```
share_i = (units_i / total_official_units) × final_bill_amount
```

Where `total_official_units` = official meter (present − previous) × multiplier.

This automatically satisfies the **conservation property** (all shares sum exactly to the
bill) and is slab-safe *only* for flat-rate tariffs — see P-01.

The UI must still display the **component-wise breakdown** per party (energy / fixed /
FPPAS / duty / dues / DPC), because "here's your ratio × total" is not persuasive to a
tenant, whereas an itemised table is. Same maths, better presentation.

---

### D-05 — Tariff model: hard-code Torrent now, generic internals
**Status:** ✅ Decided (2026-08-15) · supersedes P-03

The v1 **input form** exposes Torrent Power's fields directly (energy rate, fixed
charge/kW/month, base FPPAS rate, FPPAS %, govt duty %). The **engine internals** are
component-based — an ordered list of `perUnit | flat | percentOfSubtotal` charges — so
generalising to other utilities later is additive, not a rewrite.

**Rationale:** ship against the only bill that exists, without painting into a corner.

---

### D-06 — Stack: React + TypeScript + Vite
**Status:** ✅ Decided (2026-08-15) · supersedes P-04

Vite + React + TypeScript, tested with Vitest. Static build, deployable anywhere.
Money maths gets explicit types; the engine is a pure module with zero UI or storage
imports.

---

### D-07 — Outputs: all four
**Status:** ✅ Decided (2026-08-15) · supersedes P-05

1. On-screen per-party itemised breakdown table (baseline).
2. Copy-to-clipboard plain-text summary per tenant, formatted for WhatsApp.
3. Printable per-tenant statement (print stylesheet → browser "Save as PDF").
4. History view — past cycles per tenant, units and amounts over time (uses D-03 storage).

---

### D-08 — Households, not tenants; residual is structural
**Status:** ✅ Decided (2026-08-15) · resolves P-01

"Owner" and "tenant" are legal roles with no bearing on the arithmetic — a property may be
occupied entirely by tenants with an absent owner. The model is **N households**, each
either **metered** (has a sub-meter) or **unmetered** (units derived as
`official − Σ metered`). **At most one household may be unmetered** — two are
mathematically unsolvable from a single official reading, and validation rejects it.

Residual attribution therefore stops being a policy question and becomes a structural
property: the unmetered household absorbs it. When *every* household is metered, the
residual is genuine common load and a `residualPolicy` applies
(`proRata` default | `equalSplit` | `assignTo`). An absent owner who wants common load
itemised adds a household named "Common Area" and marks it unmetered.

**Rationale:** raised by the owner — a house where the owner does not live breaks
owner/tenant framing entirely, but does not break household framing.
See [`SPEC.md`](./SPEC.md) §1.

**Amended (2026-08-16):** the "large share unaccounted for" warning now fires **only when
every household is metered**. With an unmetered household the residual is that household's
consumption by definition, so a large one is the normal case — it fired on all seven
historical cycles and on every sample. A warning that is always on is a warning nobody
reads. The residual is still shown as a figure; it is just no longer flagged. The
sub-meters-exceed-the-official-meter warning is unaffected: negative residual is an
anomaly however the households are set up.

---

### D-09 — Metered shared load is its own thing, and it is shared
**Status:** ✅ Decided (2026-08-15)

A **common meter** measures load that belongs to nobody in particular: the water pump, the
porch light, the stair lighting, the lift. It is *not* a household, and its units are *not*
part of the unmetered residual.

The attribution order is now:

1. Each household's own sub-meter → its own units.
2. Common meters → measured shared units.
3. `residual = official − household meters − common meters` → the genuinely unknown part,
   which the unmetered household absorbs (D-08) or `residualPolicy` splits.
4. Common-meter units are then shared across households by a separate `commonPolicy`
   (`proRata` default | `equalSplit` | `assignTo`), weighted by each household's *own*
   units from steps 1–3.

**Rationale:** raised by the owner — the motor is on its own meter and serves everyone. The
existing spreadsheet added the motor's units to the first floor, which overcharged that
household by roughly 7–11 units a cycle. Folding it into the residual instead would have
overcharged the ground floor by the same amount. Neither is right: it is shared.

**Why a separate policy from `residualPolicy`:** a water pump tracks usage (pro-rata), a
lift or a stair light serves each household about equally (equal split). The two questions
have different right answers, so they get different switches.

**Consequence:** the unmetered household's units go *down* once a shared meter is entered,
because load that used to be invisible is now measured. That is the point.
See [`SPEC.md`](./SPEC.md) §1.

---

### D-10 — Provider profiles
**Status:** ✅ Decided (2026-08-15) · supersedes the form half of D-05

The owner picks a **provider** and a **tariff category**; the form then shows exactly the
line items that tariff has, pre-filled with the published rates. Adding a utility is a data
entry in `app/src/engine/providers/registry.ts` — nothing else in `engine/` knows a provider
exists.

A profile carries a `confidence` flag, shown in the UI:

- `verified` — transcribed from the regulator's tariff order. Torrent Ahmedabad is
  additionally reproduced to the paisa by the golden test against the reference bill.
- `indicative` — the *structure* is right, the *rates* came from secondary summaries. The
  UI says so and tells the owner to check them.

**Rates are defaults, never truth.** Tariffs change every April and fuel surcharges change
every cycle; the bill in hand always wins, and the printed-payable cross-check is what
catches a stale default. Setting a rate to 0 removes that line from the split entirely
(and any percentage that referenced it is repaired).

**Rationale:** owner's request — there are three or four licensees in the same city, so
"which provider?" has to come before "what rate?". See [`PROVIDERS.md`](./PROVIDERS.md) for
every number and where it came from.

---

### D-11 — Slab tariffs use the blended average rate
**Status:** ✅ Decided (2026-08-15) · resolves P-02, adopting its recommendation

Telescopic slabs are applied **once, to the whole official reading**, and the resulting
energy charge is then split pro-rata like every other component. Everybody pays the same
blended average rate.

Slab widths are quoted **per month**, so a 60-day bill gets double the width — 100 units in
Torrent RGP's first slab, not 50. Getting this wrong pushes units into a dearer slab.

**Rejected:** filling the cheap slabs from one household's units first. It is arbitrary
(whose units go first?), indefensible to whoever loses, and would not sum back to the bill.

**Consequence:** on a steep slab tariff a heavy user is subsidised by a light one relative
to what they would pay on their own connection. Accepted — it is the same trade-off D-01
already makes for fixed charges, and it is the only rule that is explainable.

---

### D-12 — A cycle whose itemisation is lost is carried as its printed total
**Status:** ✅ Decided (2026-08-15)

The owner's spreadsheet recorded one money column: the amount payable. No energy rate, no
fixed charge, no FPPAS, no duty. Those seven cycles are still worth having in history, so
there has to be a way to enter a bill you only know the total of.

**The itemisation is not needed.** Under D-01/D-02 every component is apportioned by the
same ratio, so a household's share is `ratio × total` no matter how the total was composed.
Reconstructing a plausible rate stack would add nothing and would be inventing rates.

So: a `flat` charge template (`engine/providers/types.ts`), and the plan
`custom / total-only` — one field, "Bill total as printed". Exact to the paise, unlike
the older `custom / blended` plan, whose ₹/unit round-trip loses up to a rupee.

**Fixed charge settled at ₹140** (₹70/kW/month × 1 kW × 2 months), confirmed by the owner
— which is what `registry.ts` already defaults to. The spreadsheet's ₹50 constant was
stale. It does not change any restated share, for the reason above; it only shows how far
the spreadsheet's own method had drifted.

**Restating the seven cycles** moves ₹163.26 off the first floor in total, ~₹23/cycle:

| Change | First floor, 7 cycles | Δ |
|---|---:|---:|
| Spreadsheet as it stood | ₹9,978.39 | — |
| + D-01 (fixed charge pro-rata, not ₹25 each) | ₹10,012.91 | +₹34.51 |
| + D-09 (motor is shared load, not first-floor load) | ₹9,815.13 | −₹197.78 |

Pinned by `storage/seed.test.ts`.

---

### D-13 — Sub-meters are lined up with the bill's reading window
**Status:** ✅ Decided (2026-08-16)

The utility reads the official meter on its own day — 21/07/26 on the reference bill. The
owner reads the sub-meters when the bill arrives, a week or two later. So the two windows
do not coincide, and what leaks is not the lag but the **change** in lag: read four days
later than last cycle and the sub-meters cover 65 days against the bill's 61.

Those four extra days inflate the metered households' units, which shrinks the residual by
exactly the same amount — so **the entire error lands on the unmetered household** (D-08).

The owner's own form timestamps show the reading day walking 1 Oct → 3 Dec → 4 Feb →
7 Apr → 11 Jun: ten days of one-way creep in eight months, worth roughly ₹217 across those
four cycles at ~₹23/drift-day. Larger than the D-01 and D-09 corrections combined, and
pointing the same way.

**Decision:** a meter is not a pair of numbers, it is a cumulative curve sampled at known
dates. Interpolate it linearly between samples, evaluate at the bill's two reading dates,
subtract. `engine/align.ts`.

Dates are **optional throughout**. Without them the engine behaves exactly as it did
before, and says nothing.

**Rejected: scaling units by `billDays / meterDays`.** It looks like the same idea and is
not — it throws the extra days away, and since the next cycle's delta starts from the late
reading, those units are billed to nobody, ever. The test in `align.test.ts` pins this:
across three cycles of a meter whose rate changes, interpolation totals exactly the 600
units the meter really recorded; scaling totals 634.

**Consequence:** no single cycle is exactly right — a rate change inside a reading interval
cannot be recovered from two readings. What is guaranteed is that consecutive bills
partition consumption exactly, because the endpoint two bills share is evaluated on the
same segment of the same curve. Per-cycle estimate, long-run exact.

**Consequence:** the cycle keeps one extra number per meter — the reading *before* last.
Rolled forward automatically by "Start next cycle", never typed, but shown read-only
because it moves money. Without it the opening date is extrapolated instead of
interpolated, and the cycle says so.

**The real fix is still free:** read the sub-meters on the day the bill says the utility
read the official meter. The form shows both windows side by side so the drift is visible
while it can still be avoided.

---

### D-14 — The app is a page with a hero and a standing answer panel, not a form
**Status:** ✅ Decided (2026-08-17)

The single-column sheet read as an internal tool: it opened on field one of a long form,
said nothing about what it was for, and put the answer at the bottom where you only saw it
after scrolling past everything.

**Decision:** three bands and a two-column working area.

- A **hero** states what the app does and shows the answer it produces — a specimen card
  holding an example split that becomes this cycle's real split the moment there is one.
  Same figure, same component, so the promise and the result are one object.
- The **answer panel** moves out of the bottom of the page and sticks beside the form on
  desktop, so every reading typed in is seen landing on somebody's share. Below 1024px it
  follows the form and a fixed bottom bar carries the total until you reach it.
- Before the form has enough in it, that panel holds the list of what is still missing —
  the space where the answer will be, saying why it isn't there yet. The separate "Before
  this can be calculated" card is gone.
- A **sticky top bar** carries the name, the theme, and the steps as chips with a tick
  each, so the progress read-out and the way to a step are the same control.

**Unchanged, deliberately:** every colour and type token, the ramp, the tariff form itself,
and the engine. This was a layout decision only — §3, §4 and §7 of `BRAND.md` are as they
were.

**Print changed with it:** the sheet is the answer and its working, so the form column is
`display: none` on paper and a one-line masthead names the cycle. Every figure typed in
still appears, in the breakdown.

---

### D-15 — Hosting: private S3 behind CloudFront, defined in CDK
**Status:** ✅ Decided (2026-09-11)

D-03 makes the app pure client-side — engine in the browser, history in `localStorage`, no
API and no database. That makes hosting a solved problem rather than an architecture
question, and the cheapest correct answer is a static origin behind a CDN.

**Decision:** an `infra/` CDK app (TypeScript) defining a **private S3 bucket** — all public
access blocked, read granted only to the `cloudfront.amazonaws.com` principal via **Origin
Access Control**, scoped by the distribution's ARN — fronted by a **CloudFront
distribution**. No compute, no VPC, no database anywhere in the stack.

**Why CDK over Terraform or a bare `aws s3 sync` script:** same language and toolchain as
`app/`, so the infra is type-checked by the same `tsc`; and the response-headers, cache and
error-mapping policies still to come are typed constructs rather than hand-assembled JSON.
The IaC tool adds no AWS cost — the site fits inside the CloudFront perpetual free tier, so
the real cost levers are the price class and the cache policy.

**`PRICE_CLASS_200`, not 100.** The cheaper class serves only North America and Europe. The
users are in Ahmedabad; 200 is the first class that includes the Indian edges.

**Cache headers are split in two.** Vite content-hashes everything under `assets/`, so those
go up `immutable, max-age=31536000`; the unhashed root shell goes up `no-cache`. Publishing
the shell with a long TTL would strand viewers on an `index.html` pointing at bundles the
next deploy deleted.

**Deploys are manual** (`npm run deploy` in `infra/`, which builds and tests first and
refuses to publish a missing build). GitHub Actions via OIDC is the intended next step if the
project grows; CodePipeline is the in-AWS alternative. Recorded in `infra/README.md`.

**Domain:** the CloudFront `*.cloudfront.net` address for now. A custom domain is an ACM
certificate in us-east-1 plus `domainNames` on the existing distribution — an in-place
update, so choosing to wait costs nothing later.

---

## ⏳ Pending

### ~~P-01 — Residual attribution~~ → resolved by D-08
**Status:** ✅ Closed

Superseded by the household model in D-08. Kept for history.

---

### ~~P-02 — Slab tariff handling~~ → resolved by D-11
**Status:** ✅ Closed (2026-08-15) — option 1 adopted. Kept for the reasoning.

The reference bill is **Non-RGP Commercial**, a flat ₹4.60/unit — so no slab problem
exists today. But the printed tariff table includes slab-based categories
(RGP Residential: 0–50 @ ₹3.20, 51–200 @ ₹3.95, remaining @ ₹5.00).

If the app is ever used on a slab tariff, someone must occupy the cheap lower slabs.
Options:
1. **Blended average rate** — total energy charges ÷ total units, applied to everyone.
   Neutral, everyone gets the same effective rate. Consistent with D-04.
2. **Sequential slab fill** — owner's units fill the cheap slabs first (or tenants do).
   Arguably "truer" but arbitrary and hard to defend.

**Recommendation:** option 1, for consistency with D-04.
**Must decide before:** supporting any tariff other than the current flat commercial rate.

---

*(P-03, P-04, P-05 resolved — see D-05, D-06, D-07 above.)*
