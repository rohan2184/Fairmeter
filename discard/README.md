# discard/

Material that is no longer part of the working project, kept rather than deleted so the
reasoning behind it stays recoverable. Nothing here is built, imported, tested, deployed or
referenced by anything outside this folder — deleting the whole directory would not change
the app or the infrastructure.

| Item | Why it is here |
|------|----------------|
| `design-lab/` | The candidate-direction lab, formerly `app/src/ui/design/`. It chose direction 2a, "Warm ledger", which `app/src/styles.css` now implements — so the lab has no job left. It was also **shipping to production**: reachable from a footer link and the `#design` hash, and worth about a third of the CSS bundle plus eight Google Font families on its own. |
| `design_handoff_fairmeter_brand/` | The brand handoff package. Its `BRAND.md` is a stale duplicate of the canonical one at the repo root. |
| `design-system-guide.md` | A generic design-system primer, superseded by `BRAND.md`, which is specific to this product and is the file the code actually follows. |
| `Electricity Bill Split.pdf` | An early write-up of the problem, superseded by `PROBLEM_STATEMENT.md`. At 964 kB it was also the largest file in the repo and unreferenced by anything. |

## What was deliberately *not* discarded

Two files look like reference clutter but are live dependencies, so they stay at the repo
root:

- **`100113210.pdf`** — the reference bill. It is the provenance for the golden test in
  `app/src/engine/engine.test.ts`, which reproduces its printed figures to the paisa, and
  it is cited by `PROBLEM_STATEMENT.md` §3 and `PROVIDERS.md`. Without it those figures
  have no source anyone can check.
- **`Monthly Meter Reading Form (Responses).xlsx`** — read at that exact path by
  `tools/seed_history.py`, which regenerates `seed/spreadsheet-history.json`. Moving it
  breaks that tool.

Say the word if you want either moved anyway and I will update the references to match.

## Recovering something

Everything here is tracked in git and was moved with `git mv`, so the history is intact:

```bash
git log --follow -- discard/<path>     # its history, across the move
git mv discard/<path> <somewhere>      # put it back
```
