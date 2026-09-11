# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**Electricity Bill Split** — a web app that splits one official electricity bill (single
utility meter) between the **households** sharing the connection, using readings from
private sub-meters.

Never say "tenants" in the model: a property may be occupied entirely by tenants with an
absent owner. The unit of the model is a household, which is either metered or unmetered
(D-08).

## Repository layout

| Path | Purpose |
|------|---------|
| `PROBLEM_STATEMENT.md` | Problem definition, reference-bill anatomy, scope, correctness properties |
| `SPEC.md` | Domain model, calculation contract, architecture, validation rules |
| `DECISIONS.md` | Decisions log — ✅ decided / ⏳ pending. **Read before implementing anything.** |
| `PROVIDERS.md` | Utility research: who bills where, every tariff figure and its source |
| `100113210.pdf` | Reference bill: Torrent Power, Ahmedabad, July 2026, Non-RGP Commercial |
| `Monthly Meter Reading Form (Responses).xlsx` | The owner's original spreadsheet — what this app replaces |
| `tools/seed_history.py` | Regenerates the seed below from the spreadsheet |
| `seed/spreadsheet-history.json` | The spreadsheet's 7 cycles, restated (D-12). Import via History → Import |
| `app/src/engine/` | Pure calculation engine — no storage, no DOM, no clock |
| `app/src/engine/align.ts` | Sub-meter window → bill window interpolation (D-13) |
| `app/src/engine/providers/` | Provider catalogue + profile→bill builder (D-10) |
| `app/src/storage/` | `CycleStore` interface + localStorage implementation |
| `app/src/ui/`, `app/src/export/` | React components; WhatsApp text + print output |
| `infra/` | AWS CDK stack: private S3 + CloudFront static hosting (D-15). `npm run deploy` |

## Commands

```bash
cd app
npm run dev     # http://localhost:5173
npm test        # vitest run — engine + reference-bill golden test
npm run build   # tsc -b && vite build
```

`tsconfig` has `erasableSyntaxOnly` on: no constructor parameter properties, no enums.

## Domain rules currently in force

Every bill component is apportioned by a **single consumption ratio**
(`units_i / total_official_units`) — including fixed charges (D-01), previous dues,
delayed payment charges and rounding (D-02). Shares must sum **exactly** to the bill total.

Three kinds of meter, and they are not interchangeable (D-08, D-09):

- **household sub-meter** — a party that owes money;
- **common meter** — measured shared load (pump, lift, porch light). Not a household; its
  units are shared across households by `commonPolicy`;
- **the residual** — `official − every meter above`. Unknown by construction. Lands on the
  single unmetered household, or splits by `residualPolicy` if all are metered.

Sub-meters are read on a different day from the official meter, and the gap moves (D-13).
Given reading dates, `engine/align.ts` interpolates each meter's cumulative curve to the
bill's window; without dates it returns the raw delta and nothing changes. Never "fix" this
by scaling units by `billDays / meterDays` — that discards the extra days permanently.
Each cycle keeps the reading *before* last (`prior`), rolled forward automatically, which
is what makes the alignment exact rather than an extrapolation.

Reference bill charge stack (see `PROBLEM_STATEMENT.md` §3 for values):
energy (per-unit) → fixed (per kW per month) → base FPPAS (per-unit) →
FPPAS % of the three above → govt duty % of that subtotal → account-level dues/DPC/rounding.

Money is **integer paise everywhere**. Allocation uses the largest-remainder method
(`engine/money.ts`), which guarantees each component's parts sum back to it exactly.
Any change there must keep `engine.test.ts`'s conservation cases green.

Slab tariffs shipped (D-11): slabs are evaluated once over the whole official reading and
then split pro-rata, so everyone pays the same blended rate. **Slab widths are per month** —
multiply by `billingMonths`.

Adding a utility means adding an entry to `engine/providers/registry.ts` and a section to
`PROVIDERS.md`. Never invent rates: mark a profile `indicative` when the figures came from
anything other than the regulator's tariff order, and the UI will say so.

## Stack

React + TypeScript + Vite, Vitest for tests (D-06). The form is generated from the selected
provider profile; engine internals are a generic ordered component list (`perUnit |
slabPerUnit | flat | perKwPerMonth | perInstallationPerMonth | percentOfSubtotal`), which is
what lets a new utility be data rather than code (D-05, D-10).

Outputs (D-07): on-screen breakdown table, WhatsApp-ready copy-paste text, printable
statement (`@media print` in `styles.css`), and a history view over saved cycles.

## Working conventions

- Persistence is **browser-local in v1, backend later** (D-03). Keep the calculation
  engine free of any storage dependency; storage must be swappable and data
  JSON-exportable.
- The calculation engine is the core asset — it should be pure, deterministic, and unit
  tested against the reference bill's exact figures.
- Never silently drop rounding remainders; surface them.
- When a policy question comes up, check `DECISIONS.md` first. If it is unanswered, ask
  the user rather than assuming — then record the answer there.

## Reading the reference PDF

`pdftoppm` is not installed, so `Read` cannot render the PDF. Extract text with:

```powershell
python -c "from pypdf import PdfReader; print('\n'.join(p.extract_text() for p in PdfReader(r'D:\side-project-02\100113210.pdf').pages))"
```

(`pypdf` is already installed for the system Python at `C:\Python314\python.exe`.)
