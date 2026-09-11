# The Complete Design System Reference Guide

> **Purpose:** A reusable checklist + reference doc. Whenever you start a new project, copy this file, work through it top to bottom, and fill in the blanks. Sections are ordered roughly in the order you'd actually define them (strategy → identity → foundations → tokens → components → governance).

---

## How to use this guide

1. **Don't try to fill in everything at once.** A 2-person startup needs Sections 1–5 + a lightweight version of 10. A product team shipping a multi-platform app eventually needs all 13.
2. **Foundational work (audit → tokens → core components → docs) typically takes 2–4 months** for a first version. A design system is never "done" — treat it as a living product with its own owner and changelog, not a one-time deliverable.
3. Work in layers: **Style guide** (colors, type, logo — the visual fundamentals) → **Design system** (adds tokens, components, code, documentation, governance on top).

---

## 1. Brand Foundations (do this first)

Everything downstream — color, type, tone — should be a *decision made because of this section*, not a default.

- [ ] **Purpose / mission** — why does this product or brand exist?
- [ ] **Vision** — what does success look like in 3–5 years?
- [ ] **Core values** — 3–5 words that should be legible in every design decision
- [ ] **Brand personality** — pick 3–5 adjectives (e.g. "precise, warm, unshowy") and, importantly, write down what they *rule out* too (e.g. "warm, not cute")
- [ ] **Target audience / user personas** — who is this for, what do they already expect from similar products?
- [ ] **Positioning statement** — one sentence: for [audience], [product] is the [category] that [key differentiator]
- [ ] **Competitive scan** — 3–5 competitor or adjacent brands, and one line on how you intentionally differ visually

---

## 2. Logo & Brand Mark System

### 2.1 Logo construction types
Choose which category (or categories) your mark falls into — this is about *style*, separate from the variants below:

| Type | Description | Example |
|---|---|---|
| Wordmark | Brand name only, custom typography | Google, Coca-Cola |
| Lettermark / Monogram | Initials instead of full name | HBO, NASA |
| Brandmark / Symbol | Icon with no text | Apple, Nike swoosh |
| Combination mark | Text + symbol together | Adidas, Burger King |
| Emblem | Text inside a badge/shape | Starbucks, Harley-Davidson |

### 2.2 Required variant set
A professional identity needs **four coordinated marks**, each saved as vector (SVG/AI/EPS):

- [ ] **Primary logo** — the full lockup, used whenever there's room. Most detailed version (may include tagline).
- [ ] **Secondary logo** — a reshaped alternate (e.g. stacked vs. horizontal) for spaces the primary doesn't fit — wide banners, narrow columns.
- [ ] **Submark / brandmark** — a compact icon, monogram, or badge for small or square spaces: social avatars, watermarks, merch.
- [ ] **Favicon / app icon** — the simplest reduction, legible at 16×16 px. Usually the submark simplified further, or just initials.

### 2.3 Color variants (needed for every mark above)
- [ ] Full color (primary, on light background)
- [ ] Full color (on dark/brand-color background)
- [ ] Single color / black
- [ ] Reversed / white (for dark or photographic backgrounds)
- [ ] Grayscale (for print or restricted-color contexts)

### 2.4 Usage rules to document
- [ ] **Clear space** — minimum padding around the mark, usually defined as a multiple of a feature of the logo itself (e.g. "1x the height of the icon")
- [ ] **Minimum size** — smallest size the mark stays legible at (print and digital)
- [ ] **Incorrect usage examples** — don't stretch, recolor, rotate, add drop shadows, place on low-contrast backgrounds, or recreate in a different font
- [ ] **Backgrounds** — approved background colors/images for each variant
- [ ] **Co-branding / lockup rules** — spacing and hierarchy when paired with a partner logo

### 2.5 File deliverables
`.svg` (web), `.eps`/`.ai` (print/vector master), `.png` (transparent, for quick use), `.pdf`. Naming convention example: `brand-logo_primary_fullcolor.svg`, `brand-logo_submark_white.svg`.

---

## 3. Color System

### 3.1 Palette structure
Four functional categories — keep them conceptually separate even if some colors are shared:

| Category | Purpose | Typical count |
|---|---|---|
| Primary | Core brand color(s), main identity carrier | 1–2 |
| Secondary | Supporting/complementary brand colors | 1–3 |
| Neutrals | Backgrounds, text, borders, dividers | 6–10 step grayscale |
| Semantic | Communicate state: success, error, warning, info | 4 (min), each with its own tint/shade steps |

**Rule of thumb:** active color use in any single screen should draw from only 2–3 hues at once — more creates visual competition. Keep semantic colors (red=error, green=success) fully separate from brand hues — if your brand color is also red, users can't tell "on-brand" from "something's wrong."

### 3.2 Tints & shades
Generate a 9–11 step scale per color (commonly labeled 50–900 or 100–900):
- Light steps (50–300): backgrounds, subtle fills, hover states on light UI
- Mid steps (400–600): borders, icons, secondary UI
- Dark steps (700–900): primary buttons/text — the 700 weight is commonly the accessible base for UI elements on light backgrounds

### 3.3 Semantic color roles to define (minimum set)
- [ ] `surface/default`, `surface/elevated` (modals, dropdowns, tooltips)
- [ ] `text/primary`, `text/secondary`, `text/disabled` — never pure black; use near-black (e.g. `#0F172A`) for better typographic color
- [ ] `border/default`, `border/focus`
- [ ] `interactive/default`, `interactive/hover`, `interactive/active`, `interactive/disabled`
- [ ] `feedback/success`, `feedback/error`, `feedback/warning`, `feedback/info`

### 3.4 Distribution
The classic **60-30-10 rule**: 60% dominant/neutral (backgrounds, surfaces), 30% secondary (cards, sidebars), 10% accent (CTAs, active states). Keeping accent color to ~10% of the UI preserves its signal value.

### 3.5 Accessibility (WCAG)
- [ ] Body text ≥ **4.5:1** contrast ratio against its background (AA)
- [ ] Large text / bold headings ≥ **3:1**
- [ ] Aim for **7:1** (AAA) on primary text where feasible
- [ ] Never use color as the *only* signal for meaning — pair with icon/label/pattern too
- [ ] Check form labels, placeholder text, disabled states, and icons — these are the most commonly-missed low-contrast spots
- [ ] Test against **both** light and dark theme surfaces if you support dark mode

### 3.6 Format specs to document per color
Hex, RGB, HSL (for screen), CMYK and Pantone/spot color (for print), plus the token name (see Section 8).

---

## 4. Typography

### 4.1 Typeface roles
Define 2–3 type roles, not one font for everything:
- **Display/heading face** — carries personality, used with restraint
- **Body face** — optimized for on-screen readability at small sizes
- **Mono/utility face** — for code, data, timestamps, captions (optional but common in product UI)

Pairing principle: contrast supports hierarchy — e.g. a characterful serif or display face for headlines against a clean, neutral sans for body copy — but don't pick fonts you'd reach for on *any* project; ground the choice in the brand personality from Section 1.

### 4.2 Type scale ("type ramp")
A predefined set of 6–12 sizes so nobody invents a one-off size. Example using a 1.125 (minor third) ratio off a 16px base:

| Level | Size | Weight | Line height | Use |
|---|---|---|---|---|
| Display | 48px | Bold | 1.1 | Hero headlines |
| H1 | 38px | Bold | 1.15 | Page titles |
| H2 | 32px | Semibold | 1.2 | Section headers |
| H3 | 28px | Semibold | 1.25 | Subsections |
| H4 | 24px | Semibold | 1.3 | Card/component titles |
| Body Large | 18px | Regular | 1.5 | Intro paragraphs |
| Body | 16px | Regular | 1.6 | Default paragraph text |
| Small | 14px | Regular | 1.5 | Captions, metadata |
| Micro | 12px | Medium | 1.4 | Labels, badges, legal |

- [ ] Discipline: if the ramp doesn't have the size you need, that's a signal to reconsider the layout — not to invent a bespoke size.
- [ ] Define letter-spacing per level (tighter tracking on large display sizes is common)
- [ ] Define responsive/fluid behavior — does type scale down at mobile breakpoints, and by how much?
- [ ] Define a **web-safe fallback stack** for each role (e.g. `"Inter", -apple-system, "Segoe UI", sans-serif`)
- [ ] Minimum accessible body size: 16px equivalent for primary reading content

---

## 5. Iconography

- [ ] **Style**: outline / filled / duotone / two-tone — pick one and don't mix
- [ ] **Grid**: base size (commonly 24×24px) and keyline shapes icons must align to, so all icons feel the same visual weight
- [ ] **Stroke weight**: consistent px value (e.g. 1.5px or 2px strokes)
- [ ] **Corner radius**: consistent rounding to match the brand's shape language
- [ ] **Naming convention**: `icon-{name}-{variant}.svg` (e.g. `icon-arrow-right-filled.svg`)
- [ ] **Source/library**: custom set vs. an established library (Lucide, Phosphor, Material Symbols) as a base to extend
- [ ] **Sizes provided**: e.g. 16/20/24/32px exports, or a single scalable SVG source

---

## 6. Imagery & Illustration

- [ ] **Photography style** — lighting, color grading, subject framing, do/don't examples
- [ ] **Illustration style** — flat / isometric / hand-drawn / 3D; consistent color palette drawn from Section 3
- [ ] **Image treatment** — overlays, duotones, crop ratios, corner radius on images
- [ ] **Data visualization style** — chart color order, gridline treatment, label typography (should reuse tokens from Sections 3 & 4, not invent new colors)
- [ ] **Alt text / accessibility standard** for imagery

---

## 7. Layout, Spacing & Grid

- [ ] **Spacing scale** — a base unit (4px or 8px) with a defined step scale (4, 8, 12, 16, 24, 32, 48, 64...). All margins/padding should pull from this scale, not arbitrary values.
- [ ] **Grid system** — column count (e.g. 12-col), gutter width, margin, per breakpoint
- [ ] **Breakpoints** — e.g. mobile 0–599px, tablet 600–1023px, desktop 1024px+
- [ ] **Border radius scale** — e.g. `sm: 4px, md: 8px, lg: 16px, full: 9999px`
- [ ] **Elevation/shadow scale** — a small set of shadow tokens (e.g. `elevation-1` through `elevation-4`) for cards, modals, dropdowns
- [ ] **Z-index scale** — named layers (`z-dropdown`, `z-modal`, `z-toast`) so stacking conflicts don't get solved with random large numbers

---

## 8. Design Tokens

Tokens are the layer that makes everything above *implementable and updatable in one place* — change the token, every component that references it updates.

### 8.1 Naming convention (recommended pattern)
`category.property.variant.state` → e.g. `color.button.primary.hover`, `space.card.padding.md`

### 8.2 Token layers (best practice: 2–3 layers, not flat values)
1. **Core/primitive tokens** — raw values: `blue-500 = #3B82F6`
2. **Semantic tokens** — purpose-named, reference core tokens: `color.interactive.brand = {blue-500}`
3. **Component tokens** (optional) — reference semantic tokens: `button.background.primary = {color.interactive.brand}`

This separation means a brand color change only requires editing the core token — every semantic and component token downstream updates automatically.

### 8.3 Token categories to define
- [ ] Color — [ ] Typography (family/size/weight/line-height/letter-spacing) — [ ] Spacing — [ ] Sizing — [ ] Border radius — [ ] Shadow/elevation — [ ] Motion (duration/easing) — [ ] Z-index — [ ] Breakpoints

### 8.4 Tooling
Figma Variables (design side) + Style Dictionary or Tokens Studio (to export tokens to CSS/JSON/Swift/Android XML) keeps design and code as a single source of truth — misalignment between a Figma-only system and a code-only system is one of the most common causes of inconsistent output, especially when AI tools are generating UI code from the system.

---

## 9. Motion & Animation

- [ ] **Duration scale** — e.g. `fast: 100ms, base: 200ms, slow: 400ms`
- [ ] **Easing curves** — named, e.g. `ease-out` for entrances, `ease-in` for exits, a custom brand curve for signature moments
- [ ] **Principles** — motion should clarify (show where something came from/went to), not decorate; prefer one orchestrated moment over scattered micro-animations everywhere
- [ ] **Reduced motion** — respect `prefers-reduced-motion`; define a reduced/no-motion fallback for every meaningful animation

---

## 10. Component Library

### 10.1 Structure (atomic design is the common mental model)
**Atoms** (button, input, label, icon) → **Molecules** (form field = label + input + error text) → **Organisms** (a full form, a nav bar, a card grid)

### 10.2 What every component's spec needs
A component isn't just a visual — it's a contract between design and code. For each one, define:
- [ ] **Visual spec** — dimensions, colors, typography, spacing, all referencing tokens (never raw hex/px)
- [ ] **All states** — default, hover, active, focused, disabled, loading, error
- [ ] **Variants** — size (sm/md/lg), emphasis (primary/secondary/tertiary/ghost), context-specific versions
- [ ] **Accessibility spec** — ARIA role, keyboard behavior, focus order, screen-reader labeling, contrast check
- [ ] **Usage guidance** — when to use it, when *not* to, content/copy guidelines, do/don't examples
- [ ] **Responsive behavior** — how it adapts across breakpoints

Well-specified components with full state coverage measurably reduce UI bugs compared to loosely-defined ones — the states/accessibility fields above aren't optional extras.

### 10.3 Common core component checklist
Buttons · Inputs (text, select, checkbox, radio, toggle, textarea) · Form field/validation pattern · Navigation (top nav, sidebar, tabs, breadcrumbs) · Cards · Modals/dialogs · Tooltips/popovers · Toasts/alerts/banners · Tables · Pagination · Badges/tags · Avatars · Accordion · Loading states (spinners, skeletons) · Empty states

---

## 11. Voice & Tone / Content Guidelines

- [ ] **Voice attributes** — 3–5 traits (from Section 1), with a "this, not that" example for each
- [ ] **Tone shifts by context** — e.g. more playful in onboarding, more neutral/precise in billing or error flows
- [ ] **Writing principles**:
  - Name things by what people control, not by system internals (a person "manages notifications," not "webhook config")
  - Default to active voice: a button says exactly what happens ("Save changes," not "Submit")
  - Keep vocabulary consistent through a flow — the button that says "Publish" produces a toast that says "Published," not "Success"
  - Errors state what happened and how to fix it, without apologizing or being vague
  - Empty states are an invitation to act, not just an absence
- [ ] **Mechanics** — capitalization rules (sentence case vs. title case), punctuation, number formatting, date/time formatting
- [ ] **Terminology glossary** — approved product terms vs. banned synonyms, so the same thing is never called two different names

---

## 12. Accessibility Standards

- [ ] Target compliance level stated explicitly (usually **WCAG 2.2 AA**)
- [ ] Color contrast rules (see 3.5) baked into tokens, not left to individual judgment
- [ ] Visible keyboard focus states on every interactive element
- [ ] Full keyboard navigability (no mouse-only interactions)
- [ ] Screen reader support — semantic HTML/ARIA roles specified per component
- [ ] Reduced motion respected (see Section 9)
- [ ] Touch target minimum size (commonly 44×44px)
- [ ] Responsive down to mobile without loss of function

---

## 13. Governance & Documentation

A design system is only as strong as its documentation, and it needs an owner — otherwise it drifts out of sync with the product.

- [ ] **Single source of truth** — decide if design (Figma) or code is canonical, and keep the other in sync; a code-first system is easier for AI coding tools to consume correctly
- [ ] **Versioning** — semantic versioning + a changelog; every component/token change should trigger a documentation update, ideally enforced via CI/PR checklist so builds are blocked without it
- [ ] **Ownership model** — who can propose changes, who approves, how often is it reviewed
- [ ] **Contribution guidelines** — how a product team requests a new component or variant
- [ ] **"Last updated" + changelog link** on every doc page
- [ ] **Documentation content per component**: usage guidance, do/don't visual examples, accessibility notes, code snippets, rationale (not just "what," but "why")
- [ ] **Tooling stack** — e.g. Figma (design) + Storybook (component sandbox) + Style Dictionary (token pipeline) + a docs site (Zeroheight, Backstage, or custom)

---

## Quick-Start Checklist (condensed)

Use this as the fast pass before diving into the full sections above:

- [ ] Brand purpose, values, and 3–5 personality adjectives defined
- [ ] Primary + secondary + submark + favicon logo, each in 4 color variants
- [ ] Color palette: primary, secondary, 6–10 step neutral scale, 4 semantic colors — all WCAG AA checked
- [ ] Type roles chosen (display/body/mono) + a documented 6–9 step type scale
- [ ] Icon style + grid size decided
- [ ] Spacing scale (4 or 8px base) + border radius scale + shadow scale
- [ ] Design tokens set up (core → semantic → component layers) with a naming convention
- [ ] Core component set specced with all states, variants, and accessibility notes
- [ ] Voice & tone principles + a terminology glossary
- [ ] Documentation site/location + an owner + a versioning process

---

## Reference Examples Worth Studying
When in doubt, look at how a mature system solves the problem you're stuck on:
- **IBM Carbon** — code-first, strong accessibility documentation
- **Atlassian Design System** — excellent component usage guidance and content standards
- **Material Design (Google)** — thorough color/token architecture
- **Shopify Polaris** — strong content/voice guidelines
- **Salesforce Lightning / Microsoft Fluent** — enterprise-scale governance models

---

*Template note: duplicate this file per project, fill in the checkboxes and tables with your actual values (hex codes, font names, token names), and keep it versioned alongside your design files.*
