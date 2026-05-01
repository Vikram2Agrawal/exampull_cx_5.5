# ExamPull Build Tracker

Last updated: 2026-05-01

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
- [x] Build smoke E2E, unit tests, eval artifact harness, stopguard script, and deployment verification loop.
- [ ] Expand full browser/persona E2E coverage for every PRD flow and attach artifacts per testing docs.
- [x] Deepen visual annotation from metadata overlays into downloadable Guru visual feedback PDF artifacts.
- [ ] Complete post-v1 admin hardening: passkey/SMS operator auth, CSRF tokens, immutable external audit replication, and destructive-operation reauth.

## Known Risks

- The repository began with documentation only; implementation is new and still needs broad cross-browser exploratory coverage.
- Admin phone/passkey flows remain out of this loop by operator direction; autonomous testing uses agent admin auth.
- Visual annotation now creates a rendered feedback PDF; true overlay-on-original-attempt rendering remains a fidelity improvement.
- OCR for scanned image-only PDFs is not complete; text PDFs are extracted server-side, and supported image uploads are passed to the AI gateway as multimodal context during extraction and generation.
- Power Mode has explicit up/down reordering and bulk range edits; drag-and-drop and tap-to-target mobile reorder remain fidelity improvements.
- Anonymous preview claim-to-account preservation still needs full Firebase anonymous-linking E2E; preview delivery itself no longer exposes the source PDF.

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
- `pnpm eval:run` writes eval artifacts under `artifacts/eval/`; latest run `artifacts/eval/2026-05-01T21-59-10-970Z`.

## Completion Bar

ExamPull is not done until every PRD/admin-PRD feature has implementation coverage, automated test coverage, E2E artifact evidence, clean build/type/lint/test gates, and no open P0/P1 findings.
