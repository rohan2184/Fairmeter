# Decisions Log

Tracks every policy/design decision for the Electricity Bill Share Calculator.
See [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md) for context.

Status legend: ✅ Decided · ⏳ Pending · 🔁 Revisit later

---

## ✅ Decided

### D-01 — Fixed charges are split pro-rata by units
**Status:** ✅ Decided (2026-08-15)

Fixed charges (₹70/kW/month × sanctioned load × months — ₹140.00 in the reference bill)
are apportioned in the **same ratio as consumption**, not equally per party.

**Rationale:** keeps one single ratio driving the whole bill, is trivial to explain to a
tenant, and a low-usage tenant is not penalised.
**Consequence:** a tenant with zero consumption in a cycle pays ₹0 toward the connection.
Accepted.

---

### D-02 — Account-level items are shared pro-rata
**Status:** ✅ Decided (2026-08-15)

Previous dues (₹0.23), delayed payment charges (₹30.28) and the round-down adjustment
(−₹6.29) are **rolled into the total and split by the same consumption ratio** as
everything else.

**Rationale:** owner's explicit preference — one uniform rule, no carve-outs, simplest
possible explanation.
**Consequence:** a tenant can pay a small share of a late-payment penalty they did not
cause. Accepted by the owner.
**Note:** the breakdown output must still *itemise* these lines per party so a tenant can
see exactly what they are being charged for.

---

### D-03 — Persistence: browser-local history now, backend later
**Status:** ✅ Decided (2026-08-15) · 🔁 Revisit when backend is introduced

v1 stores bill history in **browser local storage** (no login, no server). Next cycle
auto-fills each meter's *previous* reading from the last saved cycle's *present* reading.

A full backend (accounts, cross-device history, tenant records) is a **planned future
phase**, not v1.

**Implication for v1 architecture:** the calculation engine and the storage layer must be
cleanly separated from the start, so swapping local storage for an API is a drop-in
change and not a rewrite. Data must also be **exportable/importable as JSON** so nothing
is lost in the migration.

---

### D-04 — Derived consequence: the bill collapses to a single ratio
**Status:** ✅ Decided (implied by D-01 + D-02)

Because *every* component — energy, fixed, base FPPAS, FPPAS %, govt duty, arrears, DPC,
rounding — is apportioned by consumption, each party's share is:

```
share_i = (units_i / total_official_units) × final_bill_amount
```

Where `total_official_units` = official meter (present − previous) × multiplier.

This automatically satisfies the **conservation property** (all shares sum exactly to the
bill) and is slab-safe *only* for flat-rate tariffs — see P-01.

The UI must still display the **component-wise breakdown** per party (energy / fixed /
FPPAS / duty / dues / DPC), because "here's your ratio × total" is not persuasive to a
tenant, whereas an itemised table is. Same maths, better presentation.

---

### D-05 — Tariff model: hard-code Torrent now, generic internals
**Status:** ✅ Decided (2026-08-15) · supersedes P-03

The v1 **input form** exposes Torrent Power's fields directly (energy rate, fixed
charge/kW/month, base FPPAS rate, FPPAS %, govt duty %). The **engine internals** are
component-based — an ordered list of `perUnit | flat | percentOfSubtotal` charges — so
generalising to other utilities later is additive, not a rewrite.

**Rationale:** ship against the only bill that exists, without painting into a corner.

---

### D-06 — Stack: React + TypeScript + Vite
**Status:** ✅ Decided (2026-08-15) · supersedes P-04

Vite + React + TypeScript, tested with Vitest. Static build, deployable anywhere.
Money maths gets explicit types; the engine is a pure module with zero UI or storage
imports.

---

### D-07 — Outputs: all four
**Status:** ✅ Decided (2026-08-15) · supersedes P-05

1. On-screen per-party itemised breakdown table (baseline).
2. Copy-to-clipboard plain-text summary per tenant, formatted for WhatsApp.
3. Printable per-tenant statement (print stylesheet → browser "Save as PDF").
4. History view — past cycles per tenant, units and amounts over time (uses D-03 storage).

---

### D-08 — Households, not tenants; residual is structural
**Status:** ✅ Decided (2026-08-15) · resolves P-01

"Owner" and "tenant" are legal roles with no bearing on the arithmetic — a property may be
occupied entirely by tenants with an absent owner. The model is **N households**, each
either **metered** (has a sub-meter) or **unmetered** (units derived as
`official − Σ metered`). **At most one household may be unmetered** — two are
mathematically unsolvable from a single official reading, and validation rejects it.

Residual attribution therefore stops being a policy question and becomes a structural
property: the unmetered household absorbs it. When *every* household is metered, the
residual is genuine common load and a `residualPolicy` applies
(`proRata` default | `equalSplit` | `assignTo`). An absent owner who wants common load
itemised adds a household named "Common Area" and marks it unmetered.

**Rationale:** raised by the owner — a house where the owner does not live breaks
owner/tenant framing entirely, but does not break household framing.
See [`SPEC.md`](./SPEC.md) §1.

**Amended (2026-08-16):** the "large share unaccounted for" warning now fires **only when
every household is metered**. With an unmetered household the residual is that household's
consumption by definition, so a large one is the normal case — it fired on all seven
historical cycles and on every sample. A warning that is always on is a warning nobody
reads. The residual is still shown as a figure; it is just no longer flagged. The
sub-meters-exceed-the-official-meter warning is unaffected: negative residual is an
anomaly however the households are set up.

---

### D-09 — Metered shared load is its own thing, and it is shared
**Status:** ✅ Decided (2026-08-15)

A **common meter** measures load that belongs to nobody in particular: the water pump, the
porch light, the stair lighting, the lift. It is *not* a household, and its units are *not*
part of the unmetered residual.

The attribution order is now:

1. Each household's own sub-meter → its own units.
2. Common meters → measured shared units.
3. `residual = official − household meters − common meters` → the genuinely unknown part,
   which the unmetered household absorbs (D-08) or `residualPolicy` splits.
4. Common-meter units are then shared across households by a separate `commonPolicy`
   (`proRata` default | `equalSplit` | `assignTo`), weighted by each household's *own*
   units from steps 1–3.

**Rationale:** raised by the owner — the motor is on its own meter and serves everyone. The
existing spreadsheet added the motor's units to the first floor, which overcharged that
household by roughly 7–11 units a cycle. Folding it into the residual instead would have
overcharged the ground floor by the same amount. Neither is right: it is shared.

**Why a separate policy from `residualPolicy`:** a water pump tracks usage (pro-rata), a
lift or a stair light serves each household about equally (equal split). The two questions
have different right answers, so they get different switches.

**Consequence:** the unmetered household's units go *down* once a shared meter is entered,
because load that used to be invisible is now measured. That is the point.
See [`SPEC.md`](./SPEC.md) §1.

---

### D-10 — Provider profiles
**Status:** ✅ Decided (2026-08-15) · supersedes the form half of D-05

The owner picks a **provider** and a **tariff category**; the form then shows exactly the
line items that tariff has, pre-filled with the published rates. Adding a utility is a data
entry in `app/src/engine/providers/registry.ts` — nothing else in `engine/` knows a provider
exists.

A profile carries a `confidence` flag, shown in the UI:

- `verified` — transcribed from the regulator's tariff order. Torrent Ahmedabad is
  additionally reproduced to the paisa by the golden test against the reference bill.
- `indicative` — the *structure* is right, the *rates* came from secondary summaries. The
  UI says so and tells the owner to check them.

**Rates are defaults, never truth.** Tariffs change every April and fuel surcharges change
every cycle; the bill in hand always wins, and the printed-payable cross-check is what
catches a stale default. Setting a rate to 0 removes that line from the split entirely
(and any percentage that referenced it is repaired).

**Rationale:** owner's request — there are three or four licensees in the same city, so
"which provider?" has to come before "what rate?". See [`PROVIDERS.md`](./PROVIDERS.md) for
every number and where it came from.

---

### D-11 — Slab tariffs use the blended average rate
**Status:** ✅ Decided (2026-08-15) · resolves P-02, adopting its recommendation

Telescopic slabs are applied **once, to the whole official reading**, and the resulting
energy charge is then split pro-rata like every other component. Everybody pays the same
blended average rate.

Slab widths are quoted **per month**, so a 60-day bill gets double the width — 100 units in
Torrent RGP's first slab, not 50. Getting this wrong pushes units into a dearer slab.

**Rejected:** filling the cheap slabs from one household's units first. It is arbitrary
(whose units go first?), indefensible to whoever loses, and would not sum back to the bill.

**Consequence:** on a steep slab tariff a heavy user is subsidised by a light one relative
to what they would pay on their own connection. Accepted — it is the same trade-off D-01
already makes for fixed charges, and it is the only rule that is explainable.

---

### D-12 — A cycle whose itemisation is lost is carried as its printed total
**Status:** ✅ Decided (2026-08-15)

The owner's spreadsheet recorded one money column: the amount payable. No energy rate, no
fixed charge, no FPPAS, no duty. Those seven cycles are still worth having in history, so
there has to be a way to enter a bill you only know the total of.

**The itemisation is not needed.** Under D-01/D-02 every component is apportioned by the
same ratio, so a household's share is `ratio × total` no matter how the total was composed.
Reconstructing a plausible rate stack would add nothing and would be inventing rates.

So: a `flat` charge template (`engine/providers/types.ts`), and the plan
`custom / total-only` — one field, "Bill total as printed". Exact to the paise, unlike
the older `custom / blended` plan, whose ₹/unit round-trip loses up to a rupee.

**Fixed charge settled at ₹140** (₹70/kW/month × 1 kW × 2 months), confirmed by the owner
— which is what `registry.ts` already defaults to. The spreadsheet's ₹50 constant was
stale. It does not change any restated share, for the reason above; it only shows how far
the spreadsheet's own method had drifted.

**Restating the seven cycles** moves ₹163.26 off the first floor in total, ~₹23/cycle:

| Change | First floor, 7 cycles | Δ |
|---|---:|---:|
| Spreadsheet as it stood | ₹9,978.39 | — |
| + D-01 (fixed charge pro-rata, not ₹25 each) | ₹10,012.91 | +₹34.51 |
| + D-09 (motor is shared load, not first-floor load) | ₹9,815.13 | −₹197.78 |

Pinned by `storage/seed.test.ts`.

---

### D-13 — Sub-meters are lined up with the bill's reading window
**Status:** ✅ Decided (2026-08-16)

The utility reads the official meter on its own day — 21/07/26 on the reference bill. The
owner reads the sub-meters when the bill arrives, a week or two later. So the two windows
do not coincide, and what leaks is not the lag but the **change** in lag: read four days
later than last cycle and the sub-meters cover 65 days against the bill's 61.

Those four extra days inflate the metered households' units, which shrinks the residual by
exactly the same amount — so **the entire error lands on the unmetered household** (D-08).

The owner's own form timestamps show the reading day walking 1 Oct → 3 Dec → 4 Feb →
7 Apr → 11 Jun: ten days of one-way creep in eight months, worth roughly ₹217 across those
four cycles at ~₹23/drift-day. Larger than the D-01 and D-09 corrections combined, and
pointing the same way.

**Decision:** a meter is not a pair of numbers, it is a cumulative curve sampled at known
dates. Interpolate it linearly between samples, evaluate at the bill's two reading dates,
subtract. `engine/align.ts`.

Dates are **optional throughout**. Without them the engine behaves exactly as it did
before, and says nothing.

**Rejected: scaling units by `billDays / meterDays`.** It looks like the same idea and is
not — it throws the extra days away, and since the next cycle's delta starts from the late
reading, those units are billed to nobody, ever. The test in `align.test.ts` pins this:
across three cycles of a meter whose rate changes, interpolation totals exactly the 600
units the meter really recorded; scaling totals 634.

**Consequence:** no single cycle is exactly right — a rate change inside a reading interval
cannot be recovered from two readings. What is guaranteed is that consecutive bills
partition consumption exactly, because the endpoint two bills share is evaluated on the
same segment of the same curve. Per-cycle estimate, long-run exact.

**Consequence:** the cycle keeps one extra number per meter — the reading *before* last.
Rolled forward automatically by "Start next cycle", never typed, but shown read-only
because it moves money. Without it the opening date is extrapolated instead of
interpolated, and the cycle says so.

**The real fix is still free:** read the sub-meters on the day the bill says the utility
read the official meter. The form shows both windows side by side so the drift is visible
while it can still be avoided.

---

### D-14 — The app is a page with a hero and a standing answer panel, not a form
**Status:** ✅ Decided (2026-08-17)

The single-column sheet read as an internal tool: it opened on field one of a long form,
said nothing about what it was for, and put the answer at the bottom where you only saw it
after scrolling past everything.

**Decision:** three bands and a two-column working area.

- A **hero** states what the app does and shows the answer it produces — a specimen card
  holding an example split that becomes this cycle's real split the moment there is one.
  Same figure, same component, so the promise and the result are one object.
- The **answer panel** moves out of the bottom of the page and sticks beside the form on
  desktop, so every reading typed in is seen landing on somebody's share. Below 1024px it
  follows the form and a fixed bottom bar carries the total until you reach it.
- Before the form has enough in it, that panel holds the list of what is still missing —
  the space where the answer will be, saying why it isn't there yet. The separate "Before
  this can be calculated" card is gone.
- A **sticky top bar** carries the name, the theme, and the steps as chips with a tick
  each, so the progress read-out and the way to a step are the same control.

**Unchanged, deliberately:** every colour and type token, the ramp, the tariff form itself,
and the engine. This was a layout decision only — §3, §4 and §7 of `BRAND.md` are as they
were.

**Print changed with it:** the sheet is the answer and its working, so the form column is
`display: none` on paper and a one-line masthead names the cycle. Every figure typed in
still appears, in the breakdown.

---

### D-15 — Hosting: private S3 behind CloudFront, defined in CDK
**Status:** ✅ Decided (2026-09-11)

D-03 makes the app pure client-side — engine in the browser, history in `localStorage`, no
API and no database. That makes hosting a solved problem rather than an architecture
question, and the cheapest correct answer is a static origin behind a CDN.

**Decision:** an `infra/` CDK app (TypeScript) defining a **private S3 bucket** — all public
access blocked, read granted only to the `cloudfront.amazonaws.com` principal via **Origin
Access Control**, scoped by the distribution's ARN — fronted by a **CloudFront
distribution**. No compute, no VPC, no database anywhere in the stack.

**Why CDK over Terraform or a bare `aws s3 sync` script:** same language and toolchain as
`app/`, so the infra is type-checked by the same `tsc`; and the response-headers, cache and
error-mapping policies still to come are typed constructs rather than hand-assembled JSON.
The IaC tool adds no AWS cost — the site fits inside the CloudFront perpetual free tier, so
the real cost levers are the price class and the cache policy.

**`PRICE_CLASS_200`, not 100.** The cheaper class serves only North America and Europe. The
users are in Ahmedabad; 200 is the first class that includes the Indian edges.

**Cache headers are split in two.** Vite content-hashes everything under `assets/`, so those
go up `immutable, max-age=31536000`; the unhashed root shell goes up `no-cache`. Publishing
the shell with a long TTL would strand viewers on an `index.html` pointing at bundles the
next deploy deleted.

**Deploys are manual** (`npm run deploy` in `infra/`, which builds and tests first and
refuses to publish a missing build). GitHub Actions via OIDC is the intended next step if the
project grows; CodePipeline is the in-AWS alternative. Recorded in `infra/README.md`.

**Domain:** the CloudFront `*.cloudfront.net` address for now. A custom domain is an ACM
certificate in us-east-1 plus `domainNames` on the existing distribution — an in-place
update, so choosing to wait costs nothing later. Note that `minimumProtocolVersion` is
deliberately **not** set until then: with the default CloudFront certificate its security
policy is fixed by AWS and the setting is silently ignored, so stating it would only look
like a guarantee that is not there.

**Response headers, added in the same decision:** a `ResponseHeadersPolicy` carrying HSTS
(one year, `includeSubdomains`, never `preload` from a domain that is not ours),
`nosniff`, `X-Frame-Options: DENY`, `strict-origin-when-cross-origin`, a `Permissions-Policy`
denying the device APIs, `Cross-Origin-Opener-Policy: same-origin`, and a CSP.

The CSP allows **no `'unsafe-inline'` for scripts**. The one inline script in the product is
the pre-paint theme pin, and its `sha256` is *computed from the built HTML at synth time*
rather than pasted into the policy — editing that script can therefore never silently leave
the policy behind and blank the site. `style-src` does keep `'unsafe-inline'`: `Rail.tsx`
sets `flex-grow` from computed data and the status pages carry their CSS inline, and a hash
list cannot cover style *attributes* regardless. `X-XSS-Protection` is deliberately not sent
— it is obsolete and its filtering modes have been a vulnerability in their own right.

---

### D-16 — A missing page is a 404, not the app served under the wrong URL
**Status:** ✅ Decided (2026-09-11)

The reflex for a single-page app is to map every unmatched path to `index.html` with a 200.
Fairmeter should not: after the design lab was removed it has **no client-side router at
all** — it is one page, and the only hash it ever read is gone. A path that does not exist
is genuinely not found. Rewriting it to a 200 would tell crawlers that every typo is a real
page of identical content, and would tell a person with a broken link that they had arrived.

**Decision:** custom status pages, with truthful status codes.

- **`app/public/404.html`** — serves CloudFront's 404 *and* its 403. With Origin Access
  Control and no `s3:ListBucket` grant, S3 answers a missing key with 403; translating it
  back to 404 is what keeps the code honest.
- **`app/public/50x.html`** — serves 500/502/503/504, each keeping its own status, cached
  for 10 seconds so recovery is not held behind a stale error.
- Both are **completely self-contained**: no bundle, no external stylesheet, no webfont, and
  no script beyond the same pre-paint theme pin `index.html` uses. Whatever broke may be the
  very thing that stops an external file loading, so these pages depend on nothing. They are
  ~8 kB each and carry the token subset from `styles.css` inline, both themes included.
- The illustration is the brand mark **in a failure state**: BRAND.md §2 defines it as two
  unequal blocks on one rule spanning exactly their combined width, so here the blocks fall
  short and the shortfall is drawn in the alert ink. The figure does not add up — which is
  the one thing this product exists to prevent. Motion is a slow drift and pulse, dropped
  entirely under `prefers-reduced-motion`.
- Copy follows §10.2: what happened and what to do, sentence case, no apology and no "Oops".
  Each page states that saved cycles are untouched, because "the site is broken" and "my
  data is gone" are the same fear (D-03).

**The design lab is retired** to `discard/design-lab/` in the same pass. It had already
chosen the direction that shipped, and it was reaching production: a footer link, the
`#design` hash, ~12.6 kB of the CSS bundle and eight Google Font families fetched at
runtime. Removing it took the CSS from 36.5 kB to 23.9 kB and the gzipped JS from 83 kB to
78 kB. `discard/README.md` records what else moved and what deliberately did not.

**Consequence for hosting:** `base: '/'` is now stated in `vite.config.ts` rather than left
to the default. The build emits absolute asset URLs and these pages link to `/`, so serving
the site anywhere but a domain root breaks it. That is a deployment contract, not a
preference, so it is written down.

---

### D-17 — Extraction runs in a Lambda behind the existing distribution
**Status:** ✅ Decided (2026-09-15)

Reading a bill needs a model, and a model needs a credential. There are three places
to put that credential, and only one survives contact with the actual user.

- **In the browser, typed by the owner.** No backend at all, no cost to this project,
  no abuse surface. And no user: the person this app is for will not create an API key.
- **In the browser, ours.** Anything shipped to a browser is public. Not a choice.
- **Server-side, ours.** A credential the user never sees and never pays for.

**Decision:** one Node/ARM Lambda in `us-east-1`, reached at `/api/*` through an
**additional behavior on the existing CloudFront distribution**, with Origin Access
Control in front of its Function URL — the same pattern D-15 already uses for the S3
origin, so the function is not reachable except through the distribution.

**Why a behavior on the existing distribution rather than a bare Function URL or its own
API Gateway domain:** it keeps the call **same-origin**. D-15's CSP says `connect-src
'self'` and means it; a second hostname would force that open and add CORS to a project
that currently talks to nothing. Routing through the distribution the app is already
served from costs nothing and changes no header.

**Why not EC2 or Fargate:** the work is six requests per household per year. An always-on
box would cost more than the inference it serves. Lambda scales to zero. If the backend
ever grows past the 15-minute ceiling or needs a persistent connection, Fargate is a
later migration and not a rewrite.

**Why `us-east-1`:** it is where the stack already deploys and where model availability is
broadest. `ap-south-1` was considered for data residency and dropped — India's DPDP Act
permits transfer rather than mandating localisation, so in-region is a nice thing to be
able to say rather than a requirement. The latency argument does not survive either:
~200 ms of Pacific against a multi-second inference call is noise. CloudFront is global
and pins no region; `infra/bin/fairmeter.ts` already says so.

**The model is Claude, served through Bedrock Mantle, and so there is no secret at all.**
Mantle is the Messages-API path for Anthropic models on Bedrock — `anthropic.claude-opus-5`
in `us-east-1`, via `AnthropicBedrockMantle` from `@anthropic-ai/bedrock-sdk`. The Lambda's
IAM execution role carries `bedrock:InvokeModel` and that is the entire credential story:
nothing in Secrets Manager, nothing to rotate, nothing that can be committed by accident.
Use Mantle rather than the legacy `bedrock-runtime` `InvokeModel` path — it exposes the same
`messages.create` surface as the first-party SDK, so the Lambda stays portable if the serving
platform ever changes.

**This is conditional on an access approval that has not landed yet** (P-06). The Lambda is
written against a narrow internal interface — bytes and a plan in, candidate `BillFields`
out — so if approval is refused, what changes is one module and not the architecture. P-06
records what that costs.

---

### D-18 — The model proposes, the engine computes, the person confirms
**Status:** ✅ Decided (2026-09-15)

**Decision:** the model's only output is a candidate `BillFields` — the same strings the
owner would otherwise have typed. It computes no money, writes no storage, and is not
imported anywhere under `engine/`. The engine recomputes from those fields exactly as it
does from typed ones, and nothing is saved until a person has confirmed it.

**`engine/` stays pure, deterministic, offline and clock-free.** The golden test against
the reference bill keeps meaning precisely what it meant before any of this existed.

**The bill checks its own extraction.** Under D-04 every component is apportioned by one
ratio, and the engine derives the payable total independently from the rates read off the
page. The bill also *prints* its total, and `printedPayable` already exists to cross-check
the two. So a misread rate does not quietly become a wrong share — it becomes a computed
total that disagrees with the paper, which the UI already knows how to report. The
verification for this feature was built before the feature was, as a side effect of the
conservation property.

**Consequence:** every extracted value lands in the form flagged as read-from-the-bill
rather than typed, and stays editable. The owner is the authority on their own bill; the
model is a typist with good eyesight.

**Consequence:** a reading that *cannot* be verified this way does not get the same trust.
Sub-meter photographs have no printed total to check against — only a plausible range from
history — which is a large part of why they are out of scope for the first slice and will
need their own guard rail when they arrive.

---

### D-19 — The image is read on the server and kept on the device
**Status:** ✅ Decided (2026-09-15)

An electricity bill carries a name, an address and a consumer number. Uploading one is the
first time anything personal leaves the browser in this project's life, so where it comes
to rest is a decision and not an implementation detail.

**Decision:** the upload is sent to the Lambda, used, and discarded there — nothing written
to S3, nothing logged beyond size and content type. The **browser** keeps the original in
IndexedDB, attached to the cycle it produced, so a disputed share can be traced back to the
paper it came from.

**Rationale:** the traceability is worth real money in exactly the argument this app exists
to settle — "why is my share ₹300 more this time" is answered best by the bill itself. But
that value is local to the person holding the bill, so the copy should be too. D-03's
promise, that your history lives on your device, survives intact.

**Consequence:** `exportAll()` stays JSON and stays text. Images are not in it, so a cycle
exported and re-imported elsewhere keeps every figure and loses its scan. Accepted: the
figures are the record, the scan is a receipt.

**Consequence:** IndexedDB is a second storage mechanism alongside the `CycleStore` of D-03.
It holds only images, keyed by cycle id, and the app must render correctly when it is empty
— cleared browser, different device, private window. A missing scan is normal, not an error.

**Left open deliberately:** server-side retention tied to an account is a coherent later
choice and would arrive with the backend D-03 already anticipates. Nothing here forecloses
it, and the local copy would become a cache rather than the only copy.

---

### D-20 — A public endpoint that spends money gets a ceiling before it gets traffic
**Status:** ✅ Decided (2026-09-15)

D-17 puts a paid inference call behind an unauthenticated URL. The cost of that feature
working as intended is negligible: a bill is a few thousand tokens and the owner reads six
a year. The cost of it being found and driven in a loop is not, and it lands on this
project rather than on whoever found it.

**Decision — all four, before the endpoint is reachable:**

- a **WAF rate-based rule** on `/api/*`, per IP;
- a **request size cap** and a content check in the Lambda by **magic bytes** — not the
  file extension, and not a `Content-Type` the caller chose;
- a hard **output-token ceiling** on the model call;
- an **AWS Budgets alarm** on inference spend, set low enough to be noticed within a day
  rather than at the end of a month.

**Rationale:** not one of these is interesting, and all of them together are cheaper than
the incident they prevent.

**Consequence:** an owner working through a backlog of several bills in one sitting must
not trip the rate limit. Tune it against that case, not against the abuser — a control
that blocks the only real user is worse than no control.

**Revisit:** if D-03's backend brings accounts, per-account quotas become the primary
control and the per-IP rule stays underneath as a floor.

---

### D-21 — One call, a schema generated from the provider profile
**Status:** ✅ Decided (2026-09-15)

**Decision:** extraction is a **single Messages request** — no tool loop, no agent, no
session. One document in, one candidate `BillFields` out. The task is structured extraction
and nothing about it is open-ended, so a loop would buy latency and cost and no accuracy.

**The response schema is generated, not written.** The selected plan already describes every
line item it has, as data, in `engine/providers/registry.ts`; its `ChargeTemplate[]` maps
directly onto the properties of a JSON schema, keyed by the same `rateKey(charge)` the form
uses. So the extractor learns a new utility at the same moment the form does, and D-10's
promise — adding a provider is a registry entry and nothing else — survives a feature it
was not written for. A hand-maintained second copy of the tariff shape would have broken it
within two providers.

That schema goes on `output_config.format`, so the response is schema-valid by construction
rather than by hopeful parsing.

**Structured outputs and citations are mutually exclusive** — enabling `citations` on the
document block alongside `output_config.format` is rejected. Citations would give a page and
character range for every figure: *here is where on the bill ₹4.60 was read from*. That is
genuinely attractive for a product whose whole job is to be persuasive to someone who thinks
they have been overcharged.

**Chose structured outputs.** D-18's cross-check already answers *whether* the read was
right, which is the load-bearing question; citations answer *where it came from*, which only
makes an audit faster. A malformed response breaks the form for everyone, a missing
provenance link inconveniences the rare dispute. If disputes turn out to be common, a
second citations-enabled call on demand is a small addition — the choice is per-request, not
architectural.

**Consequence — the eval comes with the feature.** `100113210.pdf` plus the seven seeded
cycles of D-12 are a ready-made scored set, graded on whether the engine's computed total
matches `printedPayable` to the paisa. That is an objective number, in the same spirit as
the golden test, and it is what makes "would a cheaper model do" a measurement rather than
an argument. Extraction should not ship without it.

---

### D-22 — A gap in the read is left visible, and the only confidence that counts is the engine's
**Status:** ✅ Decided (2026-09-15)

Two questions that E0.2 and E1.3 could each have answered either way. Both were built one
way in session S1, flagged rather than buried, and confirmed by the owner in S2.

**Decision — a field the model did not read is left EMPTY, never pre-filled with the plan's
published rate.** The registry knows what Torrent's fixed charge is supposed to be, and
filling it in would make the computed total land close to the printed one. That is exactly
the objection: a default looks like something the owner typed, it is usually right, and the
one time the utility revised its tariff it is wrong in the direction nobody checks.

**Consequence, accepted with the decision:** an empty rate is a zero to `buildBill`, which
drops that charge entirely, so a bill with one unread rate computes **low**. The
printed-payable cross-check of D-18 is what reports it, and it reports it loudly — a missing
line item is a large disagreement, not a small one. This is the failure the owner chose:
obviously broken over quietly plausible.

**Decision — per-field confidence is DERIVED from the response, not reported by the model.**
`FieldStatus` is `read` / `missing` / `rejected`, computed from what arrived and what
survived normalisation. No `confidence` property goes on the generated schema.

**Rationale:** a model's own score is not evidence about a bill, and D-18 already supplies
evidence that is — the engine recomputes and the printed total either agrees or does not.
What the UI needs from a field is whether a person still has to type it, which is what the
three states say. A number the model grades itself with would compete with the cross-check
for the owner's attention while carrying none of its authority.

**Decision — the request size cap of D-20 is 8 MB** of raw document, before base64. The
reference PDF is 216 KB and a phone photo of a bill is 2–6 MB, so the cap clears the real
case without the owner ever resizing anything, and still bounds one request. It lives in
`LIMITS.maxBytes` in `extract/types.ts`, shared by both ends — the browser rejects what the
Lambda would, and the Lambda enforces it regardless, because a client-side check is a
courtesy and not a control.

**Decision — the hard output-token ceiling of D-20 is 4096.** Settled by the owner in S2
rather than S3, once the size cap made the pair worth deciding together.

A complete Torrent candidate is around forty short strings — roughly 600–1,000 output tokens.
4096 is generous against that on purpose. The ceiling's job is to bound a runaway or
adversarial response, not to trim a legitimate one, and the two failures are not symmetrical:
a truncated read of a real bill arrives as a `malformed-response` that the owner cannot act on
and cannot distinguish from a bad model, while a few hundred wasted tokens on a pathological
response cost fractions of a paisa. A slab-heavy tariff with many more rates than Torrent's
still fits well inside it, which matters because D-10 means the next provider is data rather
than code and nobody will revisit this number when one is added.

It belongs to the model call, so the constant lives with E1.2's request in `lambda/extract/`,
not in the `LIMITS` of `extract/types.ts` — that object is the contract the *browser* shares,
and how many tokens the model may emit is no concern of the browser's.

---

### D-23 — Two IAM users, and the session decides which one is loaded
**Status:** ✅ Decided (2026-09-15)

Account **565398310596**, everything in `us-east-1`. Two named users exist, and they are not
interchangeable — which one is loaded is a property of the *work*, not a preference.

| Profile | Carries | Used by |
|---------|---------|---------|
| `fairmeter-admin` | `AdministratorAccess`, `IAMUserChangePassword`, `AmazonBedrockFullAccess`, `AmazonBedrockMantleFullAccess`, `CloudWatchLogsReadOnlyAccess` | **S3** (E1.2, E1.4) — the local inference call and reading its logs |
| `fairmeter-deploy` | customer-managed `fairmeter-deploy` + `CloudWatchLogsReadOnlyAccess` | **S4** (E2.1–E2.4) — `cdk diff` and `cdk deploy` |

**`fairmeter-deploy` is deliberately tiny.** Its policy grants exactly two things:
`sts:AssumeRole` on the three CDK bootstrap roles
(`cdk-hnb659fds-{deploy,file-publishing,lookup}-role-565398310596-us-east-1`) and
`ssm:GetParameter` on `/cdk-bootstrap/hnb659fds/version`. Confirmed by
`simulate-principal-policy`: `bedrock:InvokeModel` is an **implicitDeny**, and so is
`cloudformation:CreateChangeSet` — the latter is **correct and must not be "fixed"**, because
CDK reaches CloudFormation by assuming the bootstrap deploy role, not as the user. The user
cannot even read its own policy list; that has to be done through the admin profile.

**Consequence:** E1.2 cannot run under `fairmeter-deploy`. There is no configuration that
makes it work, and the failure would look like a Bedrock error rather than a credential one.

**Noted, not changed:** the three Bedrock and Logs policies on `fairmeter-admin` grant nothing
`AdministratorAccess` did not already grant. They are redundant today and harmless; they are
worth keeping as a statement of what that user is *for*, and they become load-bearing the
moment `AdministratorAccess` is removed.

**Left open, and it is the owner's call:** E1.2 is the first paid call, and running it under
`AdministratorAccess` from a laptop is broader than the work needs. D-17's own logic — the
deployed Lambda's execution role carries `bedrock:InvokeModel` and nothing else — argues for a
third user, `fairmeter-invoke`, scoped to `bedrock:InvokeModel` on the single model ARN, so a
leaked experiment key is an inference bill rather than the account. Not built; `fairmeter-admin`
is what S3 uses until it is.

**`anthropic.claude-opus-5` is listed by `bedrock list-foundation-models` in `us-east-1` for
this account**, which is P-06's access confirmed in practice rather than on paper.

---

## ⏳ Pending

### P-06 — Claude access approval, and what happens without it
**Status:** ✅ Resolved (2026-09-15) — **access granted**

**The design is settled on Claude** (D-17, D-21), and access has now been granted, so the
Claude branch of D-17 and D-21 is the one that gets built. The rest of this entry is kept
as the record of what was at stake and what the fallback would have cost; it is **not**
implemented. Had access been refused, the permitted models were **GLM 5**, **Kimi K2.5**
and **Kimi K2 Thinking** — an external constraint rather than a technical preference.

**What Claude access resolves, and why it was worth waiting for:**

- **Native PDF *and* image input.** A photographed bill and a downloaded PDF are one code
  path. Without it, they are two, and the photograph needs real OCR — Textract is the
  in-AWS answer, and it is a whole stage with its own failure modes.
- **No secret anywhere.** Bedrock Mantle serves Claude, so D-17's IAM branch applies.
  A vendor API instead means a key in Secrets Manager and rotation this project owns.
- **Structured outputs**, which is what lets D-21 generate the schema from the registry
  rather than parse hopefully.

**If approval is refused, what actually changes:**

1. **Vision is the question to ask first.** Kimi K2 and K2 Thinking are text models — vision
   has been a separate line at Moonshot. GLM 5's capability here needs confirming rather
   than assuming.
2. **Text-only is survivable, and for the reference bill nearly free.** `100113210.pdf` has
   a real text layer — `CLAUDE.md` already documents pulling it out with `pypdf`, which is
   how this repository has always read it. Extract the text, hand the model text, map it
   onto `BillFields`. Ship PDF-only first and add photographs as a second slice.
3. **PDF becomes the better input rather than the more convenient one**, and the UI should
   say which path it used. Worth telling the owner, because it changes what they should
   upload.
4. **Note for the record:** Bedrock *Mantle* is the Messages-API path for Anthropic models
   specifically and does not serve these. An earlier draft of D-17 named it as though it
   were platform-neutral. It is not.

**Unchanged in every branch:** D-18's verification. The printed-payable cross-check tests
the arithmetic of the result and never the provenance of the digits, so it works identically
on a vision read, an extracted text layer, and OCR output.

**Resolved:** the access request was answered yes on 2026-09-15. The Lambda is now worth
starting, and `ROADMAP.md` phase E0 is where it starts — with the pure, testable parts that
need no cloud at all.

---

### ~~P-01 — Residual attribution~~ → resolved by D-08
**Status:** ✅ Closed

Superseded by the household model in D-08. Kept for history.

---

### ~~P-02 — Slab tariff handling~~ → resolved by D-11
**Status:** ✅ Closed (2026-08-15) — option 1 adopted. Kept for the reasoning.

The reference bill is **Non-RGP Commercial**, a flat ₹4.60/unit — so no slab problem
exists today. But the printed tariff table includes slab-based categories
(RGP Residential: 0–50 @ ₹3.20, 51–200 @ ₹3.95, remaining @ ₹5.00).

If the app is ever used on a slab tariff, someone must occupy the cheap lower slabs.
Options:
1. **Blended average rate** — total energy charges ÷ total units, applied to everyone.
   Neutral, everyone gets the same effective rate. Consistent with D-04.
2. **Sequential slab fill** — owner's units fill the cheap slabs first (or tenants do).
   Arguably "truer" but arbitrary and hard to defend.

**Recommendation:** option 1, for consistency with D-04.
**Must decide before:** supporting any tariff other than the current flat commercial rate.

---

*(P-03, P-04, P-05 resolved — see D-05, D-06, D-07 above.)*
