# Technical Specification — Electricity Bill Share Calculator

Version 1. Companion to [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md) and
[`DECISIONS.md`](./DECISIONS.md).

---

## 1. Domain model

### 1.1 Households, not "tenants"

The connection is shared by **N households**. "Owner" and "tenant" are legal roles that
have no bearing on the arithmetic — a property may be occupied entirely by tenants with an
absent owner, and the maths must not care. A household is simply *a party that consumes
electricity behind the official meter*.

Each household is one of:

| Kind | Units determined by |
|------|---------------------|
| **Metered** | Its own sub-meter: `(present − previous) × multiplier` |
| **Unmetered** | Derived as the residual: `official units − Σ(metered units)` |

**Invariant:** at most **one** household may be unmetered. Two unmetered households cannot
be separated from a single official reading — the app must reject this at validation time.

This makes residual attribution (formerly P-01) a structural property rather than a policy
knob:

- **Resident owner, no sub-meter of their own** → mark that household unmetered. Common
  load and owner load both land on them automatically. *(The original scenario.)*
- **Absent owner, every household metered** → the residual is genuine common load
  (staircase lights, pump, meter tolerance, reading-date drift) and needs an explicit
  `residualPolicy`.
- **Absent owner who wants common load itemised** → add a household literally named
  "Common Area" and mark it unmetered.

### 1.2 Common meters vs. the residual (D-09)

Two different kinds of shared consumption, and conflating them is the mistake the old
spreadsheet made:

| | **Common meter** | **Residual** |
|---|---|---|
| What | Measured shared load — pump, lift, porch light, stair lighting | Whatever no meter measured |
| Known? | Exactly | Only as a subtraction |
| Contains | One specific load | Unmetered household's own use + meter tolerance + reading-date drift |
| Goes to | Shared across households by `commonPolicy` | The unmetered household (D-08), or `residualPolicy` if all are metered |

A common meter is **not a household**. It has no share of the bill of its own; its units are
handed out. Modelling the pump as a household would print it in the breakdown table as a
party that owes money.

### 1.3 Attribution policies

Both policies take the same three shapes. `residualPolicy` only applies when *every*
household is metered; `commonPolicy` always applies when a common meter exists.

| Policy | Behaviour |
|--------|-----------|
| `proRata` *(default)* | Distributed in proportion to each household's own units |
| `equalSplit` | Divided equally across households |
| `assignTo(householdId)` | Charged entirely to one nominated household |

Pick per fixture: a **water pump** tracks usage (`proRata`); a **lift or stair light** serves
each household about equally (`equalSplit`).

A **negative residual** (sub-meters sum to more than the official meter — possible with
meter tolerance or mismatched reading dates) is not an error, but must raise a **warning**
in the UI and be shown explicitly. It is distributed by the same policy.

### 1.4 Types

```ts
type Paise = number;            // integer minor units — never floats for money
type Units = number;            // kWh, may be fractional if a multiplier applies

interface MeterReading {
  previous: number;
  present: number;
  multiplier: number;           // default 1
  previousDate?: string;        // 'yyyy-mm-dd'; on the official meter these two
  presentDate?: string;         //   define the window the bill charges for (D-13)
  prior?: { value: number; date: string };   // the reading before `previous`
}

interface Household {
  id: string;
  name: string;                 // "Ground floor", "Shop 16", "Common Area"
  metered: boolean;
  reading?: MeterReading;       // required iff metered
}

interface CommonMeter {              // D-09 — shared load, not a household
  id: string;
  name: string;                 // "Motor / water pump", "Lift", "Porch light"
  reading: MeterReading;
}

interface Slab {
  widthPerMonth?: number;       // omit on the last slab: "remaining units"
  rate: Paise;
}

type ChargeKind =
  | { kind: 'perUnit';           rate: Paise }                  // × billed units
  | { kind: 'slabPerUnit';       slabs: Slab[] }                // telescopic (D-11)
  | { kind: 'flat';              amount: Paise }                // as-is
  | { kind: 'perKwPerMonth';     rate: Paise }                  // × load × months
  | { kind: 'perInstallationPerMonth'; amount: Paise }          // × months, load-blind
  | { kind: 'percentOfSubtotal'; percent: number; of: string[] }; // ids of prior components

interface ChargeComponent {
  id: string;                   // 'energy' | 'fixed' | 'baseFppas' | 'fppas' | 'govtDuty' | …
  label: string;
  spec: ChargeKind;
  accountLevel?: boolean;       // true for dues / DPC / rounding — not consumption-derived
}

interface OfficialBill {
  billingMonth: string;
  readingDate: string;
  officialMeter: MeterReading;
  sanctionedLoadKw: number;
  billingMonths: number;        // 60-day cycle → 2
  components: ChargeComponent[];
  payableOverride?: Paise;      // the rounded "amount payable" actually charged
}
```

### 1.5 Provider profiles (D-10)

The owner picks a **provider** and a **tariff plan**; the form then renders exactly the rate
fields that plan has, pre-filled with published defaults. `providers/build.ts` turns the
profile plus the typed rates into the ordered component list below. Nothing in `engine/`
outside `providers/` knows a provider exists — see [`PROVIDERS.md`](./PROVIDERS.md) for the
catalogue and its sources.

A plan declares `usesSanctionedLoad`, so the form hides that field for tariffs where the
fixed charge is per installation rather than per kW. A rate of 0 drops its component from the
bill, and any `percentOfSubtotal` that referenced it is repaired rather than left dangling.

The Torrent Ahmedabad **Non-RGP** plan is the reference bill's own tariff, and produces:

| id | label | spec | reference value |
|----|-------|------|----------------:|
| `energy` | Energy charges | `perUnit ₹4.60` | 740.60 |
| `fixed` | Fixed charges | `perKwPerMonth ₹70.00` | 140.00 |
| `baseFppas` | Base FPPAS | `perUnit ₹3.72` | 598.92 |
| `fppas` | FPPAS charges | `percentOfSubtotal 3.40% of [energy, fixed, baseFppas]` | 50.30 |
| `govtDuty` | Government duty | `percentOfSubtotal 20% of [energy, fixed, baseFppas, fppas]` | 305.96 |
| `previousDues` | Previous dues | `flat` · account-level | 0.23 |
| `dpc` | Delayed payment charges | `flat` · account-level | 30.28 |
| `rounding` | Round-down adjustment | `flat` · account-level | −6.29 |

Sum = **₹1,860.00**, the amount actually payable.

Government duty rate by category: Residential 15%, Commercial 20%, Industrial 10%,
Religious 15%, Hostel 11.25%.

---

## 2. Calculation contract

### Step 1 — Official units

```
U = (officialMeter.present − officialMeter.previous) × officialMeter.multiplier
```
Reference: `(1936 − 1775) × 1.00 = 161`

Reject if `U <= 0`.

### Step 2 — Household units

```
own_i     = align(meter_i, W)                            // 0 if unmetered
common_m  = align(meter_m, W)                            // each common meter
residual  = U − Σ own_i − Σ common_m
```

`W` is the bill's reading window — the official meter's `previousDate` … `presentDate`.
`align` is the raw delta `(present − previous) × multiplier` whenever any of the dates
involved are missing, which keeps an undated bill behaving exactly as it always did.

When the dates *are* there, the meter is treated as a cumulative curve sampled at its own
reading dates (`prior`, `previous`, `present`), interpolated linearly, and evaluated at
both ends of `W`:

```
align(meter, W) = R_meter(W.presentDate) − R_meter(W.previousDate)
```

This exists because the utility reads on its day and the owner reads on another, and the
gap between the two moves from cycle to cycle. Left alone, that difference falls entirely
on the residual — i.e. on the unmetered household. See D-13, `engine/align.ts`.

**Postcondition (across cycles, not within one):** consecutive bills share an endpoint and
evaluate it on the same segment of the same curve, so `Σ align(...)` over a meter's whole
history equals its true end-to-end consumption. No unit is billed twice or dropped.

1. If a household is unmetered → `residualShare_unmetered = residual`.
   Else → distribute `residual` across households per `residualPolicy`.
2. `base_i = own_i + residualShare_i` — each household's *own* consumption, now known.
3. Distribute `Σ common_m` across households per `commonPolicy`, weighted by `base_i`.
4. `units_i = base_i + commonShare_i`

The order matters: common-meter units are shared in proportion to what each household
actually used, which for the unmetered household means its residual — so step 3 cannot run
before step 1.

**Postcondition:** `Σ units_i === U` exactly.

### Step 3 — Component amounts (whole bill)

Evaluated in declaration order so `percentOfSubtotal` can reference earlier ids:

```
perUnit                  → round(rate × U)
slabPerUnit              → walk the slabs over U; each slab's width is
                           widthPerMonth × billingMonths (D-11)
perKwPerMonth            → round(rate × sanctionedLoadKw × billingMonths)
perInstallationPerMonth  → round(amount × billingMonths)
flat                     → amount
percentOfSubtotal → round(percent/100 × Σ(amounts of referenced ids))
```

Rounding to whole paise, half-up, at each component — matching how the utility prints it.

**Verification against the reference bill** (this is the engine's primary test):

```
energy    = 4.60 × 161                    = 740.60  ✓
fixed     = 70.00 × 1 × 2                 = 140.00  ✓
baseFppas = 3.72 × 161                    = 598.92  ✓
fppas     = 3.40% × 1479.52               =  50.30  ✓
subtotal (no duty)                        = 1529.82 ✓
govtDuty  = 20% × 1529.82                 = 305.96  ✓
bill incl. duty                           = 1835.78 ✓
+ dues 0.23 + dpc 30.28                   = 1866.29 ✓ (amount due)
+ rounding −6.29                          = 1860.00 ✓ (payable)
```

### Step 4 — Split each component per household

Per D-01/D-02/D-04, **every** component — consumption-derived and account-level alike — is
split by the same ratio:

```
ratio_i = units_i / U
share_i,c = allocate(component_c.amount, ratios)
```

`allocate` uses the **largest-remainder method** on integer paise:

1. `exact_i = amount × ratio_i`; take `floor(exact_i)` for each household.
2. Distribute the leftover paise one at a time, in descending order of fractional part.
3. Ties broken by household index, so results are deterministic.

**Guarantee:** `Σ share_i,c === component_c.amount` for every component, exactly — and
therefore `Σ total_i === payable`. No remainder is ever dropped or silently absorbed.

Rounding drift per household is at most 1 paise per component (≤ 8 paise on the Torrent
preset) and is reported in the breakdown as a transparency note rather than hidden.

### Step 5 — Output shape

```ts
interface HouseholdShare {
  householdId: string;
  name: string;
  units: Units;
  residualUnits: Units;      // portion of `units` that came from the residual
  ratio: number;
  lines: { componentId: string; label: string; amount: Paise }[];
  total: Paise;
}

interface Result {
  officialUnits: Units;
  meteredUnits: Units;
  residual: Units;
  payable: Paise;
  shares: HouseholdShare[];
  warnings: string[];        // negative residual, residual > 30% of total, etc.
}
```

---

## 3. Architecture

```
src/
  engine/           # pure, zero imports from ui/ or storage/
    money.ts        # Paise arithmetic, half-up rounding, largest-remainder allocate()
    meters.ts       # units, common-meter sharing, residual distribution
    charges.ts      # component evaluation (incl. slabs)
    split.ts        # orchestration → Result
    presets/torrent.ts    # the original hand-written Torrent builder (D-05)
    providers/
      types.ts      # ProviderProfile / TariffPlan / ChargeTemplate
      registry.ts   # the catalogue — the only file that knows a provider exists
      build.ts      # profile + typed rates → OfficialBill
    *.test.ts       # incl. the reference-bill golden test
  storage/          # localStorage adapter behind an interface (D-03)
  ui/               # React components
  export/           # WhatsApp text, print stylesheet
```

The engine is a pure function `split(bill, households, options) → Result`. It never
touches storage, the DOM, or the clock. Swapping localStorage for an HTTP API later
touches only `storage/`.

---

## 4. Validation rules

| Rule | Severity |
|------|----------|
| More than one unmetered household | error |
| `present < previous` on any meter, household or common | error |
| A common meter reusing a household's id | error |
| Official units ≤ 0 | error |
| Metered household missing a reading | error |
| Negative residual | warning |
| Residual > 30% of official units | warning |
| Computed payable ≠ the bill's printed payable | warning, with the delta shown |

The last one is important: the owner types the printed total *and* the rate fields, and
the app cross-checks them. It catches a mistyped rate before anyone is charged.

---

## 5. Deferred

- **Backend** — see D-03.
- **Time-of-Use / peak-hour rates** — every Gujarat discom now offers a 60 paise/unit
  off-peak concession on smart meters. Splitting it correctly needs *when* each household
  consumed, which sub-meter readings do not record. Out of scope until sub-meters report
  time-of-day.
- **Per-household subsidies** — Delhi's 200-unit subsidy is opt-in per consumer, not per
  connection. Currently entered as an account-level credit and split pro-rata like anything
  else (D-02).
- **Prepaid / smart-meter rebates** — a flat few paise off the energy rate; type the lower
  rate directly.

*(Slab tariffs were deferred as P-02 and have now shipped — see D-11.)*
