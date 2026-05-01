# ExamPull Build Tracker

Last updated: 2026-05-01

## Current Phase

Production hardening and PRD coverage expansion on a provisioned Next.js/Firebase build.

## Active Work

- [x] Scaffold strict TypeScript Next.js app with Biome, Tailwind, Firebase, and tests.
- [x] Provision Firestore, Storage, Cloud Tasks, App Hosting, LaTeX Cloud Run, bucket CORS, Stripe prices, and production secrets.
- [x] Implement auth/session gate, dashboard, classes/materials, exam generation, attempts/grading, billing, feedback, notifications, settings export/delete, share links, and PDF downloads.
- [x] Implement admin shell, agent auth, live read surfaces, credit grant API, triage API, configuration, referrals, operations, and audit-log foundation.
- [x] Implement AI gateway, LaTeX client/service, topic extraction, PDF text extraction, credit accounting, queue abstractions, worker auth, and worker routes.
- [x] Build smoke E2E, unit tests, eval artifact harness, stopguard script, and deployment verification loop.
- [ ] Expand full browser/persona E2E coverage for every PRD flow and attach artifacts per testing docs.
- [ ] Deepen visual annotation from metadata overlays into true image/PDF annotation artifacts.
- [ ] Complete post-v1 admin hardening: passkey/SMS operator auth, CSRF tokens, immutable external audit replication, and destructive-operation reauth.

## Known Risks

- The repository began with documentation only; implementation is new and still needs broad cross-browser exploratory coverage.
- Admin phone/passkey flows remain out of this loop by operator direction; autonomous testing uses agent admin auth.
- Visual annotation currently records structured annotation metadata; true rendered annotated PDFs/images still need the next implementation pass.
- OCR for scanned image-only PDFs/photos is not complete; text PDFs are extracted server-side and other files fall back to focus/filename plus LLM inference.

## Latest Verification

- `pnpm lint` passing.
- `pnpm typecheck` passing.
- `pnpm test` passing.
- `pnpm build` passing.
- `pnpm exec playwright test --project=desktop-chrome` passing.
- `pnpm exec playwright test --project=desktop-safari --project=mobile-safari` passing.
- Hosted smoke against `https://exampull-web--exampull-gpt-5-5.us-central1.hosted.app` passing on desktop Chrome.
- `pnpm eval:run` writes eval artifacts under `artifacts/eval/`.

## Completion Bar

ExamPull is not done until every PRD/admin-PRD feature has implementation coverage, automated test coverage, E2E artifact evidence, clean build/type/lint/test gates, and no open P0/P1 findings.
