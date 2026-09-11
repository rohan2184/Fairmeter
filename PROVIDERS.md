# Electricity providers & how they bill

Research backing the provider profiles (D-10) in
`app/src/engine/providers/registry.ts`. Everything the app pre-fills comes from here.

**Researched 15 August 2026.** Tariffs are revised every 1 April and fuel surcharges move
every cycle, so treat every number below as a *default to be corrected*, not a fact. The
app's printed-payable cross-check is the safety net.

---

## 1. Who supplies electricity in India

India has roughly **72 distribution companies (discoms)**. State-owned utilities and state
power departments account for about **93%** of energy sold; private licensees serve a
handful of areas — Delhi, Mumbai, Kolkata, Ahmedabad/Surat, and parts of Odisha.

Distribution is a **licensed monopoly per area**. There is no choosing your supplier: your
address determines your discom. Tariffs are set annually by the **State Electricity
Regulatory Commission** (GERC in Gujarat, MERC in Maharashtra, DERC in Delhi), which
publishes a tariff order with a full schedule as an annexure. That order is the only
authoritative source — every "bill calculator" website is a secondary summary and they
disagree with each other.

### Gujarat — the relevant case

| Discom | Ownership | Licence area |
|---|---|---|
| **Torrent Power** | Private | Ahmedabad, Gandhinagar, Surat, Dahej SEZ, Dholera SIR |
| **UGVCL** (Uttar Gujarat Vij) | State, under GUVNL | North Gujarat — Mehsana, Palanpur, Himatnagar, Gandhinagar district |
| **MGVCL** (Madhya Gujarat Vij) | State, under GUVNL | Central — Vadodara, Anand, Nadiad, Godhra |
| **PGVCL** (Paschim Gujarat Vij) | State, under GUVNL | Saurashtra & Kutch — Rajkot, Bhuj, Jamnagar |
| **DGVCL** (Dakshin Gujarat Vij) | State, under GUVNL | South — Valsad, Navsari, Bharuch, Surat district |

The four GUVNL discoms share **one combined GERC tariff schedule** — only the licence area
differs, which is why the app models them as four entries over one plan set. Torrent has its
own separate tariff order per licence area (Ahmedabad–Gandhinagar is one, Surat another).

For FY 2026-27, GERC held **base tariffs unchanged** for both the state discoms and Torrent.
Changes were confined to rebates: smart-meter prepaid rebate up from 2% to 3%, the Time-of-Use
discount of 60 paise/unit extended from 4 hours to 6 (11:00–17:00), green power tariff cut
from ₹0.90 to ₹0.75/kWh.

---

## 2. The shape of an Indian LT bill

Different utilities, same skeleton. The app's generic component list
(`perUnit | slabPerUnit | perKwPerMonth | perInstallationPerMonth | percentOfSubtotal | flat`)
covers every variant found:

| Layer | What varies between utilities |
|---|---|
| **Energy charge** | Flat ₹/unit (commercial) or **telescopic slabs** (residential). Slab widths are quoted *per month* — a 60-day bill doubles them. |
| **Fixed charge** | Per **kW per month** (commercial, and Delhi domestic) *or* per **installation per month** regardless of load (Torrent RGP, MSEDCL, GUVNL RGP by load band). |
| **Wheeling charge** | A separate per-unit line in Maharashtra. Folded into the energy rate in Gujarat. |
| **Fuel surcharge** | Three different mechanisms — see below. This is the single biggest structural difference between utilities. |
| **Electricity duty / tax** | A percentage, applied to the sum of everything above it. Rate varies by *consumer category*, not just by state. |
| **Account-level** | Previous dues, delayed payment charges (Gujarat: 15% p.a. from the due date), round-off carried to the next bill, subsidy credits. |

### The three fuel-surcharge mechanisms

1. **Two-part (Torrent, "FPPAS")** — a per-unit *base FPPAS* **plus** a percentage of
   (energy + fixed + base FPPAS). Both move every cycle. This is why the reference bill has
   two FPPAS lines.
2. **Per-unit only (GUVNL, "FPPPA"; Maharashtra, "FAC")** — one ₹/unit rate, revised
   quarterly (Gujarat) or monthly (Maharashtra). The FAC can be negative.
3. **Percentage only (Delhi, "PPAC")** — a percentage of (energy + fixed), and a large one:
   around 35.8% in 2026. Delhi additionally levies a **pension trust surcharge** on the same
   subtotal.

**Order matters.** Duty is charged on the subtotal *including* the fuel surcharge, so a
component list that puts them in the wrong order gets the total wrong. The engine evaluates
components in declaration order and a `percentOfSubtotal` may only reference components
declared before it — the catalogue test enforces this for every plan.

---

## 3. Torrent Power — Ahmedabad & Gandhinagar ✅ verified

**Source:** GERC, *Truing up for FY 2024-25, Approval of Revised ARR for FY 2026-27 and
Determination of Tariff for FY 2026-27* for TPL-D (Ahmedabad), March 2026 — Annexure: Tariff
Schedule, effective 1 April 2026. Pages 183–199.
`https://www.torrentpower.com/public/pdf/regulatory/TPL-D-A-2585-2025-Tariff-Order-of-FY-2026-27.pdf`

This is the one profile transcribed from the primary document, and the Non-RGP plan is
additionally reproduced to the paisa by the golden test against `100113210.pdf`.

### RATE: RGP (residential)
Applies to residential premises, and to common services up to 15 kW — **lifts, water
pumping systems, passage lighting** — and to pumping stations run by local authorities.

| | |
|---|---|
| Fixed charge | ₹25/month per installation (single phase) · ₹65/month (three phase) · ₹5/month for BPL |
| Energy charge | First 50 units/month **320 paise** · next 150 units/month **395 paise** · remaining **500 paise** |
| BPL energy | First 50 units/month 150 paise, then the RGP rate |
| Government duty | 15% |

Note the fixed charge is **per installation, not per kW** — a residential connection pays the
same ₹25 whether it is sanctioned 1 kW or 5 kW.

### RATE: GLP (charitable)
Public-trust premises: hospitals, schools, hostels, places of worship, crematoria.

| | |
|---|---|
| Fixed charge | ₹30/month single phase · ₹70/month three phase |
| Energy charge | First 200 units/month **410 paise** · remaining **480 paise** |

### RATE: Non-RGP (commercial) — *the reference bill's category*
Premises not covered by any other LT category, up to and including 15 kW connected load.

| | |
|---|---|
| Fixed charge | **₹70/kW/month** up to 5 kW connected load · **₹90/kW/month** for 5–15 kW |
| Energy charge | Flat **460 paise per unit** |
| Government duty | 20% |

### RATE: LTMD-1 (residential common services above 15 kW)
Lifts, water pumping, passage lighting for residential premises above 15 kW connected load.

| | |
|---|---|
| Fixed charge | ₹150/kW/month first 50 kW · ₹185/kW next 30 kW · ₹245/kW rest · ₹350/kW above contract demand |
| Energy charge | 465 paise up to 50 kW billing demand · 480 paise above |

### RATE: LTMD-2 (general, above 15 kW)
Non-RGP consumers may opt into this instead.

| | |
|---|---|
| Fixed charge | ₹175/kW/month first 50 kW · ₹230/kW next 30 kW · ₹300/kW rest · ₹425/kW above contract demand |
| Energy charge | 480 paise up to 50 kW billing demand · 500 paise above |

Billing demand for both LTMD categories = the highest of (recorded maximum demand, 85% of
contract demand, 6 kW).

### Other LT rates
Agricultural LTP 340 paise/unit (minimum ₹10/BHP/month) · Street lighting 430 paise ·
Temporary supply 510 paise + ₹25/kW/**day** · EV charging 420 paise + ₹25/month.

### General conditions worth knowing
- "The charges specified in the tariff are on a **monthly** basis. TPL-D shall adjust the
  rates according to the billing period applicable to the consumer." — this is the textual
  authority for multiplying fixed charges *and* slab widths by the number of billing months.
- Fixed charges are billed in multiples of 0.5 kW, rounded up. Energy is billed in whole kWh.
- Delayed payment charges: **15% p.a.** from the due date to the date of payment.
- Tariffs are **exclusive of** electricity duty and taxes — duty is a statutory levy on top.
- Power factor: rebate above 90% PF, penalty of 3 paise/unit for each 1% below 90%.

### Government duty by category (Gujarat)
Residential 15% · Commercial 20% · Industrial 10% · Religious 15% · Hostel 11.25%.

---

## 4. GUVNL state discoms — UGVCL / MGVCL / PGVCL / DGVCL ⚠️ indicative

**Source:** GERC combined *Tariff Schedule of DGVCL, MGVCL, PGVCL, UGVCL w.e.f. 01.04.2026*.
The regulator's site (`gercin.org`) serves that PDF behind a broken TLS certificate chain and
the direct link 404s on retry, so the figures below are **transcribed from secondary
summaries and are marked `indicative` in the app**. Re-verify from the order before relying
on them.

### RGP residential — telescopic, four slabs

| Slab (per month) | Urban | Rural / Gram Panchayat |
|---|---|---|
| First 50 units | ₹3.05 | ₹2.65 |
| Next 50 units | ₹3.50 | ₹3.10 |
| Next 150 units | ₹4.15 | ₹3.75 |
| Remaining | ₹5.20 | ₹4.90 |

Fixed charge by **load band**: ₹15/month up to 2 kW · ₹25 for 2–4 kW · ₹45 for 4–6 kW ·
₹70 above 6 kW.

### Non-RGP commercial

| | Up to 10 kW | Above 10 kW |
|---|---|---|
| Energy | ₹4.35/unit | ₹4.65/unit |
| Fixed | ₹50/kW/month (first 10 kW) | ₹85/kW/month (next 30 kW) |

Prepaid connections are billed roughly 9 paise/unit lower. Above 10 kW there is a peak-hour
surcharge of about 45 paise/unit.

### Surcharges and duty
- **FPPPA** — single per-unit fuel adjustment, revised quarterly. Around **₹3.20/unit** in
  2026. This is the number most worth checking against your own bill: it is large and it moves.
- **Electricity duty** — commercial 20%. Residential figures from secondary sources conflict
  (15% urban / 7.5% rural is the most commonly quoted pair; one source says 10%). **Unresolved
  — check the bill.**
- Smart-meter ToU concession of 60 paise/unit for consumption between 11:00 and 17:00.

---

## 5. Out-of-state comparison profiles ⚠️ indicative

Included so the model is exercised by billing shapes Gujarat does not have. Structure is
right; rates are from secondary summaries.

### MSEDCL (Mahavitaran), Maharashtra — MERC
The distinguishing feature is a **separate per-unit wheeling charge**.

| | |
|---|---|
| LT-I domestic energy | ₹5.56 (0–100/month) · ₹12.40 (101–300) · ₹16.64 (301–500) · ₹19.13 (above) |
| Wheeling | ₹1.35/unit, flat across slabs |
| Fixed | ₹135/month single phase · ₹435/month three phase |
| FAC | ≈ ₹0.55/unit, revised monthly, can be negative |
| Electricity duty | 16% on (energy + wheeling + fixed + FAC), excluding tax on sale |

### BSES Rajdhani / Yamuna, Delhi — DERC
The distinguishing feature is that fuel adjustment is a **percentage**, and a large one.

| | |
|---|---|
| Domestic energy | ₹3.00 (0–200/month) · ₹4.50 (201–400) · ₹6.50 (401–600) · ₹7.00 (601–800) · ₹8.00 (above) |
| Fixed | per kW per month by load band — roughly ₹20/kW up to 2 kW, ₹50/kW for 2–5 kW, ₹100/kW for 5–15 kW |
| PPAC | ≈ **35.83%** of (energy + fixed) |
| Pension trust surcharge | 7.5% of (energy + fixed) |
| Electricity tax | 5% |
| Subsidy | 100% for the first 200 units/month, **opt-in only**. Not modelled — enter it as a credit under "Other debit / credit". |

---

## 6. What this means for splitting a shared bill

Findings that changed the app, not just the catalogue:

1. **Slab tariffs are unavoidable once residential providers are in scope.** Every
   residential tariff researched is telescopic; only the commercial ones are flat. This is
   what closed P-02 → D-11.
2. **Slab widths are per month.** A 60-day bill gets double the width. This is stated
   explicitly in Torrent's general conditions and is easy to get wrong in either direction.
3. **Fixed charges are not always per kW.** Torrent RGP, MSEDCL and GUVNL RGP charge per
   *installation*, so "sanctioned load" is irrelevant to them — hence
   `usesSanctionedLoad` on each plan, which hides the field where it would mislead.
4. **The duty base differs.** Everyone charges duty on a subtotal that *includes* the fuel
   surcharge, but which components sit in that subtotal varies. Ordered components with
   explicit `of: [...]` references model this exactly; a hard-coded formula would not.
5. **A subsidy is a negative line item.** Delhi's is opt-in and per-consumer. Not modelled as
   a component; the "Other debit / credit" field takes it, and D-02 then splits it pro-rata
   like everything else.
6. **Sometimes there is no tariff to research at all.** Old cycles, a bill photographed
   badly, a licensee nobody has catalogued: all that survives is the amount. The
   `custom / total-only` plan takes the printed total as a single `flat` line and is exact,
   because point 7 below means the itemisation was never load-bearing for the split (D-12).
7. **None of this changes the split rule.** Whatever the provider, the bill still collapses
   to one ordered component list, each component still splits by `units_i / official_units`,
   and the shares still sum to the total exactly (D-04).

---

## 7. Sources

- [GERC tariff order for TPL-D Ahmedabad, FY 2026-27](https://www.torrentpower.com/public/pdf/regulatory/TPL-D-A-2585-2025-Tariff-Order-of-FY-2026-27.pdf) — primary, used for §3
- [GERC combined tariff schedule for DGVCL/MGVCL/PGVCL/UGVCL w.e.f. 01.04.2026](https://gercin.org/wp-content/uploads/2026/03/Tariff-Schedule-of-DGVCL-MGVCL-PGVCL-UGVCL-w.e.f.-01.04.2026.pdf) — primary but **unreachable** (TLS chain / 404)
- [GUVNL](https://www.guvnl.com/) — holding company for the four state discoms
- [DeshGujarat — GERC FY 2026-27 tariff announcement](https://deshgujarat.com/2026/03/25/gerc-unveils-fy-2026-27-power-tariff-in-gujarat-no-base-rate-hike-more-rebates-for-smart-meters-solar-hours/)
- [Mercom India — Gujarat retains FY 2027 tariffs](https://www.mercomindia.com/gujarat-retains-fy-2027-power-tariffs-at-previous-years-levels)
- [PGVCL tariff summary](https://thediscombill.com/tariffs/gujarat/pgvcl/) and [UGVCL calculator](https://electricitybillcalculator.in/ugvcl-bill-calculator/) — secondary, used for §4
- [Maharashtra bill calculator](https://billcalculator.in/maharashtra-electricity-bill-calculator/) — secondary, used for §5
- [Delhi rates, PPAC and slabs](https://bridgewaypower.in/delhi-electricity-rate-2026) — secondary, used for §5
- [CSIS — India's private power market](https://www.csis.org/analysis/indias-private-power-market-expanding-private-sector-electricity-distribution) and [NITI ICED — distribution overview](https://iced.niti.gov.in/energy/electricity/distribution) — used for §1
