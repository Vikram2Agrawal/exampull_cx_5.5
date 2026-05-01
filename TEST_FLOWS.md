# ExamPull Test Flows

Last updated: 2026-05-01

Legend: `[ ]` untested, `[x]` passing, `[!]` failing or blocked.

## P0 Primary Flows

- [!] P0-AUTH-001 Anonymous preview renders a blurred first-page image without exposing PDF data; full anonymous-to-verified account preservation still needs E2E coverage.
- [ ] P0-AUTH-002 Existing account linking handles email/provider conflict without creating duplicate accounts.
- [ ] P0-AUTH-003 Phone-number conflict requires prior auth source unless dormant 180+ days.
- [ ] P0-EXAM-001 Free user generates a 12-question Standard exam from manual topics.
- [ ] P0-EXAM-002 Scholar user generates a paid exam with answer key unlocked.
- [!] P0-EXAM-003 Guru visual-feedback worker creates a downloadable PDF artifact; full authenticated upload-to-download E2E remains.
- [ ] P0-CREDITS-001 Credit reservation is atomic across two tabs and releases on failure.
- [x] P0-DOWNLOAD-001 Completed exam and answer key download through authenticated server routes without private Storage reads.
- [x] P0-ADMIN-001 Unauthenticated `/admin/*` returns hard 404; agent auth works only through API.
- [ ] P0-SECURITY-001 User cannot read or mutate another user's data.

## P1 Product Flows

- [!] P1-CLASS-001 User creates, edits, archives, restores, and deletes a class; UI/API implementation exists, authenticated E2E remains.
- [!] P1-CLASS-002 Instructor example upload charges 2 credits and produces visible style guide; worker now reads text PDFs and supported image uploads, but full browser E2E remains.
- [ ] P1-WIZARD-001 Wizard combines class materials, ad hoc uploads, and manual topics.
- [!] P1-WIZARD-002 Long PDF with focus shows TOC-reading progress and extracts scoped topics; server-side text PDF/image extraction is implemented, but long-document progress E2E remains.
- [ ] P1-WIZARD-003 Topic extraction failure offers best-effort/manual fallback.
- [!] P1-POWER-001 Scholar/Guru Power Mode creates and reorders per-question slots on desktop; schema/UI/LaTeX support exists, authenticated E2E remains.
- [!] P1-POWER-002 Mobile Power Mode uses tap reorder and bulk actions; explicit up/down controls and range bulk edits exist, tap-to-target E2E remains.
- [!] P1-LIBRARY-001 Library search, filter, bookmark, archive, delete, move-to-class, grid/list, and bulk actions are implemented; authenticated E2E remains.
- [x] P1-DETAIL-001 Exam detail shows PDF viewer, metadata, sources, attempts, rating, clone, archive, report, and share.
- [x] P1-SHARE-001 Share link exposes student-copy PDF only; answer key remains private to authenticated creator tier.
- [!] P1-BOOST-001 Free user Scholar Boost is offered from second exam and atomically consumed; implementation exists, full authenticated two-tab E2E remains.
- [ ] P1-BILLING-001 Upgrade, downgrade, cancellation, credit packs, and receipts flow through Stripe test mode.
- [!] P1-NOTIFY-001 In-app notification center handles exam, grading, feedback, and account events; payment/referral event coverage remains.
- [x] P1-FEEDBACK-001 Product feedback widget routes feature requests, bugs, and general feedback to Firestore triage.
- [x] P1-ADMIN-002 Admin Users, Exams, Analytics, Operations, Communications, Abuse, Referrals, Configuration, Audit Log surfaces load.

## P2 Resilience And Quality Flows

- [ ] P2-CHAOS-001 Refresh at every wizard step preserves draft state.
- [ ] P2-CHAOS-002 LaTeX 503 retries without burning visual QA budget.
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
- Desktop Safari and Mobile Safari smoke: `pnpm exec playwright test --project=desktop-safari --project=mobile-safari` passed after installing WebKit.
- Hosted production smoke: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after multimodal extraction deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after Power Mode/library management deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after class lifecycle controls deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after secure anonymous preview deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Hosted production smoke after Scholar Boost deployment: `TEST_BASE_URL=https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app pnpm exec playwright test --config=playwright.prod.config.ts --project=desktop-chrome` passed.
- Eval smoke: `pnpm eval:run` wrote `artifacts/eval/2026-05-01T20-23-56-330Z`.
