# ExamPull - Product Requirements Document

**Version:** 2.0
**Date:** March 8, 2026
**Status:** Final

---

## 1. Executive Summary

ExamPull is an AI-powered platform that generates realistic practice exams in PDF format, matching the style and rigor of actual school and university exams. Students provide their study materials—lecture slides, textbooks, notes, videos, or web links—and ExamPull produces professionally typeset exams using LaTeX, along with answer keys and grading feedback.

The key differentiator is **first-class LaTeX PDF output**. While other "AI practice test" services generate questions in web-based formats, ExamPull produces print-ready PDFs that look and feel like real exams—the format students will actually face.

---

## 2. Problem Statement

Students can learn more easily than ever with AI and online resources, but official exams remain largely pen-and-paper based in standardized formats. This creates a gap between how students learn and how they are assessed.

Practice exams are the most effective way to prepare, but sources are limited:
- Professors may release a few past exams, but these are quickly exhausted
- Existing AI quiz tools produce web-formatted questions that don't match actual exam formats
- No tool generates realistic, typeset practice exams from a student's own course materials

Dedicated students want an **endless stream of realistic practice exams** to benchmark themselves.

---

## 3. Solution Overview

ExamPull bridges this gap with a three-step flow:

1. **Upload materials** → Students provide any combination of PDFs, text, web links, or videos
2. **Configure exam** → Choose question count, styles (MC, short answer, essay, etc.), and difficulty
3. **Download PDF** → Receive a professionally typeset exam and answer key, generated via LaTeX

The platform is powered by best-in-class multimodal AI models and uses LaTeX for typesetting to produce output indistinguishable from real exams. Specific model and infrastructure choices live in `system_design.md`.

---

## 4. Target Users

### Primary Audience
All students, from elementary school through post-graduate programs, across all subjects.

### User Personas

**The Cramming College Student**
- Has an exam in 3 days, wants to test themselves repeatedly
- Uploads lecture slides and past exams, generates 5 practice tests
- Values speed and volume

**The Diligent High Schooler**
- Prepares weeks in advance for AP/IB exams
- Wants exams that match the exact format of standardized tests
- Values accuracy and realism

**The Graduate Researcher**
- Studying for qualifying exams across broad topics
- Uploads textbook chapters and research papers
- Values depth and difficulty calibration

**The Organized Pre-Med Student**
- Takes multiple science courses simultaneously
- Organizes materials by class, generates targeted practice exams
- Values the class management and library features

---

## 5. Feature Requirements

### 5.1 Authentication & Accounts

#### Sign-Up Methods
- Email + password
- Google Sign-In
- Apple Sign-In (deferred — not in v1, requires Apple Developer Program)

#### Phone Verification
- Every account must have a verified phone number — **no exceptions, no edge states**
- **Verification completes BEFORE the account record is created.** The signup flow is: collect credentials (email/password or OAuth) → collect + verify phone via SMS OTP → only then is the user record written to the database. There is no window during which an unverified-phone account exists. This applies to every signup path — fresh signup, anonymous→signup linking (see §5.6), and any future auth provider added later.
- Primary purpose: **abuse prevention** for free credits. Every account gets free monthly credits, so phone verification prevents one person from creating multiple accounts to farm credits. Phone numbers are harder to duplicate than email addresses, making them an effective unique identity constraint.
- Used for 2FA and account recovery
- Strictly: ONE phone number, ONE account

#### Account Linking
Accounts are **linked**, not merged. A single ExamPull account can have multiple auth sources (multiple emails, multiple Google accounts) attached to it. There is no flow for merging two existing accounts into one — this avoids entitlement-reset exploits (e.g., a user with a consumed Scholar Boost could not reset it by merging into a fresh account).

**Linking flow — new auth source matches an existing account:**
- When a user attempts to sign in with an auth source (Google account or email/password) that is already linked to an existing account, the user is prompted: *"We found an account with this email. Do you want to link your Google account to it?"*
- **If yes**: the user must authenticate with the existing account (via email/password, SMS OTP on the account's verified phone, or an already-linked Google account). Once authenticated, the new auth source is added to the existing account.
- **If no**: the sign-in is rejected and the user must use the original auth method. A new account is NOT created to avoid duplicate accounts for the same person.

**Linking flow — phone number conflict:**
- If a user attempts to verify a phone number that's already on another ExamPull account, **SMS OTP alone is not sufficient** to claim that account (carriers reassign prepaid/burner numbers; we will not let a new owner of a recycled number silently inherit the prior owner's account). The user must additionally prove ownership via either:
  - A previously-linked email or Google account on the existing account, OR
  - The existing account has been **dormant for 180+ days**, in which case SMS OTP alone is sufficient (the original user has effectively abandoned the account).
- If neither path works, the user is gently informed and directed to support to recover their account through manual verification.

**Anonymous preview → existing account:**
- If a user completes a no-account preview and then tries to sign up with a Google account that already has an ExamPull account, they're offered the linking flow described above. If they decline to link, the preview exam is discarded (as if they never signed up).

**Use case**: Smooth transitions as school emails change (e.g., graduating, transferring) — users can add a new email to their existing account without creating a duplicate.

**Constraint**: one email cannot belong to multiple accounts; one phone number = one account; entitlements (credits, consumed boost, subscription) are always per-account, never transferable.

#### Password Recovery
- Forgot password flow for email/password accounts
- 2FA via phone (SMS) as universal recovery method

#### Subscription & Account Management
- Users can upgrade, downgrade, or cancel their plan at any time
- **On cancellation:**
  - **Monthly plans**: paid-tier access retained until the end of the current billing cycle, then downgrade to Free
  - **Annual plans**: paid-tier access retained until the end of the 12-month commitment, then downgrade to Free. Annual cancellations are **not prorated** — annual is a commitment.
- **On downgrade (e.g., Guru → Scholar):**
  - All previously generated exams retain the features of the tier they were created under (e.g., a Guru-tier exam keeps its visual annotations even after downgrade to Scholar)
  - Conversely, on **upgrade**, users gain access to paid-tier features on their old Free-tier exams too. A user who created a 12-question exam on Free and later upgrades to Scholar can spend credits to grade attempts on that old exam, unlock its answer key, and generate visual annotations (Guru). This is the user-friendly default — we don't punish users for waiting to upgrade.
  - Future exam generations are subject to the new (lower) tier's limits
  - **Credit transition (Guru → lower tier only)**: Since only Guru has rollover, the "next-cycle runway" rule applies only to Guru downgrades. All existing rolled-over credits remain accessible at Guru capability through the **next full billing cycle** under the new tier. From the cycle after that, any remaining rolled credits expire (the new tier doesn't carry rollover).
  - **Credit transition (Scholar → Free)**: Scholar has no rollover, so there's nothing to transition — Scholar's monthly credits expire at cycle end as usual.
  - **Purchased credit packs never expire on tier changes.** Credits bought with cash are permanently owned by the user, regardless of subscription status. Only subscription-granted credits are subject to tier-specific rollover rules.
- **On payment failure:**
  - 2-week grace period before downgrade
  - **New credit grants are paused** during the grace period. Existing credits remain fully usable at the current tier's capability.
  - Email and SMS reminders sent during grace period (credit cards expire, etc.)
  - After 2 weeks with no payment update, downgrade to Free tier
- **Refunds:** Handled case-by-case via the support portal. No automated self-service refunds. Annual plans are non-refundable except at operator discretion.

#### Account Deletion
- Multi-step confirmation process to prevent accidental deletion
- Triggers a **full data wipe**: all exams, uploaded materials, grading results, and personal data are permanently deleted
- Active subscriptions are cancelled and any share links created by the user are deactivated

### 5.2 Class Management & Personalization

#### Adding Classes
- Users can create classes on their profile (e.g., "MATH 301 - Real Analysis", "AP US History")
- Each class has: name, institution (optional), **education level** (required), description (optional)

#### Education Level (Unified Difficulty Scale)
Classes are tagged with an **education level** that maps to a numeric difficulty on a **0-100 internal scale**. This unifies education level and difficulty into a single dimension, enabling fine-grained control and fair comparison across institutions.

Standard education levels and their default difficulty positions:
- **Elementary School** — ~5
- **Middle School** — ~15
- **High School (Regular)** — ~25
- **High School (Honors)** — ~35
- **AP / IB** — ~45
- **Undergraduate** — ~60
- **Graduate** — ~80
- **Professional / Postdoc** — ~95

(Exact numeric values are tunable constants — the above are illustrative.)

Users can **override the default** via a rich slider widget showing segmented education levels with intervals. For example, if a user's high school honors class tends to run harder than a typical honors course, they can nudge the slider from 35 to 40. Or if they want to challenge themselves, they can place themselves at 55 (halfway between AP and Undergraduate).

The AI receives this difficulty as contextual guidance during question generation: e.g., "Target difficulty: 45 — roughly AP/IB level." The AI handles the interpretation without rigid enforcement. This sets the baseline for question depth; the Light/Balanced/Hardcore selector in the wizard adjusts relative to this baseline.

#### Class Lifecycle
- Classes can be **edited** (rename, change details) at any time
- **Archive is the default end-of-life action**. The "Archive" button is the primary option — hides the class from active view but preserves all materials, the style guide, and the class tag on associated exams. Archived classes can be restored at any time.
- **Delete is secondary** and requires stronger intent: it's a smaller element on the class page with a double-confirmation flow that explicitly asks *"Are you sure? Consider archiving instead to preserve your exam history."* Deletion permanently removes the class and its associated materials, and strips the class tag from previously generated exams (the exams themselves persist in the library but lose their class tag and style reference).
- **Class deletion is blocked while in-flight exams reference the class.** If a user tries to delete a class while an exam tagged to it is still generating, the system shows: "An exam from this class is still generating (about 2 minutes left). Wait for it to finish, then you can delete." This protects in-progress user work from silent loss.
- **Style guide edits are free on removal**, charged on add or replace. Users are never taxed for undoing a previous decision.

#### Class Materials
- Users can upload persistent materials for each class:
  - **Syllabus** — automatically provides topic scope and curriculum structure
  - **Textbook excerpts** — reference material for question generation
  - **Lecture slides/notes** — core content source
  - **Other documents** — any supplementary material
- These materials are automatically included as context when generating exams tagged to that class

#### Example Exams (Instructor Style Templates)
- Users can upload examples of their instructor's past exams for each class
- **Processing happens immediately on upload** so the user sees confirmation that the style was captured. The generated style guide is visible to the user on the class page — they can review what the AI learned from their instructor's exams and regenerate if it's off.
- **Cost**: Generating an instructor style guide costs **2 credits per upload**. This covers the AI cost of image analysis and style extraction. Subsequent exam generations using this class inherit the style at no additional cost.
- **Per-class style guide, multi-material**: A class has **one unified style guide**, but it can draw from multiple uploaded example exams. Adding or removing an example exam triggers an edit of the style guide based on the current set of materials (costs 2 credits per edit). The user always sees the current guide and can regenerate it if needed.
- **Copyright acknowledgment**: Before uploading an instructor example exam, the user must check a box: "I confirm I have the right to upload this material, either because I own it or I have explicit consent from the owner." Repeated violations lead to account suspension.
- **Power Mode override**: In Power Mode exam creation, users can supply their own ad hoc style reference materials for a single exam. When ad hoc style materials are provided, they take precedence over the class's stored style guide for that exam only.
- The system converts each uploaded exam to **page images** and analyzes them visually using AI, since the most intuitive way to understand an exam's style is to look at the final rendered output — regardless of whether the original was LaTeX, Word, or handwritten
- From this analysis, the system generates a **structured instructor style guide** stored as plain text:
  - Visual layout patterns (header style, question numbering, spacing, point distribution)
  - Question type distribution and ordering preferences
  - Difficulty calibration and phrasing style (how the instructor words questions, level of formality)
  - Tone, voice, and structural conventions
  - Example questions extracted from the uploaded exams for few-shot reference
- This guidance orients the generation model into the instructor's "state of mind" so it can reproduce the style in LaTeX output, without needing the original source format
- This approach works universally: not all instructors use LaTeX — K-12 teachers often use Word documents, and many exams are handwritten. Visual analysis handles all of these.
- Future exams for that class incorporate this stylistic guidance by default during generation. In Power Mode, users can toggle instructor style mirroring on or off per exam.

### 5.3 Exam Creation Wizard

The exam creation flow is a **three-step wizard**:

1. **Sources** — Select classes (with per-material checkboxes and focus fields), upload ad hoc files (with focus fields), and/or type manual topics. All source types are optional and can be combined freely. A user can generate an exam from manual topics alone — no materials or classes required. This is a first-class path, not a fallback.
2. **Topics** — AI extracts a structured list of content areas from uploaded sources; manual topics pass through as-is. User reviews, edits, adds, removes. If no materials were uploaded, this step is just a review of the manually entered topics. (See "Topic Extraction" below for how this works across diverse subjects.)
3. **Configure & Generate** — Set exam title, question count, question styles, difficulty, and choose Standard or Power Mode (toggle). The generate button displays the credit cost (e.g., "Generate — 15 credits") and updates live as the user changes the question count. If the user has insufficient credits, the button is disabled with a gentle inline prompt to purchase more or upgrade.

#### Material Upload & Processing

#### Supported Input Types
| Input Type | Handling |
|-----------|----------|
| PDF documents | Native multimodal processing |
| Word documents (.docx) | Server-side conversion to PDF, then multimodal processing |
| PowerPoint (.pptx) | Server-side conversion to PDF, then multimodal processing |
| Text files | Direct text input |
| Images (photos of notes, whiteboard, etc.) | Native multimodal processing |
| Web links | Server-side content extraction and processing |

#### Input Limits
- **Token budget**: Total input across all sources for a single exam is capped at approximately **800,000 tokens** (sized to fit comfortably within modern long-context models with budget left for system prompts and generation overhead)
- **File size limit**: Individual uploads are capped at **100 MB**. Files larger than this are rejected at upload with a clear error message.
- Users are informed when they approach or exceed limits with clear, non-technical messages

#### Anonymous Upload Retention
- Materials uploaded during a no-account preview session — together with the preview exam they produced — are retained for **30 days** to allow users time to sign up and claim them. After 30 days, the orphaned anonymous bundle (uploads, generated PDFs, page images, exam metadata) is automatically purged. **Uploads and exams are bundled**: they are always purged together so a user never returns to find a preview exam in their library whose source materials no longer exist.

#### Flexible Source Combination (Step 1)

The exam creation wizard Step 1 allows users to **combine any or all** of the following source types in a single exam. These are NOT mutually exclusive — users can use all three simultaneously:

1. **Add Classes** — Select one or more existing classes. When a class is added, all its individual materials are displayed with **checkboxes** so the user can include or exclude specific items (e.g., include the syllabus and lecture slides but exclude the textbook excerpt). Each material has an optional **"Focus"** text field (e.g., "Unit 4: Thermodynamics", "Chapters 7-9") to scope what's relevant from that material.

2. **Upload Files** — Upload one or more ad hoc files (PDF, Word, PowerPoint, text, images) directly. These are one-time uploads for this exam and are not added to a class library. Each uploaded file has an optional **"Focus"** text field to narrow the scope.

3. **Manual Topics** — Type in topics directly. These are passed through to the topic list as-is.

All sources are displayed together in a unified source list. Users can add/remove sources freely before proceeding.

#### Smart PDF Handling for Long Documents

For uploaded PDFs longer than 20 pages (likely textbooks or comprehensive materials):

1. The system **agentically reads the table of contents** using a fast multimodal model
2. If a focus area is specified, the system identifies the relevant chapter/section page ranges
3. **Only the relevant pages** are passed to the topic extraction AI (not the full 200-page textbook)
4. This agentic process is **visible to the user** with status updates:
   - "Reading table of contents..."
   - "Found 'Unit 4: Thermodynamics' on pages 87-142"
   - "Extracting topics from pages 87-142..."
5. If no focus area is specified, or the TOC doesn't match, the system falls back to processing the full document (or a reasonable subset)

#### Upload-Time Validation
- As each file is uploaded, a **lightweight AI pass** (fast model) performs a quick vibe check:
  - Is the file corrupted or unreadable? → Flag immediately with a clear error
  - Is the file too large (exceeds token budget)? → Flag immediately with size guidance
  - Does the content seem relevant to the exam context (class name, other materials)? → If not, nudge the user with a subtle prompt
  - Is the content very broad (e.g., a full textbook with no focus)? → Gently pulse the "Focus" field and suggest: "This file covers a lot — consider adding a focus to narrow it down"
- This validation happens in the background as files are uploaded, before the user advances to topic extraction. It catches problems early and reduces wasted processing.

#### Topic Extraction
"Topics" in ExamPull are broadly defined as **testable content areas** — not just traditional academic topics. What gets extracted depends on the subject matter:
- **STEM subjects**: Traditional topics like "Stoichiometry," "Quadratic Equations," "Thermodynamics"
- **Literature/Humanities**: Chapter references ("Chapters 6-12 of To Kill a Mockingbird"), themes ("Symbolism in The Great Gatsby"), character analysis, literary devices
- **Social Sciences**: Concepts ("Supply and Demand"), historical periods, theories, case studies
- **Skills-based subjects**: Competencies like "Reading Comprehension," "Rhetorical Analysis," "Lab Technique Identification"

The AI adapts its extraction to whatever is appropriate for the source material. The goal is to produce a list of discrete, testable content areas that the user can review and refine — not to force every subject into a rigid topic taxonomy.

Topic extraction is performed when the user advances from Step 1 to Step 2. Results are **cached per-user** by a content hash of (material + focus + other source context). The cache is scoped per-account — never shared across users — for privacy. If a user goes back and forth in the wizard without changing inputs, the cached result is reused (the back button is friendly, not punishing). Changing any focus field invalidates the cache and triggers a fresh extraction.

To prevent compute-drain abuse, topic extraction is **rate-limited per user** (generous enough that normal users never notice; strict enough to catch adversarial patterns). Cached re-uses don't count against the rate limit — only fresh extractions do.

#### Topic Extraction Failures
- **Best-effort fallback**: If extraction fails, the system uses a fast model to attempt a "best-guess" topic suggestion from whatever it could partially read. The user sees: "We couldn't fully read your file, but here are some guesses — edit or add your own." Users always have a path forward, never a dead-end.
- After 3 retries with no usable output, the user is invited to enter topics manually. Their original uploads stay in place so they can try again with a different focus or skip ahead with manual topics.

#### Processing Pipeline
1. User configures sources in Step 1 — classes (with per-material focus), ad hoc files (with focus), and/or manual topics
2. On advancing to Step 2, all source materials are processed by a **fast multimodal model** to extract a structured list of content areas:
   - Class materials are scoped by the class-level focus text
   - Uploaded files are scoped by the per-file focus text
   - Long PDFs (>20 pages) go through smart page extraction first
   - Manual topics are added directly to the list
3. All extracted topics are **merged, deduplicated**, and presented to the user for review
4. User can edit, reorder, add, or remove topics. Each topic chip shows a tooltip with the source material and focus field that produced it, so users can diagnose why a topic appeared.
5. A persistent **"These don't look right?"** action sits below the topic list, opening a quick sheet with options: "Try narrowing the focus on a specific material," "Re-extract from scratch," or "Skip extraction and enter topics manually." This makes it explicit that the user has recovery paths if the AI's interpretation feels off.
6. **Topic count warning**: If extraction produces more than ~20 topics, warn the user before displaying the full list: "We found a lot of topics — did you mean to add a focus to narrow things down?" The user can proceed anyway or go back to add focus.
7. **Extraction failure**: If topic extraction fails entirely (no usable output even with best-effort fallback) after multiple retries, show a graceful error: "We couldn't extract topics from this material — try again or enter topics manually." Always offer the manual topic entry fallback.
8. Final topic list becomes the basis for exam generation

### 5.4 Exam Generation — Normal Mode

#### User Inputs
- **Exam title** (optional — if left blank, the AI generates a descriptive title during the test plan step. If provided, the AI-generated title is skipped.)
- **Topic list** (from material processing, editable)
- **Class tag** (optional — pulls in class context, materials, and style templates)
- **Number of questions** (subject to tier limits; each question costs 2 credits to generate). The question count selector is capped at the user's tier max — the user literally cannot move the selector past the cap. A gentle toast explains: "Your current plan tops out at 12 questions per exam — upgrade to Scholar for 25 or Guru for 100."
- **Question styles** — select one or more:
  - Multiple Choice
  - True/False
  - Short Answer
  - Long Answer / Essay
  - Fill in the Blank
  - Matching
  - Problem Solving (show work)
  - Proof-based (for math/logic courses)
- **Education level slider** — positions the exam on the 0-100 difficulty scale (see 5.2). If the exam is tagged to a class, this defaults to the class's education level; the user can override via the slider to make it harder or easier. If no class is tagged, the user must pick an education level explicitly. The slider widget shows segmented stops (Elementary → Middle School → High School → Honors → AP/IB → Undergraduate → Graduate → Professional) with the ability to land between stops for finer calibration.
- **Difficulty** — relative to the education level:
  - **Light** — ~20-30% easier than a real exam at this level. A warm-up, confidence builder, and sanity check. Not laughably easy, but gentler.
  - **Balanced** — matches what you'd most likely see on an actual exam at this education level. The default.
  - **Hardcore** — ~20-30% harder. Questions are trickier, require more steps, combine multiple concepts, or go deeper on problem-solving. Still stays true to the topics — doesn't test content above the education level. The idea: if you can beat Hardcore, the real exam should be a breeze.
- **Distribution guidance** (optional, Standard Mode only) — a freeform text field where users can steer the question mix: e.g., "Mostly MC with a few short answer at the end," or "Weight derivatives more heavily than integrals." This is advisory — the AI uses it as a hint, not a rigid constraint.
  - **Guardrails**: A lightweight injection check scans this field before generation to flag obvious adversarial prompts. A **deterministic post-generation linter** also verifies the output matches the paid-for scope (the number of generated questions equals the number the user paid for). A **±2 question tolerance** is allowed since the AI may legitimately drop, merge, or split a question during assembly — this is not user fault. Mismatches beyond tolerance route to an **admin review queue**, NOT an automatic account freeze. Only repeated, demonstrated abuse patterns (across multiple flagged exams) lead to manual suspension via the admin tools.

#### Generation Pipeline

**Model Selection**: The AI model used depends on the user's tier, applied **consistently across all generation steps**:
- **Free tier**: Uses a **fast, cost-efficient model** for all generation steps
- **Scholar & Guru tiers**: Uses a **frontier-quality model** for all generation steps — "Pro-level AI"

Specific models used at each tier are configured in `system_design.md` and may be swapped over time as the model landscape evolves. All LLM calls go through a unified gateway (OpenRouter) so models can be changed via configuration without code changes.

The Visual QA checking step always uses the fast model regardless of tier (it's a verification task, not a creative generation task). If the QA loop finds issues that need fixing, the fix step uses the tier's model.

1. **Test Plan** (hidden from user) — The tier model reviews the content area list, user parameters, distribution guidance, class context, and any instructor style template to produce a structured plan: which content areas get covered, question-by-question breakdown of type and difficulty. If an exam title was not provided, the model generates one at this step. Standard Mode exams do not include point values; Power Mode exams use the user-defined point values.
2. **Question Generation** — For each planned question, a **parallel call to the tier model** generates the **answer key version**: the full question in LaTeX with the complete worked solution inline (correct answer clearly marked, followed by a detailed explanation of how to arrive at it). The answer key is the primary generation artifact — every question is born with its solution. The question text and solution LaTeX are also stored as plain text for use in the grading UI (5.7). Free users cannot view the answer key until they upgrade, but it's already waiting for them.
3. **Exam-Only Derivation** — The question-only exam PDF is derived from the answer key by stripping out the solutions and inserting appropriate answer spaces. A **lightweight AI call** (fast model) decides the right answer space for each question by choosing from a fixed set of tiers, each with a defined LaTeX dimension:
   - `none` — no answer space (e.g., inline MC bubbles)
   - `small` — ~0.5 in inline blank
   - `medium` — ~5cm vertical space
   - `large` — ~12cm vertical space
   - `extra_large` — `\vfill` to most of the page
   - `full_page` — `\vfill + \clearpage` (full page reserved)
   
   The AI picks based on question type and complexity — e.g., MC gets `none`/`small`, a multi-step proof gets `full_page`. If the AI call fails, a deterministic rule-based fallback picks a reasonable default per question style (e.g., MC → `none`, short answer → `medium`, problem solving → `large`, proof → `full_page`).
4. **Exam Assembly** — The **tier model** writes the boilerplate LaTeX (headers, formatting, instructions, page layout) for both the answer key and exam-only versions. Question LaTeX is deterministically inserted into the boilerplate. If an instructor style template exists, the stylistic guidance and example questions are provided as context.
5. **PDF Compilation** — LaTeX source for both versions is compiled into PDF via the LaTeX compilation service
6. **Visual QA Loop** — Each page of both PDFs is rendered as an image and sent to the **fast multimodal model** for a visual sanity check:
   - Checks for: text overflow, clipping, broken formatting, garbled symbols, misaligned elements, missing content
   - If issues are found, Flash provides detailed descriptions → **the tier model** fixes the LaTeX → recompile → re-check
   - Loop runs up to **5 iterations per PDF, independently** (answer key and exam-only have separate budgets — neither one's failures consume the other's runway)
   - **Infrastructure failures (LaTeX service 503, network errors) do NOT count toward the 5-iteration budget** — these are retried separately with exponential backoff. The 5 iterations are reserved exclusively for genuine content/formatting issues.
7. **Delivery** — Final exam PDF and answer key PDF are stored and made available

#### Credit Deduction
- Credits are **atomically reserved at pipeline start** via a database transaction on the user record. The reserved amount appears as "pending" in the credit balance UI. This prevents race conditions across parallel sessions (two devices both submitting jobs that exceed the user's balance).
- On **successful generation**, the reservation is committed (credits deducted permanently).
- On **failure**, the reservation is released (credits return to the user's balance).
- On failure: show a graceful error message, reassure the user they were not charged, and **persist all exam configuration** (sources, topics, settings) so they can retry with a single tap without re-entering anything.

#### Exam Status State Machine
The canonical exam status enum used throughout the platform:
- `queued` — generation request accepted, waiting to start
- `generating` — actively running the question generation step
- `qa_in_progress` — running the Visual QA loop
- `complete` — finished successfully, PDFs available
- `failed` — pipeline failed, user not charged, retry available
- `partial_qa_fail` — delivered with minor formatting imperfections (max QA iterations reached)
- `reported` — user has reported quality issues; under review

UI filters and database schema use these exact strings.

#### Tier Snapshot at Pipeline Start
- The user's tier is **snapshotted at the moment the pipeline begins**. In-flight generations complete at the tier they started under, even if the user's subscription changes mid-pipeline (e.g., Stripe webhook fires a downgrade during generation). This protects users from being penalized by mid-flight subscription changes that aren't their fault.
- New generations after a tier change are subject to the new tier's limits.

#### Progress UX
During generation, show a **per-stage progress tracker** (similar to a Domino's pizza tracker, but elegant):
- Each pipeline stage is displayed as a step that transitions from pending → in progress → complete
- During question generation (typically the longest step), show a **question-level progress indicator** (e.g., "Generating question 7 of 15") so users see continuous progress
- The tracker provides transparency into what the system is doing, reducing perceived wait time

#### Generation Failure at Max QA Iterations
If the Visual QA loop reaches its 5-iteration maximum and issues remain:
- Deliver the best available PDF with a subtle notice that minor formatting imperfections may exist
- Log the failure for quality monitoring
- Do NOT withhold the exam or charge additional credits

### 5.5 Exam Generation — Power Mode [Paid-Tier Feature]

#### Overview
Power Mode gives users **full tactical control over every question** in the exam. Instead of configuring the exam at a high level and letting the AI decide question distribution, users specify exactly what each question should cover.

#### Relationship to Standard Mode
- **Materials and classes are upstream of both modes.** Users go through the same source selection flow (Step 1 — add classes, upload files, manual topics) and topic extraction (Step 2) in both modes.
- The choice between Standard and Power Mode happens **after** topics are extracted, when configuring the exam structure.
- In Standard Mode, the AI uses the topic list and user parameters to create a test plan with full discretion on how topics map to questions.
- In Power Mode, the user manually creates the test plan.

#### Test Builder UI
- Users add question slots one by one or in groups
- For each question slot, the user specifies:
  - **Topic** — select from the extracted topic list OR type a custom topic. Source-material grounding is applied at the **exam level** — all materials, classes, and focus fields configured in Step 1 inform every question generated, regardless of the per-question topic. A custom topic typed at the question level just steers what that question is about; it doesn't bypass or override the exam's grounding context.
  - **Question style** — MC, short answer, essay, proof, etc. (configured per-question, not per-exam)
  - **Difficulty** — per-question difficulty (Light / Balanced / Hardcore). Defaults to the exam's overall difficulty level when a slot is added. A **"Set all"** button next to each slot's difficulty lets the user sync all other slots to match, for users who want consistent difficulty across all questions.
  - **Point value** — how many points the question is worth
- **Credit cost updates live** as the user adds or removes question slots — the generate button always reflects the current cost (e.g., "Generate — 7 credits" when 7 slots are configured).
- Example configuration: "3 MC questions on derivatives (Balanced, 5pts each), then 2 short answer on integrals (Hardcore, 10pts each), then 1 proof on the Mean Value Theorem (Hardcore, 20pts)"
- Users can reorder questions via drag-and-drop on desktop. On mobile (viewport < 768px), drag-and-drop is replaced with a **dedicated reorder mode** — tap a reorder icon on a slot, then tap where it should go, or use explicit up/down arrows on each slot. Drag-and-drop is painful for many slots on a small screen and mobile users shouldn't suffer that.
- **Bulk efficiency actions** (especially valuable on mobile, but available everywhere):
  - **Duplicate slot** — clones a configured slot in place
  - **Apply to range** — select a range of slots (e.g., 3-7) and bulk-edit topic, style, difficulty, or points
  - **Quick-add** — a single action: "Add 5 MC questions on Topic X at Balanced, 5pts each" creates 5 fully-configured slots in one gesture
  - **"Set all"** — sync any one slot's setting (difficulty, style, etc.) to all other slots, with a one-tap undo
- These reduce the tedious tap-tap-tap of building large exams.
- If the exam is tagged to a class with an instructor style template, Power Mode includes a **"Mirror instructor style"** toggle (on by default). Users can disable it to get a neutral exam style instead.
- The user-defined test plan replaces pipeline step 1; the rest of the pipeline (question generation, assembly, QA) runs identically

### 5.6 Exam Delivery & Download

#### No-Account Preview Experience
- Unauthenticated users can use the full Standard Mode exam creation flow (same flexible source step as authenticated users, minus class selection). The Standard/Power Mode toggle is **visible** on the configuration step but the Power Mode option is gated — tapping it shows a teaser: "Power Mode lets you customize every question. Sign up and upgrade to Scholar to unlock." This previews the upsell without giving the feature away.
- Only the first 3 questions are generated (an operational cost absorbed by the platform)
- Preview shows a **rendered image of the first page** (NOT an iframe with the full PDF URL) with a gradual blur overlay on the bottom half. The full PDF URL must never be exposed to the client — only the server-rendered page image is sent.
- Download is disabled; right-click save only captures the blurred image
- CTA: "Sign up for a free account to see the full exam"
- **Critical**: All CTAs from preview mode ("Sign Up Free", "Create Account", etc.) must route to the actual sign-up page. Preview users must NOT be silently kept as anonymous users with access to the full app. Anonymous users attempting to navigate to protected routes (/dashboard, /exams, /classes, /settings, /billing) must be redirected to the sign-up page.
- **Phone verification is mandatory and happens before the account is created**, including in the anonymous→signup linking path. The flow is: anonymous user clicks "Sign Up" → collects email/Google credential → collects + verifies phone via SMS OTP → only then is the linking executed and the durable account record written. The anonymous UID is preserved on link, but the user record only exists once the phone is verified. There is no transient unverified-phone state.
- Upon sign-up: anonymous account is linked to the new real account (UID preserved), exam becomes accessible in the user's exam library, and full PDF is downloadable. Ad hoc materials uploaded during the preview are preserved as metadata on the exam and visible on the exam detail page — the user can clone the exam to reuse these materials without re-uploading.
- The preview exam is a one-time signing bonus and does not count toward the user's monthly credits. After account creation, the user has their full monthly credit allocation to use.
- **If sign-up happens after the 30-day anonymous retention window** (per §5.3), the preview bundle (exam + materials) has been purged. The user's sign-up still completes normally (no error, no ghost references), but they start fresh with a clean library and full monthly credits — there is no preview exam to claim. The CTA on the share page implicitly assumes prompt sign-up; users returning after a month effectively forfeit the preview and that's fine.

#### Preview Abuse Prevention
- Preview generation is rate-limited using **device-level fingerprinting** (browser fingerprint, IP address, and hardware signals). This must be robust enough to detect the same physical device even in private/incognito mode.
- Limit: **exactly one preview per device per 24-hour rolling window**. Configurable via the admin kill switch if needed.
- Track total preview volume as an operational metric. If preview costs spike abnormally (e.g., a DDoS-style attack generating thousands of previews), the system supports a **server-side kill switch** that disables preview generation globally. When disabled, the landing page seamlessly adjusts — the preview option is hidden and the CTA shifts to "Sign up free to generate your first exam." The kill switch is toggleable from the admin site and propagates live (near-instant).
- Under normal conditions, preview abuse is low-risk since previews have limited utility (only 3 questions, no download). The safeguards are primarily defense against malicious actors.

#### Answer Key Availability
- Answer keys are generated during the pipeline for every exam, regardless of tier. Generating questions and answers together in the same model call ensures perfect consistency.
- **Free tier**: Answer key is stored but **locked**. The user sees a prompt to upgrade to Scholar or Guru to unlock it — the answer key is already there, waiting for them.
- **Scholar & Guru tiers**: Full answer key available for immediate download.

#### Free Tier
- Full exam generated and available for download
- Answer key locked (see above)

#### Scholar & Guru Tiers
- Full exam + answer key available for download
- Share link generation (see below)

#### Share Links
- Scholar and Guru users can generate a **share link** for any exam they've created
- Share links are **permanent** — they remain active as long as the exam exists. If the creator deletes the exam, the link dies.
- **Anyone with the link can view the exam** without an ExamPull account — no sign-up gate
- **Answer key visibility on shared links is re-checked live against the creator's current tier:**
  - If the creator currently has Scholar or Guru, the share link can include the answer key (creator chooses per-link when generating it)
  - If the creator is on Free tier, the answer key is never available via the share link, even if the viewer has a paid account. Feature access is tied to the creator's *current* tier, not the viewer.
  - **On creator downgrade**: the user receives an email listing exactly which share links will lose their answer keys, with a **7-day grace window** before the change takes effect. This way users see the consequence before it bites and can decide whether to keep their subscription or accept the change.
- Recipients can **download the exam PDF freely** from the share link
- The share page is designed as an **organic acquisition funnel**:
  - Prominent "Create your own practice exams on ExamPull" CTA
  - A **"Customize for yourself"** action that, on sign-up, opens the exam creation wizard with the shared exam's configuration pre-loaded ("fork mode") — so the new user can immediately iterate on the same topics with their own materials
  - A subtle **"Something wrong with this exam?"** link that lets viewers flag quality issues. Reports notify the creator (so they know their share is embarrassing them) and the platform quality system (so we can improve generation). Protects creator reputation and feeds back into product quality.
  - Subtle branding and value props throughout the share page
- **Purpose**: Share links are simultaneously a data flywheel (track which exams are shared, how many views they get, which exams are high quality) and a primary acquisition channel. Serving shared exams is compute-cheap (PDF already generated), so the organic reach is net positive even when a Scholar sub serves many viewers.

### 5.7 Exam Feedback [Paid-Tier Feature]

#### Upload & Grading
- After taking a practice exam, students upload their completed answers as a PDF (digital or scanned handwriting)
- **Costs 1 credit per question graded.** A 12-question exam costs 12 credits to grade. Credits are **only deducted on successful grading** — same principle as generation. If some questions cannot be graded (illegible, ambiguous), the user is charged only for the questions that were successfully graded (positive intent: charge for value delivered).
- Before full grading, a **lightweight sanity check** (fast model) verifies the uploaded content is actually gradeable: is it the right exam? Is the content legible? Is it a completely unrelated document (e.g., a photo of a random object)? If the sanity check fails, the user is informed without being charged and can re-upload.
- **Partial grading is treated as success**: if at least **50% of questions** are successfully graded, the attempt counts as a success (user is charged only for graded questions). Below 50% counts as a failure toward the 3-strike cap.
- **Failure cap**: if the sanity check or grading fails **3 times in a row** for the same exam, grading is automatically disabled for that exam. **The counter resets on any successful grade** for that exam — a transient bad upload doesn't permanently lock anyone out.
- **Lockout fallbacks**: when the 3-strike cap hits, the user sees three options instead of a dead wall:
  1. **"Try a clearer scan"** — with camera tips for lighting, angle, and focus
  2. **"Type your answers instead"** — a simple web form using the stored plain-text questions, so users with messy handwriting always have a path
  3. **"Contact support"** — for genuinely stuck cases
- The **frontier-quality model** always grades attempts (Scholar and Guru tiers both have access to it for grading, regardless of which tier they're on for generation)
- The model's multimodal capabilities handle scanned handwritten answers natively — it reads handwriting directly from page images and matches each student answer to its corresponding question using visual layout and numbering. If parts of the submission are too messy or ambiguous to grade confidently, the AI flags those specific questions with a warning ("Couldn't read your answer to question 7 clearly — please review") rather than failing the whole attempt.

#### Grading Results
Grading results are presented as an **interactive web page** on the exam detail page (not a downloadable PDF — that's what visual annotation is for):
- Each question is displayed with:
  - The original question text
  - The correct answer and full worked solution
  - The student's answer (extracted from their uploaded attempt)
  - The AI's grade and explanation
- **For Power Mode exams with point values**: The AI assigns points per question, including partial credit where appropriate (e.g., correct approach but arithmetic error). Shows total score out of total possible points.
- **For Standard Mode exams (no point values)**: Each question is graded as correct / partially correct / incorrect, with an explanation of what was right and what was missed.
- Overall summary: percentage score, topic-level performance breakdown, and study recommendations (which content areas to revisit based on weak spots)

#### Multiple Attempts
- Students can upload multiple attempts for the same exam
- Each attempt is stored and graded independently
- The exam detail page shows an **attempt list** with the score for each attempt (e.g., "Attempt 1: 73%", "Attempt 2: 85%"). Users can see at a glance whether they're improving without needing a full longitudinal analytics view.

### 5.8 Visual Feedback [Guru-Tier Feature]

#### Annotated PDF Generation
- **Requires text-based grading (5.7) to have been completed first.** Visual annotation is layered on top of the grading results — without grading, there's nothing to annotate.
- Guru users see a **"Generate Visual Annotations"** button on the attempt's grading results page after text grading completes. Clicking it shows the credit cost and confirms before charging.
- **Costs 4 credits per question** on top of the grading cost. A 12-question exam costs 48 credits for visual annotation (plus 12 credits for the text-based grading in 5.7, totaling 60 credits). State-of-the-art image editing is resource-intensive, which is reflected in the higher credit cost.
- Credits are only deducted on successful annotation. **Partial deliveries are charged proportionally**: if the model successfully annotates 7 of 12 pages and fails on the 8th, the user is charged only for the 7 successfully annotated pages (mirrors the grading policy in §5.7).
- Annotation pipeline:
  1. Each page of the student's submitted PDF is converted to an image
  2. A **state-of-the-art image-editing model** edits each image to overlay concise visual feedback: checkmarks, X marks, corrections, margin notes, circled errors
  3. Annotated images are stitched back into a PDF
- Pixel-perfect text rendering is critical so margin notes are legible — this is a primary criterion in model selection. Current model choice is documented in `system_design.md`.
- The annotated PDF is made available for download alongside the text-based feedback
- This is purely a visualization layer on top of the text-based grading — immersive but not a replacement

### 5.9 Exam Library

#### Core Features
- Grid/list view of all previously generated exams
- Each exam card shows: title/topic summary, class tag, date created, question count, status, **bookmark indicator**
- Filter by: class, date range, question style, difficulty, **bookmarked**
- **Search** by topic or title — text search across exam titles, topics, and class names. (At v1, this is token-based prefix matching adequate for typical libraries; the architecture graduates to fuzzy/substring search via Typesense at scale — see `system_design.md` §9.)
- **Bookmarking**: users can star/bookmark exams to mark important ones (e.g., the actual exams they're using for upcoming tests vs. casual experiments). Bookmarked exams have a visual marker and can be filtered to.

#### Bulk Operations
- Multi-select mode in the library: tap a "select" toggle to show checkboxes on every exam card
- Bulk actions on selected exams:
  - **Delete** (with confirmation)
  - **Archive** (hide from default view; archived exams can be unhidden)
  - **Move to class** (assign or reassign the class tag for selected exams)
  - **Bookmark / Unbookmark** (toggle stars in bulk)
- Bulk **share** is intentionally NOT supported (each share link has its own answer-key visibility configuration; bulk would obscure that decision).

#### Per-Exam Actions
- Re-download exam PDF
- Re-download answer key [Scholar/Guru]
- View/upload attempts and feedback [Scholar/Guru]
- Download annotated feedback PDF [Guru]
- Share exam (generate link) [Scholar/Guru]
- **Report this exam** — for users who notice garbled math, broken formatting, or other generation defects that slipped past the Visual QA loop. Submitting a report flags the exam for review and either (a) refunds the generation credits or (b) triggers a free regeneration, at the user's choice. This is the recourse path for the "best-effort PDF at max QA iterations" case.
- Delete exam

#### Generating Exam — Library & Dashboard Visibility
- **In the exam library**: a generating exam appears as a card with a distinct visual state (e.g., shimmer effect, "Generating..." overlay) showing the live per-stage progress tracker inline. Users can click into it to see the full progress view.
- **On the dashboard**: a compact "Exam in progress" widget appears at the top of the dashboard when any exam is generating, with the exam title and a mini progress indicator. Clicking it jumps to the full progress view.
- This ensures users can leave the page, come back later, and always know what's cooking.

#### Exam Detail Page
When a user clicks into an exam from the library, they see:
- **Embedded PDF viewer** — scroll or page through the full exam directly on the page, no download required. For users who just want to review questions without downloading, this is the primary interaction.
- Exam metadata: title, class, date created, question count, education level, difficulty, credits consumed
- **Source materials used** — list of classes, ad hoc files, and manual topics that were used to generate this exam. Provides context and makes the "Create Another Like This" feature more useful.
- Download buttons for exam PDF and answer key (if available per tier)
- Attempt history with grading results (Scholar/Guru)
- Rating prompt (if not yet rated — see 5.11)
- **"Create Another Like This"** button — launches the exam creation wizard at the final configuration step with all settings pre-loaded from this exam (topics, class, question count, styles, difficulty). The user can tweak any parameter before generating, making it easy to create variations (e.g., same topics but different question styles, or more questions).
  - **Tier-aware regeneration**: clone always uses the user's *current* tier model, not the original exam's. So a user who created an exam on Free (Flash model) and later upgraded to Scholar can clone and get a Pro-quality version. This is the canonical path to retroactively get Pro on old Free-tier exams — there is no in-place "regenerate with Pro" action because the non-determinism of generation means the new exam will be different anyway. Clone-and-regenerate is honest about that.
  - **If the source class has been deleted**: Clone is not available. The button is replaced by a graceful explanation: "The class used to create this exam has been deleted, so it can't be cloned. You can create a new exam from scratch." Ad hoc materials are preserved as exam metadata and can be re-used via the standard wizard if the user starts fresh.

#### Empty State
- When a user has no exams, show an encouraging empty state graphic with a prominent CTA to create their first exam
- The empty state should feel inviting, not hollow — communicate the value of what they're about to create

### 5.10 Generation Metadata & Cost Tracking

Every stage of the exam generation pipeline records detailed metadata for cost analysis and optimization:

#### Per-Stage Metadata
Each AI call in the pipeline records:
- **Model used** (Flash or Pro)
- **Input tokens** consumed
- **Output tokens** generated
- **Latency** in milliseconds

#### Per-Exam Metadata
Stored on the exam document after generation completes:
- `generation_metadata.stages[]` — array of per-stage records
- `generation_metadata.total_input_tokens` — sum across all stages
- `generation_metadata.total_output_tokens` — sum across all stages
- `generation_metadata.estimated_cost_usd` — computed from token counts and model pricing (the **cost** side of unit economics)
- `generation_metadata.credits_consumed` — number of credits charged (the **revenue** side of unit economics, at $0.05/credit equivalent)
- `generation_metadata.revenue_usd` — dollar value of consumed credits
- `generation_metadata.margin_usd` — revenue minus cost, per exam
- `generation_metadata.model` — primary model used (Flash or Pro)

These fields enable per-exam profitability analytics. Exams with negative margin are flagged for review so pricing and prompting can be tuned to reduce cost-outliers.

#### Per-User Aggregates
Maintained on the user profile document:
- `total_generation_cost_usd` — cumulative cost of all exams generated
- `total_exams_generated` — count
- `total_credits_consumed` — cumulative credits used
- `avg_cost_per_exam` — running average

#### Cost Estimation
Cost is computed from per-stage token counts and the configured model pricing constants. Specific provider pricing lives in `system_design.md`. The cost-tracking system is provider-agnostic so models can be swapped without code changes.

### 5.11 Exam Rating & Feedback

After exam generation completes successfully, signed-in users of **any tier** are prompted to rate the exam.

#### Rating Prompt
- The rating UI is always accessible as an inline element on the exam detail page when `status === "complete"` and no rating has been submitted
- **5-star rating** (clickable/tappable stars)
- **Optional text feedback** field (multi-line, up to 2000 characters)
- **Not nagware**: the prompt is a passive UI element in the exam library and exam detail page — it does NOT appear as a modal, toast, or forced interruption on each visit. Users discover it organically when they want to leave feedback.
- **"Don't ask again"** dismissal: users can permanently dismiss the rating UI for a specific exam if they don't want to rate it
- Once rated, shows "Thanks for your feedback!" confirmation
- NOT shown for: failed exams, queued/generating exams, anonymous/preview users

#### Data Model
Feedback is stored in **two locations** for different access patterns:

1. **On the exam document** (`users/{userId}/exams/{examId}`):
   - `rating: number` (1-5)
   - `feedbackText: string | null`
   - `ratedAt: timestamp`

2. **Top-level feedback collection** (`feedback/{feedbackId}`) for easy aggregation:
   - `userId: string`
   - `userEmail: string` (NOT anonymized — enables follow-up)
   - `examId: string`
   - `examTitle: string`
   - `rating: number` (1-5)
   - `feedbackText: string | null`
   - `examPdfUrl: string`
   - `tier: string` (user's tier at time of rating)
   - `questionCount: number`
   - `createdAt: timestamp`

#### Privacy
Feedback is explicitly **not anonymized** while the user's account is active — the user's email is stored so the operator can follow up with concerned users. This is disclosed in the rating UI: "Your feedback helps us improve. We may follow up via email."

**On account deletion**: the feedback record itself is preserved for aggregate analytics (ratings, scores, trends remain valuable), but all PII and asset references are sanitized:
- `userId`, `userEmail`, and any other identifying fields are replaced with the literal string `<Account deleted>`
- `examPdfUrl` is **nulled out** (the PDF itself was deleted with the account, so the URL would 404). The admin viewer renders this as "PDF unavailable (account deleted)" instead of a broken link.

This satisfies GDPR deletion requirements while retaining aggregate product-quality signals.

### 5.12 Admin Dashboard

A separate, gated surface of the same app at `${WEB_URL}/admin/*` (path-based during build phase). Provides comprehensive visibility into users, usage/growth metrics, cost analytics, and exam feedback.

**See [admin-prd.md](admin-prd.md) for the full Admin Dashboard PRD.**

Key capabilities:
- **Users**: Search, view, edit tier/credits, view exam history (side panel UX)
- **Usage/Growth**: User growth charts, exam volume, usage patterns, active user metrics
- **Cost**: Per-exam cost analytics, cost by tier/stage/model, spend trends
- **Feedback**: Rating aggregates, time series, individual feedback items with exam PDFs

### 5.13 Dashboard & Home

#### Authenticated Dashboard
- Quick-start exam creation CTA
- Recent exams
- Class overview with material counts
- Usage stats (credits used this month, remaining credits, credits consumed by recent exams)
- Subscription status and upgrade prompts
- Credit balance always visible

#### Welcome Back Panel (Returning Users)
- If a user's `last_active_at` exceeds **30 days**, they see a compact welcome-back panel on the dashboard the next time they log in.
- The panel summarizes what's changed: credits refreshed (or expired), classes archived, last-generated exam, any payment issues. The tone is warm and re-orienting, not anxious.
- Dismissible — appears once per re-engagement window.

#### Early-Exam Quality Recovery
- After each of the user's **first 3 generated exams**, an inline "How was this?" prompt appears on the exam detail page.
- If the user marks the exam as "Not great," they're offered a one-tap **"Refund my credits"** action. The credits used to generate that exam are refunded.
- Rate-limited to prevent abuse: **3 lifetime refunds for Free-tier users**, unlimited for paid users (but flagged for admin review if a user shows a clear refund-farming pattern).
- This builds goodwill at the most fragile moment in the funnel — when a new user has just paid (in credits) for their first impression.

#### Onboarding Flow (New Users)
- After sign-up, new users are guided through a **mobile-app-style onboarding flow** that embeds the exam creation wizard inline:
  1. Welcome screen with brief value proposition
  2. Create their first class (name, institution, education level)
  3. Upload initial materials for that class
  4. Launch their first exam generation (uses the normal 3-step wizard, embedded in the onboarding shell)
- The onboarding is interactive but NOT a forced click-through tutorial — users can skip at any point
- If the user signed up from a preview exam, they skip onboarding and go directly to the full exam view (the preview exam is now unlocked in their library)

#### Scholar Boost Discovery
- The Scholar Boost is **not promoted during onboarding or on the first exam** — new users should experience the Free tier organically first. If they jump straight to the boost, they never know what they're comparing against.
- From the **second exam generation onward**, the boost prompt appears in Step 3 of the wizard (and on any Free-tier exam detail page where it hasn't been used). Users have their full first exam to form an opinion before they're offered the upgrade taste.

#### Empty States
- Dashboard with no exams: encouraging graphic + "Create Your First Exam" CTA
- Dashboard with no classes: encouraging graphic + "Add Your First Class" CTA
- The tone should invite action, not highlight emptiness

#### Settings
A single, unified settings page covering:
- **Profile** — display name, profile picture (avatar), email addresses, linked Google accounts, phone number. Display name and avatar are surfaced on share pages and in feedback records to humanize the platform.
- **Subscription & Billing** — current plan, credit balance, payment methods, upgrade/downgrade, billing history
- **Notifications** — per-event-type opt-in across in-app, email, and SMS channels (see 5.14)
- **Appearance** — light/dark/system theme toggle (see 5.18)
- **Account** — account deletion, data export

### 5.14 Email & SMS Notifications

#### Transactional Emails
- **Welcome email** — sent on account creation
- **Exam ready** — sent when an exam finishes generating (useful if user navigates away during generation). Users can opt into **SMS notification for exam-ready** in their notification preferences (off by default — opt-in only). Useful for mobile users without email push.
- **Payment receipt** — sent on subscription purchase and credit bundle purchase
- **Subscription change confirmation** — sent on upgrade, downgrade, or cancellation
- **Share-link feature change** — sent on tier downgrade, listing share links that will lose their answer keys (with the 7-day grace window — see 5.6)

#### Engagement Notifications
- **Low credits warning** — sent when credits drop below 25 remaining, inviting user to top up or upgrade
- **Grading complete** — sent when an attempt finishes grading (grading is async too; users may navigate away after upload)
- **Payment failure** — sent during grace period with instructions to update payment method (email + SMS since we have their phone number)

#### Notification Preferences
Users manage notification preferences in Settings with **per-event-type granularity**. For each notification type (welcome, exam ready, grading complete, payment receipt, low credits, payment failure, share-link feature change, subscription change), users can toggle delivery via:
- **In-app** (always on — see notification center)
- **Email** (default on for transactional, off for engagement)
- **SMS** (opt-in only, off by default — useful for async events like exam ready and grading complete)

This way users who want maximum signal can enable everything; users who want minimum noise can disable engagement nudges entirely while keeping critical billing/payment alerts.

#### Principles
- All notifications should be concise and actionable
- Never send marketing spam — only transactional and directly useful engagement notifications

### 5.15 Public Pages

The following public-facing pages are in scope for v1:

- **Landing page** — hero, value proposition, product demo/screenshots, social proof, pricing summary, CTAs
- **Pricing page** — detailed tier comparison, credit system explanation, FAQ. Includes an **interactive cost estimator**: the user picks their typical usage (# exams/month, average question count, whether they want grading and visual annotation), and the tool projects monthly cost under each tier. Reduces decision paralysis from the credit math.
- **Terms of Service** — legal terms governing platform use
- **Privacy Policy** — data handling, FERPA/GDPR compliance, AI data usage disclosure
- **Support / Contact** — support portal for refund requests, bug reports, and general inquiries

### 5.16 Referral Program

Users have a unique **referral link** they can share to drive growth. Rewards are tied to genuine engagement — not just sign-ups — to discourage spam.

**Reward structure:**
- **For each friend who signs up via the referral link AND generates at least one exam**: the referrer gets **1 free month of Scholar**
- **For each friend who additionally upgrades to a paid tier (Scholar or Guru)**: the referrer gets **1 free month of Guru** (in addition to the Scholar month from sign-up)

**Mechanics:**
- Referral links are generated in Settings under a "Refer Friends" section
- A live counter shows pending referrals, completed referrals, and earned rewards
- Free months stack: a user with 3 friends who each generated an exam and 1 who upgraded gets 3 months of Scholar + 1 month of Guru
- Free months from referrals are applied as time-credit on top of the user's current subscription (e.g., a Scholar user who earns a Guru month gets bumped to Guru for that month, then drops back to Scholar)
- For Free-tier users, earned months activate the corresponding tier without payment for that period
- Standard fraud detection applies — abusive patterns (self-referrals, throwaway accounts) trigger admin review

The goal is aggressive growth and acquisition; the economics are intentionally generous.

### 5.17 In-App Notification Center

A persistent **notification feed** accessible from a bell icon in the top navigation bar of the authenticated app.

**Notification types displayed in the feed** (mirrors 5.14 events):
- Exam ready, grading complete (async completions)
- Low credits warning
- Payment failures and reminders
- Subscription change confirmations
- Share-link feature changes (e.g., on downgrade)
- Share-link viewer flagged your exam (see 5.6)
- Referral milestones (friend signed up, friend generated exam, friend upgraded)
- Account/security events (new sign-in source linked, etc.)

**Standard interactions:**
- Unread count badge on the bell icon
- Mark individual notifications as read by clicking
- Mark all as read
- Delete individual notifications
- Clear all
- Tap a notification to navigate to the relevant page (e.g., the exam, the billing screen)

In-app notifications are **always on** — the email/SMS preferences in Settings (5.14) only govern out-of-band channels. The notification center is the canonical record.

### 5.18 Theme & Appearance

- **Three modes**: Light, Dark, and System (follows OS preference)
- User's preference is persisted in their account settings
- Dark mode is the recommended default — glassmorphism effects work particularly well with dark backgrounds
- All components must render correctly in both light and dark modes

### 5.19 Test Accounts & Synthetic Data

The autonomous build/test loop creates and tears down many accounts and generates a lot of artifacts that are not real users or real exams. The product must distinguish **synthetic** entities from **organic** ones at every layer — visually, in admin filters, in analytics, and in the tools available to the account.

#### Test Account Flag

Every user record carries a boolean `isTestAccount` flag (default `false`).

- The flag can be set in only two ways:
  1. **Operator action** in the Users tab of admin (toggle on the user detail panel)
  2. **Test signup token** at signup — the signup form accepts an optional `testToken` parameter; if it matches the value of the `TEST_SIGNUP_TOKEN` env var, the new account is created with `isTestAccount: true`
- The flag **cannot** be self-promoted by a regular signup. Without the env-held token, no client request can flip a user to test status.
- The flag is **server-write-only** in Firestore Security Rules — clients can read but never write it.
- In production launch configuration, `TEST_SIGNUP_TOKEN` is unset or rotated to a value not held by anyone, so the test signup path is closed.

#### Visual Indicator (Main Product)

When `isTestAccount === true`, the user-facing app shows:
- A persistent **slim banner** at the top of every page: *"Test account — Developer Panel available."* The banner uses the warning palette (Ember Amber per `DESIGN_PHILOSOPHY.md` §3) so it reads as informational, not a real warning.
- A **"TEST" pill** on the user's avatar wherever the avatar appears (header, profile, share-page byline). Patina Gold border, ink text, all-caps.

Organic accounts see neither.

#### Developer Panel (test accounts only)

A side drawer accessible from a discreet icon in the top nav, **rendered only when `isTestAccount === true` server-side** (the icon literally does not exist in the DOM for organic users — never trust client gating). Capabilities:

- **Self-grant credits** (any amount, with reason note for the audit log)
- **Switch own tier** (Free / Scholar / Guru, with optional override-expiry date)
- **Reset Scholar Boost** (clears `boostUsedAt` and `boostGradingUsedAt`)
- **Force complete or fail any in-flight exam** (testing pipeline failure paths)
- **Fast-forward / reset billing cycle** (testing rollover and renewal)
- **Trigger any notification type** (welcome email, low-credits, etc.) to verify rendering
- **Inject a test webhook payload** (Stripe subscription events, Twilio STOP, etc.)
- **Mass-create exams** (5/10/25 at a time with random configs) for library scale testing
- **Jump to any pre-configured pool account state** (mid-funnel free, depleted credits, returner, etc., per `TESTING.md`)
- **View raw Firestore docs** for own data (read-only Firestore mirror — for debugging)

The Developer Panel is **firewalled by server-side verification** on every action: every server action / API route called from the panel re-checks `requireTestAccount(userId)` against the user record. The client cannot fake this — it is server-trusted state. Organic accounts that somehow trigger a panel route get a hard 404 (not 403, to avoid advertising the surface).

#### Synthetic Data Cascade

Every entity created *by* a test account is automatically tagged `isTestData: true`:
- `exams/{examId}.isTestData`
- `feedback/{feedbackId}.isTestData`
- `attempts/{attemptId}.isTestData`
- `share_links/{shareId}.isTestData`
- All ledger entries on the user's credit ledger
- Any communications sent to the user

The flag is server-written at creation time and immutable afterward. It cascades automatically — the Server Action that creates an exam reads the calling user's `isTestAccount` and sets `isTestData` accordingly.

#### Visual Indicator (Admin)

In the admin dashboard:
- The Users tab shows a **TEST badge** (Patina Gold, all-caps) next to test accounts' emails in the list and detail panel
- The Exams tab shows a TEST marker on test-data rows
- A global filter at the top of every admin tab lets the operator toggle "Hide test data" — defaults to **hidden** (so analytics dashboards don't include synthetic noise) but one click restores them
- The exam search index (Typesense) includes `isTestData` as a facetable field for fast filtering

#### Bulk Test Data Operations (Admin)

In the Configuration tab, the admin has tools to keep test data hygienic:
- **Purge test data**: a one-click action with a typed-confirmation modal that deletes every entity with `isTestData === true`. Preserves the test accounts themselves; just clears their generated artifacts. Mandatory dry-run preview shows the exact count of affected docs across each collection before executing.
- **Purge a specific test account and all its data**: cascade-delete from the user detail panel, with the same dry-run-and-confirm pattern as the bulk version.
- These operations run as background jobs on Cloud Tasks; the operator gets an in-app notification when complete.

#### Analytics Exclusion

All pre-aggregated analytics queries and admin charts exclude `isTestData === true` and `isTestAccount === true` records by default. A toggle on each Analytics sub-tab reintroduces them when the operator wants to see them (e.g., "are my test exams generating successfully? what's my test-pipeline failure rate?"). Exclusion is at the aggregation source — the daily aggregator jobs filter on `isTestData === false` when computing `analytics/daily_*` summaries.

#### Test Account Limits

To prevent test accounts from polluting cost analytics or causing infrastructure surprises:
- A per-test-account exam-generation rate limit (default 100/hour) prevents runaway loops
- A global per-day cap on test-account OpenRouter spend (default $20/day, configurable in admin) — exceeding it returns a 429 with a clear message; legitimate organic generation is unaffected
- Test accounts cannot purchase real Stripe subscriptions in test mode is enough; in production the test-signup path is closed entirely

### 5.20 Customer Feedback, Roadmap & Bug Reports

ExamPull treats product-level customer voice as a first-class surface — distinct from §5.11 (per-exam ratings), which only captures "was *this exam* good?". This section covers product feedback, feature requests, bug reports, the public roadmap, and the changelog. The integration is powered by **Featurebase** (see `system_design.md`), with SSO via Firebase ID token so authenticated users never log in twice.

#### Surfaces

The product exposes four customer-voice surfaces, three of which are public:

| Surface | Public? | Path | Purpose |
|---|---|---|---|
| **Public roadmap** | Public read | `/roadmap` | Shows what's Planned / In Progress / Shipped. Anyone — including unauthenticated visitors — can view. No voting without auth. |
| **Public changelog** | Public read | `/changelog` | Reverse-chronological timeline of shipped changes. "✨ What's New" entries with images/GIFs and brief notes. |
| **Feature request board** | Public read; authenticated write | `/feedback` | Browse requests, see status, see vote counts. Submitting, voting, and commenting require sign-in (prevents anonymous spam). |
| **In-app feedback widget** | Authenticated only | Persistent button | Slide-over from the bottom-right corner of every authenticated page with three tabs: **Suggest a feature**, **Report a bug**, **General feedback**. |

All four are powered by Featurebase under the hood. Users never see the Featurebase brand — surfaces render either embedded inline (the widget, the changelog timeline) or via a customized iframe (the feedback board, the roadmap) with ExamPull styling.

#### In-App Feedback Widget

A persistent floating button (lower-right, with a small `?` icon — "Help & Feedback") opens a slide-over with three tabs:

1. **Suggest a feature** — title + body + optional category tag → submitted to the Featurebase feature board. The user can opt to make it public (default) or private (only the operator sees it).
2. **Report a bug** — title + description + optional steps to reproduce. Browser, OS, viewport, current URL, recent client-side console errors, and the user's tier are auto-attached. Optional screenshot drag-and-drop. The submission **does NOT go to the public board** — it routes directly to the admin Support Inbox (see admin-prd §5.5.7) so bug specifics aren't aired publicly.
3. **General feedback** — open-ended message → routes to admin Support Inbox.

After submission, the user sees a confirmation: *"Thanks — we read every one of these."* For feature requests, they're given a link to view their submission on the public board. For bugs, they see *"We'll get back to you within 2 business days."*

#### Authentication & SSO

Authenticated users SSO into Featurebase via a JWT signed with `FEATUREBASE_JWT_SECRET`:
- The JWT carries: `userId`, `email`, `displayName`, `avatarUrl`, `tier` (as a custom attribute)
- Token TTL: 1 hour, regenerated on each Featurebase load
- The user's display name, avatar, and email surface in their feature request comments
- **`isTestAccount: true`** users are tagged with that attribute on the JWT so the operator can filter test feedback out of the public board (Featurebase supports custom-attribute filters)
- Unauthenticated visitors can read the public roadmap, changelog, and request board — but voting, commenting, or submitting requires sign-in. Clicking any write action prompts a sign-in modal that returns to the same page.

#### Privacy

Only profile-level information flows to Featurebase: display name, avatar URL, email, tier badge. **Never** sent: exam content, class names, materials, attempts, payment data, phone number, or anything beyond the four fields above. This is documented in the privacy policy and disclosed in the SSO consent the first time a user clicks into Featurebase.

#### Notifications

User-side (per the notification preferences in §5.14):
- **Feature request status changed** (e.g., a request the user voted on moves from "Planned" → "In Progress" → "Shipped"): in-app notification + optional email
- **Reply on your submission** (operator or another user comments on a request you submitted): in-app notification + optional email
- **A request you voted on shipped**: a celebratory in-app notification with a link to the changelog entry

Operator-side: bug-report submissions and general-feedback submissions land in the admin Support Inbox (admin-prd §5.5.7) immediately as new tickets with channel = "Featurebase widget" or "Featurebase board." The operator can reply directly from the Support Inbox; the reply posts back to the user via in-app notification + email.

#### Changelog "What's New" Indicator

When the operator publishes a new changelog entry, **authenticated users see a subtle "✨" dot on the Help & Feedback button** until they open it (or until they visit `/changelog`). The dot persists across sessions until acknowledged. Implementation: each changelog entry has a `publishedAt` timestamp; each user has a `lastChangelogSeenAt` field on their user doc; the dot shows when `publishedAt > lastChangelogSeenAt`. Visiting either surface bumps `lastChangelogSeenAt`.

The dot is **never urgent** — soft, low-saturation, easy to ignore. It is not a notification badge with a count; it's an ambient signal.

#### Public Roadmap & Changelog Pages

The `/roadmap` and `/changelog` routes are first-class public pages (joining `/`, `/pricing`, `/terms`, `/privacy`, `/support` per §5.15):
- Marketing-style layout with the atelier ambient backdrop
- Embedded Featurebase iframe (or custom-rendered from Featurebase's API) for the actual content
- Footer link from every public page
- Authenticated app shell adds a "Roadmap" and "Changelog" link in the help menu / footer
- Both pages are crawlable (good for SEO — "exampull roadmap", "exampull changelog" are nontrivial search hits)

#### Distinction from §5.11 (Per-Exam Rating)

| Dimension | §5.11 Per-Exam Rating | §5.20 Product Feedback |
|---|---|---|
| Scope | One specific exam | The product overall |
| Trigger | After exam generation | Anytime, persistent widget |
| Storage | `feedback/{feedbackId}` (top-level) | Featurebase + admin Support Inbox |
| Visibility | Operator-only via admin Feedback tab | Public board (feature requests) or admin-only (bugs/general) |
| Data attached | Exam ID, rating, text | Profile + bug context (browser, etc.) for bug reports |

The two systems do not overlap — `feedback/{feedbackId}` is purely about per-exam quality and feeds the §5.4.4 Quality analytics. Product feedback flows entirely through Featurebase + Support Inbox.

#### Test Account Behavior

Test accounts (per §5.19) can use all four surfaces. Their submissions are tagged `isTestAccount: true` via the SSO JWT custom attribute, so the operator filters them out of the public board view by default. This lets agents exercise the full feedback flow during the build without polluting real customer voice.

---

## 6. Pricing & Monetization

### Credit System

Credits are the universal currency for exam generation, grading, and visual annotation. The unit is designed so all operations use whole numbers — no fractional credits.

- **Generate 1 question** = 2 credits
- **Grade 1 question** = 1 credit
- **Visual annotation for 1 question** = 4 credits
- **Upload an instructor example exam** (generates style guide) = 2 credits

### Tier Structure

| Feature | No Account | Free | Scholar (Pro) | Guru (Max) |
|---------|-----------|------|---------------|------------|
| **Price** | $0 | $0 | $5/mo or $30/yr | $20/mo or $120/yr |
| **Credits/month** | Preview only | 40 | 400 | 4,000 |
| **Max questions/exam** | 3 (preview) | 12 | 25 | 100 |
| **Pro AI model** | No | No | Yes | Yes |
| **Exam PDF download** | No | Yes | Yes | Yes |
| **Answer key** | No | Locked (generated but not viewable) | Yes | Yes |
| **Power mode** | No | No | Yes | Yes |
| **Exam feedback** | No | No | Yes | Yes |
| **Visual feedback** | No | No | No | Yes |
| **Credit rollover** | — | No | No | Yes (up to 1 year) |

### Annual Billing
- Annual subscribers are charged upfront for the full year at a discount ($30/yr for Scholar, $120/yr for Guru). Annual is a 12-month commitment — **no prorated refunds on cancellation**. Cancelling an annual plan retains paid-tier access until the end of the current billing cycle (12 months from purchase).
- Credits are distributed **monthly on a rolling basis** (400/month for Scholar, 4,000/month for Guru) — not granted all at once
- Unused monthly credits expire at the end of each billing cycle (use-it-or-lose-it), except for Guru which rolls over unused credits for up to **1 year**. Guru credits older than 12 months expire.

### Credit Math Example
A 15-question exam costs **30 credits** to generate (15 × 2), **15 credits** to grade (15 × 1), and **60 credits** for visual annotation (15 × 4) — totaling 105 credits for the full experience. Uploading an example exam to a class is a one-time 2-credit cost; that style guide is then applied for free to all future exams in that class.

### Scholar Boost (One-Time Trial)
The Scholar Boost exists **only for Free-tier users** as a free trial of Scholar features. Paid users (Scholar/Guru) have no concept of a "boost" — they already have full access to the features it would unlock.

Every Free-tier account gets a **once-per-lifetime Scholar boost** — a single exam upgraded to Scholar-tier features at zero credit cost. The entire boosted exam is free: generation, answer key, and one round of grading. This lets Free users experience the full Scholar workflow without any scarcity mindset around credits.

**Lifetime tracking**: The account stores `boost_used_at` (timestamp of consumption) and `boost_grading_used_at` (timestamp of the grading round being used). These flags are tracked at the account level, not per-exam, ensuring the boost is truly once-per-lifetime regardless of how many exams the user creates.

What the boost unlocks:
- Pro AI model for higher-quality questions
- Answer key unlocked
- Power Mode available
- Higher question limit (up to 25)
- One round of exam feedback grading (included free — additional attempts require Scholar/Guru subscription)

The boost is offered in two places:
1. **During exam creation** (Step 3) — a subtle prompt: "Boost this exam to Scholar tier for free" with a preview of what unlocks. The user can increase their question count, enable Power Mode, and the exam generates with the Pro model.
2. **On an existing Free-tier exam** (exam detail page) — "Upgrade this exam to Scholar" offers two options:
   - **Unlock features only** (fast, free): Unlock the answer key and enable one round of feedback grading on the existing Flash-generated exam.
   - **Regenerate with Pro** (takes 1-2 minutes, free): Re-run the generation pipeline with the Pro model using the original configuration, producing a higher-quality exam. This replaces the original exam PDF. Useful if the user loved the topic selection but wants Pro-level question quality.
   - Either option consumes the once-per-lifetime boost.

Once used, the boost is consumed and cannot be applied again — except for the regret recovery below.

**Boost scope**: the boost applies Pro-model generation and Scholar features to **one specific exam instance only**. Once that exam is generated (or regenerated), the boost is consumed. Pro-model generation isn't carried over to other Free-tier exams.

**Atomic consumption**: the boost uses an atomic compare-and-swap on a `boost_consumed_at` timestamp. If a user clicks "Boost this exam" in two tabs simultaneously, only the first click consumes the boost; the second click is gracefully informed that the boost is already being applied.

**Regret recovery (24h window)**: if a boosted exam is reported as defective (via "Report this exam" in §5.9) within 24 hours of generation, the boost is refunded — not consumed. This encourages users to actually use the boost without fear of wasting it on a bad output.

### Payment UX for Additional Credits
- Ultra-low-friction payment: single tap/click to purchase, similar to Snapchat streak restore
- **Base rate**: $0.05 per credit
- **Credit packs**:
  - 20 credits for $1 (base rate)
  - 100 credits for $4 (20% savings — $0.04/credit)
  - 240 credits for $8 (33% savings — ~$0.033/credit)
- All pack options always visible — user chooses convenience vs. value
- Credit balance visible in the UI at all times
- Saved payment methods (Stripe Link, Apple Pay, Google Pay) for one-tap repeat purchases

### Conversion Funnel
1. **No account** → experience the product, see blurred preview → sign up
2. **Free tier** → use 40 credits (1-2 exams at 2 credits/question), get value → use Scholar boost to taste Pro features → hit limit → upgrade or buy credits
3. **Scholar** → power users who study frequently, want answer keys + feedback + Pro AI
4. **Guru** → heavy users, multiple courses, want visual annotations + massive credit pool

---

## 7. Design Requirements

### Visual Identity
- **Theme:** Liquid Glass — glassmorphism, 3D elements, translucent surfaces, depth and layering
- **Aesthetic:** Premium, modern, fun — not sterile or corporate
- **Effects:** Cursor interactions, smooth animations, parallax, micro-interactions
- **Typography:** Clean, readable, modern sans-serif (exam PDFs use professional serif fonts)

### Responsive Design
- Fully responsive across mobile, tablet, and desktop
- Dynamic layouts — not just scaled-down desktop views
- Touch-optimized on mobile (drag-and-drop in power mode should work on touch)

### Design System
- Scalable component library from day 1
- Reusable, themed components with consistent glassmorphism styling
- Design tokens for colors, spacing, typography, glass effects
- Three appearance modes: Light, Dark, and System (see 5.18)

### Accessibility
- WCAG 2.1 AA compliance as a baseline
- Glassmorphism effects must not compromise readability (sufficient contrast ratios)
- Screen reader support for all interactive elements
- Keyboard navigation for all flows

---

## 8. Non-Functional Requirements

### Performance
- Exam generation: target < 2 minutes for a 15-question exam (including visual QA)
- Page load: < 2 seconds for initial load, < 500ms for navigation
- PDF download: instant (pre-generated and cached)

### Reliability
- 99.9% uptime for the web application
- Graceful degradation if AI services are slow or unavailable
- Exam generation jobs must be resumable if interrupted
- Concurrent exam generation is supported — jobs run asynchronously in the cloud, so users can navigate away, refresh, or even start another exam while one is generating
- The exam library and dashboard use **real-time database listeners** so exam status updates propagate live across devices and tabs. A user logging in from a second device sees the current state immediately, never stale data.

### Error Handling
- **Never show technical error messages to users.** All errors should be translated into clear, concise, non-technical language.
- **Errors should appear in context** — a file upload error appears on the upload UI, a generation error appears on the generation page, etc.
- **For attention-critical errors**, use toast notifications with clear instructions for what the user can do (retry, contact support, etc.)
- **Monthly limit reached**: graceful toast with invitation to upgrade or purchase credits — no hard blocks or aggressive upsells
- **Generation failure**: reassure user they were not charged, persist all settings, offer one-tap retry (see 5.4)

### Security
- All data encrypted at rest and in transit
- User-uploaded materials are private and never used to train models
- PII handling compliant with FERPA (student data) and GDPR
- Rate limiting on all API endpoints with **exponential backoff** for upstream AI model rate limits
- Abuse prevention: phone verification, credit limits per tier

### Data Retention
- All user data (uploaded materials, generated PDFs, exam metadata, grading results) is stored **indefinitely**
- Users can delete individual exams or materials at any time
- Account deletion triggers a full data wipe of all user-associated data
- **Data export**: Users can request a full export of their data (exams, materials, feedback) for GDPR compliance. Available via the Settings page.

### Language Support
- **English only for v1.** The platform, UI, and exam generation are designed and tested for English.
- Modern multimodal LLMs are inherently multilingual and may produce reasonable results in other languages, but non-English output is not tested, marketed, or officially supported. LaTeX handling of non-Latin scripts introduces additional complexity.
- If organic demand for non-English exams emerges, this can be revisited in a future version.

### Scalability
- Architecture must support 10x growth without re-architecture
- AI costs must scale sub-linearly with user growth (caching, optimization)

---

## 9. Success Metrics

### North Star Metric
**Monthly Credits Consumed** — total question credits used across all users per month (directly measures product value delivery)

### Primary Metrics
| Metric | Target (Month 1) | Target (Month 6) |
|--------|------------------|-------------------|
| Registered users | 500 | 10,000 |
| Monthly credits consumed | 6,000 | 150,000 |
| Monthly exam generations | 200 | 5,000 |
| Free → Paid conversion | 5% | 10% |
| Exam completion rate (gen started → PDF downloaded) | 80% | 90% |

### Secondary Metrics
- Average questions per exam
- Average credits per user per month
- Material upload rate (% of exams using uploaded materials)
- Repeat usage (exams per user per month)
- Visual QA loop iterations (target: <2 avg, indicates LaTeX quality)
- Feedback upload rate (% of Scholar/Guru users who upload attempts)
- Share link generation rate and click-through

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LaTeX compilation errors from AI-generated code | Broken PDFs, bad UX | Visual QA loop catches issues; fallback to simplified formatting; deliver best-effort PDF at max iterations |
| High AI costs per question erode margins | Unprofitable at scale | Per-question credit system aligns cost with revenue; Flash model for free tier; caching; batch API |
| Slow exam generation frustrates users | Churn | Per-stage progress tracker with question-level progress bar; parallel question generation; async cloud processing |
| Students generate copyrighted exam content | Legal liability | Terms of service, content disclaimers, no verbatim reproduction from uploaded materials |
| Phone verification friction reduces signups | Lower conversion | Optimize the verification UX to be fast and seamless (auto-detect, one-tap verify). The friction is an acceptable cost of abuse prevention. |
| AI model quality varies across subjects | Inconsistent exam quality | Subject-specific prompt engineering, user feedback loop, quality monitoring via rating system, ability to swap models per stage via the LLM gateway |
| Video/web link processing edge cases | Failed material ingestion | Enforce video length limits; graceful fallback for inaccessible web pages; clear error messaging |

---

## 11. Future Considerations

These are explicitly out of scope for v1 but should be architecturally accommodated:

- **Native mobile apps** (iOS/Android)
- **Collaborative features** — share exams with study groups, class-wide exam pools
- **Teacher/professor mode** — generate exams for their own classes
- **Exam marketplace** — community-generated exam templates
- **Spaced repetition** — track question-level performance over time, resurface weak areas
- **LMS integration** — Canvas, Blackboard, Google Classroom
- **Offline mode** — PWA with cached exams for offline study
