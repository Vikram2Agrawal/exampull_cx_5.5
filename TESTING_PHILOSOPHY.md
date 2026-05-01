# ExamPull — Testing Philosophy

**Version:** 1.0
**Date:** 2026-04-28
**Status:** Foundational — read before authoring tests, building test infra, or judging quality

This document is the source of truth for **how we know the product is good**. It sits alongside `prd.md` (what we build), `system_design.md` (how it runs), `DESIGN_PHILOSOPHY.md` (how it looks and feels), and `EVAL_PHILOSOPHY.md` (how we judge exam content quality).

It is **stack-independent**. Tools change; philosophy doesn't. Where current tooling matters, separate operational docs (`TESTING.md`, `TESTER_PROMPT.md`, `TEST_FLOWS.md`) hold the prescriptions. This doc holds the principles that survive when we swap browser drivers, add a new framework, or move to a different runner.

It is **autonomous-first**. The product must be testable by an unsupervised loop of agents that can read this document, understand what to test and how, generate test plans, execute them, judge results, and either fix issues or queue them — without a human in the loop.

---

## 1. The North Star

A passing test suite must not mean "the code didn't crash." It must mean: **a real user, in a real moment, would have a good time.**

Testing succeeds when:
1. Every feature in the PRD works end-to-end across every state a user can plausibly reach.
2. Every interaction *feels* the way a thoughtful designer would want — not just functionally correct but smooth, responsive, and respectful.
3. Every failure mode is anticipated and graceful — never a wall, never a silent loss.
4. The above can be verified by an autonomous loop, repeatably, without human babysitting.

If a release ships with green tests but a real user hits something broken, the test suite — not the engineer — is what failed. Tests are the contract.

---

## 2. The Two Dimensions of Quality

Every test answers some combination of two questions:

### Did it work? (Functional Correctness)
The mechanical question. Did the click submit the form? Did the credits deduct? Did the file upload? Did the redirect land at the right URL? Was the database row written?

This is the easier dimension. Most testing literature is about this. It is **necessary but not sufficient**.

### Did it feel right? (Perceptual Quality)
The harder question. Was the click acknowledged within 100ms? Did the loading state appear before the user wondered if it broke? Did the modal dismiss with motion or just vanish? Was the empty state inviting or hollow? Was the error message specific or vague? Did the page hold its layout while content loaded?

A button that submits in 4 seconds with no spinner *passes the functional test*. It fails the user. **Both dimensions must pass for a test to pass.**

The implication: every meaningful test produces evidence on **both** dimensions. A unit test on a utility function only needs functional correctness. An end-to-end flow needs both, with the perceptual side weighted heavily.

---

## 3. The User-Tester Mindset

The single most important shift: **a tester is not a QA engineer running test cases. A tester is a user pursuing an intention.**

A test does not begin with "Step 1: navigate to /dashboard." A test begins with:

> *"I am a senior in high school cramming for AP Chem in three days. I have my professor's review packet as a PDF. I want to generate a 20-question practice exam with answer key tonight so I can take it tomorrow morning. I have never used this product before."*

Everything that follows — every click, every form fill, every wait — is in service of that intention. The tester finds the upload button because they're looking for a way to get the PDF in. They notice the credit cost because they're a Free user wondering if this is going to work for them. They hover over "Power Mode" because the word intrigued them.

Tests built this way catch what test cases miss:
- **Wayfinding failures**: "I can't find where to upload my PDF."
- **Confidence failures**: "I'm not sure if it worked. Should I click again?"
- **Stakes failures**: "I'm scared to click 'Generate' because I don't know if I'll be charged."
- **Comprehension failures**: "I don't know what '15 credits' means in dollars."
- **Trust failures**: "This feels like a startup that might disappear in three months."

These are not edge cases. They are the *primary* causes of conversion loss and churn — and they are invisible to traditional functional tests.

### What a User-Tester Does Not Do

- Read the source code before testing. Source code reveals intent; the user has no intent revealed to them.
- Use developer tools first. Real users don't open the console.
- Re-do a flow until it works. If a normal attempt fails, that's the finding.
- Assume "they'll figure it out." If a path takes more than one moment of thought, document the friction.
- Pre-judge whether a problem is "important." Severity is a downstream decision.

---

## 4. Personas: Who's Testing, Conceptually

Every test scenario is anchored to a persona. The four PRD personas exist for product strategy; for testing, we extend them with **adversarial personas** that probe edges.

### The Intent-Driven Personas (from PRD §4)
1. **The Cramming College Student** — speed, volume, low patience. Tests that the wizard is fast, that 5 exams in a session don't degrade.
2. **The Diligent High Schooler** — wants format fidelity. Tests that the exam *looks* like the AP exam they'll face.
3. **The Graduate Researcher** — uploads dense materials, wants depth. Tests that long PDFs and complex topic extraction work.
4. **The Organized Pre-Med Student** — multiple classes, library hygiene. Tests that class management, archiving, and the library scale.

### The Adversarial Personas (probe failure modes)
5. **The Speed-Clicker** — clicks every button twice in case it didn't work the first time. Tests idempotency and double-submit protection.
6. **The Tab-Hopper** — has 14 tabs open, switches mid-flow, comes back 20 minutes later. Tests session resilience and async update propagation.
7. **The Refresher** — when something is taking too long, hits Cmd+R. Tests state recovery, in-flight job survival, draft persistence.
8. **The Network-Toggler** — on a flaky train wifi. Tests retry behavior, queue resilience, optimistic UI rollbacks.
9. **The Mobile-Only User** — only ever uses their phone. Tests that touch targets, virtual keyboard interactions, and small-viewport layouts work first-class, not as a downgraded desktop view.
10. **The Screen-Reader User** — navigates with VoiceOver or NVDA. Tests semantic markup, focus order, ARIA labels, live region announcements.
11. **The Returner** — last opened the app 47 days ago. Tests welcome-back panel, expired credits, archived classes, billing changes that happened while away.
12. **The Adversary** — types `<script>` into every text field, uploads a 200MB malicious PDF, tries to access another user's exam by guessing the URL, opens the same boost link in two tabs simultaneously. Tests security, validation, and atomic operations.
13. **The Edge Inputter** — names their class with 500 characters of emoji, uploads an empty PDF, sets question count to 0, picks a phone number from a country we've never seen. Tests boundary conditions and graceful degradation.
14. **The Power User** — has 47 classes and 412 exams. Tests scaling, pagination, search performance, and library responsiveness at the upper bound.

A test scenario without a persona is a code path, not a user journey. **Always start with the persona.**

---

## 5. The Layers of Testing

Coverage is multi-layered. Each layer answers different questions and catches different bugs. A robust suite uses **all** of them.

| Layer | Question Answered | Cost | Catches |
|-------|------------------|------|---------|
| **Smoke** | Does the app boot at all? | seconds | Total breakage, deploy disasters |
| **Unit** | Does this function behave as specified? | milliseconds | Logic bugs in pure code |
| **Integration** | Do these systems talk to each other correctly? | seconds | Wiring bugs, contract violations |
| **Flow** | Can a user complete this end-to-end task? | minutes | Wayfinding bugs, broken handoffs |
| **Persona** | Does this user persona have a good time? | minutes | UX failures, friction, confidence loss |
| **Adversarial** | What happens when things go wrong? | minutes | Resilience failures, data loss, security holes |
| **Visual** | Does it look the way we intend? | seconds | Layout drift, theme inconsistency, design regressions |
| **Performance** | Does it feel fast? | seconds | Slow loads, layout shift, jank, perceived latency |
| **Cross-Environment** | Does it work everywhere? | minutes | Browser/device/network-specific bugs |
| **Regression** | Did we break something that was working? | varies | Reintroduced bugs, contract drift |

### The Inverted Pyramid

Traditional testing wisdom is *unit > integration > E2E* (the "test pyramid"): many cheap unit tests at the base, few expensive E2E tests at the top.

**For ExamPull, we invert this.** End-to-end persona tests are our *primary* layer. Unit tests serve them, not the other way around. Reasons:

- Our value is in the *user experience*, not the *code units*. A 100% unit-tested codebase with a broken sign-up flow is worthless.
- Most of our complexity is integration: AI APIs, payments, storage, queues, multi-step pipelines. Unit-mocking these gives false confidence.
- Autonomous testing makes E2E *cheap enough*. Subagents in parallel can run a full persona pass in minutes.
- The bugs that hurt us are the ones unit tests can't see — UX papercuts, perceptual quality, cross-system race conditions.

Unit tests still exist where they earn their keep: pure data transformations, business-logic predicates, the LaTeX assembly logic, credit math. But they are not the goal — they are the substrate.

---

## 6. The Subagent Pattern

Autonomous testing is parallelizable in a way human testing is not. Spawning subagents — each in a fresh context, each owning one flow or persona — is the central execution pattern.

### Anatomy of a Tester Subagent

A tester subagent receives:
- **A persona** (one of the 14 above).
- **An intention** (a user goal in one sentence).
- **A flow specification** — the PRD section(s) relevant to the intention, plus the design philosophy section(s) for perceptual judgment.
- **Test resources** — credentials, mock data, test cards, environment URLs.
- **A capability set** — browser automation, screen capture, network inspection, vision-based judgment, console/log access.
- **A reporting contract** — what evidence and findings it must produce.

It does **not** receive:
- Source code (unless absolutely needed for an internal-state probe).
- Knowledge of past test runs (prevents confirmation bias).
- A list of "expected bugs" or "known issues" (would bias attention).
- Implementation details about which file or service might be involved.

The subagent's job: **inhabit the persona, pursue the intention, document everything that happens, judge it against the philosophy, and report.**

### Why Fresh Context Matters

A subagent loaded with previous bug reports will subconsciously confirm the bugs. A subagent loaded with the current code will reason about what *should* happen, not what *does*. Fresh context is a feature, not a limitation — it forces the subagent into the user's epistemic position.

### Parallelism

The autonomous loop spawns many subagents per pass:
- One per persona × intention combination
- Multiple in parallel, bounded by API rate limits and infra capacity
- Each isolated (separate browser context, separate test account, separate evidence directory)

Aggregation happens in the orchestrator (lead agent), which never tests itself — it sequences batches, aggregates findings, triages, dispatches fix work, and re-runs.

### When NOT to Use Subagents

- **Trivial smoke tests**: a 3-second "does the homepage load" doesn't need a fresh-context agent.
- **Pure unit tests**: the runner already isolates them.
- **Highly interactive debugging**: when you're investigating *why* something fails, you want one persistent context, not new ones.

Subagents are for *coverage and parallelism*. Direct tooling is for *triage and depth*.

### Browser Interaction Modes: Scripted vs. Agentic

A tester subagent needs a way to drive a real browser. Two modes exist; both are valid, and they catch different bugs. Where the harness supports both, use both.

#### Scripted (e.g., Playwright, Cypress, Puppeteer)

The tester writes (or generates) code that performs a deterministic sequence of actions: navigate to URL, click selector, type into field, assert text. The same script produces the same actions every time.

- **Strengths**: deterministic, fast, repeatable, cheap to run at scale; precise instrumentation (timing, console, network); suitable for regression suites and performance benchmarks where repeatability is the point.
- **Weaknesses**: tests *what we thought to test*. The script does what it's told and nothing more. If the persona's natural path diverges from the script, the test either fails on a missing selector or executes an inauthentic sequence. Brittle to UI changes — every visual refactor breaks selector-based scripts. Cannot judge perception (the script doesn't *see* the page, only the DOM).

#### Agentic (e.g., LLMs with computer-use / browser-use / vision-driven browser drivers)

The tester is given a **goal**, not a script. It perceives the rendered page (DOM and/or screenshot), reasons about what to do next, and acts. The same goal can produce different action sequences across runs depending on what the agent encounters.

- **Strengths**: **persona-authentic** — the agent has to figure out the path the way a real user would, which means it experiences the same wayfinding friction; adaptive to UI changes (no brittle selectors); discovers unanticipated friction (an agent that can't find the upload button finds the same friction a user would); can judge perception inline (it's already looking at the page); surfaces emergent cross-feature issues a script would never reach.
- **Weaknesses**: non-deterministic (bad for regression and exact timing measurements); more expensive per run; requires a vision-capable harness; may hallucinate actions or miss subtle states; harder to debug failures because the action sequence varies between runs.

#### When To Use Each

| Purpose | Mode |
|---------|------|
| Regression of a known, stable flow | Scripted |
| Performance benchmark (precise timings, web vitals) | Scripted |
| Persona pursuing an intention from cold start | **Agentic** |
| Discovery — "what would a user trip over here" | **Agentic** |
| Visual / perceptual quality judgment | Agentic, or scripted with post-hoc soft-oracle judge on captured artifacts |
| Accessibility — mechanical checks (axe-core, Lighthouse) | Scripted |
| Accessibility — screen-reader walks | Agentic with screen-reader emulation |
| Adversarial probing (chaos + exploration) | Hybrid — scripted to inject the chaos condition, agentic to react and explore the consequence |
| Smoke tests | Scripted (need cheap, reliable signal) |
| Cross-feature emergent-bug hunting | Agentic |

#### The Trap to Avoid

Agentic browser-use is **not "a script written in English."** Handing the agent step-by-step instructions — "click here, then type X, then click submit, then verify Y" — is a fragile script with extra tokens and worse determinism. The whole value of agentic mode is **goal-orientation**:

> *"You are a cramming college student. You have a chemistry midterm in three days. Use this PDF to generate a 20-question practice exam with an answer key. Report what you experienced — what was easy, what was confusing, what felt off."*

If you find yourself writing more than two or three sentences of procedural instruction inside an agentic test, you're using the wrong tool. Switch to scripted, or rewrite the prompt as a goal.

#### Implementation Reality

ExamPull's testing harness is **subagent-driven**. The orchestration runtime spawns fresh-context subagents that drive a browser in either of the two modes; the runtime is harness-agnostic (works for any agent platform that supports fresh-context subagent spawning, screenshot capture, and tool-driven browser control).

**Browser driver — minimum bar:**
- **Playwright** is the **minimum** required driver. Every test surface must work with a Playwright-backed scripted runner so the regression net is always available, deterministic, and cheap.

**Browser driver — encouraged additions, run in parallel:**
- **Native computer-use** primitives offered by the harness (where available) — driving the actual browser the way a human would, with mouse and keyboard events at the OS level. Catches issues a Playwright `page.click()` skips (real cursor trail, true scroll inertia, virtual-keyboard interactions on touch).
- **Browser-use libraries** that wrap Playwright with vision + LLM reasoning at every step. Same DOM as Playwright, but the action selection is goal-driven.
- **Custom validators** the agent invents during the build — e.g., a screenshot-diff service, a Lighthouse runner, a a11y scanner — each running independently in parallel as a side-channel oracle. The loop strengthens through *parallel diversity of validation*, not through one perfect validator.

**Modes within any of the above drivers:**

- **Scripted mode** — a subagent writes a deterministic browser script (Playwright preferred; other drivers acceptable) and executes it. The script is the action sequence.
- **Agentic mode** — a subagent runs the browser driver as a tool: at each step it captures a screenshot, reasons about what to do next given the persona's goal, and issues the next driver action (`page.click(selector)`, `page.fill(...)`, `page.goto(...)`, or the equivalent for whichever driver). The loop is *perceive → reason → act → observe → repeat* until the goal is achieved or the agent gives up.

The harness is unified at the evidence layer: every driver writes screenshots, video, and traces to the same evidence dossier (per §8). The Lead aggregator triages findings without caring which driver produced them; cross-driver agreement on a finding is a stronger signal than any single driver alone.

**Agentic-primary for persona/discovery work, scripted-primary for regression/performance.** A mature loop runs *all* available drivers in parallel: Playwright scripted as the cheap regression net, agentic Playwright + computer-use + browser-use as the deep exploratory probes, custom validators as side-channels. More independent oracles → fewer escaped bugs.

#### Why This Matters

A test suite of 500 scripted flows that all pass is consistent with a product that is *broken in ways nobody scripted for*. A user encountering a layout glitch on a viewport you didn't script, a microcopy ambiguity in a state you didn't enumerate, a wayfinding failure in an entry path you didn't anticipate — none of these will fail a scripted test. They will fail the user.

Agentic browser-use is the only way to test the **negative space** — the bugs that exist because we didn't think to look for them. Without it, the test suite is a confidence machine for the failures we already imagined, blind to the rest.

---

## 7. The Quality Oracle

The hardest problem in autonomous testing: **how does the test know what "right" looks like?** Especially for subjective things like "does this empty state feel inviting" or "is this animation smooth."

We use three classes of oracle, in order of preference where applicable.

### Hard Oracles (mechanical truth)
The test asserts a precise expectation: a count, a value, a presence, a URL, a database state. Examples:
- After successful sign-up, a Firestore user document exists with the expected fields.
- After purchasing a credit pack, the user's credit balance increased by exactly the pack size.
- After deleting a class, navigating to that class's URL returns 404.
- The "Generate" button is disabled when the user has insufficient credits.

Hard oracles are unambiguous, fast, and reliable. **Use them whenever possible.** Most functional correctness is testable this way.

### Reference Oracles (comparison to known-good)
The test compares output to a stored baseline. Examples:
- A screenshot of the dashboard at a fixed viewport matches the baseline within a tolerance.
- A generated exam PDF's structure matches a reference (same number of questions, same section headers).
- A generated topic list contains the same canonical topics as a reference for the same input.

Reference oracles catch **regressions** but not **always-was-bad**. A baseline of an ugly design still matches an ugly design. Use them as a safety net, not as the sole judge of quality.

### Soft Oracles (rubric-based judgment by an LLM)
The test presents an artifact (screenshot, video, transcript) to a vision/text-capable model along with a rubric, and asks for judgment. Examples:
- "Does this empty state encourage the user to take action? Rate 1–5 against the criteria in §11 of `DESIGN_PHILOSOPHY.md`."
- "Watch this video of the generation tracker. Is the motion purposeful, smooth, and free of jank?"
- "Read this error message. Does it tell the user what happened, why, and what they can do? Rate against the microcopy guidance in §10 of `DESIGN_PHILOSOPHY.md`."

#### Rules for Soft Oracles
- **Always pass the rubric.** A judgment without criteria is a vibe. The judge gets the relevant section of `DESIGN_PHILOSOPHY.md` or `prd.md` as context.
- **Always pass the artifact, not a description.** The judge looks at the screenshot, not a summary of the screenshot.
- **Demand specificity.** A judgment must point to *what* is wrong and *why*, not just rate. "3/5 — text feels cramped near the right edge of the credit balance pill, breaking the rhythm" is useful. "Looks okay" is not.
- **Allow the judge to be opinionated.** Phrase prompts to invite criticism, not confirmation. "What is wrong with this screen?" beats "Does this screen look good?"
- **The judge runs as a fresh-context subagent of the harness. NOT as an external API call.** This is a hard rule, mirroring the eval system (`EVAL_PHILOSOPHY.md`). The harness's own multimodal model reads screenshots/video and reasons over them in fresh context; we do not pay an external API to do work the harness already does, and we do not introduce a second model provider's biases.
- **Use a different model than the one that generated the artifact.** If the same model produces and grades, biases compound. The product generates exam content via OpenRouter-routed text models (per `system_design.md` §4); the harness's judge model is structurally separate, so this rule is satisfied by default.

#### Dimensional Scoring (when judgment needs to be aggregable)

For one-off findings, prose criticism is enough. For judgments that need to be *aggregated* — release-readiness rollups, weekly trend reports, regression-baseline tracking, "did this PR's UI changes degrade the design philosophy score" — borrow the dimensional pattern from `EVAL_PHILOSOPHY.md`:

1. Define N dimensions explicitly (e.g., for a UI screen judged against `DESIGN_PHILOSOPHY.md`: material discipline §2/§5, color semantics §3, typography hierarchy §4, motion fidelity §7, microcopy specificity §10, component personality §11).
2. Score each 1–10 with anchor definitions (10 = exemplary, 7–9 = minor issues, 4–6 = noticeable problems, 1–3 = major violations).
3. Apply weights reflecting what matters most for that surface and produce a composite.
4. Require a one-line justification per dimension; flag specific issues separately.

This makes soft judgments comparable across runs and enables CI gates (e.g., "composite drop > 1.0 from baseline blocks deploy" — same pattern the eval system uses). Use the structure when scores need to be tracked; skip it when a finding is a one-off observation that just needs to be filed.

#### The Eval System as a Reference Implementation

`EVAL_PHILOSOPHY.md` describes a working soft-oracle pipeline for the *exam artifact* (Visual Quality, Adherence, Content Quality with a weighted composite, graded by fresh-context subagents reading PNGs + PDFs + LaTeX). It is methodologically the same pattern as a soft oracle in this doc — the difference is scope: eval grades a finished artifact against absolute educational/visual criteria; testing grades the *experience and surfaces* of the product against `DESIGN_PHILOSOPHY.md` and PRD intent. When designing a new soft-oracle judge, look there first for the structural pattern (subagent + multimodal artifact + rubric → JSON score with justifications), then specialize the rubric.

### The Composite Verdict

A flow's overall verdict combines all three oracles:
- All hard oracles pass → functional correctness ✓
- Reference oracles pass (or have justified deltas) → no regression ✓
- Soft oracles pass against rubric → perceptual quality ✓

A failure on any dimension is a failure overall — but the *category* of failure determines triage (P0 functional vs. P2 polish).

---

## 8. Evidence Collection

Every test produces an evidence dossier. Evidence is the substrate of triage, regression analysis, and trust. Without evidence, a test result is hearsay.

### Required Evidence (always)
- **Outcome**: pass / fail / blocked, with a single-sentence summary.
- **Persona & intention**: which user, what goal.
- **Reproduction recipe**: the exact sequence of actions, in plain language, sufficient for a human to redo manually.
- **Console & network log**: errors, warnings, failed requests, suspicious latency.
- **Final screenshot**: the last visible state at the end of the test.

### Conditional Evidence (when relevant)
- **Step-by-step screenshots**: at each meaningful state transition (page load, modal open, form submit, response received). Not every click — a flow with 30 clicks doesn't need 30 screenshots; ~5–10 well-chosen ones tell the story.
- **Video recording**: for any test asserting motion quality, transition smoothness, or generation flow. Static images cannot capture jank.
- **Performance trace**: for any test asserting "feels fast." Includes paint timings, layout-shift events, frame-rate samples during animation.
- **DOM snapshot**: when the test failed and the screenshot is ambiguous about *why*.
- **Backend state diff**: for tests where the relevant outcome is a database/storage change (e.g., credit deduction, subscription update).
- **Generated artifact**: for exam-generation tests, the resulting PDF and answer key are part of the evidence.

### Evidence Hygiene

- **Evidence is structured, not free-form.** A test report is a parseable document, not a paragraph. The orchestrator must be able to aggregate.
- **Evidence is timestamped.** Both wall-clock and relative-to-test-start.
- **Evidence is reproducible.** A reader of the dossier should be able to recreate the failure on their machine in under 5 minutes.
- **Evidence is retained.** Pass evidence stays for at least one regression cycle so we can compare. Fail evidence stays until the bug is fixed and re-verified.

---

## 9. Mock Data & Test Resources

Autonomous testing requires a **rich, realistic, safe library of test inputs**. Real user data is off-limits. Real charges are off-limits. Real phone bills are off-limits. We construct a synthetic universe that exercises the product fully.

### Test Materials Library

The product accepts diverse uploads: PDFs, slides, docs, text, images, video, links. The mock library covers:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Canonical study materials** | Happy-path topic extraction across subjects | A 30-page calculus chapter, a chemistry lecture deck, a Shakespeare essay PDF, a history syllabus, an econ problem set |
| **Long documents** | Smart-PDF TOC extraction | 200+ page textbook PDFs with real tables of contents |
| **Edge formats** | Format conversion paths | A Word doc, a PowerPoint, a scanned-image PDF, a handwritten notes photo |
| **Tiny/empty** | Boundary conditions | A 1-page PDF, a blank PDF, a single-paragraph .txt file |
| **Oversized** | Limit enforcement | A 100MB PDF (at limit), a 150MB PDF (over limit) |
| **Adversarial content** | Validation | A PDF that's actually a renamed image, a corrupted PDF, a password-protected PDF |
| **Ambiguous content** | Topic-extraction stress | A PDF in a language other than English, a PDF of pure formulas with no prose, a PDF that mixes three subjects |
| **Web links** | Link processing | A Wikipedia article URL, a YouTube lecture URL (short and long), a paywalled article URL, a 404 URL |
| **Video** | Video pipeline | A short lecture video (under length limit), a long video (over limit), a video with audio-only content, a video with no useful content |

The library is **versioned and synthetic**. We do not use real student work. Sources:
- Open educational resources (OER) — public domain textbooks, OpenStax content, project Gutenberg
- AI-generated synthetic content — when we need a "100-page chemistry textbook with TOC and three chapters about thermodynamics," we generate it once and store it
- Hand-crafted edge cases — the 1-page PDF, the corrupted file, the password-protected file are crafted intentionally

The library lives outside the repo (it's binary and large). Tests reference it by ID, not by path-to-file-someone-needs-to-have-locally.

### Test Accounts & Tier States

Authentic testing requires accounts at every tier with every state combination. Maintain a pool:

| Account State | Purpose |
|---------------|---------|
| Anonymous (no account) | Preview flows, sign-up flows, abuse prevention |
| Fresh free user (no exams, full credit balance) | Onboarding, first exam |
| Free user with exams (mid-funnel) | Library, returning user |
| Free user with depleted credits | Upgrade prompts, blocked actions |
| Free user with consumed Boost | Boost edge cases (already-used) |
| Free user, never-touched Boost | Boost flow, regret recovery |
| Scholar user (mid-cycle, mid-credit) | Standard paid flows |
| Scholar annual subscriber | Cancellation behavior |
| Guru user with rolled-over credits | Rollover, downgrade transitions |
| User in payment-failure grace period | Grace-period UX, recovery |
| User with linked accounts (multiple emails/Google) | Linking edge cases |
| User with archived classes | Archive UX |
| User with deleted classes referenced by exams | Clone-blocking, orphaned exam display |
| Power user (47 classes, 400 exams) | Scale, library performance |
| Returner (last active 60+ days ago) | Welcome-back panel |
| Account scheduled for deletion | Deletion flow, anonymization |

These accounts are **reset to known states** between test runs. A test that depends on "fresh free user with 40 credits" must guarantee that state — either by fixture (a script that resets the account before the test) or by isolation (each run gets a freshly-created account).

### Payment Resources

- **Stripe test mode** for everything. Real Stripe API, test keys, test cards covering: success, declined, requires-3DS-auth, expired, insufficient funds, processing-error, network-failure.
- **Stored payment methods**: at least one test account has a stored card; another has none; another has a card that's about to expire.
- **Webhook simulation**: subscription.created, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted. Trigger via Stripe CLI in tests or via direct webhook POSTs with valid signatures.

### Phone & SMS Resources

- **Firebase Auth test phone numbers**: pre-configured numbers that always succeed verification with predictable codes. No real SMS sent.
- **Test numbers across countries**: at least one US, one EU, one Asia-Pacific, one with a country code we'd otherwise never see.
- **Adversarial numbers**: a number already on another test account (linking conflict), a number on a "dormant" account (testing 180-day rule).

### Email Resources

- **A test email service** (Mailosaur, EtherealMail, or a dedicated catch-all domain) that lets tests programmatically read the contents of welcome emails, password resets, payment receipts, and grace-period reminders.
- **Verifying email content**: a test of password recovery isn't done when "we sent an email" — it's done when the test reads the email, extracts the reset link, follows it, and completes the reset.

### AI & External Resources

- **Vertex AI**: real calls in test mode (no separate "mock Vertex"). Cheaper than building a mock. Test runs are isolated to a budget cap with monitoring; if a test loop runs away, alarms fire.
- **Latex compilation service**: real, against the deployed Cloud Run service.
- **Where mocking is used**: the layer is mocked when the test's purpose is to inject a *failure mode* the real service won't reliably produce — e.g., "what does the UI do when Vertex returns a 503?" The mock injects a 503; the real service almost never does on demand.

### Cleanup

Every test run leaves state. Without cleanup, the test environment becomes a graveyard of stale accounts, half-finished exams, abandoned uploads, and zombie subscriptions. Cleanup is part of the test, not an afterthought:

- **Per-test**: anonymous uploads, throwaway accounts, draft exams.
- **Per-run**: subscriptions cancelled (Stripe test mode), Firestore documents in test collections purged.
- **Daily**: a sweeper job removes anything older than the longest test horizon.
- **Pre-flight**: every test starts with an *assertion* of the expected initial state — if the world isn't what the test expected, fail fast with a clear setup error rather than producing misleading results.

---

## 10. Adversarial & Chaos Testing

The PRD enumerates the happy paths. The product survives because we test the *unhappy* paths just as rigorously.

### Categories of Chaos

**Network chaos**:
- Slow connection (3G throttling)
- Intermittent connection (drop every 30 seconds)
- Offline mid-action
- High latency on specific endpoints (simulate a slow Vertex call)
- Out-of-order responses (rare, but happens with retries)

**Timing chaos**:
- Rapid double-click on the same button
- Submit, then refresh before response
- Long idle (15+ minutes) between steps
- Two actions racing (open second tab, submit different action)
- Click "Generate" exactly as the credit balance refreshes

**State chaos**:
- Refresh in the middle of every multi-step flow
- Browser back button in places it logically shouldn't be used (mid-payment)
- Same account in two tabs, simultaneous mutations
- Same account on two devices, divergent actions
- Sign out from one tab while another tab has an in-flight action
- Subscription downgrades via webhook *during* an exam generation (PRD §5.4 tier snapshot)

**Input chaos**:
- Empty everything (titles, descriptions, focus fields)
- Maximum-length everything (500 emoji as a class name)
- Unicode, RTL text, control characters, zero-width spaces
- HTML and script tags in text fields (XSS attempt)
- SQL-injection-shaped strings (we don't use SQL but the patterns probe sanitization)
- Whitespace-only inputs (trimmed to empty?)
- Numbers as strings, strings as numbers, dates as strings

**Auth chaos**:
- Token expires mid-flow
- Account deleted by admin while user is signed in elsewhere
- User signs in from a new device while session active on old
- Phone number recycled (tests dormant-account rule)

**Resource chaos**:
- Quota hit exactly at the limit
- Quota hit just over (1 over, 50 over)
- Credit balance goes negative due to a race (does it auto-correct? does it block?)
- Cloud Storage hiccup mid-upload
- LaTeX service returns a 503 (PRD §5.4 says infra failures don't burn QA budget — verify)
- AI returns garbage that doesn't parse (test recovery)
- AI returns plausibly-correct-but-actually-wrong output (the eval system, not unit tests, catches this)

**Time chaos**:
- Action straddles midnight (does the credit cycle reset correctly?)
- Action straddles billing renewal (does the user get billed twice or zero times?)
- Action right before grace period expires
- Account state changes (Boost consumed, tier changed) right before reading

### How Chaos Tests Are Structured

Chaos tests are **persona tests with an injected disruption**. The persona doesn't change; the environment does. The assertion isn't just "no crash" — it's "the user understands what happened and has a clear next step."

A chaos test that ends with "the page showed an unhandled error" fails. A chaos test that ends with "the user saw 'Connection lost — your draft is saved, try again when you're back online'" passes.

### The "What If You Did The Worst Thing" Pass

Once per major release, run an adversarial pass where a single subagent's instruction is: *"You are trying to break this product. Use any combination of inputs, timing, navigation, and tools. Do not destroy other users' data. Find anything that crashes, deceives, leaks, or fails silently."*

This is the closest automated analog to a security/quality red-team. It surfaces things test plans never anticipated.

---

## 11. Performance, Motion, and Feel

Functional tests measure correctness. Performance tests measure *experience*. They are not optional.

### Numerical Targets

These are commitments, not aspirations. A test that finds the product missing them produces a P1 finding.

| Metric | Target | Hard Fail |
|--------|--------|-----------|
| Time to first byte | < 400ms | > 1s |
| Largest Contentful Paint (LCP) | < 1.5s | > 2.5s |
| Interaction to Next Paint (INP) | < 100ms | > 200ms |
| Cumulative Layout Shift (CLS) | < 0.05 | > 0.1 |
| Time from action click to *any* visible feedback | < 100ms | > 200ms |
| Time from "Generate" click to first stage visible in tracker | < 1s | > 3s |
| 60 FPS during all UI animations | sustained | drop below 30 |

### Motion Quality

Per `DESIGN_PHILOSOPHY.md` §7, motion is part of the brand. It must be measured, not just observed.

- **Record video** during animations and analyze frame timings.
- **Sample frame rates** during ambient orb motion, page transitions, the generation tracker's stage advances.
- **Verify no layout shift** during entry animations (animate transform/opacity, not properties that reflow layout).
- **Verify reduced-motion fallback**: with `prefers-reduced-motion: reduce` set, orbs stop drifting, transforms become opacity, durations shorten — and nothing is visually broken.

### Feel — the most subjective dimension

"Feel" is the gap between the metrics passing and the user being delighted. Things to test that aren't captured by numbers alone:

- **Acknowledgment latency**: a button press should *visually respond* (color shift, scale, micro-motion) within one frame (16ms) regardless of when the underlying request resolves. The user's brain pairs the click with the response — if there's a 200ms gap, it feels broken even if the request finished in 50ms.
- **Loading honesty**: a loading state that says "Loading…" forever feels broken. A loading state that says "Reading pages 87–142…" feels alive. Tests verify the *content* of loading states, not just their presence.
- **Optimistic rollback**: if an optimistic update fails, the rollback should be smooth and explained. A janky reversion feels like a bug even when correct.
- **Focus return**: closing a modal should return focus to the element that opened it. Closing a sheet should not scroll the underlying page. Tests verify focus management explicitly.
- **Scroll restoration**: navigating away and back should restore scroll position when intuitive (returning to library after viewing an exam) and reset when intuitive (going to a new exam page from scratch).

These are tested by a combination of automated probes (focus assertion, scroll assertion) and soft-oracle judgment (reviewing video of the interaction).

---

## 12. Visual Verification (Beyond Screenshots)

Static screenshot diffing is the **floor** of visual testing, not the ceiling. We use it as a regression guard but rely on more for quality.

### What Screenshots Catch
- Layout drift between releases
- Color/theme regressions
- Missing or duplicated elements
- Truncation, overflow, clipping at fixed viewports

### What Screenshots Miss
- Whether an animation is smooth or janky
- Whether a hover state ever appears (a single screenshot is one moment)
- Whether the focus ring is visible during keyboard navigation
- Whether the empty state is *inviting* (visual rubric, not pixel diff)
- Whether typography hierarchy guides the eye correctly
- Whether the design philosophy (atelier vs. artifact, glass discipline, color semantics) is actually applied
- Whether the screen "feels premium" — the most important quality, the least measurable

### Layered Visual Verification

1. **Pixel-diff regression** (mechanical): for stable surfaces (marketing pages, settings, billing), capture baselines and diff at the pixel level. Any diff above tolerance flags for review.
2. **Structural diff** (semi-mechanical): for surfaces with intentional dynamism (dashboard with varying exam counts), diff the *DOM structure and computed styles* rather than pixels. Catches "the card layout broke" without false-positives on "the count went from 3 to 4."
3. **Interaction recording** (video): capture full-screen video of multi-step flows. Used both for motion analysis and as evidence in failure reports.
4. **Soft-oracle visual judgment**: a vision-capable LLM reviews a screen against the design philosophy rubric. Specifically asked to find what's *wrong*, not to confirm what's *right*. Output is a list of specific deviations with severity.
5. **Cross-mode consistency** (light/dark): every visual test runs in both modes. Some bugs only appear in one (invisible light-mode borders, washed-out dark-mode gradients).
6. **Cross-viewport consistency**: every visual test runs at mobile, tablet, and desktop. Layout intent must hold; the test verifies *the intent*, not pixel parity across viewports.

### The Design Philosophy as Test Input

`DESIGN_PHILOSOPHY.md` is not just internal guidance — it is a **test input**. The soft-oracle visual judge gets the relevant section as context. When a screen is reviewed:

- Is glass used per the elevation tiers in §5? (No 4-deep stacks, no glass on body text.)
- Is color used per the semantic discipline in §3? (Indigo only for primary actions, gold only for premium, etc.)
- Is the artifact (paper) surface used wherever exam content renders?
- Is motion within the vocabulary defined in §7?
- Is microcopy specific per §10?

If the screen passes the rubric, it passes visually. If it doesn't, the finding cites the violated principle by section.

---

## 13. Accessibility & Cross-Environment

Accessibility is not a separate test pass. It is **a property of every test**.

### Accessibility Checks Embedded in Every Flow

- Every interactive element must be keyboard-reachable (test flows with the mouse disabled).
- Tab order must match visual order.
- Focus rings must be visible at every focusable element.
- All images and icon-only buttons must have accessible names.
- Form errors must be announced (live region or focus shift).
- Color contrast at body text and interactive elements must meet WCAG AA (4.5:1 for text, 3:1 for large text and graphics).
- Modals must trap focus; Escape must dismiss; focus returns to trigger.
- Screen-reader walks (one persona is the Screen-Reader User) verify the experience end-to-end with assistive tech, not just lint-level checks.

Static accessibility scanners (axe-core, Lighthouse) catch syntax-level issues. Persona-driven walks catch the experiential issues — "the form errors are technically announced but the order is wrong, so the user is told the password is too short before they realize they typed in the email field."

### Cross-Environment Coverage

Every persona × intention test must be run across the matrix:

| Dimension | Values |
|-----------|--------|
| **Viewport** | 375px (mobile), 768px (tablet), 1280px (desktop), 1536px (large desktop) |
| **Browser engine** | Chromium, WebKit, Firefox |
| **Color scheme** | Dark mode (primary), light mode |
| **Network** | Fast (cable), slow (3G throttle), offline |
| **Reduced motion** | On, off |
| **Locale/timezone** | At minimum: en-US/America/Los_Angeles, en-GB/Europe/London, en-AU/Australia/Sydney (catches midnight-rollover bugs in different zones) |
| **Touch vs. pointer** | Mobile = touch primary, desktop = pointer primary |

Not every test runs every cell of the matrix every time — that's combinatorial explosion. Strategy:

- **Smoke matrix**: run on every release, all critical flows × all viewports × dark mode × Chromium. Cheap and catches the most common breakage.
- **Full matrix**: run nightly or pre-release, all flows × full matrix.
- **Risk-targeted**: run on changed code areas — if a payment flow changed, run all payment tests across the full matrix, not the rest.

### iOS Realism

Browser emulation tests behave like iOS Safari but they are not iOS Safari. Some classes of bug — popup blocker behavior after async, scroll bounce, virtual keyboard layout, safe-area-inset rendering — only reproduce reliably on real devices. Plan for periodic real-device passes (BrowserStack-equivalent service or physical devices) for high-stakes mobile flows: sign-up, payment, exam download.

---

## 14. The Autonomous Loop

The goal: a continuous cycle that improves the product without human intervention.

```
                ┌──────────────────────────┐
                │   Test Plan Generation    │
                │  (read PRD + philosophy → │
                │   derive persona × intent  │
                │   scenarios per feature)   │
                └─────────────┬────────────┘
                              ▼
                ┌──────────────────────────┐
                │      Test Execution        │
                │   (spawn N tester subagents│
                │    in parallel, fresh ctx) │
                └─────────────┬────────────┘
                              ▼
                ┌──────────────────────────┐
                │    Evidence Collection     │
                │  (screenshots, video, logs,│
                │   perf traces, artifacts)  │
                └─────────────┬────────────┘
                              ▼
                ┌──────────────────────────┐
                │     Quality Judgment       │
                │  (hard, reference, soft    │
                │   oracles → verdicts)      │
                └─────────────┬────────────┘
                              ▼
                ┌──────────────────────────┐
                │   Aggregation & Triage     │
                │  (lead agent: dedupe,     │
                │   severity, route)        │
                └─────────────┬────────────┘
                              ▼
                ┌──────────────────────────┐
                │     Fix or Queue           │
                │  (auto-fixer for clear     │
                │   bugs; human queue for    │
                │   ambiguous or design      │
                │   decisions)               │
                └─────────────┬────────────┘
                              ▼
                ┌──────────────────────────┐
                │       Re-Test              │
                │  (verify fix, ensure no    │
                │   regression elsewhere)    │
                └─────────────┬────────────┘
                              │
                              └──→ back to top
```

### Loop Cadence

- **Smoke loop**: every deploy. ~5 minutes. Critical flows only.
- **Persona loop**: every 6–12 hours. Full persona × intention matrix on the smoke matrix of environments.
- **Full loop**: nightly. Persona × intention × full environment matrix.
- **Adversarial loop**: weekly. Chaos personas, security probes, "break this product" pass.
- **Visual regression loop**: every deploy + nightly. Pixel and structural diffs.

### Stopping Conditions

The loop runs continuously, but individual passes stop when:

- All tests in the current pass have a verdict (pass, fail, blocked).
- All findings have been triaged (severity assigned, route decided).
- All P0 findings have been routed to fix (and re-tested).
- The loop has produced a pass-rate report with deltas vs. previous run.

A loop pass that "completed" with un-triaged findings is a failed loop. The orchestrator surfaces this as a process bug, not a test bug.

### Human Gates — Narrow by Design

The loop's job is to solve everything it can. Humans are inserted only when *judgment* is required, never when *effort* is required.

1. **Severity disagreement**: the loop assigns P2 but a human bumps to P0, or vice versa. Human override is logged so the auto-triager learns.
2. **Design decisions**: a soft-oracle finding says "this empty state feels hollow." That's not a bug — it's a design call. Routes to the human queue.
3. **Strategic priorities**: a finding may be technically a P1 but business-de-prioritized. Human decision, logged.

Outside these three, the loop runs autonomously and **does not escalate** until it has demonstrably exhausted its own attempts.

### Loop Until Solved

The default fixer disposition is **persist, not punt**. If a finding is mechanical, the auto-fixer fixes it. If it's stubborn, the auto-fixer keeps trying — different approaches, different decompositions, fresh-context retries — until either:

- The fix lands, retest passes, no regression, and the flow is signed off, or
- The loop hits a documented hard blocker (missing credentials, external service truly unreachable, ambiguous spec that maps to one of the three Human Gates above).

A blocker is documented in `BLOCKED.md` with the specific question the human needs to answer. *Without* that documentation, the loop is not blocked — it just hasn't tried enough yet.

Concretely, the autonomous loop stays alive across sessions and time using:

- **`ScheduleWakeup` / `/loop`**: the loop self-paces — short delays (60–270s) when actively iterating on a fix, longer delays (1200–1800s) when waiting on a deploy or eval run
- **`CronCreate`**: scheduled background passes (smoke every deploy, persona pass every 6–12h, full pass nightly, adversarial weekly)
- **Stop-guard hooks**: as documented in `TESTING.md` § Hook Enforcement, the harness blocks "stop" while P0/P1 work remains untested or failing — preventing premature sign-off
- **Fresh-context retry on stuck fixes**: when the same Fixer has tried twice without progress, the next attempt spawns a *new* Fixer subagent with the bug report and a clean context (no prior failed attempts). Often the fresh perspective resolves what an over-invested context cannot.

The bias is: **try literally everything before escalating.** Multiple approaches per finding, multiple personas per regression, multiple fresh contexts before declaring blocked. Escalation is a last resort, not a first impulse.

---

## 15. Reporting & Triage

Findings without triage are noise. Triage without structured findings is impossible. Both must be disciplined.

### The Finding Schema

Every finding produced by any test layer conforms to:

- **ID** — stable, sortable
- **Title** — one sentence, action-oriented ("Sign-up button does nothing on Safari iOS after 3rd attempt")
- **Persona & intention** — context for why this matters
- **Reproduction recipe** — plain language, reproducible
- **Evidence references** — pointers to screenshots, video, logs
- **Category** — functional / perceptual / performance / accessibility / security / chaos
- **Severity (proposed)** — see below
- **Probable surface** — which feature area, which file/component if knowable
- **Notes** — anything else: hypotheses, related findings, "I think this is the same as ID-X"

### Severity Rubric

- **P0 — Critical**: data loss, security hole, primary flow broken, user can't sign up or pay or generate. Drop everything.
- **P1 — Major**: feature broken in a meaningful way, painful workaround required, perceptual quality flagrantly wrong on a primary screen. Fix this release.
- **P2 — Minor**: feature works but with friction, mid-tier perceptual issues, edge-case bugs. Fix soon.
- **P3 — Polish**: nits, micro-improvements, "would be nicer if." Backlog.

Severity is **proposed** by the testing layer and **confirmed** by triage. Confirmation is the human gate or the orchestrator's automatic triager (with override logged).

### Deduplication

The same bug found by 14 personas is one bug, not 14. Triage clusters findings by:

- Same probable surface
- Same error signature (console message, status code, visible symptom)
- Same step in the reproduction recipe

A cluster collapses to one canonical finding with the multiple persona discoveries as context (useful: "this fails for 14 personas → broad impact").

### Trend Reports

The aggregator produces a periodic report:

- Pass rate by feature area
- Pass rate trend over the last N runs (regression spotting)
- Most-common failure categories (functional vs. perceptual vs. perf)
- Mean time to fix by severity
- Soft-oracle scores by screen (which screens are most "off-philosophy")
- Coverage gaps (which PRD sections have no recent test runs)

Trend reports are read by the lead agent (and the human, when relevant) to *direct future test investment*. If a feature area is consistently passing for months, deprioritize it. If a feature area has rising failure rates, increase coverage there.

---

## 16. What We Don't Test

Equally important as what we test. Naming the boundaries prevents wasted effort and false confidence.

- **Real users at scale.** Synthetic personas can approximate a user, but never *be* one. Real-user behavior is observable in production analytics, not test runs.
- **The PRD's correctness.** If the PRD specifies a confusing flow, tests verify the flow matches the spec — not that the spec was a good idea. Bad spec is a different problem.
- **Real money in production payments.** Stripe test mode always.
- **Real SMS/email delivery to real phones/inboxes.** Test phone numbers, test mail catchers.
- **Vendor SLA.** We don't test "is Vertex AI up." We test "what does our product do when Vertex is slow or down" — that's chaos.
- **Long-term durability.** A test run can't tell us if today's exam will still be downloadable in 5 years. That's an operational concern, addressed by storage policies and migrations.
- **Subjective product judgment.** "Should the dashboard show 5 recent exams or 8" is a design call, not a test failure. Tests verify the implementation matches the decision.
- **Exam content quality.** That's `EVAL_PHILOSOPHY.md`'s job. Testing verifies the *pipeline*; eval verifies the *output*. Methodologically, the eval system is a specialized soft-oracle implementation operating on a finished artifact rather than a UI surface — the two systems share the Claude-Code-subagent + rubric + multimodal-artifact pattern, applied to different scopes. They run on coordinated cadences: testing per-deploy and continuously; eval pre-release and on prompt/model changes.
- **Manual human moments that automation can't reach.** The feel of a real iPhone in a real coffee shop with real LTE — periodic real-device passes are scheduled, not part of the autonomous loop.

---

## 17. PRD Coverage Map

A high-level mapping of every PRD §5 feature to the testing layers and personas most relevant. Use this to verify that no feature is uncovered. This is a living map; update when the PRD evolves.

| PRD § | Feature | Primary Layers | Key Personas |
|-------|---------|----------------|--------------|
| 5.1 | Authentication & Accounts | Flow, Adversarial, Cross-Environment | Speed-Clicker, Adversary, Mobile-Only, Returner |
| 5.1 | Account linking & phone conflicts | Adversarial, Flow | Adversary, Edge Inputter |
| 5.2 | Class management | Flow, Persona | Pre-Med Organizer, Power User |
| 5.2 | Education level slider | Flow, Visual | High Schooler, Researcher |
| 5.3 | Exam creation wizard (sources, topics, configure) | Flow, Persona, Visual, Performance | Cramming Student, Researcher, Mobile-Only |
| 5.3 | Long-PDF smart handling | Flow, Performance, Reference Oracle | Researcher |
| 5.3 | Topic extraction failures | Adversarial, Flow | Edge Inputter, Adversary |
| 5.4 | Exam generation pipeline (pipeline mechanics — chaos, perf, recovery, status, credit deduction) | Flow, Performance, Chaos, Reference Oracle | Cramming Student, Network-Toggler, Refresher |
| 5.4 | Exam generation pipeline (artifact content quality — questions, answers, LaTeX visual quality) | **Owned by `EVAL_PHILOSOPHY.md`** — runs eval suite pre-release and on model/prompt changes | n/a (eval system) |
| 5.4 | Generation progress UX | Visual, Performance, Soft Oracle | All |
| 5.4 | Tier snapshot & credit reservation | Adversarial, Chaos | Tab-Hopper, Adversary |
| 5.5 | Power Mode test builder | Flow, Persona, Performance | High Schooler, Mobile-Only, Power User |
| 5.5 | Drag-and-drop / mobile reorder | Cross-Environment, Persona | Mobile-Only |
| 5.6 | No-account preview | Flow, Adversarial, Performance | New Visitor (special), Adversary |
| 5.6 | Share links & answer-key visibility | Flow, Adversarial | Adversary, Pre-Med Organizer |
| 5.6 | Preview abuse prevention | Adversarial | Adversary |
| 5.7 | Exam feedback / grading | Flow, Reference Oracle, Chaos | Pre-Med Organizer, Edge Inputter |
| 5.7 | Sanity check & failure cap | Adversarial | Adversary |
| 5.8 | Visual annotation (Guru) | Flow, Reference Oracle, Performance | Pre-Med Organizer (Guru variant) |
| 5.9 | Exam library (search, filter, bulk) | Flow, Persona, Performance | Power User, Pre-Med Organizer |
| 5.9 | Generating exam visibility | Flow, Performance, Visual | Tab-Hopper, Refresher |
| 5.9 | Exam detail page & clone | Flow, Persona | Cramming Student, Researcher |
| 5.10 | Generation metadata & cost tracking | Unit, Integration | n/a (backend) |
| 5.11 | Exam rating & feedback | Flow | Researcher |
| 5.12 | Admin dashboard | Flow, Persona | Admin (special) |
| 5.13 | Dashboard & onboarding | Flow, Persona, Visual | New Free User, Returner |
| 5.13 | Welcome-back panel | Flow, Reference Oracle | Returner |
| 5.13 | Early-exam quality recovery | Flow | New Free User, Cramming Student |
| 5.13 | Scholar Boost discovery | Flow, Persona | New Free User, Edge Inputter |
| 5.14 | Email & SMS notifications | Integration, Flow | Tab-Hopper, Returner |
| 5.15 | Public pages | Flow, Visual, Performance, Cross-Environment | New Visitor |
| 5.16 | Referral program | Flow, Adversarial | Power User, Adversary |
| 5.17 | In-app notification center | Flow, Visual | Tab-Hopper, Power User |
| 5.18 | Theme & appearance | Cross-Environment, Visual | All |

If a PRD feature is not in this table, the table is wrong — add it. If a row in this table is failing in recent loops, that area needs investment.

---

## 18. How To Use This Document

- **When designing a new test scenario**: re-read §3 (User-Tester Mindset) and §4 (Personas). Anchor in a persona before drafting steps.
- **When deciding what layer to use**: §5 (Layers of Testing) and §17 (Coverage Map).
- **When uncertain how to judge a result**: §7 (Quality Oracle).
- **When constructing test data**: §9 (Mock Data).
- **When the autonomous loop misbehaves**: §14 (Autonomous Loop) and §15 (Triage).
- **When pushing back on a finding**: §16 (What We Don't Test). If it's out of scope, say so.

When this doc and operational docs (`TESTING.md`, `TESTER_PROMPT.md`, `TEST_FLOWS.md`) disagree, **this doc wins on principle, the operational docs win on mechanics**. If they're irreconcilable, the operational doc is wrong and needs updating.

---

## 19. Open Questions

Things this document deliberately leaves open. Resolve as the loop matures.

1. **Auto-fixer maturity.** Default disposition: **the loop fixes everything it can and keeps trying until it can't.** Human escalation is reserved for the three Human Gates in §14. Mechanical fixes (typos, aria-labels, dead links) are trivial; logic bugs, layout drift, perf regressions, and broken integrations are all in scope for the auto-fixer to attempt across multiple fresh-context retries before falling back to a Human Gate. The open question is *how many retries before falling back*, not *whether to attempt*.
2. **Synthetic user behavior modeling.** Personas as agent prompts are a coarse approximation of real users. A future investment is replaying anonymized session traces from production through the loop. Out of scope until we have meaningful production traffic.
3. **Eval-loop integration.** `EVAL_PHILOSOPHY.md` defines content-quality grading for generated exams. Should the autonomous testing loop also re-run the eval suite on every release? Probably yes, but with a separate cadence (eval is expensive). Wire-up TBD.
4. **Real-device coverage cadence.** How often do we run real-device passes? Initial: weekly for top-traffic mobile flows. Adjust based on production crash reports.
5. **Soft-oracle drift.** As the design philosophy evolves, soft-oracle judgments may drift. Track historical judgments per screen so we can spot when "the rubric changed" vs "the screen got worse."
6. **Cost ceiling for the loop itself.** The autonomous loop consumes API budget (Vertex calls in tests, vision-model judgments, agent runs). Set monthly caps and alarm on overshoot. Initial budget TBD with finance/admin telemetry.

---

## Appendix A: Glossary

- **Persona**: a stable user archetype with a defined goal and constraints. Tests are anchored to personas.
- **Intention**: a single sentence describing what the persona wants to accomplish.
- **Flow**: the sequence of screens and interactions a persona takes pursuing an intention.
- **Oracle**: the mechanism by which a test decides pass vs. fail. Hard, reference, or soft.
- **Soft oracle**: an LLM judge given a rubric and an artifact, asked for opinionated criticism.
- **Subagent**: a tester instance with fresh context, owning one flow.
- **Evidence dossier**: the structured record produced by a test run.
- **Triage**: the process of taking findings, deduping, severity-rating, and routing.
- **Loop pass**: one full cycle of plan → execute → judge → triage → fix-or-queue → re-test.
- **The matrix**: the cross-product of viewport × browser × theme × network × motion × locale.
- **Atelier / Artifact**: from `DESIGN_PHILOSOPHY.md` — the workshop UI vs. the exam paper. Tests verify both surfaces appropriately.

---

## Appendix B: Adjacent Documents

- `DESIGN_PHILOSOPHY.md` — visual and interaction philosophy. Used as soft-oracle rubric input.
- `EVAL_PHILOSOPHY.md` — content-quality grading for generated exams. A specialized form of testing for the exam artifact.
- `TESTING.md` — operational details of the current testing setup (Playwright, agent teams, browser matrix). The "how it runs today."
- `TESTER_PROMPT.md` — current prompt template for tester agents. Should evolve to embody this document.
- `TEST_FLOWS.md` — the enumerated flows currently exercised. Should be regenerated periodically from the PRD coverage map.
- `prd.md` — what we test against.
- `system_design.md` — the system whose behavior we verify.
