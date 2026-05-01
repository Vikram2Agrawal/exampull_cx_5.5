# ExamPull Admin Dashboard — Product Requirements Document

**Version:** 2.0
**Date:** April 28, 2026
**Status:** Final

---

## 1. Executive Summary

The ExamPull Admin Dashboard is a **separate, gated surface** of the same Next.js app, accessible at `${WEB_URL}/admin/*` (path-based middleware-gated routing during the build phase; designed to graduate to a host-based subdomain post-launch with no code change). It is the **operational nerve center** for running the business — a single control panel for the founder/operator to monitor the platform, support individual users, intervene when needed, and analyze growth, cost, and quality.

This is NOT a tab within the main user-facing app. It has its own authentication (passkey + SMS + agent password), its own design language (data-dense, utility-first — not glassmorphism), and is single-operator by design. Built to serve one user (the founder) extremely well today, while scaling cleanly to a platform with **1M+ users**.

The dashboard's two equally important responsibilities:
1. **Visibility** — analytics, dashboards, drill-downs, segmentation
2. **Operability** — direct intervention on user accounts, exams, billing, communications, and configuration

---

## 2. Access & Authentication

### Single-Operator Auth

The admin dashboard is accessible only to the founder. Authentication offers two factors that work together — the user can choose either, both registered on first setup:

1. **Passkey / WebAuthn** (preferred) — uses Touch ID, Face ID, Windows Hello, or a hardware security key. Cryptographic, phishing-resistant, and fast on the operator's known devices.
2. **SMS one-time code** — sent to a single configured phone number. Backup factor for new devices or when the passkey isn't available.

There is no email/password fallback for the human operator, and no Google sign-in.

#### Agent Password Path (Automation Only)

A third sign-in path exists strictly to unblock the autonomous build/test loop, which cannot present a passkey or read SMS codes interactively. It is **deliberately distinct** from the operator's normal auth and held to different rules.

- Gated by a strong password held in the `ADMIN_AGENT_PASSWORD` env var (not committed; rotated regularly; hashed at rest with `ADMIN_AGENT_PASSWORD_HASH` if we ever surface it through UI). When the env var is unset, the path is disabled — there is no way to reach it through the UI.
- Submission endpoint: `POST /api/admin/auth/agent` with body `{ password }`. No human-facing button on the login page; only callable programmatically.
- Issues a session with the same HMAC cookie shape as passkey/SMS, but with a distinct `auth_method: "agent_password"` claim that:
  - Logs every action to the audit trail with `via=agent_password`
  - Rejects step-up confirmation paths (any destructive op that requires step-up is blocked under this auth method) — agent sessions can read, search, view, and run idempotent ops; they cannot suspend users, refund cash, broadcast, or change config without the human re-confirming via passkey or SMS first
  - Caps session lifetime at 4 hours with no idle extension
  - Is disable-able by toggling `ADMIN_AGENT_AUTH_ENABLED` in Configuration (default: enabled in pre-launch, disabled at launch unless explicitly re-enabled for ongoing automated coverage)
- Passkey and SMS remain the primary auth methods for the human operator. Both paths must be regression-tested in every release; the agent path does not substitute for testing them.

**Login flow:**
1. User visits `${WEB_URL}/admin/sign-in` → sees a "Sign in with passkey" button (primary) and a "Send login code via SMS" link (fallback). The agent password path (per §2 above) is reachable only via direct API call and is not advertised in the UI.
2. **Passkey path**: browser prompts for biometric/device unlock → server validates the signed challenge → session cookie issued
3. **SMS path**: server sends a 6-digit code to the configured admin phone → user enters code → session cookie issued
4. On valid auth: server issues an HTTP-only, secure, **SameSite=strict** session cookie (HMAC-SHA256). Sessions are tracked server-side in a sessions collection so they can be revoked instantly.
5. On invalid auth: gentle error, no detail leaked
6. Rate-limited to 5 SMS sends per hour per IP, with exponential backoff. Per-phone limits use a separate cooldown to avoid lockout-DoS attacks against the legitimate operator.

**SMS code rules:**
- 6 digits, randomly generated
- 60-second expiry
- Single-use (consumed on validation, even on failure)
- Maximum 5 verification attempts per code
- Constant-time comparison to prevent timing attacks

**Configuration (env vars):**
- `ADMIN_PHONE_NUMBER` — admin SMS destination (never hardcoded in source or committed to repo)
- `ADMIN_SECRET` — HMAC signing key for session tokens
- `ADMIN_WEBAUTHN_RP_ID` — relying party ID for passkey registration

**Session management:**
- 24-hour cookie expiry with **30-minute idle timeout** — if no admin action in 30 min, session requires re-auth
- Server-side session list lets the operator revoke any active session from a "Devices" page in settings
- Logout button invalidates the session immediately on both client and server
- All admin routes protected by middleware that validates the cookie AND the server-side session record
- Failed auth attempts logged for audit

### Step-Up Confirmation
For destructive operations (suspending users, mass refunds, kill-switch toggles, large bulk credit grants), the admin re-confirms via passkey touch (or SMS code if passkey unavailable). This is a quick gesture, not a full re-login.

### Future-Proofing
- Multi-operator support via an `operators` collection schema (see §8) — already scaffolded so RBAC can be added later without migration pain
- TOTP / authenticator-app codes could be added as a third factor if needed

---

## 3. Design Requirements

### Aesthetic
- **Not glassmorphism** — utility-first, data-dense design optimized for fast scanning
- White/gray backgrounds, clear typography, high contrast, no blur effects
- Inspiration: Vercel Dashboard, Linear, Stripe Dashboard, Retool
- Color is functional: tier badges (Free=gray, Scholar=blue, Guru=purple), status colors (success=green, warn=yellow, error=red), neutral charts

### Layout
- **Fixed left sidebar** with primary navigation
- **Main content area** takes remaining width
- **Side panels / sheets** slide in from the right for entity drill-downs (users, exams, feedback items) — overlay with backdrop, dismissible
- **Top bar** with global search, alert/notification icon, current admin session indicator, and a logout button
- **Desktop-first** — optimized for 1280px+
- **Mobile (768px and below)**: read-only mode only. The operator can view dashboards, look up users, read messages, and check system health from a phone, but destructive or write operations (refunds, suspensions, broadcasts, config changes) are disabled with a "switch to desktop" prompt. This catches the common case of an operator getting paged on the go while preventing accidental changes from a small touchscreen.

### Empty States
For day-1 launch (zero data), every aggregation/chart shows a clear empty-state graphic and message: "No data yet. Charts will populate as users start using the platform." Avoids a wall of broken-looking empty charts.

### Charts & Visualization
- **Recharts** library across all charts for consistency
- Interactive tooltips, axis labels, legends always visible
- Date range selectors are standardized: 24h, 7d, 30d, 90d, All Time, plus custom range
- Loading skeletons while data fetches
- Empty states show clear "no data" messaging

### Performance
- Lazy loading and pagination on all lists
- Pre-aggregated metrics for headline numbers (see §7 Data Model)
- Target: any tab loads < 3 seconds at 1M users
- No real-time listeners on admin views — data is read-on-demand with explicit refresh

### Data Freshness
- Cached metrics are refreshed on a **15-minute cycle** by default
- Every tab includes a **manual refresh button** that bypasses cache and pulls live aggregations
- **On dashboard open**, the system automatically kicks off a fresh aggregation job so the operator sees the most recent data without needing to click refresh
- Each pre-aggregated chart shows its `last_updated_at` timestamp inline so the operator always knows how stale the displayed data is

---

## 4. Information Architecture

The dashboard is organized into nine top-level sections, accessible from the sidebar:

| Section | Purpose |
|---------|---------|
| **Overview** | At-a-glance dashboard with the most important real-time metrics |
| **Users** | Search, view, edit, and act on individual user accounts |
| **Exams** | Browse all generated exams across all users with filters |
| **Analytics** | Growth, engagement, cost, and quality dashboards |
| **Operations** | Refunds, credit adjustments, suspensions, manual overrides |
| **Communications** | Send emails or SMS to users (1-on-1, segmented, broadcast) |
| **Abuse & Triage** | Review queues for flagged exams, fraud signals, copyright reports |
| **Referrals** | Monitor the referral program — pending, completed, top referrers |
| **Configuration** | Feature flags, pricing constants, kill switches, system limits |
| **Audit Log** | All admin actions, filterable by date, action type, target entity |

A persistent **global search** in the top bar lets the operator jump to any user, exam, or feedback item by email, UID, exam title, or share-link slug.

---

## 5. Features

### 5.1 Overview Tab

The landing page after login. Shows a single screen of the most important real-time signals, designed to answer "is the platform healthy right now?"

**Above the fold (4 KPI cards):**
- **Users**: total count + delta vs. last week (e.g., "12,431 total, +247 this week")
- **MRR**: monthly recurring revenue + delta
- **Exams generated (24h)** + status breakdown (complete / failed / in-progress)
- **Spend (24h)**: total Gemini API spend in USD

**Live signals row (4 mini-charts):**
- Generation queue depth (current jobs in `queued` or `generating` state)
- Visual QA loop iteration histogram (last 24h) — flag if avg ≥3
- Failed-exam rate (last 24h) — flag if >5%
- New signups per hour (last 24h)

**Action items:**
- A list of admin attention items (e.g., "3 exams in abuse review queue", "2 refund requests pending", "1 distribution-guidance flag from user X")
- One-click navigation to the relevant tab

**System health:**
- Cloud Run service status, LaTeX service status, Stripe webhook status
- Last deploy timestamp + revision

### 5.2 Users Tab

The primary user management interface.

#### User List
| Element | Description |
|---------|-------------|
| **Search** | Search by email, display name, phone number, Firebase UID, Stripe customer ID. Debounced (300ms). Returns matches across all of these dimensions in a unified result. |
| **Table columns** | Email, Display Name, Tier (badge), Credits Balance, Total Exams, MRR contribution, Created Date, Last Active |
| **Pagination** | 50 users per page with cursor-based pagination (scales to 1M+ users) |
| **Sort** | Click any column header. Default: Created Date descending. |
| **Row actions** | Click row to open the User Detail panel; right-click for quick actions menu |

#### Filters (collapsible filter bar)
Filter the user list by any combination of:
- **Tier**: Free / Scholar / Guru (multi-select)
- **Subscription status**: active / cancelled / payment failure / grace period
- **Signup date range**
- **Last active range**: e.g., last 7 days, dormant 30+ days
- **Total exams generated**: range
- **Total spend**: range (cumulative dollar value)
- **Phone verified**: yes / no
- **Has linked Google account**: yes / no
- **Account flag status**: clean / flagged / under review / suspended
- **Test account**: yes / no — defaults to "exclude test accounts" so the operator's normal view is organic users only; one click reveals test accounts (per main PRD §5.19)
- **Has consumed Scholar Boost**: yes / no
- **Referral attribution**: signed up via referral link / referred others / neither
- **Tags**: free-form admin-applied tags (see User Detail)

Combinations of filters are URL-shareable so the operator can bookmark "all dormant Scholar users from January 2026" or similar segments.

#### User Detail Side Panel
Clicking a user row opens a slide-over panel from the right (60% width, dismissible).

**Sections:**

| Section | Contents |
|---------|----------|
| **Header** | Display name, avatar, email, UID (copyable), tier badge, member since date, current credit balance |
| **Auth & Identity** | All linked auth sources (emails, Google accounts), phone number with verification status, last sign-in info, account creation IP / device fingerprint (when available) |
| **Subscription & Billing** | Current plan, billing cycle dates, next charge amount, payment method (last 4), Stripe customer ID (link to Stripe), grace period status, lifetime spend on subscriptions and credit packs |
| **Credits Ledger** | Current balance broken down by source (subscription-granted vs purchased packs vs admin grants vs refunds). Time-series of credit grants and consumptions. |
| **Exam History** | Scrollable, filterable list of the user's exams: title, status, question count, date, cost, rating. Click → opens the Exam Detail panel. |
| **Attempts & Grading** | List of all attempts the user has uploaded for grading, with scores. |
| **Referral Activity** | Referral link they own, friends they've referred, status of each referral, rewards earned. |
| **Notes & Tags** | Free-form admin notes (markdown supported) plus admin-applied tags (e.g., "VIP", "support escalation", "test account"). Tags are searchable in the user list filter. |
| **Activity Timeline** | Chronological log of significant events: signups, tier changes, payment events, exam generations, support interactions. |

**Inline actions (in panel header):**
- **Edit Tier** → tier dropdown with confirmation modal. On change, optionally adjusts credits to match new tier's monthly allocation.
- **Adjust Credits** → number input (positive or negative). Reason field required. Logged to audit trail.
- **Apply Scholar Boost** → admin can manually grant a fresh boost (useful for support cases where the user lost theirs to a bug).
- **Suspend / Unsuspend** → toggles the account's ability to generate exams. Suspended users can still log in and view their library but can't create new exams.
- **Send Message** → opens the Communications composer pre-targeted to this user (see 5.6).
- **Trigger Password Reset / SMS Recovery** → for support cases.
- **Impersonate** → opens the main app as this user **strictly in read-only mode**. The backend rejects every mutation request originating from an impersonation token — no writes to user data, no billing operations, no exam generation, no Stripe actions. The UI renders a persistent banner: "You are impersonating [user]. Read-only mode." Sessions are time-limited to 1 hour and explicitly logged in the audit trail with start/end markers. Useful for reproducing user-reported visual or UX issues without any risk of fraudulent actions on the user's behalf.
- **Force Refund** → opens the refund flow (see 5.5).
- **Delete Account** → escalated action; requires typing the user's email to confirm. Triggers full data wipe per the Account Deletion subsection in main PRD §5.1.

### 5.3 Exams Tab

Browse all generated exams across all users.

#### Exam List
| Element | Description |
|---------|-------------|
| **Search** | Search by exam title, exam ID, share-link slug, or owner email |
| **Table columns** | Title (truncated), Owner Email, Class, Tier (at gen time), Question Count, Status, Cost, Rating (if rated), Created Date |
| **Pagination** | 50 exams per page, cursor-based |

#### Filters
- **Status**: queued / generating / qa_in_progress / complete / failed / partial_qa_fail / reported
- **Tier at generation time**: Free / Scholar / Guru
- **Mode**: Standard / Power
- **Education level range**: slider (0-100 scale per main PRD §5.2)
- **Question count range**
- **Cost range** (USD)
- **QA loop iterations**: e.g., ≥3 to find quality outliers
- **Has rating**: yes / no, with star filter
- **Reported as defective**: yes / no
- **Has share link**: yes / no
- **Test data**: yes / no — defaults to "exclude test data" so production exam metrics are organic-only (per main PRD §5.19)
- **Created date range**

#### Exam Detail Side Panel
Click a row to drill down into a single exam.

| Section | Contents |
|---------|----------|
| **Header** | Title, owner email, status, generation timestamp |
| **PDF Preview** | Embedded preview of both the exam and answer key PDFs (tabbed) |
| **Configuration** | All wizard inputs: sources used, focus fields, topic list, question styles, education level, difficulty, distribution guidance |
| **Pipeline Trace** | Per-stage breakdown with model used, input/output tokens, latency, cost. Includes Visual QA loop iterations and any fix attempts. |
| **Cost & Margin** | Revenue (credits × $0.05), cost (Gemini API spend), margin (revenue − cost). Flagged red if margin is negative. |
| **Attempts** | All graded attempts with scores |
| **Rating & Feedback** | Star rating + text feedback if rated |
| **Share Links** | All share links generated for this exam, with view counts and recipient feedback flags |
| **Reports** | Any user-submitted reports of defects (see main PRD §5.9) |

**Actions:**
- **Force regenerate** (admin override — costs nothing to user, useful for support)
- **Refund credits** for this exam to the owner (one-click)
- **Revoke share link**
- **Mark as exemplary** → adds to a curated quality dataset for prompt tuning

### 5.4 Analytics Tab

Four sub-tabs: **Growth**, **Engagement**, **Cost**, **Quality**.

All analytics views support a consistent **filter rail** at the top:
- Date range
- User tier (Free / Scholar / Guru / All)
- User segment (active / dormant / new / paid / etc.)
- Education level range
- Custom user segments saved from the Users tab
- **Include test data** (toggle, default OFF) — when OFF, all charts exclude `isTestAccount === true` users and `isTestData === true` artifacts. Production metrics stay clean of build-loop noise. When ON, charts include synthetic data — useful for "is my test pipeline working?" diagnostics. The exclusion is enforced at the aggregation source: `analytics/daily_*` jobs filter on `isTestData === false` when computing summary documents.

Switching filters updates all charts on the page. Filter state is URL-shareable.

#### 5.4.1 Growth
- **Cumulative users** (line chart)
- **New signups per day** (bar chart with status breakdown: completed phone verification vs dropped at SMS)
- **Conversion funnel** (Sankey or stepped bar): visited landing → started preview → completed preview → started signup → verified phone → generated first exam → returned within 7d → became paid
- **Free → Paid conversion rate** over time
- **Churn rate** by tier and by month
- **Cohort retention heatmap** — % of users from cohort N still active at week M
- **Source attribution**: organic / referral / share-link landing / direct

#### 5.4.2 Engagement
- **Daily / Weekly / Monthly Active Users** (line chart, all three on one chart)
- **Exams generated per day** (bar chart, stacked by status)
- **Credits consumed per day** (bar chart, stacked by action type: generation / grading / annotation / style guide)
- **Exams per user distribution** (histogram) — most users generate N exams per month
- **Usage time-of-day heatmap** (24h × 7d) — when do users actually generate exams
- **Feature adoption rates**: % of users who have used Power Mode, instructor style guides, share links, attempt grading, visual annotation

#### 5.4.3 Cost
- **Total Gemini spend per day** (area chart) with model breakdown (Flash / Pro / Image)
- **Average cost per exam** by tier (grouped bar)
- **Cost by pipeline stage** (stacked bar) — topic extraction, test plan, question generation, assembly, QA loop, exam-only derivation
- **Cost by content type** — exams using video, exams using web links, exams using images, vs text-only — to see which inputs drive cost
- **Margin per exam histogram** — flag the negative-margin tail
- **Top 50 most expensive exams** (table) with drill-through links
- **Token usage trends** (input vs output, daily)
- **Cost-per-credit-revenue ratio** (the unit-economics health metric) — should stay well below $0.05/credit

#### 5.4.4 Quality
- **Average rating over time** (rolling 7-day) by tier
- **Rating distribution** (5-star bar chart)
- **Rating by question style** — are essay-heavy exams rated lower?
- **Rating by education level**
- **Visual QA loop iteration histogram** — should be tightly clustered near 1
- **Reported-as-defective rate** over time, by tier, by class size
- **Failure rate by stage** — which pipeline step fails most often
- **Quality vs cost scatter** — are higher-rated exams also more expensive?

### 5.5 Operations Tab

Operational tooling for direct customer service and platform interventions.

#### 5.5.1 Refunds
- Queue of pending refund requests sourced from the support inbox, user-triggered "report this exam" flow (main PRD §5.9), and the Early-Exam Quality Recovery prompt (main PRD §5.13)
- Each request shows: user, exam (if applicable), reason, amount, support context, and the user's refund history (to spot patterns)
- **Refund types** — the operator picks which to apply, depending on the situation:
  - **Credit refund** — restores credits to the user's balance. Default for exam-quality issues, generation failures, and grading complaints. No Stripe involvement.
  - **Cash refund** — issued via Stripe API for the original charge (subscription period or credit pack). Default for billing complaints, accidental purchases, and cancellation refund requests.
  - **Combination** — for partial scenarios (e.g., a user bought a 50-credit pack, used 10, requests refund — operator can refund cash for the 40 unused credits at the pack's effective per-credit rate, while clawing back the unused balance).
- **Cash refund clawback rule**: when refunding cash for a credit pack, any credits from that pack still in the user's balance are deducted. If they've already spent more credits than the refunded portion covers, the operator chooses to absorb the difference or decline the cash refund.
- **Subscription period refunds** apply credits or cash for the unused portion at the operator's discretion. The user's tier is unchanged unless the operator also issues a downgrade.
- **Stripe chargebacks** appear in this queue automatically (via Stripe webhook). The operator can submit dispute evidence directly from the dashboard, see Stripe's verdict, and escalate or close.
- One-click actions: **Approve**, **Decline** (with reason note), **Escalate** (flag for follow-up), **Submit dispute evidence** (chargebacks only)
- **Refund-to-user lifecycle** (end-to-end): on Approve, the system (a) executes the refund (Firestore credit ledger entry + optional Stripe API call), (b) emails the user a confirmation with refund details, (c) creates an in-app notification visible in the user's notification center, (d) writes an audit log entry, (e) updates the user's billing page to show the refund. The user always sees the outcome.
- Refund history view: all completed refunds with searchable notes

#### 5.5.2 Credit Grants
- **Single-user grant**: from User Detail panel (existing flow)
- **Bulk grant**: select a user segment (via filter or saved segment) and grant credits to the entire segment with a reason. Examples: "Apology for outage on April 28: +50 credits to all users active that day."
- **Mandatory dry-run preview** before any bulk grant: shows the exact recipient count, a sample of 10 affected users, and the total credit cost. The operator must confirm the preview before the grant executes. Prevents segment-misconfiguration disasters.
- **Optional expiry**: bulk grants (and single grants) can carry an `expires_at` date. Granted credits beyond the expiry roll off the user's balance with an in-app explanation. Useful for time-bound apology grants without permanent inflation.
- Audit log records every grant with operator identity, target users, amount, reason, expiry (if any)
- Rollback action: bulk grants can be reversed within 24 hours (clawing back unspent portions) by clicking "Rollback" on the audit entry. Useful for the "wrong segment" mistake.

#### 5.5.3 Tier Overrides
- Manually elevate test accounts (e.g., your own test users) to Scholar or Guru indefinitely without a paid subscription
- "Override expires on" optional date — if set, tier reverts on that date
- Marked clearly in the user's tier badge (e.g., "Guru (admin override)") so it's not confused with paid subscribers
- Useful for: own test accounts, beta testers, customer goodwill upgrades

#### 5.5.4 Suspensions
- View all currently suspended accounts in one place
- Reason field, suspended-at timestamp, suspended-by (operator)
- One-click unsuspend with reason
- Suspended users see a clear in-app message with operator-defined explanation and a link to support

#### 5.5.5 Force Regenerate / Repair Exams
- Admin can re-run any exam through the generation pipeline, optionally with a different model (Flash → Pro) for free
- Useful for: regenerating after fixing a prompt bug, upgrading old exams as a goodwill gesture

#### 5.5.6 Force Re-grade Attempts
- Re-run grading on a previously graded attempt
- Useful for: prompt updates, user complaints about a specific grading decision

#### 5.5.7 Support Inbox
- Unified inbox for incoming support requests from multiple sources: support email forwards, in-app contact form (main PRD §5.15), Featurebase forwards, and chargeback notifications
- Each ticket has: source channel, user (if identifiable), subject, body, attachments, status (`new` / `open` / `waiting` / `closed`), priority, last activity timestamp
- Operator can: reply (drafts a Communications message, see 5.6), assign tags, link to refund/credit-grant actions, escalate, mark as resolved
- SLA timestamps tracked per ticket (response time, resolution time) for personal accountability — even with one operator
- Searchable by user, status, age, channel

#### 5.5.8 Data Export Requests
- Queue of incoming GDPR/CCPA data export requests (from in-app account settings, support email, or operator-initiated)
- Each request shows: user, request date, status (`pending` / `processing` / `delivered` / `failed`)
- One-click "Generate export" triggers an async job that gathers all user data (profile, exams, attempts, feedback, materials) into a ZIP, uploads to GCS with a signed URL, and emails the URL to the user with a 7-day expiry
- Operator can review the export contents before delivery if needed

### 5.6 Communications Tab

Direct messaging interface for emailing or SMSing users.

#### 5.6.1 Compose Single-User Message
- Triggered from User Detail or directly via this tab
- Channels: email, SMS, in-app notification (any combination)
- Templates: load a pre-defined template (welcome, apology, payment-failure-help, refund-confirmed, etc.) or write from scratch
- Variables: `{{display_name}}`, `{{credit_balance}}`, `{{tier}}`, etc., interpolated at send time
- Preview pane shows the message as the user will see it
- Send → logged in audit trail and in the user's communication history

#### 5.6.2 Segmented Broadcast
- Define an audience via filters (same filter system as Users tab, or load a saved segment)
- Audience size shown live as filters narrow
- Compose subject + body + channel(s) — body content auto-validated against a URL allowlist (configured in `config/url_allowlist`; defaults to `${WEB_URL}` and any operator-approved partner domains) to prevent the broadcast surface from being weaponized for phishing
- All non-transactional emails automatically include a CAN-SPAM-compliant unsubscribe footer linking to the user's notification preferences. Unsubscribed users are honored on subsequent sends.
- All SMS broadcasts honor STOP/HELP keywords automatically (Twilio compliance) — STOP responses unsubscribe the user from broadcast SMS while preserving transactional SMS
- **Schedule** for now or future timestamp
- **Test send** to a specified test address before broadcasting
- **Cooling-off**: broadcasts to >10K recipients require a 1-hour delayed-execution window with a cancel button. Smaller broadcasts execute immediately on send. Prevents weaponization in the event of a compromised admin session.
- Confirmation modal showing recipient count + sample render before actual send
- **Live broadcast controls**: in-flight broadcasts can be **paused, resumed, and aborted** from the Communications tab. Pause halts new sends; abort stops the broadcast permanently and prevents retries.
- Sends are throttled (default 100/sec, configurable) to respect Twilio / SendGrid rate limits
- **Idempotency**: each broadcast and each per-recipient send carries a unique idempotency key, so retries don't double-send to recipients
- **Bounce handling**: hard bounces and STOP unsubs are written to a separate suppression list that's automatically applied to future broadcast targeting
- Audit log records the broadcast with full audience snapshot, message content, send timestamps, delivery/bounce rates, and pause/abort events

#### 5.6.3 User Communication History
- On each user's profile, a tab showing all messages sent to them — automated and manual — with channel, content, delivered/bounced status

#### 5.6.4 Templates Library
- CRUD for message templates (name, body, supported channels, variables)
- Preview, duplicate, archive

### 5.7 Abuse & Triage Tab

Review queues for flagged content and behavior.

#### 5.7.1 Distribution Guidance Linter Queue
- Per main PRD §5.4, the deterministic post-generation linter routes mismatches (beyond ±2 question tolerance) here for review
- Each item shows: user, exam, expected vs. actual question count, distribution guidance text, model output excerpt
- Actions: **Confirm legitimate** (no penalty, refund any credit), **Confirm abuse** (suspend user with reason), **Escalate**

#### 5.7.2 Copyright Violation Reports
- Flagged uploads (instructor exam style templates) with potential copyright concerns
- Admin can review, contact the user, request takedown, or suspend on repeat violations

#### 5.7.3 Refund Farming Detection
- Auto-flagged users showing repeated patterns of "Not great" feedback + refund requests on early exams (per main PRD §5.13 Early-Exam Quality Recovery)
- Admin reviews the user's exam history and ratings, decides whether to disable refund eligibility for that account

#### 5.7.4 Share-Link Viewer Reports
- Per main PRD §5.6, viewers can flag shared exams as defective
- Each report shows: shared exam, creator email, viewer-provided context (if any), aggregate flag count for that creator
- Admin can: contact the creator, force-regenerate the exam, revoke the share link, or note as benign

#### 5.7.5 Source Material Moderation
- Users upload PDFs, videos, web links, and images as exam source materials. Some of this content could be illegal, NSFW, contain PII of others, or be otherwise problematic.
- Auto-flagged uploads (via lightweight content classifier — NSFW image detection, plausible-PII detection, copyright signal) appear here for review
- Operator can: contact user, remove material, suspend account on repeat violations
- This is distinct from copyright reports (5.7.2 — instructor exam style templates) and exam reports (5.7.4) — this covers the general source materials uploaded into class libraries or wizard sessions

#### 5.7.6 Account Anomaly Signals
- Aggregate view of accounts with unusual patterns: high refund frequency, rapid exam generation bursts, multiple SMS verification attempts, suspicious referral activity
- Admin reviews, decides on action

### 5.8 Referrals Tab

Monitor the referral program (per main PRD §5.16).

- **Headline metrics**: total referral links generated, total successful referrals (signed up + generated exam), total paid conversions from referrals, total free Scholar/Guru months granted
- **Top referrers** leaderboard (top 50 users by # of successful referrals)
- **Referral funnel chart**: link clicks → signups → first exam → upgrade to paid
- **Suspicious patterns flagged** (self-referrals, throwaway accounts, etc.)
- Manual override: revoke or grant referral rewards directly. Useful for confirmed abuse (revoke) or for honoring rewards that didn't auto-trigger due to bugs (grant).

### 5.9 Configuration Tab

Live-toggleable platform settings. All changes propagate to production within seconds and are logged in the audit trail.

#### 5.9.1 Feature Flags / Kill Switches
- **Preview generation kill switch** (per main PRD §5.6) — global on/off
- **Sign-up open / closed** — temporarily close registration if needed
- **Generation pipeline pause** — for emergency cost controls
- **Visual annotation enabled** — disable Nano Banana Pro globally if costs spike
- **Referral rewards enabled** — for fraud response

#### 5.9.2 Pricing & Limits
- Editable pricing constants (credit costs, pack prices, tier monthly allocations, max questions per tier, video/file size caps). Changes here take effect on next read.
- Note: changes to subscription prices apply only to new subscriptions; existing subscribers grandfathered.

#### 5.9.3 Model Configuration
- Active model IDs (Gemini Flash / Pro / Image preview), token cost constants for revenue/cost analytics
- Switch a tier between Flash and Pro globally (e.g., move Free to Flash 3.5 when it ships)

#### 5.9.4 Rate Limits
- Per-user topic extraction rate limit
- Per-user grading attempt rate limit
- Preview-per-device-per-day setting (default: 1)

#### 5.9.5 Notification Templates
- Edit transactional email templates (welcome, exam-ready, payment-receipt, etc.) without redeploying

#### 5.9.6 Status Banner
- Toggle a global status banner displayed across the main app and landing page
- Severity options: `info` / `warning` / `critical`
- Operator sets the message text, optional link (e.g., to a status page), and optional scheduled start/end times for planned maintenance
- Used for: incident communication, scheduled maintenance announcements, important product updates
- Multi-line markdown support
- Preview shows exact rendering before publish

#### 5.9.7 Test Data Purge

Tools for keeping synthetic data hygienic without polluting production analytics (per main PRD §5.19):

- **Purge all test data**: typed-confirmation modal → mandatory dry-run preview showing exact count of affected docs across each collection (`exams`, `feedback`, `attempts`, `share_links`, etc., where `isTestData === true`) → operator confirms → background job on Cloud Tasks deletes everything matching. Test accounts themselves are preserved (just their generated artifacts are cleared).
- **Purge a specific test account and all its data**: cascade-delete from the user detail panel using the same dry-run-and-confirm flow. Removes the user record, its subcollections (classes, exams, attempts, notifications), all associated test-data artifacts (feedback, share_links, communications), and the credit ledger. Audit log entry includes the full set of deleted document IDs.
- **Reset all test accounts to clean state**: less destructive — keeps test accounts but clears their generated artifacts, resets their credit balance to the tier default, clears the boost flags, and resets `lastActiveAt`. Useful between full test loop runs.

All purge jobs report progress to an in-app notification when complete (with deleted-doc counts). All operations are audit-logged and (for the bulk operation) reversible within a 24h window via the audit-log entry's "Rollback" — though rollback only restores docs, not their original timestamps or referenced storage assets that the GC has already removed.

#### 5.9.8 Webhook Health
- View recent Stripe webhook deliveries with: event type, timestamp, signature validation status, payload, processing result
- Failed-delivery log with retry button to manually replay an event
- Stripe webhook signing secret rotation interface (regenerate, surface to env var)
- Twilio webhook health view (for SMS delivery and STOP keyword handling)

### 5.10 Audit Log Tab

Comprehensive log of every admin action — designed as a true append-only ledger.

**Storage architecture (immutability enforced by infrastructure, not convention):**
- Audit entries are written to a **separate GCP project** with deny-delete IAM, OR streamed to a GCS bucket with object-lock and bucket-level retention policies. The main app's service account has write-only permission; nobody — not even the operator — can edit or delete entries via the application.
- Each entry is **hash-chained** to the previous entry (entry N stores hash of entry N-1). Tampering with any historical entry breaks the chain and is detectable on read.
- Backed by daily replication to a cold-storage archive for long-term retention

**Retention:**
- Hot storage: 12 months, immediately queryable in the dashboard
- Cold archive: 7 years (compliance retention), accessible via async query → GCS export

**Querying:**
- Searchable, filterable by date range, action type, target entity (user / exam / config), and operator
- Each entry: timestamp, operator, action, target, before/after values where applicable, reason note
- Critical actions (deletions, broadcasts, large credit grants, config changes) visually highlighted

**Export:**
- CSV export of any filtered slice. Large exports run async — the export job uploads results to GCS, the operator receives a signed URL via in-app notification when ready. No browser OOM from million-row downloads.

**Meta-audit:**
- Read access to the audit log is itself logged (separate `audit_access` collection) — this catches a compromised operator quietly auditing their own future moves
- Recursion is prevented: writes to `audit_access` itself do NOT recursively log to avoid infinite loops

---

## 6. Filtering & Segmentation

A unified, composable filtering system used across Users, Exams, and Analytics tabs.

### Filter Composition
- Filters AND together by default; OR is supported within a single filter (multi-select values)
- Compound filters via AND/OR groups for advanced segmentation
- All filter state is URL-encoded so any view can be bookmarked, shared, or returned to

**Backing engine:**
- Simple AND-only filters on indexed Firestore fields execute as Firestore queries (fast, cheap)
- Complex OR groups, full-text search, and substring matches route through a search index (Algolia or Typesense — see §8) which mirrors the user/exam collections in near-real-time
- Firestore's composite-index limit (200) and inability to OR across fields is respected — the system falls back to the search index when a query exceeds Firestore capabilities, and degrades gracefully with a "this query will run on search index" indicator if relevant

### Saved Segments
- Operator can save a filter combination as a named segment ("Dormant Scholar users from Q1 2026", "Power-Mode-only users")
- Saved segments appear in:
  - Users tab quick-filter dropdown
  - Communications tab as broadcast audiences
  - Analytics tab as a global filter
  - Operations tab for bulk actions
- Segments are dynamic — they re-compute against current data each time they're loaded

### Universal Search
- Top-bar global search hits multiple indexes: users (by email, display name, phone, UID, Stripe ID), exams (by title, ID, share slug), feedback (by content), classes (by name)
- Results grouped by entity type with one-click jump to detail panel

---

## 7. Data Model & Caching Strategy

### Pre-Aggregation for Scale
Direct queries over a 1M-user collection to compute analytics are too slow and too expensive. The admin dashboard reads from **pre-aggregated summary collections** populated by scheduled jobs:

| Aggregation | Source | Frequency | Stored At |
|------|--------|--------|-----------|
| Daily user counts | `users/` | Hourly | `analytics/daily_users/{YYYY-MM-DD}` |
| Daily exam counts by status | Collection group `exams` | Hourly | `analytics/daily_exams/{YYYY-MM-DD}` |
| Daily revenue and cost | Collection group `exams` + `subscriptions` | Hourly | `analytics/daily_finance/{YYYY-MM-DD}` |
| Cohort retention | `users/` + `exams` | Daily | `analytics/cohorts/{cohort_id}` |
| Per-user lifetime stats | `users/{uid}/exams` | Updated on exam complete | `users/{uid}/lifetime_stats` |
| Tier and subscription counts | `users/` | Real-time on tier change | `analytics/tier_counts/current` |

For **deep-dive analytics** beyond what's pre-aggregated, the admin can trigger an **on-demand BigQuery export** of a specific date range or segment. Results stream into the dashboard as they materialize.

### Indexes
Required Firestore indexes (illustrative — exhaustive list maintained in `firestore.indexes.json`):
- `users` by `tier`, `createdAt`
- `users` by `last_active_at`, `tier`
- Collection group `exams` by `createdAt`, `status`
- Collection group `exams` by `tier_at_gen`, `status`
- Collection group `exams` by `generation_metadata.estimated_cost_usd`
- Top-level `feedback` by `rating`, `createdAt`
- Top-level `audit_log` by `timestamp`, `operator_id`, `action_type`

### Caching
- Headline KPIs and chart data cached for **15 minutes** by default
- Per-user detail and exam detail are always live (no cache)
- **Manual refresh button** on every tab bypasses cache and pulls live aggregations
- **Auto-refresh on dashboard open**: opening the admin dashboard kicks off an aggregation job so the operator's first view is fresh without needing to click refresh
- Cache automatically invalidated on relevant admin actions (e.g., a tier change invalidates tier-count caches)
- Each cached metric displays its `last_updated_at` timestamp inline so the operator always sees how stale the data is

### Aggregation Job Monitoring
- Each pre-aggregated collection has a `last_successful_run_at` field updated on every successful aggregation
- The Overview tab shows a "Data freshness" health card that flags any aggregation that hasn't run in the past 2 hours
- Failed aggregation jobs send an alert to the operator's notification channel
- Backfill tooling: if a job fails for 6 hours, the operator can trigger a manual catch-up run from the Configuration tab

### BigQuery Cost Guardrails
On-demand BigQuery exports are powerful but can be expensive. Built-in safeguards:
- **Per-query cost ceiling**: each query is dry-run first to estimate cost; queries projected to exceed the threshold (default $5) require explicit operator confirmation
- **Daily total ceiling**: cumulative BigQuery spend per 24-hour window is capped (default $50). Exceeding the cap blocks new queries until the next window or a Configuration override.
- **Result caching**: identical query results are cached for 1 hour to avoid repeat-cost on the same exploration

### Communications Storage
- Per-user communication history is stored in a **separate top-level `communications/` collection** (not as subdocuments on user records). This prevents hot-spotting on broadcasts of millions of users (which would otherwise generate millions of writes against user docs).
- Each communication record references its recipient by `userId` and is queried via index on `(userId, sent_at desc)` for the user-detail view

### Live Streams
- Generation queue depth and active job count are read live (no cache) — the operator needs immediate visibility on platform health
- Newly logged audit entries appear in the audit log within seconds

---

## 8. Technical Architecture

### Deployment
**Route group within the existing Next.js app**, served at `${WEB_URL}/admin/*` during the build phase via path-based middleware. The admin code is gated by middleware that checks for the admin session cookie. This keeps infrastructure simple and lets the admin dashboard read from the same Firestore project without separate credentials management.

### Routing
- During build phase: path-based — `${WEB_URL}/admin/*`
- Next.js middleware checks the path prefix and the admin session cookie. Without a valid admin session, every `/admin/*` route returns a hard **404** (not 401, not redirect — full 404 so the surface's existence isn't advertised to anonymous probes).
- Any admin session cookie sent to a non-`/admin/*` path is silently ignored — admin sessions cannot act on user-app surfaces, and vice versa.
- Post-launch: when a custom admin host is added, swap the path prefix gate for a host prefix gate; no other code change. The path-based scheme is forward-compatible.

### Tech Stack
- **Framework**: Next.js 15+ (same as main app), App Router
- **Auth**: WebAuthn primary + SMS fallback (Twilio); HMAC-SHA256 cookie validation in middleware backed by server-side session collection for instant revocation
- **SMS**: Twilio
- **Charts**: Recharts
- **Tables**: TanStack Table (handles 1M+ rows with virtualization)
- **State**: React Query for server state, URL params for filter state
- **Styling**: Tailwind, but with a separate `admin.css` token set (utility/data palette, no glassmorphism tokens)
- **Aggregation jobs**: Cloud Scheduler → Cloud Functions writing to summary collections
- **Heavy analytics**: BigQuery (on-demand, not always-on) for complex segmentation
- **Search**: Algolia or Typesense, syncing user/exam collections via Firestore extension or Cloud Function trigger
- **Notifications**: in-app via Firestore real-time listeners, email via the main app's transactional email provider, SMS via Twilio

### Operators Schema (RBAC Scaffolding)
Even though there's a single operator today, the admin schema is built for multi-operator future:

- `operators/{operatorId}` — operator records with display name, primary auth identity (passkey or phone), role
- `operator_roles/{roleId}` — role definitions with granular permission grants (e.g., `refunds:write`, `users:edit_tier`, `config:write`)
- All admin actions in the audit log carry `operator_id`
- Today: one operator with a `super_admin` role that has all permissions
- Future: additional operators (support agents, finance ops, etc.) with limited roles, no migration needed

### Disaster Recovery
- **Daily Firestore export** to GCS (managed export feature). Retention: 30 days hot, 7 years archive.
- **Audit log replication** to a separate GCP project + GCS object-lock bucket for tamper-evident long-term storage
- **Recovery runbook** documented separately in `RUNBOOK.md` covering: bad bulk credit grant rollback, mistaken broadcast retraction, accidental config change reversal, region failure
- **Bulk credit grants** are reversible within 24 hours via the audit log entry's "Rollback" action

### Performance Budgets
- Cold load (post-login): < 3 seconds
- Tab switch: < 1 second
- User search response: < 500 ms
- Pagination scroll: < 200 ms per page
- Broadcast send to 100K users: throttled at 100/sec, total ~17 minutes; UI shows live progress

---

## 9. Security

### Authentication & Sessions
- **WebAuthn / passkey** as primary auth factor (Touch ID, Face ID, hardware security key); **SMS code** as fallback
- Phone number stored in `ADMIN_PHONE_NUMBER` env var — never committed to source code
- HMAC-SHA256 session tokens, HTTP-only cookies, **SameSite=strict**, secure flag, 24h expiry with 30-min idle timeout
- Server-side session collection for instant revocation across devices
- **Rate limiting**: 5 SMS sends / hour / IP with exponential backoff. Per-phone limits use a separate cooldown to avoid lockout-DoS attacks against the legitimate operator.
- SMS codes: 6 digits, 60s expiry, single-use, max 5 attempts, constant-time compare

### CSRF Protection
- All admin mutations require explicit CSRF tokens
- SameSite=strict cookies + token validation prevents cross-site request forgery on GET-with-side-effects endpoints

### Step-Up Auth for Destructive Operations
For destructive operations (suspending users, mass refunds, kill-switch toggles, bulk credit grants, large broadcasts), the admin re-confirms via passkey touch (or SMS code if passkey unavailable). Quick gesture, not a full re-login.

### Service Account Isolation
- The admin route handler uses a **separate, least-privileged Firebase service account** distinct from the main app's service account
- Admin service account scoped to required Firestore collections only
- Stripe API access via a **Restricted Key** with refund/customer-read scope (no full secret-key access)

### Audit Log Immutability (Infrastructure-Level)
- Audit entries written to a separate GCP project with deny-delete IAM, OR streamed to a GCS bucket with object-lock + bucket-level retention
- Hash-chained entries enable tamper detection on read
- Read access to the audit log is itself logged (meta-audit) in a separate `audit_access` collection

### Impersonation
- Strictly read-only — backend rejects all mutation requests originating from impersonation tokens
- Time-limited to 1 hour
- UI banner on impersonated sessions
- Explicitly logged in audit trail with start/end markers

### Configuration Change Safeguards
- **Hard floors and ceilings** on pricing constants (configurable in env, not via admin UI) — prevents a compromised admin from setting credit prices to $0
- Config changes generate an audit entry plus an out-of-band notification (email + Slack/Discord) so the operator is alerted to changes — useful as an early-warning if a session is compromised

### Communications Safeguards
- Broadcasts to >10K recipients require a 1-hour cooling-off window with cancel button
- Email/SMS body content is validated against a URL allowlist (configured in `config/url_allowlist`; defaults to `${WEB_URL}` and any operator-approved partner domains)
- All non-transactional emails include CAN-SPAM-compliant unsubscribe footers
- All SMS broadcasts honor STOP/HELP keywords (Twilio compliance)

### Logging Hygiene
- Search query strings (which can contain PII like phone numbers and emails) are scrubbed from Cloud Run / Next.js telemetry
- Stack traces with PII are redacted before reaching log sinks

### Operational
- All admin Firestore writes are logged to the immutable audit collection
- Bulk operations require typing a confirmation code
- No CORS — admin subdomain only

---

## 10. Scale Considerations

The dashboard must remain usable at **1M+ users** and **10M+ exams**. Key design decisions to enable this:

1. **All lists use cursor-based pagination** — no offset-based skips that degrade with large datasets
2. **All analytics read from pre-aggregated summary collections** — no count() over millions of docs at request time
3. **Heavy slicing uses BigQuery** — on-demand exports, not real-time
4. **Tables virtualize** — TanStack Table renders only visible rows even when the underlying dataset is millions of rows
5. **Search uses Algolia or Typesense** at scale — Firestore where-clauses can't do substring or full-text search across millions of records. The search index mirrors `users` and `exams` collections via Firestore extension or Cloud Function trigger; sync lag is typically <30 seconds. Search index cost is budgeted in monthly infrastructure
6. **Aggregation jobs are incremental** — daily aggregations process only the new/changed data since the last run, not the full collection
7. **No real-time listeners on dashboard views** — admins explicitly refresh; auto-refresh on dashboard open kicks off a fresh aggregation
8. **Async exports** — large CSV exports (audit log, user list, exam list) run as Cloud Functions writing to GCS, with results delivered via signed URL in an in-app notification. Browsers never load million-row CSVs in memory.
9. **Aggregation health monitoring** — every aggregation job updates a `last_successful_run_at` timestamp; the Overview tab surfaces stale aggregations and alerts the operator if any job hasn't run in 2+ hours

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Admin dashboard load time | < 3 seconds per tab |
| Time to find a specific user | < 10 seconds (search + click) |
| Time to issue a refund | < 30 seconds (search → user → refund) |
| Time to send a one-off message | < 60 seconds |
| Time to send a segmented broadcast | < 5 minutes (filter → compose → preview → send) |
| Data freshness for KPIs | ≤ 5 minutes |
| Uptime | Same as main app (99.9%) |
| Admin operator satisfaction | Founder uses it daily and prefers it to ad-hoc Firestore console queries |

---

## 12. Future Considerations

Out of scope for v1 but architecturally accommodated:

- **Multiple admin operators** with role-based permissions (e.g., support agents with read + refund-only powers)
- **Webhooks** to notify operator on critical events (large refund requested, subscription cancellation by VIP user, abuse signal threshold crossed) — Slack / Discord integration
- **Anomaly detection** with ML — automatically surface unusual patterns (cost spikes, conversion dips) without operator having to look
- **A/B test management** — define experiments, segment users, view results
- **In-product survey deployment** — push a one-time question to a segment of users
- **Customer health scores** — heuristic scoring of churn risk per paid user
- **Cohort exporter** to email lists for external campaigns
- **TOTP / authenticator app** as a 2FA option alongside SMS
