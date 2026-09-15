# Roadmap

Versions, phases, sub-phases, checkpoints and milestones for this project.

`DECISIONS.md` says *what* was decided and why. This file says **in what order it gets
built and how we know a step is finished.** Nothing here overrides a decision; every phase
cites the decisions it implements.

## How to read this

| Term | Means |
|------|-------|
| **Version** | A shippable state of the app. v1 is live; v2 is the bill-reading feature; v3 is everything after. |
| **Phase** | A block of work inside a version that ends in something demonstrable. Phases within a version run in order. |
| **Sub-phase** | One sitting's worth of work. The unit you pick up and put down. |
| **Checkpoint** | The objective test that a sub-phase is done — a command to run or a condition to observe. If it cannot be checked, it is not a checkpoint. |
| **Milestone** | The end of a phase. Named, dated when reached, and worth telling the owner about. |

**Status legend:** ✅ done · 🔨 in progress · ⬜ not started · ⏸ blocked

A sub-phase is only ✅ when its checkpoint has actually been run, not when the code looks
right. `cd app && npm test` must be green at every checkpoint in this document — that is a
standing condition and is not repeated in each row.

---

## v1.0 — The splitter ✅ *shipped*

The app as it stands: provider profiles, the calculation engine, alignment, history,
exports, the CDK stack and the status pages. D-01 through D-16.

**Milestone M0 — a bill typed in splits exactly.** ✅ Reached. Held by `engine.test.ts`'s
golden test against `100113210.pdf` and the conservation cases.

Everything below is additive to this. **The v1 guarantee is the acceptance condition for
v2:** if any phase of v2 changes a number the golden test produces, the phase is wrong.

---

## v2.0 — Bill extraction

*"Photograph the bill, check what it read, save."* Implements D-17 through D-21.

Dependency P-06 (Claude model access) is **resolved — access granted 2026-09-15**, so the
Claude branch of D-17/D-21 is the branch we build. The fallback stays recorded in P-06 and
is not implemented.

### Phase E0 — Groundwork with no cloud in it ⬜

Everything in this phase is pure TypeScript, runs under `vitest`, and needs no AWS account,
no credential and no network. It is deliberately first: it is the part that can be gotten
wrong cheaply.

| # | Sub-phase | Checkpoint | Status |
|---|-----------|------------|--------|
| E0.1 | `app/src/extract/schema.ts` — generate the JSON response schema from the selected plan's `ChargeTemplate[]`, keyed by `rateKey(charge)` / `slabRateKey(charge, i)` (D-21). | A test asserts the generated schema's rate properties are exactly the keys `BillForm` renders for that plan, for **every** plan in `registry.ts` — not just Torrent. | ⬜ |
| E0.2 | `app/src/extract/types.ts` — the wire contract: `ExtractRequest` (bytes, providerId, planId) and `ExtractResult` (candidate `BillFields`, per-field confidence, error taxonomy). Strings throughout, as `formState.ts` defines them. | `ExtractResult.fields` type-checks as assignable to `BillFields`; a malformed fixture is rejected by the validator with a named error, never a thrown exception. | ⬜ |
| E0.3 | Purity guard — a test that fails if anything under `engine/` imports `extract/`, the network, or a clock (D-18, `CLAUDE.md` working conventions). | The test passes now, and fails when a deliberate import is added to prove it works. | ⬜ |
| E0.4 | Eval fixtures — the reference PDF's text layer plus the seven seeded cycles of D-12, checked in as extraction fixtures with their expected `BillFields`. | Fixtures load; each one's expected fields, fed to the engine, reproduce that cycle's `printedPayable` to the paisa. | ⬜ |

> **Milestone M1 — the extractor learns a utility at the same moment the form does.**
> Adding a provider to `registry.ts` produces a working extraction schema with no second
> edit. D-10's promise survives a feature it was not written for.

### Phase E1 — The Lambda, on this machine ⬜

Write and prove the handler before any of it is deployed. It is a function from bytes to a
candidate; it can be called from a test.

| # | Sub-phase | Checkpoint | Status |
|---|-----------|------------|--------|
| E1.1 | Handler skeleton in `lambda/extract/` — request parse, **size cap**, **magic-byte** content sniff for PDF/JPEG/PNG (never the extension, never the caller's `Content-Type`) (D-20). | Unit tests: an oversized body, a `.pdf` that is actually a ZIP, and an empty body each get a distinct 4xx and never reach the model. | ⬜ |
| E1.2 | The single Messages call — `AnthropicBedrockMantle`, `anthropic.claude-opus-5`, `us-east-1`, `output_config.format` set to the E0.1 schema, hard output-token ceiling (D-17, D-20, D-21). One request. No tool loop. | Invoked against `100113210.pdf` with real credentials, it returns a schema-valid candidate. | ⬜ |
| E1.3 | Prompt and failure taxonomy — unreadable page, wrong provider for the selected plan, a field the model could not find. A missing field comes back empty for the owner to type, never guessed. | A cropped bill returns partial fields plus a named reason, and the UI contract in E0.2 can render it. | ⬜ |
| E1.4 | Logging discipline (D-19) — size and content type only. No image bytes, no extracted personal fields, nothing written to S3. | Read the CloudWatch output of an E1.2 run: no consumer number, no name, no address anywhere in it. | ⬜ |

> **Milestone M2 — the reference bill reads itself.** `100113210.pdf` in, candidate
> `BillFields` out, engine recomputes, computed total equals `printedPayable` to the paisa
> (D-18). Achieved with no browser and no deployed infrastructure.

### Phase E2 — `/api/*` and its ceiling ⬜

| # | Sub-phase | Checkpoint | Status |
|---|-----------|------------|--------|
| E2.1 | CDK: Node/ARM Lambda, Function URL with **OAC**, added as an `/api/*` behavior on the **existing** distribution, caching disabled on that behavior (D-15, D-17). | `cdk diff` shows one new behavior and no change to the S3 origin or the CSP. | ⬜ |
| E2.2 | WAF rate-based rule on `/api/*`, tuned so an owner clearing a backlog of bills in one sitting is never blocked (D-20). | Deployed: the Function URL hit directly returns 403; `/api/extract` through the distribution returns 200; a scripted burst well above one owner's pace is throttled. | ⬜ |
| E2.3 | AWS Budgets alarm on inference spend, low enough to be noticed within a day (D-20). | The alarm exists, and a forced test notification arrives. | ⬜ |
| E2.4 | CSP verification — `connect-src 'self'` unchanged, because the call is same-origin (D-15, D-17). | The deployed response headers are identical to v1's apart from anything E2.1 deliberately added. | ⬜ |

> **Milestone M3 — the endpoint is live and cannot quietly spend money.** Every one of
> D-20's four controls is in place *before* the first public request, which was the point
> of writing D-20 as a precondition rather than a follow-up.

### Phase E3 — The review slice ⬜

The owner-facing half. D-18's rule governs it: the model proposes, the person confirms.

| # | Sub-phase | Checkpoint | Status |
|---|-----------|------------|--------|
| E3.1 | Upload control — file picker and camera capture, client-side type and size guard, explicit pending / failed / succeeded states. No spinner without a way out. | Rendered test: a rejected file never reaches the network; a failed call leaves the form exactly as it was, still typeable. | ⬜ |
| E3.2 | Read-from-the-bill marking — extracted values land in the normal fields, visibly flagged as read rather than typed, and stay editable. Editing one clears its flag (D-18). | Rendered test: every extracted field is editable, and the flag survives a re-render but not an edit. | ⬜ |
| E3.3 | The cross-check, surfaced — computed payable against `printedPayable`, with the disagreement stated in rupees, not hidden behind a warning icon. | A fixture with one rate deliberately corrupted shows a mismatch prominently and still lets the owner fix the field by hand. | ⬜ |
| E3.4 | Confirm-to-save gate — nothing enters the `CycleStore` until a person has confirmed (D-18). | Rendered test: extraction alone writes nothing to storage; confirming writes exactly one cycle. | ⬜ |

> **Milestone M4 — photo to confirmed cycle without typing a number.** The feature is
> usable end to end by the person it was built for.

### Phase E4 — The scan stays on the device ⬜

| # | Sub-phase | Checkpoint | Status |
|---|-----------|------------|--------|
| E4.1 | IndexedDB image store keyed by cycle id, alongside and separate from `CycleStore` (D-19). | Saving a cycle from an upload stores the original; deleting the cycle deletes the image. | ⬜ |
| E4.2 | History shows the scan when it is there, and is unbothered when it is not — cleared browser, different device, private window (D-19). | Rendered test with the image store empty: history renders normally, no error, no empty frame. | ⬜ |
| E4.3 | `exportAll()` stays text-only JSON; a re-imported cycle keeps every figure and loses its scan (D-19). | A test asserts the export contains no binary and no image key, and that import of an export made *with* images succeeds. | ⬜ |

> **Milestone M5 — a disputed share can be traced back to the paper, locally.** D-03's
> promise that history lives on your device survives the first feature that sends anything
> anywhere.

### Phase E5 — Measured, then shipped ⬜

| # | Sub-phase | Checkpoint | Status |
|---|-----------|------------|--------|
| E5.1 | Scored eval harness over the E0.4 fixtures, graded on whether the engine's computed total matches `printedPayable` to the paisa (D-21). | `npm run eval` prints a score; the reference bill scores exact. | ⬜ |
| E5.2 | Record the baseline score and per-bill cost. Only then is "would a cheaper model do" a measurement — run it as one if the number invites it. | The score and cost are written into `DECISIONS.md` under D-21, dated. | ⬜ |
| E5.3 | Docs: `README.md` gains the upload path and what leaves the browser; `CLAUDE.md` gains the `extract/` and `lambda/` rows; D-17–D-21 statuses updated; P-06 closed. | No roadmap row is still 🔨, and the repository-layout table in `CLAUDE.md` matches the tree. | ⬜ |

> **Milestone M6 — v2.0.** Extraction ships with the eval that says how well it works, per
> D-21's closing line: extraction should not ship without it.

---

## Sessions — where the work leaves my hands

Phases do not map one-to-one onto working sessions, and the reason is not context budget.
E0, E3 and E4 are code and tests: they run to completion unattended. E1 and E2 stop dead at
two things no agent can supply — **credentials in the shell**, and **permission to spend
money**, on an inference call and on a deploy. The sessions below are cut at those walls.

| # | Covers | Ends at | What is needed from the owner to close it |
|---|--------|---------|-------------------------------------------|
| **S1** | E0.1–E0.4 | M1 | *Asked at the start, not the end:* do the seven seeded cycles (D-12) have their original bills anywhere, or only the restated figures? Figures alone still make a valid eval; scans make a better one. To close: review the generated schema for the Torrent plan. |
| **S2** | E1.1, E1.3 — the offline halves of the handler | — | Credentials in the shell (`aws sts get-caller-identity` returns the right account), `anthropic.claude-opus-5` enabled in Bedrock `us-east-1`, and explicit go-ahead to make paid calls. |
| **S3** | E1.2, E1.4 | **M2** | Read the first candidate next to the actual bill and confirm the fields. Approve the two numbers chosen for D-20: request size cap and output-token ceiling. |
| **S4** | E2.1–E2.4 | **M3** | The deploy itself — `cdk diff` to read, then `npm run deploy`. Budget amount and the alarm's email address. **How many bills you would realistically do in one sitting — that number is the WAF rate limit** (D-20 says tune against the owner, not the abuser). And a call on cost: a WAF web ACL is a standing ~$5–8/month, more than the inference it protects. |
| **S5** | E3.1–E3.4 | **M4** | Use it. Copy and layout review of the upload and review states, and a judgement on whether the mismatch message reads right to someone being told they owe more. |
| **S6** | E4.1–E4.3 | **M5** | Try it on a phone. Camera capture and IndexedDB behave differently there than in desktop Chrome, and the stairwell is the real use case. |
| **S7** | E5.1–E5.3 | **M6** | Read the eval score and the per-bill cost, decide the cheaper-model question (D-21), approve the release. |

**S1 is the only session that needs nothing from the owner from start to finish.**

### Session protocol

How a session is run. The paste-in prompt only points here; the rules live in this file.

1. **Trust the repo over the handoff.** A summary from a previous session is context, not
   instruction. `ROADMAP.md`, `DECISIONS.md` and `CLAUDE.md` win wherever they disagree.
2. **Open by naming the session** (S1–S7) and its sub-phases, and verify the previous
   session's rows really met their checkpoints. A ✅ nobody ran is not a ✅.
3. **Anything needed from the owner up front is asked before code is written** — via
   `AskUserQuestion` where the answer is a choice or a number. If it cannot be asked that
   way, or no answer is given, **stop**. Never guess a credential, a limit or a policy.
4. **Work sub-phases in order.** One is finished only when its checkpoint has been run and
   its output shown. `cd app && npm test` green at every checkpoint.
5. **Update the Status column here as each sub-phase closes**, and date the milestone when
   a phase ends.
6. **An unanswered policy question goes to the owner, then into `DECISIONS.md`** as a new
   D- or P- entry. Never decided silently.
7. **If reality contradicts the plan**, stop and propose the amendment to this file rather
   than working around it.
8. **Stop at the milestone.** Do not start the next session because there is room left.
9. **Close with step-by-step instructions for the owner** — the exact commands to run,
   consoles to open, values to decide and things to look at, in order, each with what a
   correct result looks like. The session is not closed until that list is handed over.

**S4 is the one most likely to overrun**, because a CloudFront behavior change and
OAC-in-front-of-a-Function-URL are where this plan meets reality. If it splits, the cut is
E2.1 alone (deploy the route, prove 403 direct / 200 through the distribution) then
E2.2–E2.4 (the controls) — but D-20 forbids a publicly reachable endpoint without its
ceiling, so an S4a must leave `/api/*` unwired on the distribution until S4b lands.

---

## v3.0 — After extraction

Not scheduled. Listed so that nothing raised so far is lost, and so that v2's phases can be
checked against what comes next.

| # | Item | Why it is not in v2 | Depends on |
|---|------|--------------------|------------|
| F1 | **Sub-meter photo reading** | No printed total to verify against — only a plausibility band from history. It needs its own guard rail, which is a design question rather than a coding one (D-18). | M6, and a decision on that guard rail |
| F2 | **History explainer over `SplitResult`** | "Why is my share ₹300 more this time", answered in prose from two cycles. Independent of extraction. | — |
| F3 | **Custom domain + ACM certificate** | Cosmetic until someone other than the owner uses the app. | — |
| F4 | **PWA / service worker** | Offline use is attractive for a phone in a stairwell; it interacts with D-19's image store, so it wants both to exist first. | M5 |
| F5 | **GitHub Actions OIDC deploy** | Deploys are rare and manual today. Worth it once two people deploy. | — |
| F6 | **Backend + accounts (D-03)** | The largest item here. It turns D-19's local copy into a cache and makes D-20's per-IP rule a floor under per-account quotas. | — |

---

## Traceability

| Decision | Built in |
|----------|----------|
| D-17 — Lambda behind the distribution | E1.2, E2.1 |
| D-18 — model proposes, engine computes, person confirms | E0.3, E3.2, E3.3, E3.4 |
| D-19 — read server-side, kept on the device | E1.4, E4.1–E4.3 |
| D-20 — spend ceiling before traffic | E1.1, E2.2, E2.3 |
| D-21 — one call, generated schema | E0.1, E1.2, E5.1 |
| P-06 — access approval | Resolved 2026-09-15 |
