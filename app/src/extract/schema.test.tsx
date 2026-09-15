// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultRates } from '../engine/providers/build';
import { PROVIDERS } from '../engine/providers/registry';
import type { ProviderProfile, TariffPlan } from '../engine/providers/types';
import { BillForm } from '../ui/BillForm';
import { blankBill, withPlan, type BillFields } from '../ui/formState';
import {
  DOCUMENT_KEY,
  SCALAR_FIELDS,
  billFieldsSchema,
  schemaRateKeys,
  type JsonSchema,
} from './schema';

/**
 * E0.1's checkpoint (D-21): the generated schema's rate properties are exactly
 * the keys `BillForm` renders for that plan — for EVERY plan in the registry,
 * not just Torrent's. If a new provider needs a second edit to be extractable,
 * this fails.
 *
 * "The keys BillForm renders" is established by rendering it and typing into
 * every rate field, which is the only definition that cannot drift.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** React reads the value off the node's own property, so bypass its setter. */
function type(el: HTMLInputElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el) as object,
    'value',
  )?.set;
  setter?.call(el, next);
  act(() => el.dispatchEvent(new Event('input', { bubbles: true })));
}

/**
 * Every `rates` key the rendered form writes to: type into each input in turn
 * and see which key of the emitted `BillFields` moved.
 */
function renderedRateKeys(provider: ProviderProfile, plan: TariffPlan): string[] {
  const value = withPlan(blankBill(), provider.id, plan.id);
  const emitted: BillFields[] = [];
  act(() => root.render(<BillForm value={value} onChange={(next) => emitted.push(next)} />));

  const keys: string[] = [];
  for (const input of container.querySelectorAll('input')) {
    emitted.length = 0;
    type(input, '123.45');
    for (const next of emitted) {
      for (const [k, v] of Object.entries(next.rates)) {
        if (v === '123.45' && value.rates[k] !== '123.45' && !keys.includes(k)) keys.push(k);
      }
    }
  }
  return keys;
}

const props = (s: JsonSchema | undefined): Record<string, JsonSchema> => s?.properties ?? {};

describe('generated extraction schema', () => {
  for (const provider of PROVIDERS) {
    for (const plan of provider.plans) {
      describe(`${provider.shortName} — ${plan.label}`, () => {
        it('has exactly the rate properties the form renders', () => {
          const schema = billFieldsSchema(provider, plan);
          expect(Object.keys(props(props(schema).rates)).sort()).toEqual(
            renderedRateKeys(provider, plan).sort(),
          );
        });

        it('has exactly the rate keys the engine builds the bill from', () => {
          // `defaultRates` is what `ratesFor` seeds form state with and what
          // `buildBill` looks each charge up by — the other end of the same rule.
          expect(schemaRateKeys(plan).sort()).toEqual(Object.keys(defaultRates(plan)).sort());
        });

        it('is a closed object of strings, every property required', () => {
          const schema = billFieldsSchema(provider, plan);
          const check = (s: JsonSchema) => {
            expect(s.type).toBe('object');
            expect(s.additionalProperties).toBe(false);
            expect(s.required?.slice().sort()).toEqual(Object.keys(props(s)).sort());
            for (const child of Object.values(props(s))) {
              if (child.type === 'object') check(child);
              else expect(child.type).toBe('string');
            }
            // Descriptions are what the model reads; an undescribed field is
            // a field it has to guess at.
            for (const child of Object.values(props(s))) {
              expect(child.description?.length ?? 0).toBeGreaterThan(0);
            }
          };
          check(schema);
        });

        it('asks for every scalar field and nothing the bill does not print', () => {
          const scalars = Object.keys(props(billFieldsSchema(provider, plan))).filter(
            (k) => k !== 'rates' && k !== DOCUMENT_KEY,
          );
          expect(scalars).toEqual(SCALAR_FIELDS.map((f) => f.key));
          // The owner chose these before uploading; the sub-meters are not on
          // the utility's bill at all.
          for (const absent of [
            'providerId',
            'planId',
            'submeterPriorDate',
            'submeterPreviousDate',
            'submeterReadingDate',
          ]) {
            expect(scalars).not.toContain(absent);
          }
        });

        it('carries the document meta object, which is not a form field', () => {
          // Added in E1.3: `wrong-provider` needs a fact off the page to compare
          // against, and the candidate alone does not carry one. It is deliberately
          // OUTSIDE the scalar half, because it must never reach `BillFields`.
          const meta = props(billFieldsSchema(provider, plan))[DOCUMENT_KEY];
          expect(Object.keys(props(meta))).toEqual(['utility']);
          expect(schemaRateKeys(plan)).not.toContain(DOCUMENT_KEY);
        });
      });
    }
  }

  it('covers every plan in the registry', () => {
    expect(PROVIDERS.flatMap((p) => p.plans).length).toBeGreaterThan(1);
  });
});
