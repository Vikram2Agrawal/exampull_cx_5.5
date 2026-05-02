# ExamPull — System Design Document

**Version:** 2.0
**Date:** April 28, 2026
**Status:** Final

This document is the technical source of truth for ExamPull. The product spec lives in `prd.md`; the admin tool spec lives in `admin-prd.md`. This document covers infrastructure, technology choices, model selection, data model, security, and operations.

The design philosophy is:
- **Minimal dependencies** — prefer one provider per concern, prefer Google Cloud where reasonable, use third parties only when GCP doesn't have a credible alternative
- **Provider-agnostic where it counts** — LLM access goes through a gateway so models can be swapped without code changes
- **Boring tech where appropriate** — Next.js + Firebase is well-trodden; no need to reinvent
- **Build for the present, scale when needed** — designed to handle 10K users today and scale to 1M with documented migration paths

---

## 1. Infrastructure Inventory

### Per-Agent Project Model

Each parallel build agent owns **its own GCP project** for full data isolation. Two agents working in parallel never share Firestore data, Storage buckets, Cloud Tasks queues, or Cloud Run services.

**Per-agent SaaS keys** (separate API keys per agent, for separate cost tracking, rate-limit isolation, and signal cleanliness):
- **OpenRouter** — separate `OPENROUTER_API_KEY` per agent so token spend, rate limits, and any abuse blocks attributable to one agent never interfere with another
- **GitHub** — separate `GITHUB_PAT` per agent (each agent pushes from its own identity)
- **Sentry** — separate projects (under the same org) per agent. Each agent has its own `SENTRY_DSN` and `SENTRY_PROJECT_ID`; `SENTRY_ORG` and `SENTRY_AUTH_TOKEN` are org-scoped and stay shared. Errors from each agent land in its own issue list with separate alerts and quotas — no cross-agent triage friction.

**Shared SaaS accounts** (single API key across agents — data isolation comes from the per-project Firestore/Cloud Run separation, not from the SaaS layer):
- Stripe (test mode — per-agent project regenerates its own price IDs via `pnpm setup:stripe`)
- Resend, Twilio, Featurebase, Porkbun
- PostHog — shared project; per-agent attribution via `$environment` event property and `agent` person property at identify time

The values below describe the *shape* of each agent's project; concrete IDs and numbers are filled in per agent in that agent's `.env.local`. There is no shared "production" GCP project that build agents may touch — operator-owned launch infrastructure is intentionally out of agent scope.

### Per-Agent Project Bootstrap

The first time an agent runs, it provisions its own project. The setup is idempotent — re-running on an already-bootstrapped project is safe.

```bash
# 1. Create the GCP project (operator runs this once per agent; agent uses thereafter)
PROJECT_ID="exampull-<agent-slug>"        # e.g., exampull-claude-dev, exampull-codex-dev
gcloud projects create "$PROJECT_ID" --name "ExamPull (<agent-slug>)"
gcloud config set project "$PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"

# 2. Enable required APIs
gcloud services enable \
  firebase.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com

# 3. Add Firebase to the project + create the Web App
firebase projects:addfirebase "$PROJECT_ID"
firebase apps:create web exampull-web --project "$PROJECT_ID"

# 4. Initialize Firestore in nam5 (multi-region US)
gcloud firestore databases create --location=nam5

# 5. Create service accounts (per IAM section in §6)
gcloud iam service-accounts create exampull-server --display-name="ExamPull Server"
gcloud iam service-accounts create exampull-tasks --display-name="ExamPull Cloud Tasks Invoker"

# 6. Provision the Cloud Tasks queue + IAM (per §6.2 and §6.3 below)
# 7. Deploy the LaTeX service (pnpm deploy:latex)
# 8. Create the Firebase App Hosting backend
firebase apphosting:backends:create --project "$PROJECT_ID" exampull-web
# Capture the backend URL → store in .env.local as WEB_URL
```

The agent's `.env.local` then carries:
- `GOOGLE_CLOUD_PROJECT=$PROJECT_ID`
- `WEB_URL=<backend URL from step 8>`
- Firebase Web App credentials (API key, app ID, etc., from step 3)
- Stripe / OpenRouter / Resend / Twilio API keys (shared across agents — these don't need per-agent isolation)

The repo has a `pnpm setup:project` script (in `scripts/`) that runs steps 2–7 idempotently against the currently-active gcloud project.

| Resource | Convention |
|---|---|
| GCP Project ID | `${GOOGLE_CLOUD_PROJECT}` (per-agent, set on first project creation) |
| GCP Project Number | `${GOOGLE_CLOUD_PROJECT_NUMBER}` (assigned by GCP at project creation) |
| Primary Region | `us-central1` |
| Firestore Region | `nam5` (multi-region US) |
| Server Service Account | `exampull-server@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com` |
| Cloud Run service (web) | `exampull-web` (managed by Firebase App Hosting in us-central1) |
| Web URL (App Hosting backend) | `${WEB_URL}` (set per agent in `.env.local` after `firebase apphosting:backends:create`) |
| Routing | App Hosting → Cloud Run (managed) |
| Cloud Tasks queue (exam jobs) | `exampull-jobs` (us-central1) — see §6.2 |
| Cloud Tasks invoker SA | `exampull-tasks@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com` — see §6.3 |
| LaTeX service Cloud Run | `latex-service` (us-central1) — URL in `LATEX_SERVICE_URL` env |

### Third-Party Account Ownership
All third-party services are managed under the operator's primary email (`vikram2agrawal@gmail.com`) unless noted. A fresh agent inherits these by being granted access via API key.

| Service | Role | Notes |
|---|---|---|
| OpenRouter | LLM gateway | Single org; key at `OPENROUTER_API_KEY` |
| Resend | Transactional email | Sending domain configured via `RESEND_FROM_ADDRESS`; see §14 |
| Twilio | SMS broadcast + admin auth fallback | Account SID at `TWILIO_ACCOUNT_SID`; phone at `TWILIO_PHONE_NUMBER` |
| Stripe | Payments | Test mode + live mode; Restricted Key for refunds (admin-only) |
| Featurebase | Feedback / roadmap / changelog | SSO via Firebase ID token |
| Sentry | Error tracking | One org, two projects (web + admin) |
| Typesense Cloud | Admin search index | Provisioned only when scaling demands it (post-v1) |
| PostHog | Product analytics (optional) | Self-hostable; if used, env in §15 |
| Porkbun | Domain registrar + DNS | Programmatic via `PORKBUN_API_KEY` / `PORKBUN_SECRET_KEY` |

### Firebase
| Resource | Value |
|---|---|
| Web App ID | `${NEXT_PUBLIC_FIREBASE_APP_ID}` (per-agent — assigned when the agent registers a Web App on its GCP project) |
| Auth providers enabled | Email/Password, Google, Phone, Anonymous |

### Hostnames

For the build/pre-launch phase, the app and the admin both run on the **Firebase App Hosting URL** of the `exampull-web` backend (an `*.run.app` or `*.hosted.app` URL — exact value resolved from App Hosting at backend creation time and stored in the `WEB_URL` env var). There is no custom domain.

| Resource | Value |
|---|---|
| Web app | `${WEB_URL}` (Firebase App Hosting backend URL) |
| Admin dashboard | `${WEB_URL}/admin/*` (path-based routing on the same backend; see §6 / §8 for the firewall) |

A custom apex domain may be added by the operator after launch (operator-owned process, **not** in scope for autonomous build agents). When/if that happens, host-based admin routing can replace the path-based scheme without code changes — only middleware reconfiguration. Until then, every reference to "the app URL" or "the admin URL" resolves through `WEB_URL`, never a hardcoded domain.

### DNS Records
The Porkbun account (`PORKBUN_API_KEY` / `PORKBUN_SECRET_KEY` in `.env.local`) is reserved for the operator's post-launch custom-domain setup. Build agents do not write DNS records and do not assume any particular zone exists. The Porkbun credentials are present so that the same `lib/dns/` client used for any future programmatic DNS updates (e.g., re-issuing Resend DKIM under a new sender domain) can be wired up later.

### GitHub
| Resource | Value |
|---|---|
| Repository | `Vikram2Agrawal/exampull` (private) |
| Default branch | `main` |

### Owner
| Resource | Value |
|---|---|
| Operator | Vikram Agrawal |
| Operator email | `vikram2agrawal@gmail.com` |
| GitHub | `Vikram2Agrawal` |

### Secrets Convention
All secrets are loaded from `.env.local` (gitignored) in dev and from **GCP Secret Manager** in production. The `.env.example` file in the repo enumerates the required keys without values. The full list of env vars is in §15.

### Tooling Versions
| Tool | Version |
|---|---|
| Node | 22.15.0 (via nvm) |
| Package manager | pnpm 10.30.1 |
| gcloud SDK | 557.0.0 |
| Firebase CLI | 14.9.0 |

> **Note for fresh agents**: gcloud requires `export CLOUDSDK_PYTHON=/opt/homebrew/opt/python@3.12/libexec/bin/python3` and `export PATH="$HOME/google-cloud-sdk/bin:$PATH"`. Source nvm via `source ~/.nvm/nvm.sh`.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│                Next.js 15+ (React 19, App Router, RSC)               │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Cloud Run (`exampull-web`, us-central1)           │
│       Next.js 15 SSR — deployed via Firebase App Hosting (§3)        │
│                                                                       │
│                                                                       │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐     │
│  │ Server       │   │ API Routes   │   │ Server Actions       │     │
│  │ Components   │   │ /api/*       │   │ (mutations)          │     │
│  └──────────────┘   └──────┬───────┘   └────────┬─────────────┘     │
└──────────────────────────┬─────────────────────┬─────────────────────┘
                           │                     │
       ┌───────────────────┼─────────────────────┼─────────────────┐
       ▼                   ▼                     ▼                 ▼
┌─────────────┐   ┌────────────────┐   ┌──────────────┐   ┌──────────────┐
│ Firebase    │   │ Cloud          │   │ OpenRouter   │   │ Stripe       │
│ Auth        │   │ Firestore      │   │ (LLM gateway)│   │ (payments)   │
└─────────────┘   └────────────────┘   └──────┬───────┘   └──────────────┘
                                              │
                          ┌───────────────────┴────────────────────┐
                          ▼                                        ▼
                ┌──────────────────┐                    ┌──────────────────┐
                │ Text models      │                    │ Image-edit model │
                │ (Gemini 3 Flash, │                    │ (GPT Image 2,    │
                │  Gemini 3.1 Pro, │                    │  via OpenRouter) │
                │  swappable)      │                    └──────────────────┘
                └──────────────────┘
       ▼                   ▼                     ▼                 ▼
┌─────────────┐   ┌────────────────┐   ┌──────────────┐   ┌──────────────┐
│ Cloud       │   │ Cloud Tasks    │   │ LaTeX Service│   │ Resend       │
│ Storage     │   │ (job queue)    │   │ (Cloud Run)  │   │ (email)      │
└─────────────┘   └────────────────┘   └──────────────┘   └──────────────┘
                                                                  ▼
                                                          ┌──────────────┐
                                                          │ Twilio       │
                                                          │ (SMS)        │
                                                          └──────────────┘
```

---

## 3. Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend Framework** | Next.js 15+ (App Router, React 19, RSC) | Industry standard; Deployment Adapter API support for Firebase App Hosting |
| **Styling** | Tailwind CSS v4 | Industry standard; zero-config in v4; uses Oklch color space |
| **UI Components** | shadcn/ui + custom glassmorphism layer | Accessible base components; layered glass effects for premium feel |
| **Animations** | Framer Motion | De facto React animation library |
| **Backend Runtime** | Next.js Server Actions + API Routes | Single deployment; no separate backend service |
| **Hosting** | Firebase App Hosting (GA) | Managed Next.js hosting on Cloud Run with integrated CI/CD, CDN, and PR-preview channels. The existing `exampull-web` Cloud Run service is the target backend; App Hosting takes over deploys via `apphosting.yaml`. |
| **Database** | Cloud Firestore | Serverless NoSQL; real-time listeners; zero ops; multi-region |
| **Auth** | Firebase Auth | Google, email/password, phone OTP, anonymous; passkey/WebAuthn support |
| **File Storage** | Cloud Storage (GCS) | GCP-native; signed URLs for direct client uploads/downloads |
| **LLM Gateway** | OpenRouter | Single API across 300+ models; switch models via config; provider fallback |
| **Image Editing** | OpenAI GPT Image 2 (via OpenRouter) | Pixel-perfect text rendering — critical for visual annotations |
| **Job Queue** | Cloud Tasks | Reliable async dispatch; OIDC-secured; integrates with Cloud Run |
| **LaTeX Compilation** | Custom Cloud Run service (TeX Live Docker) | Full LaTeX support; isolated from main app; auto-scaling |
| **Search (admin scale)** | Typesense Cloud | Open-source-friendly; mirrors Firestore via Cloud Function trigger |
| **Payments** | Stripe | No GCP alternative; lowest fees; Stripe Link for one-tap |
| **Transactional Email** | Resend | Best Next.js DX in 2026; React Email templates; competitive pricing |
| **SMS (broadcast)** | Twilio | Industry standard for programmatic SMS; STOP/HELP keyword handling |
| **SMS (auth)** | Firebase Auth (built-in) | Phone verification handled natively in Firebase Auth |
| **Feedback / Roadmap** | Featurebase | Already integrated; SSO via Firebase ID token |
| **Monitoring** | Cloud Monitoring + Cloud Logging | Native GCP observability |
| **Error Tracking** | Sentry | Source-mapped client + server stack traces |
| **Secrets** | GCP Secret Manager (prod), `.env.local` (dev) | IAM-secured rotation |
| **CI/CD** | GitHub Actions | Auto-deploys to Firebase App Hosting on push to main |
| **Language** | TypeScript strict mode throughout | Type safety; no `any`; no `@ts-ignore` |
| **Linting/Formatting** | Biome | Single tool replacing ESLint + Prettier. Config in `biome.json` enforces `indentStyle: "tab"` and `indentWidth: 4`. `.editorconfig` and `.vscode/settings.json` are configured for format-on-save with tabs. **Never spaces.** |
| **Testing** | Vitest (unit/integration) + Playwright (E2E) | Standard tooling |

---

## 4. AI Model Strategy

ExamPull uses **OpenRouter** as the unified gateway for LLM access. This decouples the codebase from any single provider and lets us swap models per stage via configuration without redeploying.

### Why OpenRouter
- **300+ models** behind a single OpenAI-compatible API (Gemini, GPT, Claude, DeepSeek, Qwen, Llama, etc.)
- **Image-generation models** including GPT-5.4 Image 2, Nano Banana Pro, Gemini 3.1 Flash Image
- **Provider fallback** — if one upstream is down, OpenRouter routes around it
- **Single billing relationship** — one invoice instead of N provider accounts
- **A/B testing** — swap model IDs in config to compare quality/cost without code changes
- Tradeoffs vs direct calls: small markup, slight latency. Acceptable for the flexibility gained.

### Model Selection by Pipeline Stage

The current model choices below are **defaults** — all stage-to-model mappings live in a single `lib/ai/models.ts` config file and can be changed without touching pipeline code.

All "fast" stages use **Gemini 3 Flash**; all paid-tier "frontier" stages use **Gemini 3.1 Pro**. Other models (DeepSeek V4 Flash, Claude, GPT-5.4) are available behind the same OpenRouter gateway and can be A/B tested or swapped per stage via config without code changes.

| Stage | Default Model | Notes |
|---|---|---|
| Topic extraction (per material) | Gemini 3 Flash | Strong multimodal + content extraction |
| Upload-time validation pass | Gemini 3 Flash | Lightweight vibe-check |
| Smart PDF TOC reading | Gemini 3 Flash | Strong long-context PDF parsing |
| Test plan (Free tier) | Gemini 3 Flash | Fast, cost-efficient |
| Test plan (Scholar/Guru) | Gemini 3.1 Pro | Frontier reasoning quality |
| Question generation (Free tier) | Gemini 3 Flash | Fast, cost-efficient |
| Question generation (Scholar/Guru) | Gemini 3.1 Pro | Frontier quality + best multimodal grounding from materials |
| LaTeX assembly | Tier model (Pro for paid, Flash for Free) | LaTeX correctness benefits from stronger model on paid tiers |
| Visual QA check | Gemini 3 Flash | Strong multimodal vision; cost-efficient for verification |
| Visual QA fix | Tier model | Use whichever model the user paid for |
| Answer-space tier selection | Gemini 3 Flash | Trivial classification |
| Grading sanity check | Gemini 3 Flash | Multimodal vision |
| Grading (Scholar/Guru) | Gemini 3.1 Pro | Multimodal handwriting recognition + reasoning |
| Visual annotation | GPT Image 2 (`openai/gpt-5.4-image-2` via OpenRouter) | Pixel-perfect text rendering for legible margin notes |
| Distribution-guidance injection check | Gemini 3 Flash | Cheap, fast |
| Instructor style guide generation | Gemini 3 Flash | Multimodal vision over uploaded exam images |
| Title generation (when user leaves blank) | Gemini 3 Flash | Trivial completion |

### Pricing Constants (April 2026)

Stored as configurable constants in `lib/ai/pricing.ts`:

| Model | Input ($/1M tok) | Output ($/1M tok) |
|---|---|---|
| Gemini 3 Flash | $0.50 | $3.00 |
| Gemini 3.1 Pro | $1.25 | $5.00 |
| GPT Image 2 (text) | $8.00 | n/a |
| GPT Image 2 (image input) | $0.015 / megapixel | n/a |
| GPT Image 2 (image output) | $0.03 / first MP, $0.015 / additional MP | n/a |
| DeepSeek V4 Flash *(available, not currently used)* | $0.14 | $0.28 |

OpenRouter adds a small markup; effective rates are recorded per-call from response headers so the cost analytics in §5.10 of the PRD are exact, not estimated.

### Credit-to-Action Mapping (canonical, mirrors PRD §6)
These constants govern `computeCost(input)` referenced in §6 and `refreshMonthlyCredits` in §13. Stored in `lib/billing/credits.ts`:

```ts
export const CREDIT_COSTS = {
  GENERATE_QUESTION: 2,        // 2 credits per question generated
  GRADE_QUESTION: 1,           // 1 credit per question graded (text feedback)
  ANNOTATE_QUESTION: 4,        // 4 credits per question for visual annotation
  STYLE_GUIDE_UPLOAD: 2,       // 2 credits per instructor-exam upload (style guide gen / edit)
} as const;

export const TIER_MONTHLY_CREDITS = {
  free: 40,
  scholar: 400,
  guru: 4000,
} as const;

export const TIER_MAX_QUESTIONS_PER_EXAM = {
  free: 12,
  scholar: 25,
  guru: 100,
} as const;

export const CREDIT_PACK_PRICES = {           // USD cents
  pack_20: 100,    // 20 credits for $1.00
  pack_100: 400,   // 100 credits for $4.00 (20% savings)
  pack_240: 800,   // 240 credits for $8.00 (33% savings)
} as const;

export const GURU_ROLLOVER_MAX_AGE_DAYS = 365;  // Guru-only: credits expire after 1 year
```

`computeCost(config)` returns `config.questionCount * CREDIT_COSTS.GENERATE_QUESTION` for generation. Grading and annotation costs are computed per-attempt in their respective server actions.

### Eval Grading Rule (CRITICAL)
**The eval system NEVER calls API-billable LLMs for grading exam quality.** Eval runner generates exam artifacts (PDFs, page images, LaTeX, manifest); grading happens via fresh-context **subagents** spawned by whichever harness the operator is running (the harness's own multimodal-capable model reads the artifacts and produces JSON scores). Do NOT add API-callable LLM SDKs (`@anthropic-ai/sdk`, the OpenAI SDK, the Gemini SDK, etc.) to the eval harness for grading purposes — the operator is emphatic about this. See `EVAL_PHILOSOPHY.md` for full detail.

### Model-Swap Rollback & Canary
The model-swap procedure described above is forward-only as written. For safer rollouts:

1. **Per-stage feature flag**: each stage in `lib/ai/models.ts` can read from a Firestore `config/model_routing/{stage}` document at runtime (cached 60s), so model changes can be made without redeploys. Falls back to env-var defaults if Firestore is unreachable.
2. **Percent rollout**: routing supports `{ "default": "gemini-3-flash-preview", "canary": { "model": "deepseek-v4-flash", "percent": 10 } }` so a fraction of traffic uses the new model before full cutover.
3. **Rollback**: revert the Firestore `config/model_routing/{stage}` document to the prior value via the admin Configuration tab. Effect is near-instant.
4. **Monitor**: per-exam margin and rating dashboards (admin §5.4) flag quality regressions within hours.

### Multimodal Capabilities Required
- **PDF / image / handwritten text reading** — primary models all support natively (Gemini 3.1 Pro, GPT-5.4, Claude 4.5)
- **Long context (up to 800K input tokens)** — Gemini, Claude have 1M; GPT-5.4 has 400K
- **Image editing (annotation overlay)** — GPT Image 2 is the current best for text-rendering quality; Nano Banana Pro is the fallback
- **No video** — not required; video file/link inputs are not supported in the product spec

### Model Swap Procedure
To change a model for a stage:
1. Update the model ID in `lib/ai/models.ts`
2. Update pricing in `lib/ai/pricing.ts` if needed
3. Run `pnpm eval:run` against the affected pipeline stages to verify quality
4. Deploy via standard CI/CD

No code changes needed — all pipeline calls take the model ID from config.

---

## 5. Frontend Architecture

### Project Structure

```
/app                            # Next.js App Router
├── (marketing)/                # Public pages
│   ├── page.tsx                # Landing
│   ├── pricing/page.tsx
│   ├── terms/page.tsx
│   ├── privacy/page.tsx
│   └── support/page.tsx
├── (auth)/                     # Auth pages
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── forgot-password/page.tsx
│   └── verify-phone/page.tsx
├── (app)/                      # Authenticated app
│   ├── layout.tsx              # App shell
│   ├── dashboard/page.tsx
│   ├── classes/
│   ├── exams/
│   │   ├── new/                # Wizard
│   │   ├── [examId]/           # Detail page (embedded PDF, attempts, rating, clone)
│   │   └── page.tsx            # Library
│   ├── share/[shareId]/page.tsx  # Public share-link viewer (no auth)
│   ├── settings/page.tsx
│   └── notifications/page.tsx  # In-app notification center
├── (admin)/                    # Admin dashboard (path-based at /admin/*; middleware-gated by admin session)
│   └── ...                     # see admin-prd.md
├── api/
│   ├── webhooks/stripe/route.ts
│   ├── webhooks/twilio/route.ts
│   ├── workers/generate-exam/route.ts
│   ├── workers/grade-attempt/route.ts
│   ├── workers/visual-feedback/route.ts
│   ├── workers/extract-topics/route.ts
│   ├── workers/style-guide/route.ts
│   └── auth/admin-sms/route.ts
└── layout.tsx
```

### Components

```
/components
├── ui/                         # shadcn/ui base
├── glass/                      # Glassmorphism wrappers
├── exam/                       # ExamCreator, TopicEditor, TestBuilder, ExamCard, PdfPreview, AttemptList, RatingPrompt
├── class/                      # ClassCard, MaterialList, StyleGuideViewer
├── feedback/                   # GradingResults, AnnotatedPdfViewer
├── billing/                    # PriceCalculator, CreditPackPicker, SubscriptionManager
├── notifications/              # NotificationBell, NotificationFeed
├── admin/                      # Admin-only components (data-dense, no glassmorphism)
└── layout/                     # Shell, nav, sidebar
```

### State Management
- **Server state**: React Server Components + Server Actions
- **Real-time state**: Firestore `onSnapshot` listeners for exam status, credit balance, notifications
- **Client state**: React hooks; Zustand only if global state grows complex
- **Form state**: React Hook Form + Zod
- **URL state**: nuqs for filter/segment state on admin pages

### Key Frontend Libraries
| Library | Purpose |
|---|---|
| `firebase` | Client SDK for Auth, Firestore listeners, Storage uploads |
| `framer-motion` | Animations |
| `react-hook-form` + `zod` | Forms and validation |
| `@react-pdf-viewer/core` | Embedded PDF viewer on exam detail page |
| `lucide-react` | Icons |
| `sonner` | Toast notifications |
| `nuqs` | URL search params state |
| `@tanstack/react-table` | Admin tables (virtualized for 1M rows) |
| `recharts` | Admin charts |
| `react-email` | Email template authoring (renders to HTML for Resend) |

---

## 6. Backend Architecture

### Server Actions for Mutations

```typescript
// app/actions/exams.ts
"use server"

export async function createExam(input: ExamConfig): Promise<ExamJob> {
  const user = await getAuthUser();
  await validateExamQuota(user, input);          // Tier limits
  const reservation = await reserveCredits(user, computeCost(input)); // Atomic Firestore txn
  const job = await createExamJob(user, input);
  await enqueueExamGeneration(job.id);
  return job;
}
```

### Cloud Tasks for Async Pipelines

Long-running pipelines (exam generation, grading, visual annotation, instructor style guide processing) are dispatched via Cloud Tasks to protected `/api/workers/*` endpoints on the same Cloud Run instance.

```
User clicks "Generate"
  → Server Action reserves credits + creates Firestore doc (status: "queued")
  → Server Action enqueues Cloud Task (target: /api/workers/generate-exam)
  → Cloud Tasks invokes worker with OIDC token
  → Worker runs pipeline, updates Firestore status field at each stage
  → Client's Firestore listener shows live progress
  → On success: commit credit reservation; on failure: release reservation
```

**Why Cloud Tasks**: built-in retries with exponential backoff, configurable timeouts up to 30 minutes, dead-letter queue, no cold-start penalty (reuses the warm Cloud Run instance).

### Cloud Tasks Queue Configuration
Provision once via gcloud (idempotent — safe to re-run):

```bash
gcloud tasks queues create exampull-jobs \
  --location=us-central1 \
  --max-attempts=5 \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=4 \
  --max-dispatches-per-second=50 \
  --max-concurrent-dispatches=200
```

| Setting | Value | Rationale |
|---|---|---|
| Queue name | `exampull-jobs` | Single shared queue for all worker types (exam-gen, grading, annotation, style-guide) |
| Region | `us-central1` | Same as Cloud Run service |
| Max attempts | 5 | Enough retries for transient upstream failures |
| Min backoff | 10s | Quick initial retry |
| Max backoff | 300s | Cap exponential backoff at 5 min |
| Dispatch deadline | 30 min | Set per-task; max for long-running pipelines |
| Routing target | `${WEB_URL}/api/workers/<route>` | Per-task at enqueue time |

### Cloud Tasks Invoker Identity
Tasks are dispatched with an OIDC token signed by a dedicated service account:

| Resource | Value |
|---|---|
| Invoker SA | `exampull-tasks@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com` |
| Required role on the invoker SA | `roles/iam.serviceAccountTokenCreator` (to mint OIDC tokens) |
| Required role on `exampull-web` Cloud Run | `roles/run.invoker` granted to the invoker SA |
| Server SA permission to enqueue | The server SA granted `roles/cloudtasks.enqueuer` on the queue |

Provision IAM (idempotent):

```bash
# Create the invoker SA
gcloud iam service-accounts create exampull-tasks \
  --display-name="ExamPull Cloud Tasks Invoker"

# Grant invoker rights on the Cloud Run service
gcloud run services add-iam-policy-binding exampull-web \
  --region=us-central1 \
  --member=serviceAccount:exampull-tasks@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com \
  --role=roles/run.invoker

# Allow the server SA to enqueue tasks
gcloud tasks queues add-iam-policy-binding exampull-jobs \
  --location=us-central1 \
  --member=serviceAccount:exampull-server@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com \
  --role=roles/cloudtasks.enqueuer

# Allow the server SA to create tokens for the invoker SA
gcloud iam service-accounts add-iam-policy-binding \
  exampull-tasks@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com \
  --member=serviceAccount:exampull-server@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator
```

### Worker Endpoint Security
All `/api/workers/*` routes:
- Reject requests without a valid OIDC bearer token in the `Authorization` header
- Verify the token's `aud` claim matches the Cloud Run service URL (`${WEB_URL}`)
- Verify the token's `email` claim equals `exampull-tasks@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com` (the configured invoker SA)
- Verify the token signature against Google's public certs (cached)
- Return 401 on any auth failure
- Are not reachable from the public internet via load balancer rules (admin and worker routes are filtered at the Cloud Armor / LB level)

### Webhook Endpoints
- `/api/webhooks/stripe` — Stripe events (subscription, payment, refund, chargeback). Signature verified per request.
- `/api/webhooks/twilio` — Twilio events (SMS delivery status, STOP/HELP keyword responses)

---

## 7. Database Design (Cloud Firestore)

### Naming Convention
**All Firestore field names use camelCase.** Where the PRD or admin-PRD documents use snake_case for readability (e.g., `boost_used_at`, `revenue_usd`), the actual stored field name is the camelCase equivalent (`boostUsedAt`, `revenueUsd`). The schema below is canonical.

### Top-Level Collections

```
users/{userId}                   # Per-user profile, credits, subscription state
operators/{operatorId}           # Admin operators (RBAC scaffold; one operator today)
operator_roles/{roleId}          # Role definitions
feedback/{feedbackId}            # Top-level rating + feedback aggregation (PII redacted on user delete)
communications/{commId}          # Per-recipient outbound message log (broadcasts + 1-on-1)
audit_log/{entryId}              # Admin actions (immutable, hash-chained, replicated to separate project)
audit_access/{entryId}           # Meta-audit: who read the audit log
analytics/                       # Pre-aggregated summary docs (daily users, exams, revenue, cost)
config/                          # Feature flags, kill switches, pricing constants
support_tickets/{ticketId}       # Inbound support requests
data_export_requests/{reqId}     # GDPR/CCPA export queue
share_links/{shareId}            # Public share-link metadata (separate from owning exam doc)
referrals/{referralId}           # Referral program tracking
```

### User Subcollections

```
users/{userId}
├── displayName: string
├── avatarUrl: string | null
├── email: string
├── linkedAuthProviders: array  # [{type: 'google'|'email'|'phone', identifier}]
├── phone: string
├── phoneVerifiedAt: timestamp
├── tier: 'free' | 'scholar' | 'guru'
├── tierOverride: { tier, expiresAt? } | null   # Admin override
├── credits: number             # Current usable balance
├── reservedCredits: number     # Pending in-flight pipelines
├── creditLedger: array         # Recent grants/consumptions; capped at 100 entries — older entries spill to `users/{userId}/creditLedgerArchive/{entryId}` subcollection to stay under Firestore's 1MB doc-size limit
├── purchasedCreditsBalance: number   # Cash-purchased credits (never expire on tier changes)
├── rolloverCredits: number     # Guru-only, capped at 12 months
├── stripeCustomerId: string
├── subscriptionStatus: 'active' | 'cancelled' | 'past_due' | 'grace_period'
├── subscriptionEndsAt: timestamp
├── billingCycleStart: timestamp
├── boostUsedAt: timestamp | null      # Scholar Boost lifetime tracking
├── boostGradingUsedAt: timestamp | null
├── refundsRemaining: number    # Lifetime "early-exam quality" refund pool (Free tier)
├── notificationPrefs: { ... }  # Per-event, per-channel granular toggles
├── theme: 'light' | 'dark' | 'system'
├── tags: string[]              # Admin-applied tags (searchable filter)
├── adminNotes: string          # Markdown
├── isTestAccount: boolean      # Per main PRD §5.19. Server-write-only. Set via admin or TEST_SIGNUP_TOKEN.
├── lastActiveAt: timestamp
├── createdAt: timestamp
│
├── /classes/{classId}
│   ├── name, institution, educationLevel (0-100 numeric), description
│   ├── status: 'active' | 'archived' | 'deleted'
│   ├── styleGuide: string      # Generated from example exams
│   ├── createdAt, archivedAt
│   │
│   ├── /materials/{materialId}
│   │   ├── type, name, storageUrl, sizeBytes
│   │   ├── uploadedAt
│   │   └── extractedTopicsCache: { hash, topics, generatedAt }   # Cache key includes material + focus
│   │
│   └── /exampleExams/{exampleId}
│       ├── name, storageUrl
│       ├── styleAnalysis: string   # Plain-text analysis from this single example
│       └── uploadedAt
│
├── /exams/{examId}
│   ├── classId: string | null
│   ├── status: 'queued' | 'generating' | 'qa_in_progress' | 'complete' | 'failed' | 'partial_qa_fail' | 'reported'
│   ├── tierAtGen: 'free' | 'scholar' | 'guru'   # Snapshot at pipeline start
│   ├── modelAtGen: string                        # e.g., 'deepseek-v4-flash'
│   ├── boostApplied: boolean
│   ├── title: string
│   ├── topics: string[]
│   ├── config: { ... }         # Wizard inputs
│   ├── examPdfUrl, answerKeyPdfUrl, answerKeyLatex, examLatex
│   ├── sourceMaterialsSnapshot: array           # Captured at gen for "Create Another Like This"
│   ├── qaIterations: { exam: number, answerKey: number }
│   ├── generationMetadata: { stages, totalInputTokens, totalOutputTokens, costUsd, revenueUsd, marginUsd }
│   ├── rating: number | null
│   ├── feedbackText: string | null
│   ├── ratedAt: timestamp | null
│   ├── reportedAt: timestamp | null
│   ├── bookmarked: boolean
│   ├── isTestData: boolean     # Cascade-tagged at creation from user.isTestAccount; immutable. See main PRD §5.19.
│   ├── createdAt: timestamp
│   │
│   ├── /questions/{questionId}
│   │   ├── index, topic, style, difficulty, points
│   │   ├── questionLatex, answerLatex, answerSpaceTier
│   │   └── questionPlainText, answerPlainText   # For grading UI display
│   │
│   └── /attempts/{attemptId}
│       ├── uploadedPdfUrl
│       ├── score, maxScore, percentage
│       ├── perQuestionResults: array
│       ├── annotatedPdfUrl: string | null
│       ├── gradingFailureCount: number          # 3-strike counter
│       ├── gradedAt: timestamp
│       └── uploadedAt: timestamp
│
└── /notifications/{notifId}    # In-app notification feed
    ├── type, title, body, link
    ├── read: boolean
    └── createdAt
```

### Key Design Decisions

**Why Firestore over Cloud SQL**
- Zero ops, auto-scaling, real-time listeners
- Hierarchical model maps naturally to user → class → material and user → exam → attempt
- Generous free tier; pay-per-read at scale is predictable

**Tradeoffs accepted**
- No JOINs; relational queries handled in app code or pre-aggregated to summary collections
- Composite-index limit (200); admin-tab "OR across fields" queries route through Typesense (§9)
- 1MB document size limit; large blobs (PDFs, images) live in Cloud Storage with URL refs

**Indexes** (managed in `firestore.indexes.json`)
- `users` by `tier`, `createdAt`
- `users` by `lastActiveAt`, `tier`
- Collection group `exams` by `createdAt`, `status`
- Collection group `exams` by `tierAtGen`, `status`
- Collection group `exams` by `generationMetadata.costUsd` (desc) — for "most expensive" admin view
- Top-level `feedback` by `rating`, `createdAt`
- Top-level `communications` by `userId`, `sentAt` (desc)
- Top-level `audit_log` by `timestamp`, `operatorId`, `actionType`

**Security Rules**
- Users read/write only their own data
- Subcollection access follows parent ownership
- `feedback`, `share_links`, `audit_log`, etc. are server-write-only (clients can never write directly)
- `isTestAccount` (on users) and `isTestData` (on exams, feedback, attempts, etc.) are **server-write-only** — clients can read but never write. The Developer Panel (PRD §5.19) does NOT bypass this; every panel action calls a server route that re-checks `requireTestAccount(userId)` against the canonical user doc, never trusting client claims.
- Worker routes use Firebase Admin SDK (bypasses rules with service account)

### Pre-Aggregation Collections (Admin Scale)
Admin analytics never query the main collections directly at request time. Cloud Scheduler triggers Cloud Functions that incrementally update summary docs hourly:

```
analytics/
├── daily_users/{YYYY-MM-DD}     # signups, active counts, tier breakdown
├── daily_exams/{YYYY-MM-DD}     # generation volume by status/tier/model
├── daily_finance/{YYYY-MM-DD}   # revenue, cost, margin
├── tier_counts/current          # Real-time on tier change
├── cohorts/{cohort_id}          # Daily cohort retention matrices
└── lastSuccessfulRun: { topAggregator, perAggregator timestamps }   # Health monitoring
```

The admin dashboard surfaces `lastSuccessfulRun` so stale aggregations are visible.

---

## 8. Authentication Architecture

### User-Facing Auth (Firebase Auth)

| Provider | Method | Use |
|---|---|---|
| Email + Password | `createUserWithEmailAndPassword` | Standard sign-up |
| Google | `signInWithPopup(GoogleAuthProvider)` | OAuth |
| Phone (SMS OTP) | `signInWithPhoneNumber` | Verification + 2FA + recovery |
| Anonymous | `signInAnonymously` | No-account preview |

Apple Sign-In is deferred (requires $99/year Apple Developer Program). Architecture supports adding `OAuthProvider('apple.com')` later.

### Phone Verification Flow

Phone verification is a **prerequisite for account creation**, not a post-creation step (per main PRD §5.1). The user record is only written to Firestore once the phone is verified — there is no intermediate "unverified phone" account state.

Implementation: signup credentials (email/password or Google OAuth) are validated client-side and held in a transient signup state. Firebase Auth's account-creation step is deferred until after the phone OTP is verified.

```
User initiates signup (email/password OR Google OAuth)
  → Credentials validated; held in transient signup state (NOT yet a Firebase Auth user)
  → Phone collection step → Firebase Auth: signInWithPhoneNumber → SMS OTP
  → Server checks if phone is on another account
    → If yes, follow the linking-collision flow per main PRD §5.1
  → On OTP success, server creates the durable Firebase Auth user, links auth providers, and writes user doc with phone + phoneVerifiedAt set in a single atomic transaction
  → For anonymous→real linking: same gate. Anonymous UID is preserved via linkWithCredential only after phone verification succeeds.
```

### Anonymous → Real Account Linking
```
Anonymous user generates preview exam → exam tied to anonymous UID
  → User signs up with Google/email
  → If incoming credential matches an existing account, prompt to link
  → If no match, Firebase Auth: linkWithCredential() upgrades anonymous to permanent (UID preserved)
  → Anonymous-uploaded ad hoc materials transfer with UID
```

### Session Management
- Firebase Auth ID tokens (JWTs), verified server-side via Firebase Admin SDK on every request
- Session cookie set on sign-in (HTTP-only, secure) so RSC can read auth on the server
- ID token refreshed automatically by client SDK
- Server uses `cookies()` + `verifyIdToken()` in Server Components and Server Actions

### Admin Auth (separate, see admin-prd.md §2)
- WebAuthn/passkey primary + SMS fallback
- HMAC-SHA256 cookie, server-side session collection for instant revocation
- Phone number from `ADMIN_PHONE_NUMBER` env var
- Step-up auth for destructive operations

### Operator Phone Number Collision
The operator's phone (`ADMIN_PHONE_NUMBER`) is used solely for the admin dashboard's SMS auth fallback. It is intentionally **separate from the user-side `users/` collection** — the admin auth system uses its own `operators/` collection and does not consult or write to user records.

If the operator ever signs up as a regular user with the same phone, the user-side phone-uniqueness rule (one phone per user account) is unaffected because the constraint is enforced only across the `users/` collection. The operator's two identities (admin vs user) are distinct accounts in different collections.

### Auth Path Separation
For the build phase (path-based admin), middleware enforces a hard separation between the user app surface (every path *except* `/admin/*`) and the admin surface (`/admin/*`):

- Any request to `/admin/*` without a valid admin session cookie returns a **404** (not 401, not redirect — full 404, so the existence of the admin surface is not advertised to anonymous probes)
- Any request from the user app's session cookie hitting `/admin/*` is rejected the same way — admin auth is a distinct cookie domain, not piggybacking on the user session
- Any admin session cookie sent to a non-`/admin/*` path is silently ignored (admin sessions cannot be used to act on user surfaces)

This delivers the same security guarantees as the host-based design (admin and user are separate cookie domains; one session can never act as the other) without requiring a custom domain. When a custom domain is later configured, swap the path-prefix gate for a host-prefix gate; no other code change.

---

## 9. Search at Scale (Typesense)

For admin-tab user/exam search and complex segmentation that exceeds Firestore's capabilities, ExamPull uses **Typesense Cloud**.

> **Provisioning timing**: Typesense is **not required for v1 launch**. Firestore where-clauses on indexed fields handle admin search up to ~10K users. Provision the Typesense Cloud cluster only when search latency exceeds ~1 second on the admin tab.

### Indexes
| Index | Source | Sync Mechanism |
|---|---|---|
| `users` | Firestore `users/` | Cloud Function trigger on user doc write |
| `exams` | Collection group `exams` | Cloud Function trigger on exam status change |
| `feedback` | Firestore `feedback/` | Cloud Function trigger on feedback write |

### Index Schemas

```ts
// users index
{
  name: "users",
  fields: [
    { name: "userId", type: "string" },
    { name: "email", type: "string", facet: false, infix: true },
    { name: "displayName", type: "string", infix: true },
    { name: "phone", type: "string", facet: false, infix: true },
    { name: "stripeCustomerId", type: "string", facet: false },
    { name: "tier", type: "string", facet: true },
    { name: "subscriptionStatus", type: "string", facet: true },
    { name: "tags", type: "string[]", facet: true, optional: true },
    { name: "credits", type: "int32" },
    { name: "totalSpendCents", type: "int32" },
    { name: "totalExamsGenerated", type: "int32" },
    { name: "createdAt", type: "int64" },
    { name: "lastActiveAt", type: "int64" },
  ],
  default_sorting_field: "lastActiveAt",
}

// exams index
{
  name: "exams",
  fields: [
    { name: "examId", type: "string" },
    { name: "userId", type: "string" },
    { name: "userEmail", type: "string", infix: true },
    { name: "title", type: "string", infix: true },
    { name: "topics", type: "string[]" },
    { name: "classId", type: "string", optional: true, facet: true },
    { name: "tierAtGen", type: "string", facet: true },
    { name: "modelAtGen", type: "string", facet: true },
    { name: "status", type: "string", facet: true },
    { name: "questionCount", type: "int32" },
    { name: "rating", type: "int32", optional: true, facet: true },
    { name: "costUsd", type: "float" },
    { name: "marginUsd", type: "float" },
    { name: "createdAt", type: "int64" },
    { name: "shareSlug", type: "string", optional: true },
  ],
  default_sorting_field: "createdAt",
}

// feedback index
{
  name: "feedback",
  fields: [
    { name: "feedbackId", type: "string" },
    { name: "userId", type: "string" },
    { name: "userEmail", type: "string", infix: true },
    { name: "examTitle", type: "string", infix: true },
    { name: "rating", type: "int32", facet: true },
    { name: "feedbackText", type: "string", optional: true },
    { name: "tier", type: "string", facet: true },
    { name: "createdAt", type: "int64" },
  ],
  default_sorting_field: "createdAt",
}
```

### API Key Scopes
Two API keys, both stored in env vars:

- `TYPESENSE_API_KEY` (server-side, full access) — used by Cloud Functions to write to indexes and by admin server actions to query
- `TYPESENSE_SEARCH_ONLY_API_KEY` (client-side, read-only) — generated as a scoped key restricted to `actions: ["documents:search"]`. Currently unused since admin queries always go through the server, but available if any client-side typeahead is added later. **Never embed this in the user-facing app bundle** — it should only ship to admin clients.

### Other Notes
- Sync lag typically <30 seconds
- Search by email, display name, phone, Firebase UID, Stripe customer ID, tags, exam title, share-link slug
- Supports prefix, fuzzy, and full-text matching unavailable in Firestore
- Compound AND/OR filters that exceed Firestore's index/operator limits route here automatically

### User-Side Library Search (Phased)

Per main PRD §5.9, the user-facing library has a search box across exam titles, topics, and class names. We deliver this in two phases that match Typesense provisioning:

**Phase 1 (v1 launch — Firestore tokenized search):**
- On every exam doc write, a server-side hook normalizes title + topics + class name into a `searchTokens: string[]` array (lowercase, deduplicated, stop-word-stripped, prefix-tokenized for short prefix support).
- Library queries use Firestore's `array-contains-any` against `searchTokens`, scoped to the user's `users/{userId}/exams` subcollection.
- Strengths: ~free, no extra infra, latency comparable to other library reads.
- Limits: prefix and exact-token matching only; no in-word substring; no fuzzy. Adequate for the ≤200-exam library size of ~99% of users.

**Phase 2 (post-v1 — same Typesense cluster as admin):**
- When admin Typesense is provisioned (per the timing rule above), user-side search graduates onto the same cluster. The `exams` index already mirrors the collection group; userId-scoped search-only API keys (Typesense's `scoped_api_key` feature) restrict each user to their own documents.
- Adds: fuzzy match, in-word substring match, ranked relevance, multi-field weighting.
- No additional dedicated cost beyond what admin already consumes — incremental query load only.
- The transition is server-side: clients call the same server-action endpoint; the implementation switches from Firestore tokens to Typesense behind it. No client-side work.

The product app continues to use Firestore directly for everything else (reads, writes, real-time listeners). Typesense is *only* the search index for both user and admin search at Phase 2 — no other read paths route through it.

**Why Typesense vs Algolia**: open-source-friendly, lower cost at the volumes we expect, self-host option for cost control later. Both are functional fits.

---

## 10. AI Pipeline (Implementation)

All LLM calls go through `lib/ai/client.ts`, a thin wrapper around the OpenRouter API:

```typescript
// lib/ai/client.ts
import { ROUTING } from "./models"; // stage → model ID config

export async function callLLM(stage: PipelineStage, input: LLMInput): Promise<LLMOutput> {
  const modelId = ROUTING[stage][user.tier] ?? ROUTING[stage].default;
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: modelId, ...input }),
  });
}
```

The pipeline stages and their model bindings live in §4. Each call records token counts, latency, and cost (from response headers) into the per-exam `generationMetadata` field.

### Visual QA Loop Implementation
```
for iteration in 1..5 (per PDF, independent budgets):
    pages = renderPdfToImages(pdf)
    issues = await callLLM('qa-check', { images: pages })   # fast model
    if !issues.hasIssues: return SUCCESS
    fixedLatex = await callLLM('qa-fix', { latex, issues }) # tier model
    pdf = await compileLatex(fixedLatex)                     # LaTeX service
return PARTIAL_FAIL
```

Infrastructure failures (LaTeX service 503, network errors) don't count toward the 5-iteration budget — they're retried separately with exponential backoff.

### Visual Annotation (Image Editing)
GPT Image 2 is called via OpenRouter with the page image as a reference and a prompt that describes the corrections to overlay. The image-editing model is provider-specific (OpenAI in April 2026); routing through OpenRouter still gives us swap-ability if a better text-rendering image model emerges.

---

## 11. LaTeX Compilation Service

A dedicated **Cloud Run** service runs a TeX Live Docker container, separate from the main Next.js app for isolation.

```dockerfile
FROM texlive/texlive:latest-minimal
RUN tlmgr install \
    amsmath amssymb amsthm geometry fancyhdr enumitem \
    graphicx xcolor hyperref tikz pgfplots chemfig \
    listings minted booktabs multirow makecell tcolorbox \
    fontspec unicode-math exam
RUN apt-get update && apt-get install -y poppler-utils
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
WORKDIR /app
COPY server.js package.json ./
RUN npm install
EXPOSE 8080
CMD ["node", "server.js"]
```

### API
```
POST /compile
  Body: { latex, engine: 'pdflatex' | 'xelatex' }
  Response: PDF binary (application/pdf)

POST /compile-and-render
  Body: { latex, engine, dpi: 200 }
  Response: { pdf: base64, pages: base64[] }

GET /health
  Response: { status: 'ok', texVersion }
```

### Cloud Run Configuration
| Setting | Value | Rationale |
|---|---|---|
| CPU | 2 vCPU | LaTeX compilation is CPU-intensive |
| Memory | 2 GiB | TeX Live packages loaded in memory |
| Min instances | 1 | Avoid cold-start (TeX Live init is slow) |
| Max instances | 10 | Scale for parallel jobs |
| Request timeout | 120s | Complex exams may take time |
| Concurrency | 4 | Each compile is CPU-heavy |

### Security
- Service-to-service auth via Cloud Run IAM (`roles/run.invoker` for `exampull-server@`)
- Not exposed to public internet; only callable from the main app's service account
- LaTeX input sanitized before compilation (see "Sanitization Rules" below)
- Compiler invoked with `-no-shell-escape` flag

### Sanitization Rules (`lib/latex/sanitize.ts`)
The sanitizer scans AI-generated LaTeX for known-dangerous primitives and rejects (or escapes) them before sending to the compiler. The rules are conservative — when in doubt, reject and ask the model to regenerate.

**Hard-blocked commands** (full match — reject the entire LaTeX block on detection):
- `\write18` — shell escape
- `\immediate\write` — file writes
- `\input{` — file include from arbitrary paths (allowed only inside the boilerplate template, not user content)
- `\include{` — same as input
- `\openin`, `\read`, `\openout` — file I/O
- `\catcode` — character-class redefinition (used in jailbreaks)
- `\directlua`, `\latelua` — Lua execution (XeLaTeX/LuaLaTeX)
- `\ShellEscape`, `\write*\shell`
- `\let\x=\y` patterns redefining file-I/O macros
- Any `\\(.*?)\{(/|~|\.\.|\$)` — file-system path operands

**Allowed packages** (whitelist — all others rejected via preamble inspection):
`amsmath, amssymb, amsthm, geometry, fancyhdr, enumitem, graphicx, xcolor, hyperref, tikz, pgfplots, chemfig, listings, booktabs, multirow, makecell, tcolorbox, fontspec, unicode-math, exam, mathtools, cancel, siunitx`

**Inline content rules**:
- `\verb`, verbatim, listings allowed for code questions, but content is escaped
- Filesystem-style paths inside text are rendered as text (not commands)
- Include directives (e.g., `\includegraphics`) only resolve from the assembled-during-build assets directory, never from URLs or user paths

The boilerplate LaTeX template (header, packages, page setup) is **server-controlled** and inserted around AI-generated question content via deterministic string substitution, not by the model. The model never produces `\documentclass`, `\usepackage`, or any preamble.

### Cost
~$30-40/month for 1 always-on min instance + scale-on-demand.

---

## 12. File Storage (Cloud Storage)

### Buckets
```
exampull-uploads/
├── users/{userId}/materials/{materialId}/{filename}
├── users/{userId}/example-exams/{exampleId}/{filename}
├── users/{userId}/attempts/{attemptId}/{filename}
└── anonymous/{anonymousUid}/materials/{materialId}/{filename}    # 30-day TTL (bundled with anonymous exam — see PRD §5.3 Anonymous Upload Retention)

exampull-generated/
├── exams/{examId}/exam.pdf
├── exams/{examId}/answer-key.pdf
├── exams/{examId}/pages/page-{n}.png      # Used for QA loop; 24-hour TTL
└── exams/{examId}/annotated-feedback.pdf

exampull-exports/
└── data-exports/{userId}/{requestId}/{archive}.zip   # 7-day signed URL TTL
```

### Access Patterns
- Client uploads via signed upload URLs (server issues; direct browser → GCS)
- Client downloads via signed read URLs (1-hour expiry, regenerated per session)
- Workers use the server service account directly (no signed URL needed)
- LLM gateway (OpenRouter) uses signed read URLs to fetch input files

### Lifecycle Rules
- Page images deleted after 24 hours
- Anonymous-uploaded materials AND anonymous-generated exam artifacts deleted together after 30 days as a bundled unit (per main PRD §5.3 / §5.6). The lifecycle job keys on the anonymous UID and purges materials, generated exam PDFs, page images, and the exam metadata document atomically.
- Materials in archived classes move to Nearline after 90 days
- Account deletion cascade-deletes all user-owned files

---

## 13. Payment Integration (Stripe)

### Products
| Product | Stripe Type | Price ID env |
|---|---|---|
| Scholar Monthly ($5) | Subscription | `STRIPE_PRICE_SCHOLAR_MONTHLY` |
| Scholar Annual ($30) | Subscription | `STRIPE_PRICE_SCHOLAR_ANNUAL` |
| Guru Monthly ($20) | Subscription | `STRIPE_PRICE_GURU_MONTHLY` |
| Guru Annual ($120) | Subscription | `STRIPE_PRICE_GURU_ANNUAL` |
| Credit Pack 20 ($1) | One-time | `STRIPE_PRICE_CREDITS_20` |
| Credit Pack 100 ($4) | One-time | `STRIPE_PRICE_CREDITS_100` |
| Credit Pack 240 ($8) | One-time | `STRIPE_PRICE_CREDITS_240` |

(Note: credits-per-question is 2; 20-credit pack = ~10 questions. See main PRD §6 for full pricing structure.)

### Stripe Setup
- Stripe Payment Element for one-tap purchases
- Stripe Link for cross-device payment-method persistence
- Apple Pay + Google Pay via Stripe Wallet
- Webhook endpoint: `/api/webhooks/stripe`, signature-verified
- **Stripe Restricted Key** (`STRIPE_RESTRICTED_KEY_REFUNDS`) for the admin app's refund operations.

### Stripe Restricted Key Setup
Stripe Restricted Keys cannot be created via API — must be created in the Dashboard:

1. Go to https://dashboard.stripe.com/test/apikeys (test mode) or `/apikeys` (live)
2. Click **Create restricted key**
3. Name: `Admin Refunds`
4. Permissions:
   - **Refunds**: Write
   - **Charges**: Read
   - **Customers**: Read
   - **Payment Intents**: Read
   - All other resources: None
5. Click **Create key**, copy the `rk_test_...` (or `rk_live_...`) value
6. Paste into `.env.local` as `STRIPE_RESTRICTED_KEY_REFUNDS=rk_...`

### Refund Amount Ceiling
The "amount ceiling" referenced in admin-prd is enforced **in application code**, not at the key level (Stripe doesn't provide a per-key amount cap). The admin server action that issues refunds reads the cap from a Firestore config doc (`config/refund_limits`):

```ts
{
  perRefundCapUsd: 500,        // Single-refund limit; larger requires step-up auth
  dailyTotalCapUsd: 2000,      // Total refunds across all admins per day
  perOperatorDailyCapUsd: 1500 // Per individual operator per day
}
```

Exceeding any cap triggers an in-app block with a clear admin error and an optional override that re-prompts for passkey + reason note (audit-logged).

### Billing Cycle
Cloud Scheduler triggers a monthly Cloud Function (`refreshMonthlyCredits`):
- Resets monthly subscription credits per tier
- Honors Guru's 1-year rollover cap (purges credits older than 12 months)
- Purchased credit pack balances are untouched (never expire)

### Subscription Lifecycle
- Stripe webhooks update Firestore on subscription changes (created, updated, cancelled, past_due, deleted)
- Payment failure → 2-week grace period → automatic downgrade to Free if unresolved
- Cancellation → access retained until end of current cycle (or end of annual commitment)

---

## 14. Email & SMS

### Email (Resend)
- Account: managed under the operator's primary email
- **Sending domain**: configured via `RESEND_FROM_ADDRESS`. For autonomous build agents, the recommended starting value is Resend's built-in onboarding sender (`onboarding@resend.dev`) which works without domain verification; the operator may swap to a verified custom sender later. The agent never assumes a specific domain — always reads `RESEND_FROM_ADDRESS` from env.
- Domain ID (when applicable) stored as `RESEND_DOMAIN_ID` env var so the verify-status endpoint and other operations can reference it without listing
- Templates authored as React components (via React Email)
- Templates: welcome, exam-ready, grading-complete, payment-receipt, low-credits, payment-failure, share-link-feature-change, subscription-change, referral-milestone
- Per-user notification preferences honored (in-app/email/SMS toggles per event type)
- All non-transactional emails include CAN-SPAM unsubscribe footer; unsub state synced to user doc

### SMS (Twilio)
Used for:
- Admin auth fallback (when passkey unavailable)
- Broadcast messaging (admin-initiated)
- User-opted-in transactional alerts (exam-ready, grading-complete) — opt-in only
- Payment failure reminders during grace period

User sign-up phone verification uses **Firebase Auth's built-in SMS** (not Twilio directly), since Firebase Auth bundles this.

STOP/HELP keywords handled automatically via `/api/webhooks/twilio`. Suppression list maintained for broadcast targeting.

---

## 15. Environment Variables

```bash
# .env.local — local development; .env.example checked into repo without values

# Web URL (Firebase App Hosting backend URL). Used by Cloud Tasks for worker callbacks,
# Stripe redirects, share-link CTAs, and anywhere the app needs to refer to itself.
WEB_URL=

# Firebase (client-side, NEXT_PUBLIC_ prefix). Per-agent values — each agent has its own
# Firebase project (Claude: exampull-opus-4-7, Codex: exampull-gpt-5-5).
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=     # Optional — present when Analytics is enabled on the Web App

# Firebase Admin (server-side only)
FIREBASE_SERVICE_ACCOUNT_KEY=                # JSON or path; loaded from Secret Manager in prod
GOOGLE_CLOUD_PROJECT=exampull
GOOGLE_CLOUD_REGION=us-central1

# OpenRouter (LLM gateway)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Stripe
STRIPE_SECRET_KEY=
STRIPE_RESTRICTED_KEY_REFUNDS=               # For admin refund operations only
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_SCHOLAR_MONTHLY=
STRIPE_PRICE_SCHOLAR_ANNUAL=
STRIPE_PRICE_GURU_MONTHLY=
STRIPE_PRICE_GURU_ANNUAL=
STRIPE_PRICE_CREDITS_20=
STRIPE_PRICE_CREDITS_100=
STRIPE_PRICE_CREDITS_240=

# Resend (email)
RESEND_API_KEY=
RESEND_FROM_ADDRESS=onboarding@resend.dev    # Default works without domain verification; operator swaps to a verified sender later (see §14)
RESEND_DOMAIN_ID=                            # Resend domain ID for verify-status API calls

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_USER_SID=
TWILIO_PHONE_NUMBER=
TWILIO_WEBHOOK_AUTH_TOKEN=

# Porkbun (DNS API for programmatic domain management)
PORKBUN_API_KEY=
PORKBUN_SECRET_KEY=

# Typesense (search — provision only when scaling beyond Firestore search)
TYPESENSE_HOST=
TYPESENSE_API_KEY=
TYPESENSE_SEARCH_ONLY_API_KEY=               # Scoped to documents:search; admin clients only

# LaTeX Service
LATEX_SERVICE_URL=                           # Cloud Run URL; localhost:8080 in dev

# Cloud Tasks
CLOUD_TASKS_QUEUE=exampull-jobs
CLOUD_TASKS_LOCATION=us-central1
CLOUD_TASKS_INVOKER_SA=exampull-tasks@exampull.iam.gserviceaccount.com

# Admin Dashboard
ADMIN_PHONE_NUMBER=                          # Operator phone (env-only, never in source)
ADMIN_SECRET=                                # HMAC signing key (32+ random hex bytes)
ADMIN_WEBAUTHN_RP_ID=                        # Set to the App Hosting hostname during build; switches to the custom admin host after launch
ADMIN_AGENT_PASSWORD=                        # Strong password for the autonomous agent auth path (admin-prd §2). Empty = path disabled.
ADMIN_AGENT_AUTH_ENABLED=true                # Live toggle (mirrored to config/admin_auth doc); default enabled pre-launch, disable at launch unless explicitly used for ongoing coverage
AUDIT_ARCHIVE_BUCKET=                        # Optional dedicated GCS bucket for immutable audit archive objects; defaults to the Firebase Storage bucket during build
AUDIT_ARCHIVE_PREFIX=admin-audit-archive/v1  # Object prefix for replicated hash-chained audit JSON records

# Test signup token — when present and matched at signup, creates an isTestAccount=true user (PRD §5.19).
# Closed in production by leaving unset or rotating. Build agents need this to spawn synthetic accounts.
TEST_SIGNUP_TOKEN=

# Featurebase
FEATUREBASE_JWT_SECRET=                      # SSO signing key
NEXT_PUBLIC_FEATUREBASE_ORGANIZATION=

# Sentry
SENTRY_DSN=
SENTRY_AUTH_TOKEN=                           # CI/CD source-map upload

# PostHog (optional product analytics; if unused, leave blank)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Feature Flags (overridable from admin Configuration tab; env are defaults)
NEXT_PUBLIC_ENABLE_PREVIEW=true
NEXT_PUBLIC_ENABLE_VISUAL_FEEDBACK=true
```

### GitHub Actions Secrets
The CI workflow references `$PROJECT_ID` and `${{ secrets.* }}` values. Configure these as repository secrets at github.com/Vikram2Agrawal/exampull/settings/secrets/actions:

| Secret | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase deploy auth (JSON key) |
| `GCP_SA_KEY` | gcloud + Cloud Build (JSON key) |
| `GCP_PROJECT_ID` | `exampull` (referenced as `$PROJECT_ID` in workflow) |

The workflow exports `PROJECT_ID=${{ secrets.GCP_PROJECT_ID }}` at the start of any job that calls `gcloud`.

In production, all sensitive values are stored in **GCP Secret Manager** and loaded into the Cloud Run service via the `--set-secrets` flag (or Firebase App Hosting equivalent). Never commit `.env.local`.

---

## 16. CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint        # Biome
      - run: pnpm typecheck   # tsc --noEmit
      - run: pnpm test        # Vitest

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: pr-${{ github.event.pull_request.number }}

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live

  deploy-latex-service:
    if: github.ref == 'refs/heads/main'
    needs: lint-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: |
          gcloud builds submit latex-service/ --tag gcr.io/$PROJECT_ID/latex-service
          gcloud run deploy latex-service \
            --image gcr.io/$PROJECT_ID/latex-service \
            --region us-central1 --min-instances 1 --max-instances 10
```

### Deployment
- **Main app**: Firebase App Hosting auto-deploys on push to `main`. The App Hosting backend is configured against the existing `exampull-web` Cloud Run service (project `exampull`, region `us-central1`); App Hosting handles build, deploy, CDN, and preview channels. Configuration lives in `apphosting.yaml` at the repo root.
- **LaTeX service**: Independent Cloud Run service; redeployed only when `latex-service/**` paths change (see the `deploy-latex-service` workflow in §16)
- **Firestore rules + indexes**: `firebase deploy --only firestore` in CI on changes
- **Preview environments**: Auto-created per PR via App Hosting, auto-deleted on merge

### Firebase Config (`firebase.json`)
Used by `firebase deploy` for Firestore rules/indexes, Storage rules, and Hosting (when on App Hosting). Expected contents:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": [
    {
      "site": "exampull",
      "public": ".next",
      "rewrites": [{ "source": "**", "destination": "/index.html" }],
      "predeploy": "pnpm build"
    }
  ],
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

App Hosting deployment uses `apphosting.yaml` at the repo root in place of the `hosting` block above; the `firestore`, `storage`, and `emulators` blocks in `firebase.json` remain in use for those services.

---

## 17. Security

### Application
- All Firebase Auth ID tokens verified server-side
- Firestore Security Rules enforce per-user data isolation
- Worker routes protected by Cloud Tasks OIDC verification
- All input validated server-side with Zod schemas
- File upload size limit: 100MB per file (enforced at signed URL issuance)
- File type validation: MIME type + magic bytes
- LaTeX sanitized before compilation (no `\input`, `\write18`, shell escape)

### Data Protection
- Encryption at rest (GCP default AES-256)
- Encryption in transit (TLS 1.3)
- User materials never used for model training (OpenRouter passes appropriate `data-policy` headers; direct provider calls use Vertex AI's data governance terms)
- Signed URLs with short expiry for all file access

### Rate Limits
- Topic extraction: per-user limit, generous default (e.g., 50/hour)
- Generation jobs: max 5 concurrent per user
- Auth attempts: Firebase Auth handles natively
- Preview generation: 1 per device per 24h, device-fingerprint based

### Abuse Prevention
- Phone verification at sign-up (per main PRD §5.1)
- Anonymous users can preview but cannot navigate to authenticated routes
- Admin distribution-guidance linter routes mismatches to review queue (not auto-freeze)
- Stripe fraud detection on all payments
- Suppression lists for SMS/email opt-outs

### Device Fingerprinting (Preview Abuse Prevention)

The PRD's preview abuse safeguard (§5.6) requires identifying the same physical device even when the user clears cookies or uses incognito. Implementation is **phased** to keep cost proportional to actual abuse:

**Phase 1 (v1 launch — DIY composite):**
- Client: open-source `@fingerprintjs/fingerprintjs` (free) generates a visitor hash from canvas, audio, fonts, plugins, screen, timezone, language signals
- Server: combines the client hash with server-only signals (IP /24 prefix, `Accept-Language`, `User-Agent` family, `Sec-CH-UA` client hints) and HMACs the result with a server secret to produce a stable `deviceFingerprint` string
- Stored in Firestore `previews/{fingerprint}/{date}` keyed for 24h-rolling-window enforcement
- Expected accuracy: ~85% in normal mode, ~70% in incognito (Brave/Safari randomize canvas). Backed by the kill switch (PRD §5.6) for cost-spike scenarios.
- Cost: $0/month

**Phase 2 (upgrade trigger — FingerprintJS Pro):**
- Trigger: if the kill-switch fires more than twice in a 30-day window OR preview cost exceeds $50/month, upgrade
- FingerprintJS Pro starts at $200/mo for 500K identifications and claims 99.5% accuracy in incognito (server-validated visitor IDs, browser-bot detection, suspicious-score)
- Server reads `visitorId` from FingerprintJS Pro's identification API, replaces the DIY composite as the canonical fingerprint
- Migration is single-field — replace the `deviceFingerprint` derivation function in one place

The kill switch (PRD §5.6) remains the ultimate backstop regardless of fingerprint accuracy. A determined abuser can defeat *any* fingerprint with enough effort; the right defense is to disable preview generation globally until the attack subsides.

### Admin Surface
See `admin-prd.md` §9. Highlights:
- WebAuthn/passkey primary + SMS fallback + agent password path (admin-prd §2)
- **Audit log primary writes go to a separate GCP project** with deny-delete IAM (NOT a replication target — there is no in-main-project copy that a compromised admin could delete before replication runs). The main app's service account holds write-only permission to that project's audit collection. A daily replication job copies entries to a GCS object-lock bucket as a long-term archive.
- Hash-chained audit entries for tamper detection
- Step-up auth for destructive operations
- Service account isolation between user app and admin app
- Stripe Restricted Key for refund-only operations

---

## 18. Monitoring & Observability

### Cloud Monitoring
| Metric | Alert Threshold |
|---|---|
| Cloud Run latency p95 | > 5s |
| Cloud Run error rate | > 5% |
| LaTeX service error rate | > 10% |
| Firestore read/write rates | Approaching quota |
| OpenRouter error rate | > 5% |
| Exam generation success rate | < 90% |
| Visual QA average iterations | > 3 (LaTeX quality drift) |
| Aggregation job last successful run | > 2 hours stale |
| BigQuery daily spend | Approaching $50 cap |

### Logging
- Structured JSON via `pino`
- PII scrubbing on all logs (search query strings, error messages with user data)
- Log-based metrics for: `exam.generation.*`, `user.signup`, `payment.*`, `admin.action.*`

### Error Tracking
- **Sentry** for client and server stack traces
- Source maps uploaded in CI
- Worker process crashes alert immediately

### Analytics
- **PostHog** (self-hostable option, generous free tier) for product analytics: funnel tracking, feature usage, cohort retention
- Admin dashboard's own analytics reads from pre-aggregated Firestore + on-demand BigQuery exports

### BigQuery (Heavy Analytics)
- On-demand exports for complex segmentation
- Per-query cost ceiling ($5 default), daily cap ($50)
- Result caching (1 hour) to avoid repeat-cost
- Daily Firestore export to BigQuery via the managed scheduled export feature

---

## 19. Disaster Recovery

| Concern | Mitigation |
|---|---|
| Firestore data loss | Daily managed export to GCS (`gs://exampull-firestore-backups/`); 30-day hot, 7-year archive |
| Audit log tampering | Primary writes go directly to a separate GCP project with deny-delete IAM (not a replication target); hash-chained for detection; daily archival snapshot to GCS object-lock bucket |
| Bad bulk credit grant | 24-hour rollback window via audit-log entry action |
| Bad config change | Configurable cooling-off + email/Slack notification on every config change |
| Stripe outage | Refund queue persists; reprocesses on recovery; user notified of delay |
| Twilio/Resend outage | In-app notifications continue working (Firestore listeners); fallback channels for critical alerts |
| Region failure (us-central1) | Firestore is multi-region (`nam5`); Cloud Run can be redeployed to `us-east1` as warm-standby |
| Operator account compromise | WebAuthn primary auth (phishing-resistant); separate audit log project; immediate session revocation |

Recovery procedures are kept inline in this document (per-row in the table above) and in admin-prd.md §5.5. A standalone `RUNBOOK.md` may be added in the future as procedures grow; for v1, the inline references are authoritative.

---

## 20. Local Development

### Prerequisites
```bash
node 22.15.0 (via nvm)
pnpm 10.30.1
docker (for LaTeX service local)
firebase-tools 14.9.0
gcloud SDK 557.0.0
```

### Setup
```bash
git clone git@github.com:Vikram2Agrawal/exampull.git
cd exampull
pnpm install
cp .env.example .env.local            # Fill in values (request from operator)
pnpm run emulators                     # Firebase Emulator Suite (Auth, Firestore, Storage)
docker compose up latex-service        # Local LaTeX service
pnpm run dev                           # Next.js dev server (Turbopack)
```

### Project Structure
```
exampull/
├── app/                       # Next.js App Router
├── components/                # React components
├── lib/
│   ├── firebase/              # Client + Admin SDK setup
│   ├── ai/
│   │   ├── client.ts          # OpenRouter wrapper (the only place that calls LLMs)
│   │   ├── models.ts          # Stage → model ID mapping
│   │   ├── pricing.ts         # Cost constants per model
│   │   └── prompts/           # All system prompts, templated
│   ├── latex/                 # LaTeX service client + sanitization
│   ├── stripe/                # Stripe client + webhook handlers
│   ├── email/                 # Resend client + React Email templates
│   ├── sms/                   # Twilio client
│   ├── search/                # Typesense client
│   └── utils/                 # Shared utilities
├── actions/                   # Server Actions
├── workers/                   # Cloud Tasks worker logic
├── latex-service/             # Separate Docker microservice
│   ├── Dockerfile
│   ├── server.js
│   └── package.json
├── eval/                      # Eval harness (see EVAL_PHILOSOPHY.md)
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json              # See "Firebase Config" below
├── apphosting.yaml            # Firebase App Hosting config (when migrated)
├── docker-compose.yml
├── .env.local
├── .env.example
├── biome.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Key Dev Commands
| Command | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server with Turbopack |
| `pnpm lint` | Biome lint |
| `pnpm typecheck` | TypeScript strict check |
| `pnpm test` | Vitest unit/integration |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm eval:run <id>` | Single eval config (see EVAL_PHILOSOPHY.md) |
| `pnpm eval:suite` | Full eval suite |
| `pnpm emulators` | Firebase Emulator Suite |
| `pnpm deploy:latex` | Build the `latex-service/` Docker image with Cloud Build and deploy it to the `latex-service` Cloud Run service in `us-central1` (idempotent — safe to re-run). Reads `GOOGLE_CLOUD_PROJECT` from env. |
| `pnpm setup:stripe` | Run `scripts/setup-stripe.ts`. Creates Stripe products (Scholar, Guru, Credit packs) and prices if not already present (looks up by metadata `exampull_key`). Idempotent. Prints the resulting price IDs to paste into `.env.local`. Safe to re-run any time pricing is updated. |
| `pnpm setup:resend-domain` | Add the configured `RESEND_FROM_ADDRESS` domain to Resend, fetch DKIM/SPF records, write them to Porkbun via API, trigger Resend verification. Idempotent. (Currently a one-time operation; see scripts/ for the underlying calls.) |

---

## 21. Cost Analysis

### Early Stage (~500 users, ~100 exams/mo)
| Service | Cost | Notes |
|---|---|---|
| Firebase App Hosting | $0 | Free tier (Spark) |
| Cloud Firestore | $0 | Free tier |
| Firebase Auth | $0 | <50K MAU |
| Cloud Storage | $0–5 | ~1 GB |
| OpenRouter (LLM) | ~$40 | Free-tier exams on Gemini 3 Flash; paid-tier on Gemini 3.1 Pro |
| GPT Image 2 (annotations) | ~$5 | Few Guru users |
| LaTeX service (Cloud Run) | ~$35 | 1 always-on min instance |
| Stripe fees | Variable | Per-transaction |
| Resend | $0 | Free tier (3K emails/mo) |
| Twilio (SMS) | ~$5 | Phone verification + admin auth |
| Typesense | ~$0 | Below free-cluster threshold |
| Mailbox catcher (Mailosaur) | ~$20 | Hobby plan; needed for E2E email verification in tests — see TESTING.md Mock Data |
| Device fingerprint (DIY composite) | $0 | Phase 1; FingerprintJS Pro at $200/mo only if abuse triggers it |
| Sentry | $0 | Free tier |
| Domain | $1 | Annualized |
| **Total** | **~$105–120/mo** | |

### Growth Stage (~5,000 users, ~2,000 exams/mo)
| Service | Cost | Notes |
|---|---|---|
| Firebase (Blaze) | $25–50 | Pay-as-you-go |
| Cloud Firestore | $20–40 | Higher volume |
| Cloud Storage | $10–20 | ~50 GB |
| OpenRouter (LLM) | ~$700–1,000 | Mix of Gemini 3 Flash (Free) and Gemini 3.1 Pro (paid) |
| GPT Image 2 | ~$80 | More Guru visual annotations |
| LaTeX service | $50–80 | 1–3 instances |
| Stripe fees | Variable | |
| Resend | $20 | Pro plan, 50K emails |
| Twilio | ~$30 | More SMS verifications + broadcasts |
| Typesense | ~$30 | Small Cloud cluster (now serves both admin and user-side library search per §9) |
| Mailbox catcher (Mailosaur) | ~$20 | Hobby plan |
| Device fingerprint | $0–200 | FingerprintJS Pro only if abuse signals warrant; otherwise stays on DIY composite |
| Monitoring/Sentry | $0–20 | |
| **Total** | **~$1,050–1,500/mo** | |

**Revenue at growth stage** (5% paid conversion, 250 Scholar + 25 Guru + ~500 credit-pack purchases):
- 250 × $5 = $1,250 (Scholar subs)
- 25 × $20 = $500 (Guru subs)
- ~500 × ~$5 avg = $2,500 (credit packs)
- **~$4,250/mo revenue → ~$3,000 margin**

### Cost Optimization Levers
1. **A/B DeepSeek V4 Flash on selected stages** — 3.5–10x cheaper than Gemini Flash; verify quality on each stage via the eval harness before swapping
2. **OpenRouter caching** — repeat-input caching for identical materials reduces input cost
3. **Batch APIs** — for non-real-time tasks (grading), use batch pricing (often 50% off)
4. **Cache topic extractions** — already in design (per-user, hashed by content + focus)
5. **Cloud Run scale-to-zero** for LaTeX service if cold starts become acceptable
6. **Margin alerts** — admin gets flagged on negative-margin exams (per main PRD §5.10) so we can tune prompts to reduce token bloat

---

## 22. Scalability Roadmap

### Current Design Handles
- Up to ~10,000 users with no architectural changes
- Firestore, Cloud Run, OpenRouter all auto-scale
- Bottleneck at scale will be OpenRouter rate limits → request quota increases or direct-call failover

### When to Scale
| Trigger | Action |
|---|---|
| OpenRouter rate limits hit | Add a fallback path to direct Vertex AI calls. Vertex AI is already accessible via `exampull-server@`'s default IAM (`roles/aiplatform.user`); the fallback would import `@google-cloud/vertexai` and use the same service-account credentials with no additional API key needed. The OpenRouter→Vertex switch is a per-stage config flag; OpenRouter remains primary. |
| Firestore costs spike on reads | Client-side caching (React Query/SWR with TTL); Firestore Bundles for popular data |
| LaTeX cold starts hurt UX | Increase min instances; pre-warm on traffic spikes |
| Mobile apps needed | Add REST API layer or use Firebase Data Connect for type-safe API |
| Multi-region demand | Deploy Cloud Run in additional regions; Firestore multi-region already in place |
| Complex relational analytics | Daily Firestore → BigQuery export already in place; expand BigQuery views |
| Team grows beyond 3 devs | Split LaTeX service to its own repo; add staging GCP project |

### What Stays the Same
The core architecture (Firebase Auth + Firestore + Cloud Run + OpenRouter + Stripe) scales well into hundreds of thousands of users. First major re-architecture is only needed if we need:
- Heavy relational analytics (add Cloud SQL alongside Firestore)
- Native mobile apps (add a stable REST/gRPC API layer)
- Multi-tenant or enterprise features (re-evaluate auth and data isolation)

Until then: scale vertically by raising Cloud Run instance counts and OpenRouter quotas.

---

## 23. Open Decisions / Out of Scope for v1

These are intentionally not part of v1 but are designed to be added without re-architecture:

- **Native mobile apps** (iOS/Android): would add a REST/GraphQL API layer
- **Apple Sign-In**: requires $99/year Apple Developer Program
- **Multi-operator admin**: schema scaffolded; RBAC enforcement to be added when needed
- **TOTP / hardware-key admin auth**: passkey already covers; TOTP is a future addition
- **Internationalization (i18n)**: English-only for v1
- **A/B test framework**: out of scope; product flags via the admin Configuration tab today
- **Spaced repetition / weak-area resurfacing UI**: data exists in grading results (study recommendations), UI surface is post-v1
- **Customer health scoring / churn prediction**: post-v1 admin enhancement
