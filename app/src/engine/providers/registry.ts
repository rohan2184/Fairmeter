import type { ChargeTemplate, ProviderProfile, TariffPlan } from './types';

/**
 * The provider catalogue (D-10). See PROVIDERS.md in the repo root for where
 * every number came from and how much to trust it.
 *
 * Adding a utility means adding an entry here. Nothing in `engine/` outside
 * this directory knows a provider exists.
 */

// ---------------------------------------------------------------------------
// Torrent Power — Ahmedabad & Gandhinagar
// Verified against the GERC tariff order for FY 2026-27 (March 2026) and,
// for Non-RGP, against the reference bill 100113210.pdf itself.
// ---------------------------------------------------------------------------

/**
 * Torrent bills fuel adjustment TWICE: a per-unit "base FPPAS" and a
 * percentage on top of (energy + fixed + base FPPAS). Both move every cycle —
 * the defaults are the reference bill's, and are meant to be overtyped.
 */
const torrentFppas = (): ChargeTemplate[] => [
  {
    kind: 'perUnit',
    id: 'baseFppas',
    label: 'Base FPPAS',
    default: 3.72,
    hint: 'Changes every cycle — copy it off this bill.',
  },
  {
    kind: 'percentOfSubtotal',
    id: 'fppas',
    label: 'FPPAS charges',
    default: 3.4,
    of: ['energy', 'fixed', 'baseFppas'],
    hint: 'Percentage of energy + fixed + base FPPAS.',
  },
];

const torrentDuty = (percent: number): ChargeTemplate => ({
  kind: 'percentOfSubtotal',
  id: 'govtDuty',
  label: 'Government duty',
  default: percent,
  of: ['energy', 'fixed', 'baseFppas', 'fppas'],
  hint: 'Residential 15 · Commercial 20 · Industrial 10 · Religious 15 · Hostel 11.25',
});

const TORRENT_AHMEDABAD: ProviderProfile = {
  id: 'torrent-ahmedabad',
  name: 'Torrent Power — Ahmedabad & Gandhinagar',
  shortName: 'Torrent Power',
  area: 'Ahmedabad, Gandhinagar',
  ownership: 'private',
  regulator: 'GERC',
  confidence: 'verified',
  source: 'GERC tariff order for TPL-D (Ahmedabad) FY 2026-27, Annexure: Tariff Schedule',
  effectiveFrom: '1 April 2026',
  notes: [
    'Fixed charges are quoted per month; a 60-day cycle is billed as 2 months.',
    'Energy-charge slabs are per month too, so a 60-day bill gets double the slab width.',
    'Delayed payment charges run at 15% p.a. from the due date.',
  ],
  plans: [
    {
      id: 'nonRgp-upto5kw',
      label: 'Non-RGP commercial (connected load up to 5 kW)',
      applicability: 'Premises not covered by any other LT category, up to 15 kW connected load.',
      usesSanctionedLoad: true,
      charges: [
        { kind: 'perUnit', id: 'energy', label: 'Energy charges', default: 4.6 },
        {
          kind: 'perKwPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 70,
          hint: '₹70/kW/month up to 5 kW connected load.',
        },
        ...torrentFppas(),
        torrentDuty(20),
      ],
    },
    {
      id: 'nonRgp-5to15kw',
      label: 'Non-RGP commercial (connected load 5–15 kW)',
      applicability: 'Premises not covered by any other LT category, 5 kW to 15 kW.',
      usesSanctionedLoad: true,
      charges: [
        { kind: 'perUnit', id: 'energy', label: 'Energy charges', default: 4.6 },
        { kind: 'perKwPerMonth', id: 'fixed', label: 'Fixed charges', default: 90 },
        ...torrentFppas(),
        torrentDuty(20),
      ],
    },
    {
      id: 'rgp-single-phase',
      label: 'RGP residential (single phase)',
      applicability:
        'Residential premises, and common services up to 15 kW like lifts, water pumps and passage lighting.',
      usesSanctionedLoad: false,
      charges: [
        {
          kind: 'slabPerUnit',
          id: 'energy',
          label: 'Energy charges',
          slabs: [
            { widthPerMonth: 50, default: 3.2 },
            { widthPerMonth: 150, default: 3.95 },
            { default: 5.0 },
          ],
          hint: 'First 50 units/month, next 150, then the rest.',
        },
        {
          kind: 'perInstallationPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 25,
          hint: 'Per installation, not per kW. ₹5/month for BPL households.',
        },
        ...torrentFppas(),
        torrentDuty(15),
      ],
    },
    {
      id: 'rgp-three-phase',
      label: 'RGP residential (three phase)',
      applicability: 'As RGP single phase, three-phase supply.',
      usesSanctionedLoad: false,
      charges: [
        {
          kind: 'slabPerUnit',
          id: 'energy',
          label: 'Energy charges',
          slabs: [
            { widthPerMonth: 50, default: 3.2 },
            { widthPerMonth: 150, default: 3.95 },
            { default: 5.0 },
          ],
        },
        {
          kind: 'perInstallationPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 65,
        },
        ...torrentFppas(),
        torrentDuty(15),
      ],
    },
    {
      id: 'glp',
      label: 'GLP charitable (single phase)',
      applicability:
        'Non-residential premises of a Public Trust: hospitals, schools, hostels, places of worship.',
      usesSanctionedLoad: false,
      charges: [
        {
          kind: 'slabPerUnit',
          id: 'energy',
          label: 'Energy charges',
          slabs: [{ widthPerMonth: 200, default: 4.1 }, { default: 4.8 }],
        },
        {
          kind: 'perInstallationPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 30,
          hint: '₹70/month on three-phase supply.',
        },
        ...torrentFppas(),
        torrentDuty(15),
      ],
    },
    {
      id: 'ltmd2',
      label: 'LTMD-2 (above 15 kW connected load)',
      applicability:
        'LT premises above 15 kW not covered elsewhere. Non-RGP consumers may opt into this instead.',
      usesSanctionedLoad: true,
      charges: [
        {
          kind: 'perUnit',
          id: 'energy',
          label: 'Energy charges',
          default: 4.8,
          hint: '₹5.00/unit for billing demand above 50 kW.',
        },
        {
          kind: 'perKwPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 175,
          hint: 'First 50 kW. Billing demand is the highest of recorded demand, 85% of contract demand, or 6 kW.',
        },
        ...torrentFppas(),
        torrentDuty(20),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// GUVNL state discoms — UGVCL, MGVCL, PGVCL, DGVCL
// One GERC tariff schedule covers all four; only the licence area differs.
// ---------------------------------------------------------------------------

const guvnlDuty = (percent: number): ChargeTemplate => ({
  kind: 'percentOfSubtotal',
  id: 'govtDuty',
  label: 'Electricity duty',
  default: percent,
  of: ['energy', 'fixed', 'fppa'],
  hint: 'Commercial 20% · residential 15% urban. Rural and Gram Panchayat rates are lower.',
});

const guvnlFppa = (): ChargeTemplate => ({
  kind: 'perUnit',
  id: 'fppa',
  label: 'FPPPA (fuel & power purchase adjustment)',
  default: 3.2,
  hint: 'Revised quarterly. Copy the rate off this bill — the default is only a typical value.',
});

const guvnlPlans = (): TariffPlan[] => [
  {
    id: 'rgp-urban',
    label: 'RGP residential — urban',
    applicability: 'Domestic connections outside Gram Panchayat areas.',
    usesSanctionedLoad: false,
    charges: [
      {
        kind: 'slabPerUnit',
        id: 'energy',
        label: 'Energy charges',
        slabs: [
          { widthPerMonth: 50, default: 3.05 },
          { widthPerMonth: 50, default: 3.5 },
          { widthPerMonth: 150, default: 4.15 },
          { default: 5.2 },
        ],
        hint: 'Telescopic: 50 / 50 / 150 / rest, per month.',
      },
      {
        kind: 'perInstallationPerMonth',
        id: 'fixed',
        label: 'Fixed charges',
        default: 25,
        hint: 'By load band: ₹15 up to 2 kW · ₹25 for 2–4 kW · ₹45 for 4–6 kW · ₹70 above 6 kW.',
      },
      guvnlFppa(),
      guvnlDuty(15),
    ],
  },
  {
    id: 'rgp-rural',
    label: 'RGP residential — rural / Gram Panchayat',
    applicability: 'Domestic connections in Gram Panchayat areas.',
    usesSanctionedLoad: false,
    charges: [
      {
        kind: 'slabPerUnit',
        id: 'energy',
        label: 'Energy charges',
        slabs: [
          { widthPerMonth: 50, default: 2.65 },
          { widthPerMonth: 50, default: 3.1 },
          { widthPerMonth: 150, default: 3.75 },
          { default: 4.9 },
        ],
      },
      { kind: 'perInstallationPerMonth', id: 'fixed', label: 'Fixed charges', default: 15 },
      guvnlFppa(),
      guvnlDuty(7.5),
    ],
  },
  {
    id: 'nonRgp-upto10kw',
    label: 'Non-RGP commercial (up to 10 kW)',
    applicability: 'LT commercial connections up to 10 kW of contracted load.',
    usesSanctionedLoad: true,
    charges: [
      {
        kind: 'perUnit',
        id: 'energy',
        label: 'Energy charges',
        default: 4.35,
        hint: 'Prepaid connections are billed about 9 paise/unit lower.',
      },
      {
        kind: 'perKwPerMonth',
        id: 'fixed',
        label: 'Fixed charges',
        default: 50,
        hint: '₹50/kW/month for the first 10 kW, ₹85/kW for the next 30 kW.',
      },
      guvnlFppa(),
      guvnlDuty(20),
    ],
  },
  {
    id: 'nonRgp-above10kw',
    label: 'Non-RGP commercial (above 10 kW)',
    applicability: 'LT commercial connections above 10 kW of contracted load.',
    usesSanctionedLoad: true,
    charges: [
      { kind: 'perUnit', id: 'energy', label: 'Energy charges', default: 4.65 },
      { kind: 'perKwPerMonth', id: 'fixed', label: 'Fixed charges', default: 85 },
      guvnlFppa(),
      guvnlDuty(20),
    ],
  },
];

const guvnlDiscom = (
  id: string,
  name: string,
  shortName: string,
  area: string,
): ProviderProfile => ({
  id,
  name,
  shortName,
  area,
  ownership: 'state',
  regulator: 'GERC',
  confidence: 'indicative',
  source:
    'GERC combined tariff schedule for DGVCL / MGVCL / PGVCL / UGVCL w.e.f. 01.04.2026; ' +
    'rates transcribed from secondary summaries, not the order itself',
  effectiveFrom: '1 April 2026',
  notes: [
    'All four GUVNL discoms share one tariff schedule — only the licence area differs.',
    'Fuel adjustment is a single per-unit FPPPA, not the two-part FPPAS that Torrent uses.',
    'Check the rates against your bill: these came from secondary sources.',
  ],
  plans: guvnlPlans(),
});

// ---------------------------------------------------------------------------
// Out-of-state examples. Structure verified, rates indicative — they exist so
// the model is exercised by more than one billing shape.
// ---------------------------------------------------------------------------

const MSEDCL: ProviderProfile = {
  id: 'msedcl',
  name: 'MSEDCL (Mahavitaran) — Maharashtra',
  shortName: 'MSEDCL',
  area: 'Maharashtra outside Mumbai city',
  ownership: 'state',
  regulator: 'MERC',
  confidence: 'indicative',
  source: 'MERC-approved LT tariff summaries for FY 2026-27',
  effectiveFrom: '1 April 2026',
  notes: [
    'Maharashtra bills wheeling charges as a separate per-unit line — Gujarat folds them into the energy rate.',
    'Electricity duty is charged on energy + wheeling + fixed + FAC.',
  ],
  plans: [
    {
      id: 'lt1-residential',
      label: 'LT-I residential (single phase)',
      applicability: 'Domestic LT connections.',
      usesSanctionedLoad: false,
      charges: [
        {
          kind: 'slabPerUnit',
          id: 'energy',
          label: 'Energy charges',
          slabs: [
            { widthPerMonth: 100, default: 5.56 },
            { widthPerMonth: 200, default: 12.4 },
            { widthPerMonth: 200, default: 16.64 },
            { default: 19.13 },
          ],
        },
        { kind: 'perUnit', id: 'wheeling', label: 'Wheeling charges', default: 1.35 },
        {
          kind: 'perInstallationPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 135,
          hint: '₹435/month on three-phase supply.',
        },
        {
          kind: 'perUnit',
          id: 'fac',
          label: 'Fuel adjustment charge (FAC)',
          default: 0.55,
          hint: 'Revised monthly; can be negative.',
        },
        {
          kind: 'percentOfSubtotal',
          id: 'govtDuty',
          label: 'Electricity duty',
          default: 16,
          of: ['energy', 'wheeling', 'fixed', 'fac'],
        },
      ],
    },
  ],
};

const BSES_DELHI: ProviderProfile = {
  id: 'bses-delhi',
  name: 'BSES Rajdhani / Yamuna — Delhi',
  shortName: 'BSES Delhi',
  area: 'South, West, Central and East Delhi',
  ownership: 'private',
  regulator: 'DERC',
  confidence: 'indicative',
  source: 'DERC tariff summaries for FY 2026-27',
  effectiveFrom: '1 April 2026',
  notes: [
    'Delhi bills fuel adjustment as a PERCENTAGE (PPAC) rather than a per-unit rate.',
    'A pension-trust surcharge rides on the same subtotal as PPAC.',
    'The Delhi government subsidy for the first 200 units is opt-in and is not modelled — enter it as a credit under "Other debit / credit".',
  ],
  plans: [
    {
      id: 'domestic',
      label: 'Domestic',
      applicability: 'Domestic LT connections.',
      usesSanctionedLoad: true,
      charges: [
        {
          kind: 'slabPerUnit',
          id: 'energy',
          label: 'Energy charges',
          slabs: [
            { widthPerMonth: 200, default: 3.0 },
            { widthPerMonth: 200, default: 4.5 },
            { widthPerMonth: 200, default: 6.5 },
            { widthPerMonth: 200, default: 7.0 },
            { default: 8.0 },
          ],
        },
        {
          kind: 'perKwPerMonth',
          id: 'fixed',
          label: 'Fixed charges',
          default: 50,
          hint: 'By sanctioned load band: roughly ₹20/kW up to 2 kW, ₹50/kW for 2–5 kW, ₹100/kW for 5–15 kW.',
        },
        {
          kind: 'percentOfSubtotal',
          id: 'ppac',
          label: 'PPAC',
          default: 35.83,
          of: ['energy', 'fixed'],
        },
        {
          kind: 'percentOfSubtotal',
          id: 'pension',
          label: 'Pension trust surcharge',
          default: 7.5,
          of: ['energy', 'fixed'],
        },
        {
          kind: 'percentOfSubtotal',
          id: 'govtDuty',
          label: 'Electricity tax',
          default: 5,
          of: ['energy', 'fixed', 'ppac', 'pension'],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Escape hatch: any utility not listed.
// ---------------------------------------------------------------------------

const CUSTOM: ProviderProfile = {
  id: 'custom',
  name: 'Other / custom utility',
  shortName: 'Custom',
  area: 'anywhere',
  ownership: 'state',
  regulator: '—',
  confidence: 'verified',
  source: 'Whatever is printed on your bill.',
  effectiveFrom: '—',
  notes: [
    'Nothing is pre-filled. Type each line item off your bill, then use the printed-payable cross-check to confirm you got it right.',
    'If a line item does not exist on your bill, leave its rate at 0 and it disappears from the split.',
  ],
  plans: [
    {
      id: 'generic',
      label: 'Generic stack (energy → fixed → surcharges → duty)',
      applicability: 'Most Indian LT bills fit this shape.',
      usesSanctionedLoad: true,
      charges: [
        { kind: 'perUnit', id: 'energy', label: 'Energy charges', default: 0 },
        { kind: 'perKwPerMonth', id: 'fixed', label: 'Fixed charges', default: 0 },
        {
          kind: 'perUnit',
          id: 'surchargePerUnit',
          label: 'Per-unit surcharge (fuel / wheeling)',
          default: 0,
        },
        {
          kind: 'percentOfSubtotal',
          id: 'surchargePercent',
          label: 'Percentage surcharge',
          default: 0,
          of: ['energy', 'fixed', 'surchargePerUnit'],
        },
        {
          kind: 'percentOfSubtotal',
          id: 'govtDuty',
          label: 'Electricity duty / tax',
          default: 0,
          of: ['energy', 'fixed', 'surchargePerUnit', 'surchargePercent'],
        },
      ],
    },
    {
      id: 'total-only',
      label: 'I only know the total — enter the total',
      applicability:
        'The itemised bill is gone and only the amount survives. Common for past cycles.',
      usesSanctionedLoad: false,
      charges: [
        {
          kind: 'flat',
          id: 'billTotal',
          label: 'Bill total as printed (₹)',
          default: 0,
          hint:
            'Exact: every charge is shared by the same consumption ratio (D-01), so the ' +
            'split of a total never depends on how that total was made up.',
        },
      ],
    },
    {
      id: 'blended',
      label: 'I only know the total — blended rate',
      applicability:
        'No itemised tariff to hand. Divide the bill total by the units and enter that as the rate.',
      usesSanctionedLoad: false,
      charges: [
        {
          kind: 'perUnit',
          id: 'energy',
          label: 'Blended rate',
          default: 0,
          hint: 'Bill total ÷ official units. Every household then pays the same average rate.',
        },
      ],
    },
  ],
};

export const PROVIDERS: ProviderProfile[] = [
  TORRENT_AHMEDABAD,
  guvnlDiscom('ugvcl', 'UGVCL — Uttar Gujarat Vij Company', 'UGVCL', 'North Gujarat: Mehsana, Palanpur, Himatnagar, Gandhinagar district'),
  guvnlDiscom('mgvcl', 'MGVCL — Madhya Gujarat Vij Company', 'MGVCL', 'Central Gujarat: Vadodara, Anand, Nadiad, Godhra'),
  guvnlDiscom('pgvcl', 'PGVCL — Paschim Gujarat Vij Company', 'PGVCL', 'Saurashtra & Kutch: Rajkot, Bhuj, Jamnagar, Junagadh'),
  guvnlDiscom('dgvcl', 'DGVCL — Dakshin Gujarat Vij Company', 'DGVCL', 'South Gujarat: Valsad, Navsari, Bharuch, Surat district'),
  MSEDCL,
  BSES_DELHI,
  CUSTOM,
];

export const DEFAULT_PROVIDER_ID = 'torrent-ahmedabad';
export const DEFAULT_PLAN_ID = 'nonRgp-upto5kw';

export function findProvider(id: string): ProviderProfile {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function findPlan(provider: ProviderProfile, id: string): TariffPlan {
  return provider.plans.find((p) => p.id === id) ?? provider.plans[0];
}
