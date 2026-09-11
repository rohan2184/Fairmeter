"""
Turn the owner's original spreadsheet into an importable history file.

    python tools/seed_history.py

Reads `Monthly Meter Reading Form (Responses).xlsx` and writes
`seed/spreadsheet-history.json`, which the app's History panel imports as-is
(same shape as its own "Export backup").

What survives the trip, and what does not:

  * First-floor sub-meter readings and motor readings are REAL — columns C and D,
    carried straight across, previous reading taken from the row above.
  * The official meter is NOT. The spreadsheet only ever recorded the period's
    units (column E), never the utility meter's own readings, so each cycle is
    written as 0 -> units. Obviously synthetic on purpose: a plausible-looking
    invented reading would be worse than one nobody can mistake for real.
  * The tariff breakdown is gone too — only the bill total (column F) was kept.
    That is enough. Every component is apportioned by the same consumption ratio
    (D-01), so each household's share is ratio x total no matter how the total
    was composed. The cycles therefore use the `custom / total-only` plan and
    carry the printed total itself.
  * The motor is a common meter (D-09), not first-floor load — which is the one
    place the spreadsheet was materially wrong.
  * Column A is the FORM SUBMISSION time, which is the reading day only when the
    row was filled in on the spot. The first three rows were all submitted on
    30 Aug 2025, so they were plainly backfilled and their dates are dropped.
    From Oct-Nov-25 on, the submissions sit ~62 days apart and are used as the
    sub-meter reading dates (D-13). They cannot align anything on their own —
    that needs the official meter's dates, which the spreadsheet never had — but
    they do record when each reading was actually taken.
"""

import json
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "Monthly Meter Reading Form (Responses).xlsx"
OUT = ROOT / "seed" / "spreadsheet-history.json"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXCEL_EPOCH = datetime(1899, 12, 30)


def read_sheet() -> dict[str, str]:
    with zipfile.ZipFile(XLSX) as z:
        shared = [
            "".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)
        ]
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))

    cells: dict[str, str] = {}
    for c in sheet.iter(f"{{{NS['m']}}}c"):
        v = c.find("m:v", NS)
        if v is None or v.text is None:
            continue
        cells[c.get("r")] = shared[int(v.text)] if c.get("t") == "s" else v.text
    return cells


def main() -> None:
    cells = read_sheet()

    # Row 2 is the baseline: readings only, no cycle. Rows 3..9 are the seven
    # computed cycles. Stop at the first row without a bill amount.
    rows = []
    r = 3
    while f"F{r}" in cells:
        rows.append(r)
        r += 1

    stamps = {r: EXCEL_EPOCH + timedelta(days=float(cells[f"A{r}"])) for r in [2, *rows]}

    # A submission that landed on the same day as the row above it was backfilled,
    # so it says nothing about when the meter was read. Neither does the row after
    # it, whose window opens on that unusable date.
    trusted = {
        r: stamps[r].date().isoformat()
        for r in rows
        if (stamps[r] - stamps[r - 1]).days > 30
    }

    cycles = []
    for r in rows:
        saved_at = stamps[r]
        label = cells[f"B{r}"]
        units = float(cells[f"E{r}"])
        total = float(cells[f"F{r}"])
        dates = {
            key: value
            for key, value in (
                ("submeterPriorDate", trusted.get(r - 2)),
                ("submeterPreviousDate", trusted.get(r - 1)),
                ("submeterReadingDate", trusted.get(r)),
            )
            if value is not None
        }

        cycles.append(
            {
                "id": f"sheet-{label.lower()}",
                "savedAt": saved_at.replace(microsecond=0).isoformat() + "Z",
                "label": f"{label} (from the spreadsheet)",
                "bill": {
                    "providerId": "custom",
                    "planId": "total-only",
                    "billingMonth": label,
                    # When the UTILITY read the meter. Never recorded, and the
                    # form's submission date is a different thing entirely.
                    "readingDate": "",
                    # Synthetic — see the module docstring. Only the delta is real.
                    "officialMeter": {"previous": 0, "present": units, "multiplier": 1},
                    "sanctionedLoadKw": 1,
                    "billingMonths": 2,
                    "rates": {"billTotal": total},
                    "printedPayable": total,
                },
                "households": [
                    {
                        "id": "ground",
                        "name": "Ground floor",
                        "metered": False,
                        "previous": 0,
                        "present": 0,
                        "multiplier": 1,
                    },
                    {
                        "id": "first",
                        "name": "First floor",
                        "metered": True,
                        "previous": float(cells[f"C{r - 1}"]),
                        "present": float(cells[f"C{r}"]),
                        "multiplier": 1,
                    },
                ],
                "commonMeters": [
                    {
                        "id": "motor",
                        "name": "Motor / water pump",
                        "previous": float(cells[f"D{r - 1}"]),
                        "present": float(cells[f"D{r}"]),
                        "multiplier": 1,
                    }
                ],
                **dates,
                "policy": {"kind": "proRata"},
                "commonPolicy": {"kind": "proRata"},
            }
        )

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"version": 1, "cycles": cycles}, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{len(cycles)} cycles -> {OUT}")


if __name__ == "__main__":
    main()
