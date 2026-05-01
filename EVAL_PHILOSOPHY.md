# ExamPull Eval Philosophy

## Why Eval?

ExamPull's core promise is **professional LaTeX-typeset exam PDFs** indistinguishable from real exams. AI generates every question, assembles the LaTeX, and compiles the PDF. Without systematic evaluation, we're flying blind — we don't know if the output is actually good, and we can't compare models or prompts objectively.

The eval system answers three questions:
1. **Does the PDF look professional?** (Visual Quality)
2. **Did the AI follow instructions?** (Adherence)
3. **Are the questions educationally sound?** (Content Quality)

## Scoring Categories

Each generated exam is scored on three dimensions, each 1-10:

### 1. Visual Quality (1-10)
How professional does the rendered PDF look?

- **10**: Indistinguishable from a real university exam. Perfect margins, spacing, typography.
- **7-9**: Minor cosmetic issues (slightly off spacing, suboptimal page breaks) but clearly professional.
- **4-6**: Noticeable problems (text overflow, broken symbols, misalignment) but still readable.
- **1-3**: Major rendering failures (garbled text, missing content, blank pages, compilation artifacts).

Checklist:
- LaTeX compiled without errors (or errors were fixed by repair loop)
- No text overflow or clipping
- Math symbols render correctly
- Consistent formatting throughout (headers, footers, numbering)
- Clean page breaks (no orphaned questions)
- Answer key solutions in clearly demarcated boxes
- Professional header/footer with page numbers
- **Printability: Exam (non-answer-key) copy has adequate blank space for students to write answers, especially for short_answer and long_answer questions. A student should be able to print the PDF and take the exam directly.**

### 2. Adherence (1-10)
Did the output match what the user configured?

- **10**: Exact match on all parameters.
- **7-9**: Minor deviations (e.g., 9 questions instead of 10, one style slightly off).
- **4-6**: Noticeable deviations (wrong difficulty, missing styles, significant question count mismatch).
- **1-3**: Output doesn't match config at all.

Checklist:
- Correct number of questions (or close: ±1 acceptable)
- Requested question styles present (MC, short answer, long answer, etc.)
- Difficulty matches specification (easy/medium/hard)
- Topics covered match input topics
- Title matches or is appropriate
- Total points is reasonable and adds up correctly
- Time recommendation is plausible
- Instructions are clear and complete

### 3. Question & Answer Quality (1-10)
Are the questions educationally sound and the answers correct?

- **10**: Every question is well-crafted, appropriately challenging, and pedagogically valuable. Every answer is correct with clear, complete working.
- **7-9**: Most questions are good; minor issues (one vague question, one incomplete solution).
- **4-6**: Mix of good and problematic questions. Some answers may be wrong or incomplete.
- **1-3**: Questions are vague, trivially easy/impossibly hard, or factually wrong. Answers contain errors.

Checklist:
- Questions are specific and unambiguous
- Difficulty is calibrated to the specified level
- MC options include plausible distractors (not obviously wrong)
- Problems provide all necessary information
- Answers are mathematically/factually correct
- Solutions show complete working (not just final answers)
- Topic coverage is balanced (not all questions on one topic)
- Questions test understanding, not just recall

## Composite Score

**Overall Score** = weighted average:
- Visual Quality: 30%
- Adherence: 25%
- Content Quality: 45%

Content Quality is weighted highest because it's the dimension users care about most — a beautiful PDF with bad questions is worthless.

## Grader Agent

### CRITICAL RULE: NO API-BILLABLE MODELS FOR GRADING

**NEVER add an API-callable LLM SDK (`@anthropic-ai/sdk`, OpenAI SDK, Gemini SDK, etc.) to the eval harness to do grading.** The harness running the build (whichever it is — multiple agents may run in parallel) already has a multimodal-capable model running and a subagent primitive. Use that. Grading must happen as a **fresh-context subagent** of the harness, not as a paid external API call.

This rule has three rationales:
1. **Cost** — the harness's model is already paid for; an external API doubles spend.
2. **Bias avoidance** — using a different model than the one that *generated* the exam (production uses OpenRouter-routed text models per `system_design.md` §4) avoids the same-model-grades-its-own-output failure mode.
3. **Harness-agnosticism** — the eval pipeline must work regardless of which orchestration runtime the operator is using; subagent invocation is the lowest common denominator.

### How Grading Works

Grading is done by **fresh-context subagents** of the harness. Each subagent:

1. Receives the exam config, file paths, and grading rubric in its prompt
2. **Visually inspects** the rendered page images (PNGs) — the harness's model is multimodal and can see the actual exam layout
3. **Reads** the answer key PDF for content verification
4. **Reads** the LaTeX source for structural analysis
5. Returns a JSON score object

### Parallelization

Multiple subagents run in parallel — one per exam config. This is fast and free (already paid for via the harness).

```
# Conceptual flow:
for each exam config:
    spawn subagent → reads PNGs + PDF + LaTeX → returns score JSON
    (all run concurrently)
collect scores → write score files → generate aggregate report
```

### What the Grader Subagent Receives

1. The exam configuration (topics, question count, styles, difficulty)
2. The generated exam page images (PNG — for VISUAL inspection)
3. The generated answer key PDF (for content verification)
4. The raw LaTeX source for both (for structural analysis)

The grader evaluates independently on all three dimensions, provides a score (1-10) for each, and writes a brief justification per score. It also flags specific issues found.

## Eval Dataset

The eval dataset should be diverse across:

### Subjects
- STEM: Linear Algebra, Organic Chemistry, Physics (Mechanics), Computer Science (Algorithms)
- Humanities: US History, Philosophy (Ethics), Literature Analysis
- Social Sciences: Microeconomics, Psychology (Cognitive), Political Science

### Configurations
- Question counts: 3, 5, 10, 15, 25
- Styles: single style (MC only, short answer only), mixed (2 styles), all styles
- Difficulty: easy, medium, hard
- Topics: 1-2 narrow topics, 3-5 moderate, 8+ broad coverage

### Edge Cases
- Very long topic names
- Topics with heavy math notation requirements
- Topics requiring diagrams (should degrade gracefully — no tikz)
- Mixed languages (e.g., foreign language exams with accented characters)

Target: **30+ eval configurations** covering the above matrix.

## Running Evals

### Two-Phase Workflow

Evals run in two phases:

**Phase 1: Generation** (standalone `tsx` script)
```bash
# Generate a single exam
pnpm eval:run --id math-linalg-3q-easy

# Generate quick subset (5 configs)
pnpm eval:run --quick

# Generate full suite (target: 30+ configs covering the matrix below)
pnpm eval:suite

# Force a specific model across all stages for comparison
pnpm eval:suite --model flash
pnpm eval:suite --model pro
```

Required env vars for generation (eval uses the same OpenRouter gateway as production — see `system_design.md` §4):
```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json   # for Firestore read of model routing config + GCS access
GOOGLE_CLOUD_PROJECT=exampull
LATEX_SERVICE_URL=https://latex-service-j27zhukrtq-uc.a.run.app
```

The eval runner imports `lib/ai/client.ts` and `lib/ai/models.ts` from the main app — same code path, same model routing as production, so eval scores are representative.

**Phase 2: Grading** (fresh-context subagents)

After generation, grade within the harness by spawning subagents that visually inspect the page images and read the PDFs. The grading prompt is built by `eval/grader.ts:buildGraderPrompt()`. Each subagent runs in fresh context (no orchestrator state, no prior runs visible) so judgments are independent.

### Output
Each eval run produces:
- `eval-results/{timestamp}/` directory containing:
  - `manifest.json` — run metadata + per-config generation results
  - `{config-id}-exam.pdf` — the generated exam
  - `{config-id}-answer-key.pdf` — the answer key
  - `{config-id}-exam.tex` / `{config-id}-answer-key.tex` — raw LaTeX
  - `{config-id}-page-N.png` — rendered page images (for visual grading)
  - `{config-id}-scores.json` — grader scores + justifications (after grading)
  - `REPORT.md` — aggregate report (after grading)

## Model Benchmarking

Benchmark results (4 comparable configs, 2026-02-25):

| Dimension | 3.1 Pro | 3 Flash | Delta |
|-----------|---------|---------|-------|
| Visual Quality | 7.5 | 8.2 | **+0.7** |
| Adherence | 9.2 | 9.5 | +0.3 |
| Content Quality | 9.2 | 9.2 | 0.0 |
| **Composite** | **8.7** | **9.0** | **+0.3** |
| Avg Gen Time | 114s | 93s | **22% faster** |
| Compile Success | 100% | 100% | Equal |

**Finding: Flash matches or exceeds Pro quality.** Flash produced visually cleaner output (+0.7), matched content quality exactly, and was 22% faster. Pro showed no advantage on any dimension. Flash is the recommended default model.

## Extending to Feedback Features

The same eval framework extends to grading and visual feedback:

### Grading Eval
- Generate exam → generate answer key → create a "student submission" (intentionally with some errors) → grade it
- Evaluate: Are scores fair? Is feedback actionable? Are correct answers identified?

### Visual Feedback Eval
- Same flow as grading eval, but evaluate the visual annotations
- Are annotations placed correctly on the page?
- Are corrections accurate?
- Is the annotated PDF readable?

## Evolution: Model Leaderboard

Long-term, the eval system becomes a model leaderboard:
1. Run the same eval suite against each new Gemini model release
2. Track scores over time
3. Auto-select the best model for each pipeline stage (e.g., Flash for topic extraction, Pro for question generation)
4. Published as a table in this doc with historical data

## Integration with CI

Future: Run a subset of evals (5-10 quick configurations) as part of CI to catch regressions. A composite score drop > 1.0 from the baseline blocks deployment.
