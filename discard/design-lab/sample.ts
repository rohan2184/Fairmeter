/**
 * Fixed sample used by the design lab only.
 *
 * These are the reference bill's real figures (100113210.pdf, Torrent Power,
 * July 2026, Non-RGP Commercial) split between two metered households plus a
 * shared pump, so the mock-ups are showing numbers that actually conserve:
 *
 *   official 161 u = ground 78 + first 52 + pump 12 + unaccounted 19
 *   own-unit ratio 78:52 carries the pump and the unaccounted units
 *   -> ground 96.6 u (60.0%), first 64.4 u (40.0%)
 *
 * Every column below sums to the bill exactly, which is the whole point of the
 * product and therefore the thing the design has to make visible.
 */

export interface LabLine {
  label: string;
  ground: string;
  first: string;
  bill: string;
  accountLevel?: boolean;
}

export const SAMPLE = {
  billingMonth: 'July 2026',
  provider: 'Torrent Power · Ahmedabad',
  plan: 'Non-RGP Commercial · 1 kW · 60-day cycle',
  officialUnits: '161',
  meteredUnits: '130',
  commonUnits: '12',
  residual: '19',
  driftDays: '+4 d',
  payable: '1,860.00',
  households: [
    { name: 'Ground floor', units: '96.6', pct: '60.0', own: '78', shared: '7.2', resid: '11.4', total: '1,116.00' },
    { name: 'First floor', units: '64.4', pct: '40.0', own: '52', shared: '4.8', resid: '7.6', total: '744.00' },
  ],
  lines: [
    { label: 'Energy charges · 161 u × ₹4.60', ground: '444.36', first: '296.24', bill: '740.60' },
    { label: 'Fixed charges · ₹70/kW × 2 months', ground: '84.00', first: '56.00', bill: '140.00' },
    { label: 'Base FPPAS · 161 u × ₹3.72', ground: '359.35', first: '239.57', bill: '598.92' },
    { label: 'FPPAS · 3.40% of the above', ground: '30.18', first: '20.12', bill: '50.30' },
    { label: 'Government duty · 20%', ground: '183.58', first: '122.38', bill: '305.96' },
    { label: 'Previous dues', ground: '0.14', first: '0.09', bill: '0.23', accountLevel: true },
    { label: 'Delayed payment charges', ground: '18.17', first: '12.11', bill: '30.28', accountLevel: true },
    { label: 'Rounded down, carried forward', ground: '−3.78', first: '−2.51', bill: '−6.29', accountLevel: true },
  ] as LabLine[],
  warning: 'Sub-meters were read 4 days after the utility read the official meter. Readings have been interpolated to the bill’s window.',
};
