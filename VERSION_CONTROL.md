# Version Control Guidance

Git is the operator's window into your work. Every commit is a unit of evidence: what changed, why, and what it produced. Treat the history like documentation — it should read cleanly five months from now, when neither of us remembers what was urgent today.

## Your repo

- **Origin**: `https://github.com/Vikram2Agrawal/exampull_cx_5.5`
- **Default branch**: `main` — always deployable, always green
- **Push policy**: push directly to `main` for trivial work; open a PR for anything non-trivial (see below)

## Commit Hygiene

**Atomic commits.** One logical change per commit. A commit that touches the wizard, the admin sidebar, and the LaTeX sanitizer is three commits, not one. The diff should answer one question. Future-you will rebase, revert, and bisect — atomic commits make all three trivial.

**Clean diff stack.** Don't mix:
- Unrelated refactors with the feature they happened next to
- Formatting changes with logic changes (Biome auto-format goes in its own commit)
- Generated files with hand-written code (separate commit for `pnpm setup:stripe` output, etc.)
- Dependency bumps with the work that needed them (run `pnpm add` in its own commit)

**Working tree always clean before pushing.** Run `git status` before every push. No half-staged hunks, no untracked junk, no `console.log` debris.

**Pre-commit gates pass.** `pnpm typecheck`, `pnpm lint`, `pnpm test` all green before you commit. The pre-commit hook enforces this; **do not** bypass it with `--no-verify`. If the hook fails, fix the underlying issue.

## Commit Messages

**Subject line:** imperative, ≤72 chars, no trailing period.
- ✅ `Add tier-aware regeneration to clone flow`
- ❌ `clone updates`
- ❌ `Updated the clone flow so that it now regenerates with the user's current tier model when they click "Create Another Like This"`

**Body: bullets, not paragraphs.** Each bullet is one fact, one decision, or one consequence. The reader scans bullets in 3 seconds; they read paragraphs reluctantly.

```
Add tier-aware regeneration to clone flow

- Clone now uses user's current tier (was: snapshot at original gen)
- Free→Scholar upgrade path: clone gets Pro model automatically
- Updates exam.tierAtGen on the new doc (not the source)
- Added eval coverage: clone-then-grade on a previously-Free exam
```

**Body answers WHY, not WHAT.** The diff shows what changed; the message explains why it changed. "Why" includes: which spec section drove it, what user behavior it fixes, what tradeoff was made, what alternative was rejected and on what grounds.

**Reference the spec.** When a commit implements a PRD/system_design section, cite it: `Implements PRD §5.9 — clone-to-Pro pathway`. When a commit fixes a finding from the test loop, cite the finding ID.

**Breaking changes get a `BREAKING:` line in the body.** Unprompted env var renames, schema migrations, API contract changes — call them out explicitly.

## Branch Strategy

- **`main` is always deployable.** Every commit on `main` should pass the full test suite and be safe to ship.
- **Feature branches** for non-trivial work. Naming: `<scope>/<topic>` in kebab-case.
  - `wizard/upload-validation`, `admin/refunds-tab`, `eval/grading-rubric`
- **One PR per feature branch.** If the branch grows beyond ~500 lines or 10 commits, split it.
- **Rebase before merging** to keep the history linear. Squash-merge is the default; rebase-merge only when each commit on the branch is independently meaningful (rare).
- **Delete branches after merge.** Stale branches are noise.

## Pull Requests

**Description template:**
```markdown
## What
<one-line summary>

## Why
- <reason 1>
- <reason 2>

## How
- <key implementation note>
- <key tradeoff>

## Spec / finding refs
- <PRD §X.Y, finding ID, etc.>

## Evidence
<screenshots, GIFs, eval results, test output — see Artifacts below>

## Risks
- <what could break, what to watch>
```

**Self-review before requesting review.** Open the diff, read every line as if a stranger wrote it. You'll catch the obvious things (left-in console.logs, dead code, sloppy types) before anyone else has to.

**Draft PRs are good.** Open a draft PR as soon as you have a meaningful chunk pushed — visibility for the operator, even if it's not ready to merge.

## Artifacts (commit them, attach them, link them)

A commit or PR with no artifact is a commit on faith. Add evidence:

| Change type | Attach |
|---|---|
| **UI changes** | Screenshots of the rendered surface (light + dark modes, mobile + desktop). Drag-drop into the PR description; GitHub embeds them. |
| **Animations / transitions** | A GIF or short MP4. A still screenshot can't show motion quality. |
| **New flows** | A short video walking through the flow as the persona — better than 10 screenshots. |
| **Bug fixes** | Before / after screenshots or video. Show the bad state, then the good state. |
| **Eval runs** | The `REPORT.md` from `eval-results/<timestamp>/` — link or paste the composite scores. |
| **Test loop findings** | Link to the team-output doc that found it; paste the persona + intention + reproduction recipe. |
| **Schema changes** | Before / after of the affected document shape; migration plan if any data exists. |
| **Performance work** | Before / after Lighthouse or Web Vitals numbers. |

**Where artifacts live:**
- Small images / GIFs (under 10MB): drag into the PR description, GitHub hosts them
- Larger media: upload to the agent's GCS bucket and link from the PR
- Eval reports and test transcripts: keep in-repo under `eval-results/` and `team-output/` (gitignored if they're per-run, committed if they're a baseline)

## Don't

- **Don't commit secrets.** `.env.local`, `.service-account-key.json`, any `*.pem`, any unredacted webhook payloads. The `.gitignore` covers the obvious paths; double-check anything new before staging.
- **Don't commit large binaries.** PDFs, videos, model weights, dataset blobs. Use Cloud Storage and link.
- **Don't `--force` push to `main`.** Ever. Use `--force-with-lease` on feature branches if you must.
- **Don't bypass hooks.** `--no-verify` only when there's a documented reason and a follow-up commit to fix the underlying issue.
- **Don't squash-merge a branch with mixed concerns.** Split the branch first.
- **Don't leave commented-out code.** Delete it. Git remembers.

## Do

- **Commit often.** Small commits compound into clean history. Multi-hour commits compound into rebase pain.
- **Push often.** Every push is a checkpoint. The operator can drop in and see live progress.
- **Tag releases.** When a meaningful chunk ships, tag it: `git tag -a v0.3.0 -m "Wizard step 2 complete; topic extraction live"`. Tags double as Sentry release identifiers (source-map upload uses `git rev-parse HEAD` or the tag).
- **Reference PRD sections, finding IDs, and prior commits** in your messages — the more cross-referenced the history, the easier it is to navigate.
- **Open issues for follow-up work** instead of TODO comments. A TODO rots in the source; an issue stays visible. Close issues when their referenced commits land.

## When Things Go Wrong

- **Commit message wrong on the last commit:** `git commit --amend` (only if not yet pushed).
- **Pushed a bad commit:** revert with a new commit (`git revert <sha>`). Don't rewrite history on `main`.
- **Branch tangled:** rebase onto `main`, resolve conflicts deliberately. If rebase gets ugly, abort and start fresh from `main` with the diff applied manually.
- **Pre-commit hook fails:** read the error, fix the cause, re-stage, recommit. **Never** bypass.
- **Someone (you, in a previous spawn) pushed something that broke main:** revert immediately, then investigate. `main` is sacred; broken `main` blocks everything else.

---

Git history is the project's autobiography. Make it one worth reading.
