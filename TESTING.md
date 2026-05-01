# ExamPull — Production Testing Methodology

## Scope & Companion Documents

This is the **operational** testing doc — tools, commands, agent mechanics, browser matrices, the execution loop. The **philosophy** of testing — why we test the way we do, the user-tester mindset, persona definitions, oracle taxonomy, the autonomous loop architecture, scripted-vs-agentic browser interaction — lives in `TESTING_PHILOSOPHY.md`. When the two disagree, philosophy wins on principle; this doc wins on mechanics.

Adjacent context that informs testing decisions:
- `prd.md` — what we test against
- `DESIGN_PHILOSOPHY.md` — soft-oracle rubric input for perceptual quality judgments
- `EVAL_PHILOSOPHY.md` — exam-content quality grading (a specialized form of testing)
- `TEST_FLOWS.md` — the enumerated flows currently exercised
- `TESTER_PROMPT.md` — the prompt template for tester agents

## Philosophy

Testing is governed by **deployment parity**: if a test passes only because it ran in a controlled environment, it has not validated user experience. The **active `main` deployment on the App Hosting backend** (resolved via `${WEB_URL}`) is the final gate for every flow — no flow is signed off until it passes there.

Pre-deployment environments (preview channels, local emulators) are not forbidden — they exist for fast iteration during development, for chaos injection that can't safely run on the live backend (forced 503s on AI providers, simulated Stripe webhook delays, account states that would be polluting), and for verifying changes before they merge. They do not, however, count for sign-off.

**Bootstrap exemption**: during the pre-launch bootstrap phase — when there is no `main` deployment of a feature yet — the gate relaxes to "the App Hosting preview channel for the current PR" or "the latest deploy on the agent's working backend." The standard tightens back to full deployment parity once the feature is merged. The Lead Agent is responsible for tracking which phase a given flow is in.

We test not just that features work, but that they work **well** — fast, smooth, accessible, resilient to user behavior. The standard is production gold: zero bugs, zero rough edges, zero "it works if you do it exactly right."

Visual and perceptual quality are judged against `DESIGN_PHILOSOPHY.md` using soft oracles (LLM-with-vision against the rubric). A flow that functionally passes but fails the design rubric is a failed flow, severity proportional to the violation.

## Flow Enumeration Formula

For each **feature** (not page — one page may have many features), systematically enumerate flows by applying these dimensions. Coverage is risk-weighted, not exhaustive — apply judgment about which combinations are worth running. A primary flow at minimum covers dimensions 1, 2, 3, 9, and 10.

### 1. Happy Path
The intended flow works start to finish with valid inputs and expected conditions.

### 2. Entry Variations
How can a user arrive at this feature?
- Direct URL (typing/bookmarking)
- Navigation (clicking links/buttons)
- Redirect (from middleware, after auth, etc.)
- Back/forward browser buttons
- Deep link from external source

### 3. State Variations
What user states exist?
- Anonymous (not signed in)
- Signed in — Free tier
- Signed in — Scholar tier
- Signed in — Guru tier
- New user (just created account, no data)
- Existing user (has classes, exams, etc.)
- Expired/invalid session
- User in payment-failure grace period
- User with consumed Boost vs. unused Boost
- User with archived classes / deleted classes referenced by exams
- Power-user state (47 classes, 400+ exams) for scale

### 4. Interruption Points
At each step in the flow:
- Hard refresh (F5 / Cmd+R)
- Close tab and reopen
- Browser back button
- Lose internet connection (airplane mode)
- Slow connection (throttled)
- Switch to different tab and come back

### 5. Input Variations
- Empty/blank inputs
- Maximum length inputs
- Special characters (unicode, emoji, HTML tags, SQL injection attempts, RTL text, control chars)
- Invalid format (wrong email format, too-short password)
- Duplicate data (same email, same class name)
- Boundary values (exactly at limit)
- Whitespace-only inputs (trimmed to empty?)

### 6. Concurrent/Race Conditions
- Multiple tabs open to same page
- Rapid double-click on submit buttons
- Two actions happening simultaneously
- Same account signed in on two browsers
- Action exactly at the moment a server-side state change lands (credit refresh, subscription cycle boundary, webhook arrival)

### 7. Failure Modes
- API returns error
- API is slow (>5 seconds)
- External service unavailable (Stripe, Firebase, Vertex AI)
- Quota exceeded (exam generation limit)
- File upload fails midway
- Network timeout during long operation
- AI returns garbage that doesn't parse (test recovery)
- LaTeX service returns 503 (verify it does NOT consume QA iteration budget per PRD §5.4)

### 8. Cross-Feature Interactions
- Delete a class that has exams linked to it
- Change subscription tier while generating an exam
- Sign out while an upload is in progress
- Create exam from class that was just deleted in another tab
- Subscription downgrade webhook fires *during* exam generation (PRD §5.4 tier snapshot)

### 9. Persona Variations
Run the flow as different personas to surface failures invisible to a generic tester. Personas are defined in `TESTING_PHILOSOPHY.md` §4. Every primary flow runs under at minimum:
- The intent-driven persona most natural to the flow (e.g., Cramming Student for fast exam generation; Researcher for long-PDF flows)
- One adversarial persona drawn from: Mobile-Only, Refresher, Network-Toggler, Tab-Hopper, Edge Inputter, Adversary, Returner, Power User
- The Screen-Reader User (accessibility verification end-to-end, not just lint-level checks)

A flow tested only by an instruction-follower has not been tested. The persona is the test's anchor.

### 10. Visual & Perceptual Conformance
Every screen the flow touches is judged against `DESIGN_PHILOSOPHY.md`:
- Atelier vs. Artifact materials used correctly? (glass for the workshop, paper for exam content)
- Glass elevation tiers respected (no 4-deep stacks, no glass on body text)?
- Color semantic discipline followed (indigo only for primary, gold only for premium, crimson only for destructive, verdant only for "good")?
- Motion vocabulary respected (lift, press, settle, sweep, drift, pulse — nothing outside)?
- Microcopy specific per design philosophy §10 ("Reading pages 87–142…", not "Loading…")?
- Performance budgets met (LCP, INP, CLS — see Quality Criteria)?

Soft-oracle dimension — judged by an LLM-with-vision against the philosophy as rubric, expected to be opinionated and specific ("the credit balance pill text feels cramped near the right edge, breaking the rhythm" is useful; "looks fine" is not).

## Browser & Device Matrix

Every feature must be tested across all supported browsers and devices. Do not test only on desktop Chrome — mobile and cross-browser bugs (like the iOS Safari popup blocker issue with downloads) are real and common.

### Required Test Targets

| Project Name | Engine | Device | Viewport | Use Case |
|-------------|--------|--------|----------|----------|
| `desktop-chrome` | Chromium | Desktop | 1280x720 | Primary desktop browser |
| `desktop-safari` | WebKit | Desktop | 1280x720 | macOS Safari — different rendering engine |
| `desktop-edge` | Chromium | Desktop | 1280x720 | Windows users — Edge-specific behaviors |
| `mobile-safari` | WebKit | iPhone 14 | 390x664 | iOS Safari — strictest popup/download rules |
| `mobile-android` | Chromium | Pixel 7 | 412x839 | Android Chrome — most common mobile browser |

### Running Tests by Project

```bash
# Single project
pnpm exec playwright test --project=mobile-safari --config=playwright.prod.config.ts

# Multiple projects
pnpm exec playwright test --project=desktop-chrome --project=mobile-safari

# All projects (runs every test on every browser/device)
pnpm exec playwright test --config=playwright.prod.config.ts
```

### How Playwright Emulation Works

Playwright does NOT use real mobile browsers or real devices. It uses the same three browser engines (Chromium, WebKit, Firefox) but configures them to **behave like** a specific device:

- **Viewport**: Set to the device's screen dimensions
- **User-Agent**: Set to the device's browser UA string (so servers return mobile responses)
- **Device scale factor**: Set to match the device's pixel density (e.g. 3x for iPhone Retina)
- **Touch events**: Enabled (`hasTouch: true`) so touch-dependent code paths execute
- **Mobile mode**: `isMobile: true` triggers mobile CSS media queries (`@media (hover: none)`, `@media (pointer: coarse)`)

### What Emulation Catches vs. Doesn't

**Catches (test for these):**
- Responsive layout issues (viewport-based CSS breakpoints)
- Touch target sizing problems (buttons too small to tap)
- Elements overflowing narrow viewports (horizontal scroll)
- User-Agent-dependent code paths
- CSS `@media (hover: none)` and `@media (pointer: coarse)` rules
- Popup blocker behavior (WebKit blocks `window.open()` after async calls)
- Download behavior differences across engines

**Doesn't catch (real-device passes needed — see below):**
- Real Safari-specific rendering quirks beyond upstream WebKit
- iOS browser chrome (address bar, safe area insets, notch)
- Real network conditions (3G/LTE latency)
- Native OS behaviors (iOS pull-to-refresh, Android back gesture)
- Real touch gesture physics (inertial scroll, pinch-zoom)
- App Store WebView differences

### iOS Chrome Note

All browsers on iOS (Chrome, Firefox, Edge, etc.) are required by Apple to use WebKit under the hood. "Chrome on iOS" is a skin over WebKit, not real Chromium. Therefore, `mobile-safari` (WebKit + iPhone 14) effectively tests all iOS browsers. A separate "Chrome on iOS" project would test the same rendering engine with a different user-agent string — only needed if the app does UA sniffing.

### Minimum Touch Target Sizes

Per mobile testing, all interactive elements must meet these minimums:
- **Buttons**: 32px minimum height (44px recommended by Apple HIG, 48px by Material Design)
- **Links**: 32px minimum height for navigation links
- **Inputs**: 36px minimum height
- Exceptions: visually-hidden accessibility elements (e.g. "Skip to main content" at 1x1px)

### Locale & Timezone Matrix

Browser/device covers form factor; locale/timezone covers what the *clock and calendar* look like to the user. At minimum, run primary flows across:

| Locale | Timezone | What it catches |
|--------|----------|-----------------|
| en-US | America/Los_Angeles | Default — baseline |
| en-GB | Europe/London | Different decimal separator, date format DD/MM/YYYY, different "today" |
| en-AU | Australia/Sydney | Catches midnight-rollover bugs (whose midnight resets the credit cycle?) |

Pay particular attention to:
- Subscription billing renewal flows (cycles can land on different calendar days per timezone)
- Credit reset boundaries (monthly resets at "midnight" — server's? user's?)
- Date display in exam metadata, billing history, library
- Currency display (always USD for v1, but verify formatting respects locale)
- Email timestamps (welcome, receipt, grace-period notices)

### Real-Device Coverage

For v1, mobile coverage is **emulation-only**: Playwright's WebKit + Chromium engines configured per the matrix above. We accept the gap that this doesn't reproduce real iOS browser chrome (safe-area insets, address-bar collapse, virtual keyboard physics, scroll bounce) or real Android system-back-gesture behavior.

The mitigation: be aggressive about emulating what *can* be emulated — touch events, pointer-coarse media queries, mobile UA strings, viewport and DPR — and treat the gap as a known operational risk surfaced via production analytics (Sentry mobile error rates, PostHog mobile conversion deltas) rather than via tests. If a real-device-only bug surfaces in production, we reproduce on a physical device manually for that incident, fix, and move on.

Real-device cadence may be added later (BrowserStack-equivalent) if production telemetry shows mobile-specific issues that emulation cannot catch. Until then, it is **not** part of the autonomous loop.

## Quality Criteria

Every flow is evaluated on ALL of these dimensions:

### Correctness
- Does it produce the right result?
- Is data persisted correctly?
- Are state transitions correct?

### Performance
- **Page load**: Target < 1 second, acceptable < 3 seconds
- **Interaction response**: Target < 200ms for button clicks, form submissions
- **Animation**: Smooth, no jank, 60fps
- **LCP (Largest Contentful Paint)**: < 2.5s
- **CLS (Cumulative Layout Shift)**: < 0.1
- **INP (Interaction to Next Paint)**: < 200ms (replaces FID)
- **Acknowledgment latency**: any visible feedback to a click within 100ms (button color shift, scale, micro-motion), regardless of when the underlying request resolves

### UX Quality
- Loading states shown during async operations?
- Loading copy specific (e.g., "Reading pages 87–142…"), not vague ("Loading…")?
- Error messages helpful and specific?
- Empty states clear and actionable?
- Success feedback visible (toast, redirect, visual change) — but not toast-spammy?
- No layout shifts as content loads?
- Glass/dark theme consistent across all elements?
- Focus return after modal close lands on the trigger element?

### Resilience
- Survives page refresh at any point?
- Recovers gracefully from errors?
- No data loss on interruption?
- Handles slow/intermittent connections?
- In-flight jobs survive client navigation away and back?

### Accessibility
- All interactive elements keyboard navigable?
- Focus indicators visible at every focusable element?
- Screen reader labels on buttons/inputs?
- Color contrast meets WCAG 2.1 AA (4.5:1 for text)?
- Form inputs have associated labels?
- Error states announced to screen readers (aria-live)?
- Modals trap focus; Escape dismisses; focus returns to trigger?
- Tab order matches visual order?

### Visual & Perceptual (per `DESIGN_PHILOSOPHY.md`)
See Flow Enumeration Formula §10. Soft-oracle judged with the design philosophy as rubric.

## Severity Rubric

Every finding is assigned a severity. Triage is **propose-and-confirm**: testers propose, lead/integrator confirms.

| Severity | Definition | Examples |
|----------|------------|----------|
| **P0 — Critical** | Data loss, security hole, primary flow broken (sign-up, payment, exam generation, download), or product-wide breakage. Drop everything. | Generation pipeline silently consumes credits without producing an exam; XSS in class name renders unescaped; share link leaks another user's PDF |
| **P1 — Major** | Feature broken in a meaningful way; painful workaround required; perceptual quality flagrantly wrong on a primary screen; design-philosophy violation that breaks brand consistency. Fix this release. | Power Mode drag-and-drop unusable on tablet; PDF preview shows blank page; light-mode glass borders invisible; "Generate" button uses crimson instead of indigo |
| **P2 — Minor** | Feature works but with friction; mid-tier perceptual issues; edge-case bugs. Fix soon. | Tooltip overflows viewport at 375px; loading copy says "Loading..." instead of being specific; tab order skips the secondary CTA |
| **P3 — Polish** | Nits, micro-improvements, "would be nicer if." Backlog. | 1px misalignment on a card border; hover state could ease in slightly slower; emoji rendering inconsistent across platforms |

A finding without a proposed severity is a process bug — testers must always propose.

## Agent Architecture

### Overview

The testing/fixing pipeline runs as a **batch-driven loop** managed by a **Lead Agent** (the main conversation). The Lead never does testing or fixing itself — it only manages teams, sequences batches, and tracks overall progress. This keeps the Lead's context window clean and focused on orchestration.

### Team Structure

Each batch contains **N flow teams** (target: 5 per batch, adjustable based on complexity). Each flow team consists of:

| Role | Count | Context | Capabilities |
|------|-------|---------|-------------|
| **Tester** | 1 per team | Fresh — no source code, only PRD + flow spec + persona + design-philosophy excerpts | Browser interaction (scripted and/or agentic — see Tester Agent) |
| **Fixer** | 1 per team | Fresh — receives tester's bug report + source code | Full codebase access, code editing, worktree isolation |

Additionally, each batch has one shared agent:

| Role | Count | Context | Capabilities |
|------|-------|---------|-------------|
| **Integrator** | 1 per batch | Deep codebase expertise, reads all N fixers' plans | Full codebase access, conflict resolution, merge, deploy |

### Communication Rules

**Within a team (Tester ↔ Fixer):**
- Communicate via `SendMessage` (direct messages between teammates)
- Do NOT message the Lead Agent — the Lead reads output docs only

**Output Docs (how the Lead monitors progress):**
- Each team writes to: `team-output/{team-name}.md`
- The Integrator writes to: `team-output/integrator-batch-{N}.md`
- These are the Lead's ONLY window into what's happening — agents must keep them current

**Output Doc Format:**
```markdown
# Team {flow-id} — Output
## Phase: {testing | planning | fixing | retesting}
## Flow: {flow-id} — {flow description}
## Persona: {persona name from TESTING_PHILOSOPHY.md §4}
## Intention: {one-sentence user goal}

## Test Results
- **Status**: PASS | FAIL | BLOCKED
- **Mode**: scripted | agentic | hybrid
- **Evidence**: {screenshot paths, video path, console output, timing, perf trace}
- **Soft-oracle judgment**: {if applicable — score and specific notes against design philosophy}
- **Issues Found**:
  - BUG-001 [Pn]: {description}
  - BUG-002 [Pn]: {description}

## Fix Plan (Fixer)
- **Files to modify**: {list}
- **Approach**: {description}
- **Risk**: {what could break}

## Fix Execution
- **Status**: PLANNED | IN_PROGRESS | DONE | NEEDS_INTEGRATOR
- **Changes made**: {summary}
- **New issues**: {if any}

## Retest Results
- **Status**: PASS | FAIL
- **Remaining issues**: {if any}
```

### Agent Roles in Detail

#### Tester Agent
- **Receives**: The specific flow(s) from `TEST_FLOWS.md`, quality criteria from this doc, **persona assignment** (per `TESTING_PHILOSOPHY.md` §4), PRD sections for context, **relevant `DESIGN_PHILOSOPHY.md` excerpts** (for perceptual judgment).
- **Does NOT receive**: Source code, implementation details, knowledge of previous fixes.
- **Tests on**: `${WEB_URL}` (the active App Hosting deployment of `main`) for sign-off; preview channels and local emulators allowed for chaos injection that can't safely run on the deployed backend.
- **Browser interaction modes** — every test runs through fresh-context subagents driving a browser. Playwright is the **minimum** required driver; native computer-use and browser-use libraries are encouraged additional drivers running in parallel. See `TESTING_PHILOSOPHY.md` §6 "Implementation Reality" for the full taxonomy. Choose by purpose:
  - **Scripted (Playwright)**: deterministic, code-driven flows. Preferred for regression of stable flows, performance benchmarks, accessibility mechanical checks (axe-core), and any test where repeatability and precise instrumentation matter.
  - **Agentic (subagent driving any browser driver as a tool)**: the subagent captures screenshots, reasons against the persona's goal, and issues each next driver action. Preferred for persona-driven flows from cold start, discovery passes, perceptual quality judgment, and exploratory adversarial probing. The agent gets a *goal*, not a script — see `TESTING_PHILOSOPHY.md` §6 for the trap to avoid.
  - **Hybrid**: scripted setup (sign in, navigate to a known state) + agentic exploration from there. Common for persona-driven tests on protected routes.
  - **Multi-driver parallel**: when both agentic Playwright AND native computer-use are available, run both on the same flow. Cross-driver agreement on a finding is a much stronger signal than any single driver. Disagreements are themselves evidence — they often mean the bug is real but the driver is hiding it.
- **Mode selection rule**: regression → scripted; persona pursuing intention → agentic; visual judgment → agentic or scripted-then-soft-oracle; performance benchmark → scripted.
- **Must provide**: Evidence for every pass/fail (screenshots, console output, timing measurements; **video where motion is asserted**; performance trace where perf is asserted; generated PDF where exam-generation flows).
- **Writes findings to**: Team output doc.
- **Sends findings to**: Fixer teammate via `SendMessage`.
- **Is "oblivious"**: Each test cycle, the Tester runs fresh — it doesn't know what was fixed, only what the gold standard behavior should be. This prevents confirmation bias.

#### Fixer Agent
- **Receives**: Bug report from Tester (via `SendMessage`), relevant source code access.
- **Phase 1 — PLAN ONLY**: Reads the bug report, explores the codebase, writes a fix plan to the output doc. Does NOT execute changes yet.
- **Phase 2 — EXECUTE**: After the Integrator reviews and approves/adjusts the plan, the Fixer executes changes in a **worktree** (isolated git branch).
- **Writes to**: Team output doc (plan, then execution status).
- **Does NOT**: Deploy, merge to main, or touch other teams' files.

#### Integrator Agent
- **Spawned once per batch**, after all N Fixers have written their plans.
- **Reads**: All N team output docs to understand every planned change.
- **Reviews for**:
  - File conflicts (two Fixers editing the same file)
  - Logical conflicts (changes that would break each other)
  - Architectural consistency (changes that violate project patterns)
  - Missed dependencies (a fix that requires another fix to work)
- **Provides feedback**: Writes adjusted guidance to each team's output doc or sends messages to Fixers.
- **After Fixers execute**: Reviews all worktrees, resolves merge conflicts, merges to main.
- **Deploys**: Handles build and deploy after successful merge.
- **Writes to**: `team-output/integrator-batch-{N}.md`.

### Lead Agent (Orchestrator) Responsibilities

The Lead Agent is the main conversation context. It does NOT test or fix. It:

1. **Splits flows into batches** — groups related flows, prioritizes P0 first
2. **Spawns teams** — creates N teams per batch, all running in background
3. **Monitors progress** — reads output docs periodically (NOT via messages)
4. **Sequences batches** — starts next batch when current one completes
5. **Tracks overall status** — updates `TEST_FLOWS.md` summary stats
6. **Handles blockers** — escalates to user when blocked (see `BLOCKED.md`)
7. **Adjusts batch size** — increases N if things are smooth, decreases if conflicts are high
8. **Manages deploy cadence** — coordinates with Integrator on when to deploy
9. **Maintains coverage map** — verifies every PRD §5 feature has at least one flow (see PRD Coverage Map below)
10. **Surfaces trend reports** — see Regression Baselines & Trend Reports below

**Context discipline**: The Lead's context should contain ONLY batch summaries and flow status. All detailed findings, plans, and code changes live in output docs and agent contexts.

## Execution Loop

```
BATCH LOOP (repeats until all flows pass):
│
├─ 1. PLAN BATCH
│     Lead selects next N flows (P0 first, then P1, P2)
│     Lead assigns persona + browser-interaction mode for each
│     Lead creates team-output/ directory structure
│
├─ 2. SPAWN TEST PHASE
│     For each flow: spawn Team (Tester + Fixer) in background
│     Tester tests flow on ${WEB_URL} (or a preview channel for chaos cases)
│     Tester writes findings to output doc + messages Fixer
│     If flow passes: team marks PASS and exits
│     If flow fails: Fixer reads bug report, proceeds to planning
│
├─ 3. FIX PLANNING PHASE
│     Each Fixer with bugs writes a fix PLAN (not code) to output doc
│     Fixer marks phase as "planning complete" in output doc
│     Lead waits until all N teams have plans (or PASS)
│
├─ 4. INTEGRATION REVIEW
│     Lead spawns Integrator agent (background, separate context)
│     Integrator reads all N output docs
│     Integrator reviews plans for conflicts, provides feedback
│     Integrator writes coordinated guidance to each team's output doc
│     Integrator writes summary to integrator-batch-{N}.md
│
├─ 5. FIX EXECUTION PHASE
│     Each Fixer executes their (potentially adjusted) plan in a worktree
│     Fixer marks execution complete in output doc
│     Lead waits until all Fixers are done
│
├─ 6. MERGE & DEPLOY
│     Integrator merges all worktrees to main
│     Integrator resolves any conflicts
│     Integrator runs typecheck + lint
│     Integrator triggers deploy
│     Integrator writes final status to its output doc
│
├─ 7. RETEST PHASE
│     Lead re-spawns Tester agents (fresh context, oblivious to fixes)
│     Testers verify their flows on production
│     Results written to output docs
│
├─ 8. BATCH SUMMARY
│     Lead reads all output docs
│     Lead updates TEST_FLOWS.md (mark [x] for pass, [!] for fail)
│     Lead notes remaining failures for next batch
│     Lead adjusts batch size/strategy if needed
│     Lead updates trend report (see Regression Baselines)
│
└─ 9. NEXT BATCH or DONE
      If failures remain: loop back to step 1 with failed flows + new flows
      If all pass: run regression sweep + adversarial pass + visual baseline diff, then DONE
```

### Batch Sizing Guidelines

| Factor | Smaller batches (3) | Larger batches (5-6) |
|--------|---------------------|----------------------|
| Flow independence | Flows touch same features | Flows are unrelated |
| Fix complexity | Deep architectural changes | Small UI/logic fixes |
| File overlap risk | High (same components) | Low (different pages) |
| Lead context cost | Lower per batch | Higher per batch |

**Default**: Start with 5 teams per batch. Adjust based on conflict rate from Integrator feedback.

### Failure Modes & Recovery

- **Tester can't reach `${WEB_URL}`**: Mark flow BLOCKED, note in output doc, Lead checks `BLOCKED.md`
- **Fixer plan conflicts with another team**: Integrator resolves during review phase
- **Merge conflicts after execution**: Integrator resolves, may ask Fixers to redo
- **Deploy fails**: Integrator rolls back, Lead spawns debug team
- **Retest still fails after fix**: Flow goes back into next batch with "retry" flag
- **Blocked by external dependency** (Stripe, Google OAuth, etc.): Mark BLOCKED in output doc, Lead adds to `BLOCKED.md`
- **Soft-oracle judgment is borderline**: Tester escalates to Lead with the artifact and the rubric — Lead either accepts the judgment or routes to human (see Human Gates in `TESTING_PHILOSOPHY.md` §14)

## Adversarial Pass

A dedicated phase of the loop, distinct from happy-path testing. **Run weekly**, plus after any major release.

The single instruction to a tester subagent: *"Find anything that crashes, deceives, leaks, or fails silently. Use any combination of inputs, timing, navigation, and tools available to a real user. Do not destroy other users' data."*

Categories of attack to attempt (non-exhaustive — see `TESTING_PHILOSOPHY.md` §10 for the full taxonomy):

- **Network chaos**: throttle, drop, offline mid-action, high latency, out-of-order responses
- **Timing chaos**: rapid double-click, submit-then-refresh, long idle (15+ minutes between steps), two-tab race, action exactly at credit-balance refresh
- **State chaos**: mid-flow refresh, browser back in invalid contexts, two-tab simultaneous mutations, sign-out during in-flight action, mid-pipeline subscription change
- **Input chaos**: empty, max-length, unicode, RTL, control chars, HTML/script tags, SQL-shaped strings, whitespace-only
- **Auth chaos**: token expiration mid-flow, account deleted by admin while signed-in elsewhere, phone recycling
- **Resource chaos**: at-limit / over-limit / negative balances, storage hiccups, LaTeX 503, AI returning garbage
- **Time chaos**: midnight crossover, billing renewal boundary, grace-period expiration, action straddling 12-month annual cycle

Adversarial findings go through the same triage as happy-path findings, but are typically rated by **exposure** (how likely a real user hits this) and **consequence** (data loss > confusion > friction). A low-exposure but high-consequence finding (e.g., a way to view another user's exam) is P0 regardless of how unlikely.

This pass is **agentic-primary** — scripted chaos can inject the disruption, but agentic exploration is what reacts to it like a real user would, not like a script that knows the disruption is coming.

## Test Account Management

### Email/Password Accounts
Using Gmail `+` alias trick — all route to vikram2agrawal@gmail.com:
- Pattern: `vikram2agrawal+{purpose}@gmail.com`
- Password pattern: stored in `.env.test` (gitignored)
- Each flow domain gets dedicated accounts to prevent cross-contamination

### Google OAuth Accounts
- Existing user: vikram2agrawal@gmail.com
- New user (for testing first-time Google sign-up): vikrorious@gmail.com
- Credentials in `.env.test` (gitignored, NEVER committed)

### Tier-Specific Accounts
- Free: default after sign-up
- Scholar: upgrade via Stripe test checkout
- Guru: upgrade via Stripe test checkout
- Accounts are created during test setup, not shared across flow domains

### Account Isolation
- Each tester agent uses unique accounts (different `+` alias)
- Prevents data contamination between test flows
- Playwright sessions use named sessions (`-s=flow-id`) for browser isolation

### Pool of Pre-Configured State Accounts
Beyond per-flow throwaway accounts, maintain a pool of accounts in known states for tests that need them. State combinations defined in `TESTING_PHILOSOPHY.md` §9 "Test Accounts & Tier States" — at minimum: fresh free, mid-funnel free, depleted free, consumed-Boost free, never-touched-Boost free, mid-cycle Scholar, annual Scholar, Guru with rolled-over credits, grace-period user, linked-accounts user, archived-classes user, deleted-class-with-orphaned-exam user, power user, returner.

## Mock Data & Test Resources

Beyond accounts, autonomous testing needs a curated library of test inputs. The full strategy lives in `TESTING_PHILOSOPHY.md` §9; the operational specifics:

### Test Materials Library

Stored at a known location outside the repo (binary/large; referenced by ID in tests). Categories:

| Category | Purpose | Example IDs |
|----------|---------|-------------|
| Canonical study materials | Happy-path topic extraction across subjects | `canon-calc-30pg`, `canon-chem-deck`, `canon-shakespeare-essay`, `canon-history-syllabus`, `canon-econ-pset` |
| Long documents | Smart-PDF TOC extraction (PRD §5.3) | `long-textbook-200pg-toc-clean`, `long-textbook-300pg-toc-messy` |
| Edge formats | Format conversion paths | `edge-docx`, `edge-pptx`, `edge-scanned-pdf`, `edge-handwritten-photo` |
| Tiny / empty | Boundary conditions | `tiny-1pg-pdf`, `empty-pdf`, `tiny-txt` |
| Oversized | Limit enforcement | `oversized-100mb-at-limit`, `oversized-150mb-over-limit` |
| Adversarial | Validation | `adv-renamed-image-as-pdf`, `adv-corrupted-pdf`, `adv-password-protected-pdf` |
| Ambiguous | Topic-extraction stress | `amb-non-english-pdf`, `amb-pure-formulas`, `amb-mixed-subjects` |
| Web links | Link processing | `link-wikipedia`, `link-youtube-short`, `link-youtube-long`, `link-paywalled`, `link-404` |
| Video | Video pipeline | `vid-short-lecture`, `vid-over-length`, `vid-audio-only`, `vid-no-content` |

Sources: open educational resources (OpenStax, Project Gutenberg, Wikipedia), AI-generated synthetics for fictitious courses, hand-crafted edge cases.

### Payment Resources
- **Stripe test mode**: real Stripe API, test keys, all standard test cards (`4242...` success, `4000...0002` declined, `4000...3220` 3DS-required, `4000...0069` expired, `4000...9995` insufficient, `4000...0119` processing-error, `4000...0341` network-failure)
- **Stored payment methods**: at least one account with stored card, one without, one with about-to-expire
- **Webhook simulation**: trigger `subscription.created`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` via Stripe CLI or signed POSTs to the webhook endpoint

### Phone & SMS Resources
- **Firebase Auth test phone numbers**: pre-configured to succeed verification with predictable codes; no real SMS billed
- **Multi-country test numbers**: at least one US, one EU, one Asia-Pacific
- **Adversarial phone numbers**: a number on another test account (linking conflict per PRD §5.1), a number on a "dormant" account (180-day rule)

### Email Resources
- **Programmatic mailbox** (Mailosaur, EtherealMail, or dedicated catch-all domain) so tests can read welcome, password-reset, payment-receipt, and grace-period emails
- **Email content verification**: tests assert specific content/links, not just "an email was sent." A password-reset test isn't done when the email lands — it's done when the test reads the email, follows the reset link, and completes the reset

### AI & External Resources
- **Vertex AI**: real calls in test mode, against a hard monthly budget cap with cost alarms; no separate mock layer (cheaper than maintaining mocks)
- **LaTeX service**: real, against the deployed Cloud Run service
- **Mock injection** is reserved for failure-mode tests — when the test's purpose is to cause a 503 / timeout / partial response that real services won't reliably produce on demand

## Cleanup & State Hygiene

Tests leave residue. Without cleanup, the test environment becomes a graveyard of stale accounts, half-finished exams, abandoned uploads, and zombie subscriptions. Eventually the residue corrupts test results.

- **Per-test cleanup**: anonymous uploads removed, throwaway draft exams deleted, in-flight credit reservations released
- **Per-batch cleanup**: subscriptions canceled in Stripe test mode; Firestore documents in dedicated test collections purged
- **Daily sweeper**: removes anything older than the longest valid test horizon (currently **7 days**, matching anonymous upload retention per PRD §5.3)
- **Pre-flight assertion**: every test starts by asserting the expected initial state of its account/fixtures. If reality differs (a previous test left state behind, a sweeper missed something), **fail fast** with a clear setup error rather than producing misleading results

Tests must not depend on the residue of previous tests. If your test passes only because a prior test left state behind, your test is broken — not because it's flaky, but because it's testing a fiction.

## Adding New Flows

During testing, agents WILL discover new flows that aren't in `TEST_FLOWS.md`. The process:
1. Tester agent notes the missing flow in their report
2. Lead agent adds it to `TEST_FLOWS.md` with appropriate priority
3. Flow gets assigned to next available tester wave
4. Lead updates the PRD Coverage Map (below) if the new flow fills a coverage gap
5. This is EXPECTED and GOOD — the flow list is a living document

## PRD Coverage Map

Every PRD §5 feature must map to at least one test flow. The canonical mapping lives in **`TESTING_PHILOSOPHY.md` §17** and is the source of truth for "is this PRD feature covered?"

`TEST_FLOWS.md` is the enumeration of flows; the coverage map is the index from PRD section to flows. The Lead Agent verifies the map is current at the end of every batch.

Process:
1. PRD changes → coverage map updates (Lead's responsibility, before the next batch starts)
2. Coverage map identifies a gap → flow added to `TEST_FLOWS.md`
3. Flow added → coverage map links to it

A PRD §5 subsection without at least one flow in `TEST_FLOWS.md` is a coverage gap. It is filed as a **P1 process bug**, not a feature complete. The "Done" criteria below requires zero coverage gaps.

## Regression Baselines & Trend Reports

Pass/fail at a single point in time tells us the current state. Trends over time tell us whether we're improving or regressing.

### Trend Report
After each loop pass, the Lead agent appends to a running record:
- Pass rate by feature area
- Pass rate trend over the last N runs (regression spotting)
- Most-common failure categories (functional vs. perceptual vs. perf vs. accessibility)
- Mean time to fix by severity
- Soft-oracle scores by screen (which screens are most "off-philosophy")
- Coverage gaps (PRD sections with no recent test runs)

Read by the Lead at the start of every new batch to direct test investment — feature areas with rising failure rates get more coverage; consistently-passing areas can be deprioritized.

### Visual & Structural Baselines
- **Pixel-diff baselines** for stable surfaces (marketing pages, settings, billing, public legal pages)
- **Structural-diff baselines** (DOM + computed styles) for dynamic surfaces (dashboard, library — immune to legitimate dynamism like changing exam counts)
- **Updated only on intentional design changes** — auto-updating on diff failure defeats the purpose. Updates require a captured commit reason.

### Soft-Oracle Drift
As the design philosophy evolves, soft-oracle judgments may drift. Track historical judgments per screen so we can spot when "the rubric changed" vs. "the screen got worse." If a screen's score drops without a code change to that screen, the change is in the rubric — investigate before acting.

## Hook Enforcement

### Stop Guard
Blocks stopping if `TEST_FLOWS.md` has any:
- `- [ ]` (untested) flows at P0 or P1
- `- [!]` (failing) flows at P0 or P1

Also checks `TRACKER.md` for incomplete items, PRD cross-reference, and the PRD Coverage Map for gaps.

### Session Start
Displays current testing progress: total flows, tested, passing, failing, untested, plus the most recent trend report summary.

### Tracker Nag
Reminds to update `TEST_FLOWS.md` and `TRACKER.md` if not updated in 20 minutes.

## What "Done" Looks Like

- ALL P0 flows: tested and passing
- ALL P1 flows: tested and passing
- ALL P2 flows: tested and passing (or triaged with documented reason)
- ALL P3 flows: tested and passing (or triaged with documented reason)
- Zero known bugs in `TRACKER.md`
- Final regression sweep passes
- Performance budgets met (per Quality Criteria § Performance)
- **Design philosophy conformance**: every primary screen passes the soft-oracle rubric against `DESIGN_PHILOSOPHY.md`
- **Cross-environment matrix complete**: primary flows pass across all defined viewports, browsers, themes, and locales
- **Most recent adversarial pass clean**: no open P0/P1 findings from the weekly adversarial run
- **PRD cross-reference**: every feature in PRD accounted for in `TEST_FLOWS.md`; PRD Coverage Map has zero gaps
- **Cross-environment matrix complete on emulated mobile**: WebKit + Chromium passes on the documented mobile viewports; real-device passes are not required for v1 sign-off (see Real-Device Coverage above)
