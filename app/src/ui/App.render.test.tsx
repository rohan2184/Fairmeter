// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

/**
 * Smoke test: mount the real app in jsdom and drive it the way a person would.
 * Catches crash-on-mount, bad hooks and undefined access — the failures a
 * typecheck cannot see.
 */

let container: HTMLDivElement;
let root: Root;
const errors: unknown[] = [];

beforeEach(() => {
  // Tells React this is an act()-aware environment; without it every render
  // logs a warning that has nothing to do with the app.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no layout, so scrollTo is unimplemented and noisy.
  window.scrollTo = () => {};

  errors.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args[0]));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

const mount = () => act(() => root.render(<App />));
const text = () => container.textContent ?? '';
const buttonBy = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
const click = (label: string) => {
  const b = buttonBy(label);
  if (!b) throw new Error(`No button matching "${label}". Buttons: ${
    [...container.querySelectorAll('button')].map((x) => x.textContent).join(' | ')}`);
  act(() => b.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

describe('App renders and works in a browser environment', () => {
  it('mounts without crashing or logging a React error', () => {
    mount();
    expect(text()).toContain('Fairmeter');
    expectNoErrors();
  });

  it('shows validation issues on an empty form instead of a result', () => {
    mount();
    expect(text()).toContain('Before this can be calculated');
  });

  it('computes the real bill end to end when the sample is loaded', () => {
    mount();
    click('Fill with the sample bill');

    // Default households: unmetered "Owner" + metered "Tenant 1" with no readings
    // => tenant 0 units, owner 161. That is valid, so a result must appear.
    expect(text()).toContain('The split');
    expect(text()).toContain('1,860.00');
    expect(text()).toContain('exactly the bill total');
    expectNoErrors();
  });

  it('recomputes when a sub-meter reading is typed in', () => {
    mount();
    click('Fill with the sample bill');

    const readings = [...container.querySelectorAll('.readings input')] as HTMLInputElement[];
    expect(readings.length).toBeGreaterThanOrEqual(2);
    setValue(readings[0], '1000'); // previous
    setValue(readings[1], '1081'); // present => 81 units

    expect(text()).toContain('exactly the bill total');
    // owner keeps 80 of the 161 units
    expect(text()).toMatch(/80/);
    expectNoErrors();
  });

  it('adds and removes households', () => {
    mount();
    click('Fill with the sample bill');
    const before = container.querySelectorAll('.household').length;
    click('+ Add household with sub-meter');
    expect(container.querySelectorAll('.household').length).toBe(before + 1);
    click('Remove');
    expect(container.querySelectorAll('.household').length).toBe(before);
    expectNoErrors();
  });

  it('blocks a second unmetered household in the UI', () => {
    mount();
    expect(buttonBy('+ Add unmetered household')?.disabled).toBe(true);
  });

  it('offers provider profiles and re-shapes the rate fields on switching plan', () => {
    mount();
    const selects = [...container.querySelectorAll('select')] as HTMLSelectElement[];
    const [providerSelect, planSelect] = selects;

    expect([...providerSelect.options].map((o) => o.value)).toContain('ugvcl');
    expect(text()).toContain('Non-RGP commercial');

    // Torrent RGP is slabbed and has no per-kW fixed charge; the form must follow.
    setSelect(planSelect, 'rgp-single-phase');
    expect(text()).toContain('First 50 units/month');
    expect(text()).not.toContain('Sanctioned load');

    // A state discom uses a single per-unit FPPPA instead of Torrent's two-part FPPAS.
    setSelect(providerSelect, 'ugvcl');
    expect(text()).toContain('FPPPA');
    expect(text()).toContain('Indicative rates');
    expectNoErrors();
  });

  it('shares a common meter across households instead of dumping it on one', () => {
    mount();
    click('Fill with the sample bill');
    click('+ Add shared meter');

    const shared = [...container.querySelectorAll('.card')]
      .find((c) => c.textContent?.includes('Shared meters'))!
      .querySelectorAll('.readings input') as NodeListOf<HTMLInputElement>;
    setValue(shared[0], '100');
    setValue(shared[1], '111'); // 11 units of pump

    expect(text()).toContain('Motor / water pump 11 units');
    expect(text()).toContain('exactly the bill total');
    expectNoErrors();
  });

  it('saves a cycle to history and rolls readings forward', () => {
    mount();
    click('Fill with the sample bill');
    click('Save this cycle');

    expect(text()).toContain('July 2026');
    expect(text()).toContain('Saved ✓');

    click('Start next cycle');
    const official = container.querySelector<HTMLInputElement>('input[value="1936"]');
    expect(official).not.toBeNull(); // last cycle's present reading became previous
    expectNoErrors();
  });

  it('stars only the fields that actually block a calculation', () => {
    mount();
    const required = () =>
      [...container.querySelectorAll('[aria-required="true"]')].map(
        (el) => el.closest('.field')?.querySelector('.field-label')?.textContent ?? '?',
      );

    // Torrent Non-RGP has a per-kW fixed charge, so the load is needed too.
    expect(required()).toEqual([
      'Billing months*',
      'Previous reading*',
      'Present reading*',
      'Sanctioned load (kW)*',
    ]);

    // The slabbed residential plan has no per-kW charge, so that star goes away
    // along with the field — and the fold stops advertising one.
    setSelect([...container.querySelectorAll('select')][1] as HTMLSelectElement, 'rgp-single-phase');
    expect(required()).toEqual(['Billing months*', 'Previous reading*', 'Present reading*']);
    expectNoErrors();
  });

  it('pins the theme to an attribute on the root, and lets go of it again', () => {
    mount();
    const pressed = () =>
      container.querySelector('.theme-toggle .segment[aria-pressed="true"]')?.textContent;
    const attr = () => document.documentElement.getAttribute('data-theme');

    // System is the default, and it must write nothing: the stylesheet's
    // prefers-color-scheme block is what decides.
    expect(pressed()).toBe('System');
    expect(attr()).toBeNull();

    click('Dark');
    expect(attr()).toBe('dark');
    expect(localStorage.getItem('fairmeter:theme')).toBe('dark');

    click('Light');
    expect(attr()).toBe('light');

    click('System');
    expect(attr()).toBeNull();
    expect(localStorage.getItem('fairmeter:theme')).toBe('system');
    expectNoErrors();
  });

  it('restores a pinned theme from storage on the next visit', () => {
    localStorage.setItem('fairmeter:theme', 'dark');
    mount();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(
      container.querySelector('.theme-toggle .segment[aria-pressed="true"]')?.textContent,
    ).toBe('Dark');
    expectNoErrors();
  });

  it('lines the sub-meters up with the bill window when the dates disagree (D-13)', () => {
    mount();
    click('Fill with the sample bill');

    // Bill: 21 May -> 21 Jul, 61 days. Sub-meters: 1 Jun -> 5 Aug, 65 days.
    const dates = [...container.querySelectorAll('input[type="date"]')] as HTMLInputElement[];
    expect(dates).toHaveLength(4);
    setValue(dates[0], '2026-05-21');
    setValue(dates[1], '2026-07-21');
    setValue(dates[2], '2026-06-01');
    setValue(dates[3], '2026-08-05');

    expect(text()).toContain("65 days against the bill's 61");

    // 130 units over 65 days is 2/day, so the bill's 61 days are worth 122.
    const readings = [...container.querySelectorAll('.readings input')] as HTMLInputElement[];
    setValue(readings[0], '1000');
    setValue(readings[1], '1130');

    expect(text()).toContain('have been moved');
    expect(text()).toContain('sub-meter read 130');
    expect(text()).toContain('exactly the bill total');
    expectNoErrors();
  });
});

/** Fails with the actual console.error text, not just a count. */
function expectNoErrors() {
  expect(errors.map((e) => String(e))).toEqual([]);
}

function setSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )!.set!;
  act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
