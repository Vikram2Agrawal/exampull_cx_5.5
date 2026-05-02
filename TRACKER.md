# ExamPull Build Tracker

Last updated: 2026-05-02

## Current Phase

Production hardening and PRD coverage expansion on a provisioned Next.js/Firebase build.

## Active Work

- [x] Scaffold strict TypeScript Next.js app with Biome, Tailwind, Firebase, and tests.
- [x] Provision Firestore, Storage, Cloud Tasks, App Hosting, LaTeX Cloud Run, bucket CORS, Stripe prices, and production secrets.
- [x] Implement auth/session gate, dashboard, classes/materials, exam generation, attempts/grading, billing, feedback, notifications, settings export/delete, share links, and PDF downloads.
- [x] Implement admin shell, agent auth, live read surfaces, credit grant API, triage API, configuration, referrals, operations, and audit-log foundation.
- [x] Implement AI gateway, multimodal material ingestion, LaTeX client/service, topic extraction, PDF text extraction, credit accounting, queue abstractions, worker auth, and worker routes.
- [x] Implement Power Mode question-slot builder, per-slot LaTeX rendering, paid-tier enforcement, and slot-count credit accounting.
- [x] Implement exam library search/filter/archive visibility/grid-list views, individual delete, and bulk archive/bookmark/delete/move-to-class operations.
- [x] Implement class edit/archive/restore/delete controls, material delete confirmation, class-tag cleanup on deletion, and material storage cleanup.
- [x] Harden anonymous preview to return a blurred first-page image instead of a PDF payload, with device/IP rate limiting and sign-up CTA.
- [x] Implement once-per-account Scholar Boost: second-exam prompt, atomic consumption, Scholar-tier generation, answer-key unlock, one free grading round, and 24-hour report regret recovery.
- [x] Harden Stripe webhook credit grants with ledger idempotency, subscription-cycle monthly credits, and billing notifications.
- [x] Implement referral link generation, signup attribution, first-exam Scholar rewards, paid-conversion Guru rewards, admin referral rows, and referral notifications.
- [x] Wire generated question/answer content into the LaTeX artifact instead of rendering only deterministic placeholder prompts.
- [x] Persist new-exam wizard drafts locally across refreshes and clear them after successful queueing.
- [x] Retry transient LaTeX compile failures for rate-limit/server-error responses before failing an exam job.
- [x] Implement one-time exam source uploads with signed Storage writes, extraction polling, persisted source metadata, and generation grounding from uploaded files.
- [x] Implement server-side phone conflict policy: active conflicts require prior auth source, dormant 180-day conflicts release the phone with audit logging.
- [x] Add security-rule regression coverage for owner-only user reads and server-only writes to private Firestore/Storage data.
- [x] Add locked local test-session and seed APIs plus authenticated Playwright coverage for own exam rendering and cross-user exam/class denial.
- [x] Add authenticated Free manual-topics E2E for queuing a 12-question Standard exam without enqueueing Cloud Tasks during local tests.
- [x] Add authenticated concurrent credit-reservation E2E proving exactly one full-cost Free exam request wins.
- [x] Add authenticated Scholar Power Mode E2E covering slot edits, reorder, range bulk edit, queueing, and created-exam metadata.
- [x] Add authenticated one-time source upload E2E covering signed Storage write, ready fallback extraction, queueing, and detail-page source retention.
- [x] Add authenticated class style-reference E2E covering 2-credit accounting, fallback style guide, stored material selection, ad hoc upload, manual topics, and combined exam queueing.
- [x] Add authenticated full-worker Free exam E2E covering 12-question generation, LaTeX compilation, Storage-backed PDF artifacts, credit settlement, download, and data export.
- [x] Move generated exam PDFs and rendered pages out of Firestore documents into private Storage artifact paths while preserving legacy inline-base64 reads.
- [x] Repair the LaTeX Cloud Run image so `pdflatex` and `xelatex` are installed and exposed on `PATH`.
- [x] Move Guru visual-feedback PDFs and rendered pages to private Storage artifact paths with legacy inline-base64 read compatibility.
- [x] Add authenticated Guru attempt upload-to-worker E2E covering signed Storage upload, grading, visual feedback generation, credit settlement, PDF download, and data export.
- [x] Implement no-account preview claim bundles with Storage-backed artifacts, session-time account claiming, and full-credit preservation.
- [x] Add authenticated anonymous-preview claim E2E covering public preview UI, no-PDF preview response, sign-up CTA preview token, claim into a verified test account, PDF download, and data export.
- [x] Add authenticated Scholar full-worker E2E covering paid-tier generation, answer-key access, answer-key download, credit settlement, and exported artifacts.
- [x] Add authenticated phone-conflict E2E covering active prior-auth-required rejection and dormant 180+ day phone reclaim into a clean account.
- [x] Add authenticated topic-extraction failure E2E covering best-effort fallback topics, warning status, and fallback source reuse in exam creation.
- [x] Implement linked auth-provider metadata, server-side duplicate-email session checks, Settings provider display, Google conflict recovery from sign-in, and preview claim handoff through sign-in.
- [x] Implement long-PDF source upload extraction progress with TOC/headings stage, page-read metadata, focus-scoped topic prompts, and Next server PDF parser packaging.
- [x] Add Mobile Safari Power Mode E2E covering tap reorder controls, range bulk edit, and queued mobile Power Mode creation.
- [x] Add Scholar Boost two-tab E2E covering atomic once-per-account consumption, included grading, report-window refund, and recovered boost reuse.
- [x] Add signed Stripe billing E2E covering signature rejection, subscription activation/downgrade/cancellation, credit packs, subscription-cycle grants, billing notifications, and duplicate-event idempotency.
- [x] Add referral fraud detection, admin reward override controls/API, and authenticated E2E covering clean rewards, suspicious alias review holds, manual grant, and manual revoke.
- [x] Add notification-center unread badge, click-to-read navigation, individual delete, clear-all APIs/UI, and authenticated event-matrix E2E.
- [x] Add wizard refresh-resilience E2E covering source details, manual topics, Power Mode controls, per-slot edits, successful queueing, and draft clearing.
- [x] Add LaTeX 503 retry chaos E2E covering local-only transient compile failures, complete generation, single credit settlement, one QA iteration per artifact, and stored PDFs.
- [x] Add Stripe tier-snapshot chaos E2E covering a signed cancellation during queued generation while the completed exam preserves Scholar entitlement and exact reserved-credit settlement.
- [x] Add accessibility E2E and UI semantics covering keyboard-only signup, wizard, library alert dialog, admin navigation/search, generation tracker labeling, and form live regions.
- [x] Harden admin queue overview with an index-missing fallback so admin shell navigation does not crash while Firestore indexes are catching up.
- [x] Add visual/performance quality E2E covering dark/light desktop/mobile screenshots, material discipline, mobile touch targets, horizontal overflow, route paint/CLS metrics, and action-feedback latency.
- [x] Harden admin write APIs with per-session CSRF tokens threaded through the admin shell, credit grant form, triage controls, and referral override controls.
- [x] Fix generated paid-tier exams to mark answer keys unlocked at creation time.
- [x] Add authenticated Scholar completed-exam E2E proving answer key access is visible for paid-tier users.
- [x] Add authenticated Guru completed-attempt E2E proving downloadable visual feedback PDF access.
- [x] Add authenticated class lifecycle E2E covering create, edit, archive, restore, delete, and missing-after-delete.
- [x] Add authenticated exam library E2E covering search, filters, grid/list, bookmark, archive/restore, move-to-class, and delete.
- [x] Build smoke E2E, unit tests, eval artifact harness, stopguard script, and deployment verification loop.
- [ ] Expand full browser/persona E2E coverage for every PRD flow and attach artifacts per testing docs.
- [x] Deepen visual annotation from metadata overlays into downloadable Guru visual feedback PDF artifacts.
- [ ] Complete post-v1 admin hardening: passkey/SMS operator auth, CSRF tokens, immutable external audit replication, and destructive-operation reauth.

## Known Risks

- The repository began with documentation only; implementation is new and still needs broad cross-browser exploratory coverage.
- Admin phone/passkey flows remain out of this loop by operator direction; autonomous testing uses agent admin auth.
- Visual annotation now creates a Storage-backed rendered feedback PDF; true overlay-on-original-attempt rendering remains a fidelity improvement.
- OCR for scanned image-only PDFs is not complete; text PDFs are extracted server-side, and supported image uploads are passed to the AI gateway as multimodal context during extraction and generation.
- Power Mode has explicit up/down reordering and bulk range edits; drag-and-drop and tap-to-target mobile reorder remain fidelity improvements.
- Anonymous preview claim-to-account preservation is covered through the verified test-session path and sign-in preview handoff; full Firebase anonymous provider linking with real OTP remains a later auth-provider fidelity pass.
- Firebase Auth can only link one credential per provider family in the current client flow; Settings exposes Google linking and provider sync, while multi-Google-account fidelity needs a provider-specific design pass if required beyond Firebase's standard linking model.

## Latest Verification

- `pnpm lint` passing.
- `pnpm typecheck` passing.
- `pnpm test` passing.
- `pnpm build` passing.
- `pnpm exec playwright test --project=desktop-chrome` passing.
- `pnpm exec playwright test --project=desktop-safari --project=mobile-safari` passing.
- Hosted smoke against `https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app` passing on desktop Chrome.
- Hosted smoke re-run after visual feedback deployment passed on desktop Chrome.
- Hosted smoke re-run after multimodal material extraction deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after Power Mode and library management passed.
- Hosted smoke re-run after Power Mode and library management deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after class lifecycle controls passed.
- Hosted smoke re-run after class lifecycle controls deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after secure anonymous preview passed.
- Hosted smoke re-run after secure anonymous preview deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after Scholar Boost implementation passed.
- Hosted smoke re-run after Scholar Boost deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after billing webhook hardening passed.
- Hosted smoke re-run after billing webhook hardening deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after referral implementation passed.
- Hosted smoke re-run after referral deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after generated-question artifact pass passed.
- Hosted smoke re-run after generated-question artifact deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after wizard draft persistence passed.
- Hosted smoke re-run after wizard draft persistence deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after LaTeX retry resilience passed.
- Hosted smoke re-run after LaTeX retry resilience deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after ad hoc source upload implementation passed.
- Hosted smoke re-run after ad hoc source upload deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after phone conflict policy passed.
- Hosted smoke re-run after phone conflict policy deployment passed on desktop Chrome.
- Local desktop Chrome smoke re-run after security-rule regression coverage passed.
- Local desktop Chrome authenticated E2E passed: own seeded exam render, cross-user exam denial, and cross-user class denial.
- Hosted smoke after authenticated E2E harness deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Local desktop Chrome authenticated E2E passed for Free manual-topics 12-question Standard exam queueing.
- Hosted smoke after Free manual-topics E2E deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Local desktop Chrome authenticated credit-race E2E passed.
- Local desktop Chrome authenticated Scholar answer-key E2E passed.
- Local desktop Chrome authenticated Guru visual-feedback download E2E passed.
- Local desktop Chrome authenticated class lifecycle E2E passed.
- Full local gate after exam library E2E passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after exam library E2E deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Full local gate after Power Mode E2E passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after Power Mode E2E deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Full local gate after one-time source upload E2E and localhost:3100 Storage CORS update passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Firebase Storage CORS verified with localhost:3100, 127.0.0.1:3100, localhost:3000, and hosted production origins.
- Full local gate after class style-reference fallback and combined-source wizard E2E passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after class style-reference fallback deployment passed on desktop Chrome with local-only authenticated specs skipped.
- LaTeX Cloud Run compile smoke passed against `LATEX_SERVICE_URL` with `200 OK` and rendered page output after image revision `latex-service-00003-fh9`.
- Focused full-worker E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "full 12-question worker"`.
- Full local gate after full-worker E2E and Storage-backed exam artifacts passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after Storage-backed exam artifact deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Focused Guru visual-feedback worker E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "upload an attempt and complete visual feedback worker"`.
- Full local gate after Storage-backed visual-feedback artifacts passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after Storage-backed visual-feedback artifact deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Focused anonymous-preview claim E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "anonymous preview can be claimed"`.
- Full local gate after anonymous-preview claim implementation passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after anonymous-preview claim deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Focused Scholar full-worker answer-key E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "scholar user can complete a full worker generation"`.
- Full local gate after Scholar full-worker answer-key E2E passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Focused phone-conflict E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "phone conflict|dormant phone"`.
- Full local gate after phone-conflict E2E harness passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Hosted smoke after phone-conflict E2E harness deployment passed on desktop Chrome with local-only authenticated specs skipped.
- Focused topic-extraction fallback E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "topic extraction failure"`.
- Full local gate after topic-extraction fallback E2E passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome`.
- Focused linked-auth E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "linked auth sources"`.
- Linked-auth unit coverage passed in `pnpm test`, including provider normalization, malformed document parsing, and Google-only ownership tracking.
- Full local gate after linked-auth implementation passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 22 desktop Chrome tests.
- Hosted smoke after linked-auth deployment passed on desktop Chrome with 2 public smoke tests and local-only authenticated specs skipped.
- Focused long-PDF wizard E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "long PDF upload"`.
- Full local gate after long-PDF wizard implementation passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 23 desktop Chrome tests.
- Hosted smoke after long-PDF wizard deployment passed on desktop Chrome with 2 public smoke tests and local-only authenticated specs skipped.
- Mobile Safari Power Mode E2E passed: `pnpm exec playwright test --project=mobile-safari e2e/authenticated.spec.ts -g "mobile user can tap reorder"`.
- Focused Scholar Boost two-tab E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "Scholar Boost is atomically"`.
- Focused signed Stripe billing E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "signed Stripe billing"`.
- TypeScript verification after signed Stripe billing E2E passed: `pnpm typecheck`.
- Referral fraud policy unit tests passed: `pnpm exec vitest run tests/referral-policy.test.ts`.
- Focused referral reward/fraud/admin override E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "referrals reward"`.
- Full local gate after referral fraud/admin override implementation passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 26 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after referral fraud/admin override implementation passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after referral fraud/admin override deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome`.
- Focused notification center E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "notification center"`.
- Full local gate after notification center implementation passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 27 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after notification center implementation passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after notification center deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome`.
- Focused wizard refresh E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "wizard preserves"`.
- Full local gate after wizard refresh resilience passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 28 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after wizard refresh resilience passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after wizard refresh deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome`.
- Focused LaTeX retry chaos E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "LaTeX 503 retry"`.
- Full local gate after LaTeX retry chaos coverage passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 29 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after LaTeX retry chaos coverage passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after LaTeX retry chaos deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome`.
- Focused Stripe tier-snapshot chaos E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "Stripe downgrade during generation"`.
- Full local gate after Stripe tier-snapshot chaos coverage passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 30 desktop Chrome tests and one mobile-only skip.
- Focused accessibility E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/accessibility.spec.ts`.
- Full local gate after accessibility coverage and admin queue fallback passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 34 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after accessibility/admin implementation passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after accessibility/admin deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome`.
- Focused visual/performance quality E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/quality.spec.ts` with screenshot artifacts under `artifacts/quality`, primary-route LCP/FCP around 472-544ms, CLS 0, and library action feedback around 16ms.
- Full local gate after visual/performance quality coverage passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 36 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after visual/performance quality implementation passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after visual/performance quality deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` with 2 public smoke tests and 35 local-only authenticated/quality specs skipped.
- Cross-browser quality matrix passed: `pnpm exec playwright test --project=desktop-safari --project=mobile-safari e2e/quality.spec.ts` and `pnpm exec playwright test --project=mobile-android e2e/quality.spec.ts`.
- Focused admin CSRF E2E passed: `pnpm exec playwright test --project=desktop-chrome e2e/authenticated.spec.ts -g "admin write APIs|referrals reward"` and `pnpm exec playwright test --project=desktop-chrome e2e/accessibility.spec.ts -g "admin sections"`.
- Full local gate after admin CSRF hardening passed: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test --project=desktop-chrome` with 37 desktop Chrome tests and one mobile-only skip.
- App Hosting deploy after admin CSRF hardening passed: `pnpm exec firebase deploy --only apphosting --project exampull-gpt-5-5 --non-interactive`.
- Hosted smoke after admin CSRF hardening deployment passed: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` with 2 public smoke tests and 36 local-only authenticated/quality specs skipped.
- `pnpm eval:run` writes eval artifacts under `artifacts/eval/`; latest run `artifacts/eval/2026-05-01T21-59-10-970Z`.

## Completion Bar

ExamPull is not done until every PRD/admin-PRD feature has implementation coverage, automated test coverage, E2E artifact evidence, clean build/type/lint/test gates, and no open P0/P1 findings.
