# Electricity Bill Split

Splits one official electricity bill between the households sharing a single utility
connection, using their private sub-meter readings.

One official meter, several households, one bill — and every cycle the person paying has
to work out who owes what. Doing it by hand goes wrong because fixed charges, FPPAS,
government duty and arrears do not divide the way a bare "units × rate" guess assumes.

## What it does

- Enter the official bill (readings, rates, fixed charges, FPPAS, duty, dues) and each
  household's sub-meter readings.
- Get a per-household itemised breakdown that **sums back to the bill total exactly, to
  the paisa**.
- Copy a WhatsApp-ready message per household, or print a statement.
- Save the cycle — the next one starts with this cycle's present readings already in
  place as its previous readings.

Nothing is uploaded. History lives in the browser; export a JSON backup any time.

## How the split works

Every charge — energy, fixed, base FPPAS, FPPAS %, government duty, previous dues,
delayed payment charges, and the round-off adjustment — is divided by one ratio:

```
share = units_used / official_units
```

Each household is either **metered** (its own sub-meter) or **unmetered** (its units are
derived as `official − Σ metered`). At most one household can be unmetered, so common
load, meter tolerance and reading-date drift land somewhere explicit rather than
vanishing. If every household is metered, the leftover is common load and you choose how
to divide it.

Allocation uses the largest-remainder method on integer paise, so no rounding remainder is
ever dropped or invented.

## Running it

```bash
cd app
npm install
npm run dev     # http://localhost:5173
npm test        # engine tests, incl. the reference bill golden test
npm run build
```

## Documents

| File | What's in it |
|------|--------------|
| [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md) | The problem, the reference bill decomposed, scope |
| [`SPEC.md`](./SPEC.md) | Domain model, calculation contract, validation rules |
| [`DECISIONS.md`](./DECISIONS.md) | Every policy decision, with rationale |
| `100113210.pdf` | Reference bill (Torrent Power, Ahmedabad, July 2026) |
| [`PROVIDERS.md`](./PROVIDERS.md) | Utility research: every tariff figure and its source |
| [`BRAND.md`](./BRAND.md) | Type, colour, tokens, voice |
| [`infra/README.md`](./infra/README.md) | How the site is hosted and deployed |

## Status

v1: single utility (Torrent Power field layout), browser-local history.
Planned: backend with accounts and cross-device history; slab-tariff support.
