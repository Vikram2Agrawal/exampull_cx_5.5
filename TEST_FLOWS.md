# ExamPull Test Flows

Last updated: 2026-05-02

Legend: `[ ]` untested, `[x]` passing, `[!]` failing or blocked.

## P0 Primary Flows

- [x] P0-AUTH-001 Anonymous preview renders a blurred first-page image without exposing PDF data; authenticated E2E verifies the preview artifact is claimed into a verified account with credits preserved.
- [x] P0-AUTH-002 Existing account linking handles email/provider conflict without creating duplicate accounts; authenticated E2E verifies synced linked-source state and export metadata, with client recovery for Google-vs-password conflicts.
- [x] P0-AUTH-003 Phone-number conflict requires prior auth source unless dormant 180+ days; authenticated E2E covers active conflict rejection and dormant reclaim without inherited account data.
- [x] P0-EXAM-001 Free user queues and completes a 12-question Standard exam from manual topics through the worker; authenticated E2E verifies credit settlement, PDF download, and exported artifacts.
- [x] P0-EXAM-002 Scholar user completes a paid-tier worker generation and can download the answer key; authenticated E2E verifies credit settlement and exported artifacts.
- [x] P0-EXAM-003 Guru visual-feedback worker creates a downloadable PDF artifact; authenticated E2E covers signed attempt upload, grading worker, visual feedback generation, credit settlement, download, and data export.
- [x] P0-CREDITS-001 Credit reservation is atomic across parallel requests; authenticated E2E verifies one full-cost Free request succeeds and the other returns 402.
- [x] P0-DOWNLOAD-001 Completed exam and answer key download through authenticated server routes from private Storage-backed artifacts without client-side Storage reads.
- [x] P0-ADMIN-001 Unauthenticated `/admin/*` returns hard 404; agent auth works only through API.
- [x] P0-SECURITY-001 User cannot read or mutate another user's data across Firestore/Storage rules and authenticated exam/class API routes.

## P1 Product Flows

- [x] P1-CLASS-001 User creates, edits, archives, restores, and deletes a class.
- [x] P1-CLASS-002 Instructor example upload charges 2 credits and produces a visible style guide; authenticated E2E verifies credit accounting and fallback style guide readiness.
- [x] P1-WIZARD-001 Wizard combines class materials, ad hoc uploads, and manual topics; authenticated E2E verifies stored material IDs, ad hoc source retention, and manual topics on the queued exam.
- [x] P1-WIZARD-002 Long PDF with focus shows TOC-reading progress and extracts scoped topics; authenticated E2E verifies PDF upload progress, page-read metadata, worker extraction, and focus-scoped topics.
- [x] P1-WIZARD-003 Topic extraction failure offers best-effort/manual fallback; authenticated E2E verifies warning status, fallback topics, and use in exam creation.
- [x] P1-POWER-001 Scholar/Guru Power Mode creates and reorders per-question slots on desktop; authenticated E2E covers slot edits, reorder, range bulk edit, queueing, and created metadata.
- [x] P1-POWER-002 Mobile Power Mode uses tap reorder and bulk actions; Mobile Safari E2E verifies tap reorder, range bulk edit, and queueing.
- [x] P1-LIBRARY-001 Library search, filter, bookmark, archive, restore, delete, move-to-class, grid/list, and bulk actions pass authenticated E2E.
- [x] P1-DETAIL-001 Exam detail shows PDF viewer, metadata, sources, attempts, rating, clone, archive, report, and share.
- [x] P1-SHARE-001 Share link exposes student-copy PDF only; answer key remains private to authenticated creator tier.
- [x] P1-BOOST-001 Free user Scholar Boost is offered from second exam, atomically consumed across two tabs, includes one free grading round, and is restored by the 24-hour report regret flow.
- [x] P1-BILLING-001 Upgrade, downgrade, cancellation, credit packs, monthly subscription grants, and receipts flow through signed Stripe webhook events; authenticated E2E verifies signature rejection, tier changes, credit packs, monthly grants, billing notifications, and idempotency.
- [x] P1-NOTIFY-001 In-app notification center handles exam, grading, billing, referral, share, feedback, and account events; authenticated E2E verifies unread badge, click-to-read navigation, individual delete, mark-all-read, and clear-all.
- [x] P1-REFERRAL-001 Referral links attribute signups and grant Scholar/Guru rewards on first exam and paid conversion; authenticated E2E verifies suspicious alias review holds, admin review visibility, manual grant, and manual revoke.
- [x] P1-FEEDBACK-001 Product feedback widget routes feature requests, bugs, and general feedback to Firestore triage.
- [x] P1-ADMIN-002 Admin Users, Exams, Analytics, Operations, Communications, Abuse, Referrals, Configuration, Audit Log surfaces load.

## P2 Resilience And Quality Flows

- [x] P2-CHAOS-001 Refresh at every wizard step preserves draft state; authenticated E2E verifies source details, manual topics, Power Mode configure controls, per-slot edits, successful queueing, and draft clearing.
- [x] P2-CHAOS-002 LaTeX 503 retries without burning visual QA budget; authenticated E2E injects local-only transient 503s and verifies generation completes with single credit settlement, one QA iteration per artifact, and stored PDFs.
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
- Desktop Chrome anonymous-preview claim suite: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "anonymous preview can be claimed"` passed with public preview UI, no-PDF response assertion, claim token, verified test account claim, PDF download, and exported artifact.
- Desktop Chrome phone-conflict suite: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "phone conflict|dormant phone"` passed with active prior-auth-required rejection and dormant 180+ day reclaim into a clean account.
- Desktop Chrome authenticated Free manual-topics exam suite: `pnpm exec playwright test --project=desktop-chrome` passed with a 12-question queued Standard exam.
- Desktop Chrome authenticated Power Mode suite: `pnpm exec playwright test --project=desktop-chrome` passed with Scholar slot edits, reorder, range bulk edit, queueing, and created metadata.
- Desktop Chrome authenticated one-time source upload suite: `pnpm exec playwright test --project=desktop-chrome` passed with signed Storage upload, ready fallback extraction, exam queueing, and detail-page source retention.
- Desktop Chrome topic-extraction fallback suite: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "topic extraction failure"` passed with missing Storage object, worker best-effort warning, fallback topics, and queued exam source retention.
- Desktop Chrome authenticated class style-reference and combined-source wizard suite: `pnpm exec playwright test --project=desktop-chrome` passed with 2-credit accounting, fallback style guide, stored material selection, ad hoc upload, manual topics, and queued exam export verification.
- Desktop Chrome authenticated full-worker exam suite: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "full 12-question worker"` passed with Cloud Run LaTeX compilation, Storage-backed artifacts, credit settlement, PDF download, and exported base64 artifacts.
- Desktop Chrome authenticated Scholar full-worker answer-key suite: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "scholar user can complete a full worker generation"` passed with answer-key access, download, credit settlement, and exported artifacts.
- Desktop Chrome authenticated Guru visual-feedback worker suite: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "upload an attempt and complete visual feedback worker"` passed with signed upload, grading, Storage-backed visual feedback artifact, credit settlement, PDF download, and exported base64 artifact.
- Full local gate after full-worker E2E and Storage-backed exam artifacts: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed.
- Full local gate after Storage-backed visual-feedback artifacts: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed.
- Full local gate after anonymous-preview claim implementation: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed.
- Full local gate after Scholar full-worker answer-key E2E: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed.
- Full local gate after phone-conflict E2E harness: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed.
- Full local gate after topic-extraction fallback E2E: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed.
- Focused linked-auth E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "linked auth sources"` with Settings provider display and export metadata assertions.
- Full local gate after linked-auth implementation: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed with 22 desktop Chrome tests.
- Focused long-PDF wizard E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "long PDF upload"` with TOC progress, page counts, PDF text extraction, and focus-scoped topics.
- Full local gate after long-PDF wizard implementation: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed with 23 desktop Chrome tests.
- Mobile Safari Power Mode E2E passed: `pnpm exec playwright test --project=mobile-safari e2e/authenticated.spec.ts -g "mobile user can tap reorder"` with tap reorder, range bulk edit, and queued Power Mode exam.
- Focused Scholar Boost two-tab E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "Scholar Boost is atomically"` with concurrent consumption, included grading, report refund, and recovered boost reuse.
- Focused signed Stripe billing E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "signed Stripe billing"` with unsigned rejection, subscription activation/downgrade/cancellation, credit pack, monthly grant, billing notifications, and duplicate-event idempotency.
- Focused referral reward/fraud/admin override E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "referrals reward"` with clean first-exam Scholar reward, paid Guru reward, suspicious alias hold, admin review visibility, manual grant, and manual revoke.
- Full local gate after referral fraud/admin override implementation: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed with 26 desktop Chrome tests and one mobile-only skip.
- Hosted production smoke after referral fraud/admin override deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with 2 public smoke tests and local-only authenticated specs skipped.
- Focused notification center E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "notification center"` with event-matrix seed data, unread badge, click-to-read navigation, individual delete, mark-all-read, and clear-all.
- Full local gate after notification center implementation: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed with 27 desktop Chrome tests and one mobile-only skip.
- Hosted production smoke after notification center deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with 2 public smoke tests and local-only authenticated specs skipped.
- Focused wizard refresh E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "wizard preserves"` with source details, manual topics, Power Mode controls, per-slot edits, queueing, and draft clearing.
- Full local gate after wizard refresh resilience: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed with 28 desktop Chrome tests and one mobile-only skip.
- Hosted production smoke after wizard refresh deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with 2 public smoke tests and local-only authenticated specs skipped.
- Focused LaTeX retry chaos E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "LaTeX 503 retry"` with local-only transient 503 injection, complete generation, single credit settlement, one QA iteration per artifact, and stored PDF export checks.
- Full local gate after LaTeX retry chaos coverage: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` passed with 29 desktop Chrome tests and one mobile-only skip.
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
- Hosted production smoke after class style-reference fallback deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after Storage-backed exam artifact deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after Storage-backed visual-feedback artifact deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after anonymous-preview claim deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after phone-conflict E2E harness deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with local-only authenticated specs skipped.
- Hosted production smoke after linked-auth deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with 2 public smoke tests and local-only authenticated specs skipped.
- Hosted production smoke after long-PDF wizard deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed with 2 public smoke tests and local-only authenticated specs skipped.
- Eval smoke: `pnpm eval:run` wrote `artifacts/eval/2026-05-01T21-59-10-970Z`.
