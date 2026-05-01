# ExamPull Test Flows

Last updated: 2026-05-01

Legend: `[ ]` untested, `[x]` passing, `[!]` failing or blocked.

## P0 Primary Flows

- [!] P0-AUTH-001 Anonymous preview renders a blurred first-page image without exposing PDF data; full anonymous-to-verified account preservation still needs E2E coverage.
- [ ] P0-AUTH-002 Existing account linking handles email/provider conflict without creating duplicate accounts.
- [!] P0-AUTH-003 Phone-number conflict requires prior auth source unless dormant 180+ days; server-side policy and unit coverage exist, Firebase credential-collision E2E remains.
- [!] P0-EXAM-001 Free user queues a 12-question Standard exam from manual topics in authenticated E2E; full worker completion E2E remains.
- [!] P0-EXAM-002 Scholar user can access answer key on a completed paid exam in authenticated E2E; full worker generation E2E remains.
- [!] P0-EXAM-003 Guru visual-feedback worker creates a downloadable PDF artifact; authenticated completed-attempt download E2E exists, full upload-to-worker-to-download E2E remains.
- [x] P0-CREDITS-001 Credit reservation is atomic across parallel requests; authenticated E2E verifies one full-cost Free request succeeds and the other returns 402.
- [x] P0-DOWNLOAD-001 Completed exam and answer key download through authenticated server routes without private Storage reads.
- [x] P0-ADMIN-001 Unauthenticated `/admin/*` returns hard 404; agent auth works only through API.
- [x] P0-SECURITY-001 User cannot read or mutate another user's data across Firestore/Storage rules and authenticated exam/class API routes.

## P1 Product Flows

- [x] P1-CLASS-001 User creates, edits, archives, restores, and deletes a class.
- [!] P1-CLASS-002 Instructor example upload charges 2 credits and produces visible style guide; worker now reads text PDFs and supported image uploads, but full browser E2E remains.
- [!] P1-WIZARD-001 Wizard combines class materials, ad hoc uploads, and manual topics; one-time upload implementation exists, authenticated E2E remains.
- [!] P1-WIZARD-002 Long PDF with focus shows TOC-reading progress and extracts scoped topics; server-side text PDF/image extraction is implemented, but long-document progress E2E remains.
- [ ] P1-WIZARD-003 Topic extraction failure offers best-effort/manual fallback.
- [x] P1-POWER-001 Scholar/Guru Power Mode creates and reorders per-question slots on desktop; authenticated E2E covers slot edits, reorder, range bulk edit, queueing, and created metadata.
- [!] P1-POWER-002 Mobile Power Mode uses tap reorder and bulk actions; explicit up/down controls and range bulk edits exist, tap-to-target E2E remains.
- [x] P1-LIBRARY-001 Library search, filter, bookmark, archive, restore, delete, move-to-class, grid/list, and bulk actions pass authenticated E2E.
- [x] P1-DETAIL-001 Exam detail shows PDF viewer, metadata, sources, attempts, rating, clone, archive, report, and share.
- [x] P1-SHARE-001 Share link exposes student-copy PDF only; answer key remains private to authenticated creator tier.
- [!] P1-BOOST-001 Free user Scholar Boost is offered from second exam and atomically consumed; implementation exists, full authenticated two-tab E2E remains.
- [!] P1-BILLING-001 Upgrade, downgrade, cancellation, credit packs, monthly subscription grants, and receipts flow through Stripe test mode; webhook idempotency is implemented, full Stripe CLI E2E remains.
- [!] P1-NOTIFY-001 In-app notification center handles exam, grading, billing, referral, feedback, and account events; full event-matrix E2E remains.
- [!] P1-REFERRAL-001 Referral links attribute signups and grant Scholar/Guru rewards on first exam and paid conversion; fraud/manual override E2E remains.
- [x] P1-FEEDBACK-001 Product feedback widget routes feature requests, bugs, and general feedback to Firestore triage.
- [x] P1-ADMIN-002 Admin Users, Exams, Analytics, Operations, Communications, Abuse, Referrals, Configuration, Audit Log surfaces load.

## P2 Resilience And Quality Flows

- [!] P2-CHAOS-001 Refresh at every wizard step preserves draft state; new-exam draft persistence is implemented, full browser E2E remains.
- [!] P2-CHAOS-002 LaTeX 503 retries without burning visual QA budget; transient compile retries are implemented, chaos E2E remains.
- [ ] P2-CHAOS-003 Stripe webhook during generation preserves tier snapshot.
- [ ] P2-A11Y-001 Keyboard-only signup, wizard, library, modal, and admin navigation.
- [ ] P2-A11Y-002 Screen-reader labels and live regions for generation tracker and forms.
- [ ] P2-VISUAL-001 Primary screens pass dark/light/mobile/desktop design soft oracle.
- [ ] P2-PERF-001 Primary flows meet LCP, INP, CLS, and action-feedback latency budgets.
- [x] P2-EVAL-001 Quick exam eval suite produces local artifacts without paid evaluator SDK calls.

## Coverage Notes

This file starts from the PRD coverage map in `TESTING_PHILOSOPHY.md` §17 and will expand as implementation discovers additional flows.

## Latest Artifacts

- Desktop Chrome smoke: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after Power Mode/library management: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after class lifecycle controls: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after secure anonymous preview: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after Scholar Boost implementation: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after billing webhook hardening: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after referral implementation: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after generated-question artifact pass: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after wizard draft persistence: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after LaTeX retry resilience: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after ad hoc source upload implementation: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after phone conflict policy: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome smoke after security-rule regression coverage: `pnpm exec playwright test --project=desktop-chrome` passed.
- Desktop Chrome authenticated ownership/security suite: `pnpm exec playwright test --project=desktop-chrome` passed with own exam render plus cross-user exam/class denial.
- Desktop Chrome authenticated Free manual-topics exam suite: `pnpm exec playwright test --project=desktop-chrome` passed with a 12-question queued Standard exam.
- Desktop Chrome authenticated Power Mode suite: `pnpm exec playwright test --project=desktop-chrome` passed with Scholar slot edits, reorder, range bulk edit, queueing, and created metadata.
- Desktop Chrome authenticated credit-race suite: `pnpm exec playwright test --project=desktop-chrome` passed with exactly one of two parallel full-cost Free exam requests accepted.
- Desktop Chrome authenticated Scholar answer-key suite: `pnpm exec playwright test --project=desktop-chrome` passed with answer key action visible on a completed paid exam.
- Desktop Chrome authenticated Guru visual-feedback suite: `pnpm exec playwright test --project=desktop-chrome` passed with visual feedback PDF download returning `application/pdf`.
- Desktop Chrome authenticated class lifecycle suite: `pnpm exec playwright test --project=desktop-chrome` passed with create/edit/archive/restore/delete.
- Desktop Chrome authenticated exam library suite: `pnpm exec playwright test --project=desktop-chrome` passed with search/filter/grid-list/bookmark/archive/restore/move/delete.
- Desktop Safari and Mobile Safari smoke: `pnpm exec playwright test --project=desktop-safari --project=mobile-safari` passed after installing WebKit.
- Hosted production smoke: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after multimodal extraction deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after Power Mode/library management deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after class lifecycle controls deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after secure anonymous preview deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after Scholar Boost deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after billing webhook hardening deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after referral deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after generated-question artifact deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after wizard draft persistence deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after LaTeX retry resilience deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after ad hoc source upload deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after phone conflict policy deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after authenticated E2E harness deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after Free manual-topics E2E deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after exam library E2E deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after Power Mode E2E deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Eval smoke: `pnpm eval:run` wrote `artifacts/eval/2026-05-01T21-59-10-970Z`.
