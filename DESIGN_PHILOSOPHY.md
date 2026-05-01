# ExamPull — Design Philosophy

**Version:** 1.0
**Date:** 2026-04-28
**Status:** Foundational — read before touching UI

This document is the source of truth for how ExamPull looks, feels, and behaves visually. It sits alongside `prd.md` (what we build), `system_design.md` (how it runs), and `EVAL_PHILOSOPHY.md` (how we measure exam quality). When an interaction or surface is in question, decisions defer to this document.

It is **opinionated and exclusionary**. A design philosophy that permits everything constrains nothing. Where we say "we don't do X," we mean it.

---

## 1. The North Star

When a student opens ExamPull, they should feel two things at once:

1. **"This is serious."** The product respects their academic stakes. It looks like something a professor would endorse, not a TikTok ad. The exam they download could pass for one their school issued.
2. **"This is mine."** The product feels personal, fast, and a little magical. They are not navigating institutional bureaucracy — they are commanding a private atelier.

If a screen makes them feel like they're on a generic AI productivity app, we've failed. If a screen makes them feel like they're filing taxes, we've also failed. The target is the narrow corridor between **academic gravitas** and **personal craft**.

---

## 2. The Central Metaphor: The Atelier and the Artifact

Every screen in ExamPull is one of two things:

### The Atelier (the app shell)
The workshop where exams are crafted. Translucent, ambient, alive with subtle motion. This is glassmorphism's home: layered surfaces, soft gradients, depth. The atelier is **modern, quiet, slightly mysterious**. It suggests that AI is at work, but it doesn't shout about it.

**Where**: dashboard, library, wizard, settings, billing, marketing — anywhere we host the user.

### The Artifact (the exam itself)
The exam PDF is the real product. It is **paper**, not glass. Serif typography, crisp white surface, formal margins, hairline rules. The artifact looks like a freshly-printed university exam — modern, clean, and finished. The PDF itself compiles to standard white; the in-app rendering matches that so the on-screen artifact and the printed page agree. It does not glow, blur, or animate. It is *finished work*.

**Where**: the rendered PDF, the in-app exam preview, the share-link page, the answer-key sheets, the grading results.

The atelier *produces* the artifact. The contrast between them is the brand. **Glass makes paper.**

This metaphor resolves the most common UI questions:
- *Should this surface be glass or solid?* → Is it part of the workshop, or part of the exam?
- *Should this text be sans or serif?* → Same question.
- *Should this animate?* → If it's atelier, yes (purposefully). If it's artifact, never.

---

## 3. Color System

### The Palette (rationale, not just hex)

We anchor on three brand hues already in the codebase, each with a specific job. We add **Patina Gold** for the premium tier and a neutral **Paper** surface for the artifact to complete the system.

| Role | Token | OKLCH | Used for |
|------|-------|-------|----------|
| **Indigo** (primary) | `--color-brand` | `0.65 0.25 265` | The brand. Primary CTAs, focused inputs, brand identity, links. The color of intelligence and craft. |
| **Surf Teal** (secondary) | `--color-brand-secondary` | `0.70 0.18 195` | Information, neutral data accents, secondary CTAs. The "calm clarity" hue. |
| **Verdant** (success) | `--color-brand-accent` / `--color-success` | `0.72 0.19 155` | Success states, "ready" indicators, completed steps, positive feedback grades. |
| **Patina Gold** (premium) | `--color-premium` *(new)* | `0.78 0.14 75` | Scholar/Guru tier badges, "Pro" labels, the Scholar Boost moment, answer-key unlock. The warm "you've earned this" accent. |
| **Ember Amber** (warning) | `--color-warning` | `0.80 0.18 85` | Cautions, low-credit warnings, payment grace period. |
| **Crimson** (error) | `--color-error` | `0.65 0.24 25` | Destructive actions only — delete confirmations, generation failure, critical errors. |
| **Paper** (artifact surface) | `--surface-paper` *(new)* | `0.99 0 0` | The exam-paper surface — crisp near-white matching printed exam stock. Used wherever exam content is rendered in-app. |
| **Ink** (artifact text) | `--ink` *(new)* | `0.18 0 0` | Body text on Paper. Neutral near-black for clean print parity. |

#### Why these and not others

- **We chose indigo over electric blue or purple-magenta** because indigo carries academic and "premium AI" associations without being the trendy "AI-startup gradient." It's the color of fountain pen ink and Oxford spires.
- **Patina Gold is the most important addition.** Premium tiers need warmth. A second cool color (more purple, more teal) for "Pro" would feel arbitrary. Gold reads instantly as *earned, special, prestige* — which is exactly the emotion we're selling.
- **Paper + Ink** is the *whole* reason we have a brand. If exam content felt like the rest of the app (translucent, glassy, ambient), we would lose our differentiator. The contrast between the dark layered atelier and the crisp white printed artifact is intentional and load-bearing — a *materiality* play. Paper looks finished; glass looks alive.
- **We do not introduce a fourth brand hue.** Three brand colors + premium gold + semantic colors is enough. More would dilute identity.

### Semantic Discipline

Colors carry meaning. Misuse breaks the system.

- **Indigo is for primary actions.** Not decoration. A page should have one indigo "do the thing" button, not three.
- **Verdant means "good."** Don't use it as a secondary brand color or to make a button "pop." If it appears, the user should expect a confirmation.
- **Crimson means "permanent, undoable, or broken."** Never use red for "warning" or "expensive" — that's amber's job.
- **Patina Gold means "Pro."** It is reserved for tier indicators, the Boost flow, and Guru-only features. Using it for ordinary CTAs cheapens it.
- **Surf Teal is the most flexible** — use it as the neutral data hue (charts, info badges, secondary nav highlights) when indigo would dominate.

### Gradients

The hero gradient (`primary → teal → green`) is the **brand gradient** and appears in exactly three places:

1. The headline word-mark on the marketing hero ("Exam-Ready PDFs")
2. The primary CTA on the marketing landing page (subtle, only on hover)
3. The progress ring of the generation tracker (sweeps through the gradient as stages complete)

It does **not** appear on:
- Buttons in the app shell
- Card borders
- Backgrounds (the orb backdrop uses radial gradients, not linear ones)
- Any text inside the authenticated app

This restraint makes the gradient mean something. If it appeared everywhere, it would mean nothing.

### Backgrounds (the Atelier ambient)

Authenticated app and marketing pages share the **ambient orb backdrop**: three slow-drifting radial gradients (indigo, teal, verdant) on a deep indigo-tinted near-black (`--background: oklch(0.13 0.02 265)`). This is the "atelier" lit by ambient light.

- **The orbs animate slowly** (15–20s loop). Faster makes the page feel restless.
- **The orbs sit at low alpha** (0.04–0.18). They suggest depth, not decoration.
- **Light mode** uses a near-white background (`oklch(0.985 0 0)`) with the same orbs at lower alpha. Glass still works in light mode, just more subtly.

### Light vs. Dark Mode

**Dark mode is the default.** Glass is dramatic on dark, restrained on light. New users land in dark mode unless their OS prefers light or they switch.

Both modes are first-class — every component must render correctly in both. But our visual identity is *first* a dark-mode identity. Marketing screenshots, OG images, social previews are all dark.

Light mode is a **respectful courtesy** for users who need it (low-light sensitivity, reading in bright sun, institutional preference). It is not the showcase.

---

## 4. Typography

Typography is where the atelier/artifact split is most visible.

### The Atelier voice — Sans
**Geist Sans** for everything in the app shell. It's geometric, neutral, and works in both display and body sizes. Already loaded.

- **Display** (hero, h1): 48–72px, tight tracking (-0.02em), 600–700 weight
- **Headings** (h2, h3): 24–36px, normal tracking, 600 weight
- **Body**: 14–16px, normal weight, 1.55 line-height
- **Caption / metadata**: 12–13px, muted color, normal weight
- **Numerics in UI** (credit counts, prices, scores): use **tabular figures** (`font-variant-numeric: tabular-nums`). When numbers change, columns shouldn't shift.

### The Artifact voice — Serif
**Source Serif 4** (or Crimson Pro as alternate) for exam content rendered in the app. This is the "paper" voice.

- **Where it appears in-app**: the embedded exam preview, the "first page rendered" image on the share page, the in-app grading results when displaying the original question text, the example exam thumbnails on the class page.
- **Where it appears in the PDF**: the actual LaTeX output uses Computer Modern (LaTeX's native serif), which reads as the academic gold standard. The web-side serif is a *visual cousin*, not a perfect match — that's fine.
- **Why Source Serif over EB Garamond or Crimson Text**: Source Serif is open-source, has wide weight range, and reads cleanly at small sizes — it works on screens, where Garamond gets thin.

### The Mono voice — accent only
**Geist Mono** for: credit costs in flight ("Generate — 30 credits"), inline code in tooltips, math snippets in helper text, the LaTeX preview in the rare case we surface it. Mono is a flavor accent — never used for body copy.

### Hierarchy rules

- **A page has one h1.** The h1 sets the orientation. If you have two h1s, you have two pages.
- **Headings get space above, not below.** A heading belongs to the content under it.
- **Don't use color for hierarchy.** Use weight and size. Color is for *meaning*, not *importance*.
- **Resist all-caps.** Reserved for: tier badges (PRO, GURU), legal labels (TOS), and section eyebrows on marketing. All-caps in UI feels shouty and 2014.

---

## 5. Surface & Elevation — The Glass System

Glass is our material. It must be *systematic*, not decorative. The elevation tiers below are a contract.

| Tier | Name | Treatment | Use for |
|------|------|-----------|---------|
| **0** | Background | Ambient orbs over deep indigo | The page itself. Never holds content directly. |
| **1** | Panel | `glass` (low blur, subtle border) | Large content containers — the dashboard grid, library shell, wizard frame. |
| **2** | Card | `glass` with hover state | Discrete interactive units — exam cards, class cards, pricing cards, settings rows. |
| **3** | Popover / Dropdown | `glass` with stronger shadow, full opacity at top of stack | Menus, tooltips, command palette. Always rises above tier 2. |
| **4** | Modal / Sheet | `glass-no-blur` with full opacity (visually opaque), strongest shadow, focused | Confirmation dialogs, destructive actions, full-screen mobile sheets. |
| **Paper** | Artifact surface | Solid `--surface-paper` (crisp white), no glass, hairline border, soft neutral shadow with subtle elevation, rounded corners (8–12px). Exam content rendered in-app. Distinct material. See §9 for embedded-PDF treatment. |

### Glass discipline

- **Never stack 3+ glass layers.** A glass card inside a glass panel inside a glass page is fine. A glass tooltip on top of that is the limit. Beyond, the eye loses depth perception and the screen looks soupy.
- **Static content does not need glass.** A paragraph of body text doesn't need a glass card. Reserve glass for surfaces that are *interactive* or *organizational*.
- **Performance matters.** `backdrop-filter: blur` is GPU-expensive. Use the existing `noBlur` variant on:
  - Pages with many simultaneous glass elements (library, dashboard with 20+ cards)
  - Mobile (lower-spec devices)
  - Any case where blur isn't visually load-bearing
- **The border is part of the material.** Glass without its hairline border looks like a transparent rectangle. Never remove the border to "clean it up."

### When NOT to use glass

- The exam preview area (use paper)
- Form input *fields* themselves (use the standard input — putting glass on inputs makes contrast unreliable)
- Marketing copy blocks where readability is the only job
- Anything inside a PDF (obviously)

---

## 6. Spacing, Layout, & Rhythm

### The Spacing Scale
Use Tailwind's default scale (4px base). When in doubt, **add more space**. Cramped = cheap.

- **Inner card padding**: 24px (`p-6`) is the default. 16px (`p-4`) is tight. 32px (`p-8`) is generous. Don't go below 16 or above 48 without a reason.
- **Section gaps on a page**: 64–96px (`py-16` to `py-24`). Marketing pages breathe more (96–128px); app pages breathe less (48–64px).
- **Stack gap (vertical)**: 12px between related elements, 24px between groups, 48px between sections.

### Density

- **Marketing**: spacious. The user is forming a first impression. Whitespace conveys confidence.
- **Dashboard, library, exam detail**: medium. The user is browsing. Comfort matters.
- **Wizard, test builder, settings**: medium-tight. The user is *doing work*. Don't make them scroll for nothing, but don't crowd them either.
- **Forms and modals**: tight. Decision moments. Get out of the way.

### Layout grid
- **Max content width** in the app shell: 1280px (`max-w-7xl`). Wider feels lost.
- **Reading width** for body copy and forms: 640px (`max-w-2xl`).
- **Marketing hero**: 896px (`max-w-4xl`). Tight enough to feel intentional.

### Optical alignment > pixel alignment
A button with an icon and a label needs `gap-2` *and* a slight visual nudge to feel right — trust your eye over the spacing token. The same applies to icons inside buttons (often need a slight downward shift to align with text x-height).

---

## 7. Motion

Motion communicates **state change**, **causality**, and **presence**. It does not entertain.

### Principles

1. **Motion has a purpose.** If you can't say what an animation communicates, it shouldn't exist.
2. **Spring over ease.** Use Framer Motion springs for natural physics. Linear easing is for progress bars and very long durations only.
3. **Fast for response, slow for setting.** UI feedback (button press, hover) should be 150–200ms. Page transitions, settling states should be 300–500ms.
4. **Stagger reveals.** When multiple elements appear, stagger them by 50–100ms. Simultaneous reveals feel computery.
5. **Respect `prefers-reduced-motion`.** Always. Animations should degrade gracefully — opacity transitions instead of transforms, no orb drift, no parallax.

### The motion vocabulary

| Pattern | Used for | Spec |
|---------|----------|------|
| **Lift** | A card receiving hover | Translate Y -2px, shadow grows, border brightens. 200ms ease-out. |
| **Press** | Active button state | Scale 0.98. 100ms. Already implemented in `GlassButton`. |
| **Settle** | Element appearing on the page | Fade + translate Y from 30px → 0. 600ms ease-out, staggered children. Already in hero. |
| **Sweep** | Progress (the generation tracker) | The active stage shows a horizontal shimmer sweep. 1.5–2s loop. |
| **Drift** | Ambient orbs | Slow x/y/scale loop, 15–20s. Already implemented. |
| **Pulse** | Live status indicators (a generating exam in the library) | Soft opacity pulse, 1.5s loop. |
| **Flip** | Toggling theme, switching modes (Standard ↔ Power) | Brief cross-fade with a subtle scale. ~250ms. |

### The Generation Tracker — a special case

The "exam generating" experience is a flagship moment. The PRD calls it a "Domino's pizza tracker, but elegant." This deserves real motion design:

- **Stage chips** light up sequentially: pending (muted) → in-progress (indigo with shimmer sweep) → complete (verdant with check mark)
- **The transition between stages** is a brief glow that travels along the connector line
- **Question-level progress** ("Generating question 7 of 15") uses a subtle counter animation — not a number flip, but a gentle fade as the digit changes
- **Completion** is celebratory but restrained: a single chime-equivalent visual moment (the gradient brand-ring sweeps through indigo → teal → verdant once, then settles)

This is one of the few places we can be a little theatrical. The wait is long; the user deserves a show.

### Motion we will not do

- **Bouncing icons.** Already cliché.
- **Gradient borders that loop.** Distracting.
- **Auto-playing video on the marketing site.** Lazy.
- **Animations longer than 800ms** (except ambient drift and progress sweeps).
- **Confetti.** Even on first exam complete. We're a serious tool. A subtle gradient sweep is the celebration.

---

## 8. Iconography

**Lucide React** is the icon system. One library, consistent stroke weight, broad coverage.

- **Stroke**: 1.5px (Lucide's default `strokeWidth={1.5}` — slightly heavier than 1, lighter than 2; reads as confident without feeling chunky)
- **Size**: 16px in body text, 20px in buttons, 24px in section headers
- **Color**: inherits from text. Don't tint icons unless they're status indicators (the green check, the red X)
- **Don't mix icon libraries.** No Heroicons, no Phosphor, no Tabler. Lucide only.

### When icons appear

- In buttons: when the action is fast-glance important (download, delete, share). Not on every button.
- In navigation: yes, paired with labels.
- As decoration: rarely. An empty state can have one feature illustration, not five tiny icons.

### Custom illustrations

For empty states, onboarding, and the share page, we will eventually want **custom illustrations** that match the atelier aesthetic — geometric, slightly translucent, indigo/teal palette, paper textures where the artifact is referenced. This is a future investment; until then, Lucide + thoughtful composition is enough.

---

## 9. The Exam Artifact in the UI

This is the differentiator. Treat it accordingly.

The artifact is a **crisp white printed page** — the same white the LaTeX-compiled PDF renders in any viewer, the same white students see when their school hands them an exam. What sets the artifact apart from the atelier is **materiality** (solid paper vs. translucent glass) and **typography** (serif on white vs. sans on dark).

The artifact:
- Sits on `--surface-paper` (crisp near-white, neutral)
- Uses serif type (Source Serif 4 in-app; Computer Modern in the LaTeX PDF)
- Displays a hairline border in `--surface-paper-border`
- Casts a soft neutral shadow that suggests slight elevation off the page (just enough to feel like the page is *resting* on the surface below)
- Uses rounded corners (8–12px) — softens the edge against surrounding atelier glass
- Stays static — no continuous animation, no shimmer, no glow. The hover lift in the PDF embed (below) is the only motion the artifact ever has.

### In-app exam previews

When we show exam content inside the app (preview blur, exam detail page, library card thumbnail), the content sits on **Paper** with **serif** type. It is visually a different *material* from the surrounding atelier glass. The contrast says: *this is the real thing, not just an interface element*.

Example treatment for an exam card thumbnail in the library:
```
┌─────────────────────────────┐
│ ░░░ glass card ░░░░░░░░░░░░ │
│ ┌─────────────────────────┐ │
│ │     PAPER THUMBNAIL      │ │  ← solid white, rounded corners,
│ │   "Real Analysis Exam"   │ │     soft elevation shadow,
│ │   serif, formal margins  │ │     serif type, hairline border
│ └─────────────────────────┘ │
│ Topic chips · class · date  │  ← back to sans on glass
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────┘
```

### The PDF embed

The exam detail page's embedded PDF viewer (PDF.js or native `<embed>`) appears inside a Paper-bordered frame:
- **Rounded corners** (10–12px on the frame) — softens the rectangle without making it ornamental
- **Soft elevation shadow** — `0 12px 36px oklch(0 0 0 / 0.18)` or similar; a single layer, not a stack
- **Hairline border** in `--surface-paper-border` to delineate the page edge
- **Subtle hover lift** — on hover, increase shadow to `0 18px 48px oklch(0 0 0 / 0.22)` and translate Y by -2px over 200ms; reverts on leave. Communicates "this is a physical thing, you can pick it up." Don't go bigger than this — the artifact does not bounce.
- **Optional 3D tilt on the marketing hero only** — a gentle perspective-tilt (`rotateY(-8deg) rotateX(2deg)`) that leans slightly toward the viewer on cursor proximity, with a long-easing return. Reserved for the hero; never inside the app shell.

Surrounding controls (download, share, generate annotations) are atelier glass — the artifact frame is solid paper, the controls are translucent. The seam is intentional: paper + glass, finished + alive.

### The share page

The share page is mostly artifact. The exam takes the entire above-the-fold real estate, rendered as a paper-faced preview with light atelier accents around it (header, "Customize for yourself" CTA, branding strip at the bottom). Recipients should feel they're looking at a finished exam, not a marketing page. The same elevation + rounded-corner treatment as the embed applies; the page should feel like it's resting on the share page, not painted on it.

### The first-page preview blur (no-account)

The blur overlay on the no-account preview is **a soft fade from clear at the top to opaque white at the bottom** — same white as the page itself, so the redaction reads as "the rest of the page exists, you just can't see it yet" rather than "the page ends here." A subtle indigo wash at the very bottom edge can hint at the brand without breaking the paper-white surface.

---

## 10. Tone & Voice

Microcopy is design. Bad words on a beautiful screen ruin the screen.

### Tone tenets

- **Confident, never cocky.** "Generate exam — 30 credits" not "Let's create something amazing!"
- **Specific, never vague.** "Reading your textbook's table of contents…" not "Processing…"
- **Warm in moments of friction.** When something fails, lead with reassurance. ("You weren't charged. Want to try again?")
- **Quietly witty in low-stakes moments.** The empty library can say "Nothing here yet. Make something." It cannot say "Looks like a ghost town! 👻"
- **Academic-respectful, not academic-dry.** We address students like peers, not like a school portal.
- **Never AI-coded.** No "I" pronouns from the system. No "delve," no "tapestry," no "let me." We are a tool, not a chatbot.

### Microcopy examples

| Bad | Good |
|-----|------|
| "Click here to start your AI experience" | "Generate your first exam" |
| "Oops! Something went wrong 😔" | "Generation failed. You weren't charged — try again?" |
| "Awesome! You're all set!" | "Saved." |
| "Loading magical AI insights…" | "Reading pages 87–142…" |
| "Upgrade now for unlimited power!" | "Scholar unlocks 25-question exams and answer keys. $5/mo." |
| "Are you sure you want to delete this exam?" | "Delete this exam? This can't be undone." |

### The generation experience as voice

Per-stage copy in the generation tracker should be **specific and grounded**:
- "Reading uploaded materials"
- "Drafting test plan"
- "Writing question 7 of 15"
- "Checking visual layout"
- "Final pass"

Not:
- ~~"AI is thinking…"~~
- ~~"Magic is happening…"~~
- ~~"Almost there!"~~

The pizza tracker only works because the steps feel real. Vague steps feel like fake progress.

---

## 11. Component Personality

Specific guidance for the components users touch most.

### Buttons

- **Primary** (indigo, solid): exactly one per primary view. The "do the thing" button.
- **Default** (glass): everything else interactive. Cancel, secondary actions, navigation.
- **Ghost**: tertiary actions (a "× dismiss" on a banner, a "copy link" inline).
- **Danger** (crimson): destructive only. Never use crimson for "premium" or "warning."
- **Premium** (gold, new variant to add): the Boost CTA, "Upgrade to Scholar," answer-key unlock. Solid Patina Gold with deep ink text.
- **Sizing**: `md` is the default. `lg` is for hero CTAs and sticky-bottom mobile actions. `sm` is for inline table actions.

### Inputs

- Solid background, hairline border, soft inner shadow on focus.
- **Focus ring** is indigo, 3px, with a subtle outer halo. Never remove the focus ring "for design." It is the accessibility contract.
- Labels above the input. Placeholders are not labels — they're hints. They disappear when the user types and the user shouldn't have to remember what the field was for.
- Error states: 1px crimson border + crimson helper text *below* the input. No icons on the field itself; the helper text is enough.

### Cards

- Default: glass, 24px padding, 16px radius. Hover: lift + brighter border.
- An exam card is a *specific* component — it includes the paper thumbnail (rounded white surface with serif type and elevation, per §9). Don't reuse the generic card.
- Cards on a grid get a uniform aspect; cards in a list don't.

### Modals & Sheets

- **Modal** (desktop): centered, max-width 480px for confirmations, 640px for forms, 800px for content. Backdrop is a darker, less saturated version of the page background, not pure black.
- **Sheet** (mobile): slides up from the bottom, 90% viewport height max, swipe-down to dismiss. Used for any modal-equivalent on mobile (drag-and-drop replacement, settings, filters).

### Toasts

- **Position**: top-right on desktop, top on mobile (under the header).
- **Variants**: success (verdant accent), info (teal accent), warning (amber accent), error (crimson accent).
- **Duration**: 4s for success/info, 7s for warnings, sticky for errors (user-dismissed).
- **Never use toasts for confirmation of routine actions.** A successful save doesn't need a toast — the saved state is the confirmation. Toasts are for state changes the user might miss.

### The Tier Badge

- Free: no badge.
- Scholar: small pill, Patina Gold border + gold text, transparent fill. Reads as "Pro" without being loud.
- Guru: solid Patina Gold pill, deep ink text. The "Max tier" badge.
- Boost-active exam: a transient indigo→gold gradient pill ("Boosted") that appears on the exam card.

---

## 12. Light & Dark Modes — Practical Notes

- **Test every component in both modes before merging.** A glass card that looks great on dark may have invisible borders on light.
- **Borders are visible** on light mode glass (`oklch(0 0 0 / 0.08)`); on dark, brighter (`oklch(1 0 0 / 0.15)`). Don't use the same alpha.
- **Shadows**: dark mode shadows can be deeper and more saturated; light mode shadows are softer and shorter. Use the existing `--glass-shadow` tokens — don't reinvent.
- **Patina Gold** shifts slightly in dark mode (a touch lighter) to maintain contrast against deep backgrounds.
- **Paper** is the same crisp white in both modes. The artifact doesn't care what mode the atelier is in. On dark backgrounds it reads as a printed page resting in front of you; on light backgrounds the elevation shadow does more of the work to keep the page distinct from the surrounding off-white.

---

## 13. Accessibility as Design

Accessibility is not a separate workstream. It's a quality dimension of the design itself.

### Non-negotiables

- **Contrast**: WCAG AA at minimum. Glass surfaces must be tested with body text against the *worst-case* background behind the glass (a bright orb). If contrast fails, the glass background gets more opaque — design accommodates accessibility, not the other way around.
- **Focus rings always visible.** No exceptions. The 3px indigo ring is the contract.
- **Hit targets**: 44×44px minimum on touch surfaces. Inline text links are exempt (they're semantically distinct).
- **Color is never the only signal.** Errors have icons or text *and* color. Required fields have a label-side asterisk *and* an explanatory message.
- **Motion**: every animation has a `prefers-reduced-motion` fallback. Orbs stop drifting. Progress sweeps become solid bars. Page transitions become fades.
- **Keyboard navigation**: every interaction reachable. Tab order matches visual order. Modals trap focus. Escape closes.
- **Screen reader**: every icon-only button has an `aria-label`. Status changes (a stage completing in the tracker) announce via live regions.

### Reading the exam content

The in-app exam preview must be accessible. The PDF.js viewer surfaces text to screen readers. The Paper surface meets contrast standards trivially (near-white + near-black ink is the highest-contrast pairing in the system).

---

## 14. Responsive Behavior

The PRD requires "dynamic layouts — not just scaled-down desktop views." We honor that.

### Breakpoints (Tailwind defaults)
- `sm` 640px — large phone landscape, small tablet
- `md` 768px — tablet portrait
- `lg` 1024px — tablet landscape, small laptop
- `xl` 1280px — standard desktop
- `2xl` 1536px — large desktop

### Layout shifts that matter

- **Wizard**: desktop is a horizontal stepper with the active step expanded; mobile is a vertical accordion of steps with explicit "next" buttons.
- **Test builder (Power Mode)**: desktop has drag-and-drop with a side rail of question slots; mobile uses tap-reorder mode with explicit up/down arrows (PRD requirement, §5.5).
- **Library**: desktop is a 3–4 column grid; tablet is 2 columns; mobile is a single-column list. Cards adapt — the grid card and the list row are *different layouts of the same card*, not the same component scaled.
- **Exam detail**: desktop has the PDF preview alongside metadata; mobile stacks them with PDF first.
- **Dashboard**: desktop is a multi-region grid (recent exams, classes, usage); mobile is a vertical stack with a sticky CTA at the bottom.

### Touch targets, tap zones
On mobile, **everything interactive is at least 44×44px**, ideally 48×48px. The "select" mode in the library uses generous checkboxes. Drag handles in test builder are large enough to grab.

---

## 15. The Marketing Site as Showcase

Marketing has different rules from the app. It's a **showroom**, not a workshop.

- **More motion, more orbs.** Hero gets the full ambient treatment.
- **More space.** Sections breathe at 96–128px vertical padding.
- **More gradient, more flair.** The brand gradient appears in the hero word-mark, the pricing-tier accent stripes, the section eyebrow text.
- **Real exam screenshots.** The marketing site should show the *artifact* — actual rendered exam pages on the crisp white paper surface, with the elevation shadow and rounded corners that signal "this is a real document." This is the proof. Avoid abstract "AI illustration" stock art.
- **Voice is bolder.** "Turn your notes into exam-ready PDFs" is direct. The app voice is quieter; the marketing voice has more of an edge.

But marketing still respects the philosophy:
- No confetti, no exploding gradients, no stock-photo students laughing at laptops
- The artifact stays artifact (paper, serif) even on the marketing page
- Glass is layered, not piled
- Premium is patina gold, not neon

---

## 16. What We Are Not

The clearest way to define identity is to name what we reject.

- **We are not a Notion clone.** Notion's restraint is admirable, but it's a tool that's proudly utilitarian. ExamPull has product theater — it celebrates the artifact.
- **We are not a generic AI startup.** No "✨ AI-powered" sparkles, no purple-pink-blue auto-gradient, no "we believe in the future of work" language.
- **We are not a children's app.** Even though we serve K–12. The design respects that students of any age recognize seriousness, and they respond to it.
- **We are not enterprise SaaS.** No data-table maximalism, no cluttered information density, no "Book a demo" CTAs.
- **We are not Apple Vision Pro maximalist glass.** Glass is a material, not the show. The exam is the show.
- **We are not Linear.** Linear's monochrome restraint is gorgeous but cold. We have warmth in our brand accents (gold, the indigo→teal→verdant gradient).
- **We are not Duolingo.** No mascot, no streak guilt, no gamified pestering. Practice is its own reward.

---

## 17. Open Questions & Future Work

Things this document deliberately leaves open. Resolve as the product matures.

1. **Custom illustration system** — empty states, onboarding, share page art. Not in scope for v1, but identified as a future investment to deepen brand presence. Until we commission this, the empty states use thoughtful Lucide compositions and copy.
2. **A signature LaTeX moment in the UI** — a small place in the app where we render a tiny actual LaTeX equation that animates as it's typeset (e.g., on the marketing hero, or as a loading flourish in generation). Could be a memorable brand moment. Worth prototyping.
3. **Sound** — completely out of scope for v1. If we ever add sound, the generation-complete moment is the only place to consider it, and even then sparingly.
4. **3D elements** — the PRD permits "3D elements, translucent surfaces." React Three Fiber is in the stack. The bar for using 3D is high: it must be load-bearing, performant on mobile, and not feel like a tech demo. Default is no 3D. A 3D exam-paper that subtly tilts on the hero hover might be the one place worth trying.
5. **Theme variants beyond light/dark** — e.g., a "high contrast" mode for users who need it, or a "focus" mode that strips ambient motion and orbs for deep work in the test builder. Worth considering post-v1.
6. **Per-class accent color** — letting users pick a color for each class (the way Apple Notes lets you color-code folders). Could enrich the library experience and personalize the dashboard. Bounded by the existing palette to preserve identity.

---

## 18. How To Use This Document

- **Before building a new screen**: re-read sections 2 (metaphor), 3 (color), and 11 (components). Most decisions fall out from these.
- **Before merging UI work**: scan the "What we are not" section. If your screen has any of those qualities, fix it.
- **When in doubt**: choose restraint. ExamPull is a confident tool. Confidence shows up as *less*, not more.
- **When updating this doc**: bump the version. Note any tokens added/changed in `app/globals.css` so the design tokens stay in sync.

---

## Appendix A: Tokens to add

These are not yet in `app/globals.css`. Adding them is the first concrete implementation step after this document is approved.

```css
/* Premium tier accent */
--color-premium: oklch(0.78 0.14 75);
--color-premium-hover: oklch(0.74 0.16 75);
--color-premium-foreground: oklch(0.18 0.01 80);

/* The artifact (paper) surface — neutral crisp white, matches printed exam stock */
--surface-paper: oklch(0.99 0 0);
--surface-paper-border: oklch(0.88 0 0);
--ink: oklch(0.18 0 0);
--ink-muted: oklch(0.45 0 0);
--paper-shadow: 0 12px 36px oklch(0 0 0 / 0.18);
--paper-shadow-hover: 0 18px 48px oklch(0 0 0 / 0.22);
--paper-radius: 12px;

/* Serif for in-app artifact rendering */
--font-serif: "Source Serif 4", "Source Serif Pro", Cambria, Georgia, serif;
```

Implementation steps (separate from this doc):
1. Add the tokens above to `app/globals.css`.
2. Add Source Serif 4 via `next/font` in `app/layout.tsx`.
3. Add a `<Paper>` component in `components/surface/` that renders the crisp-white paper surface with serif type, hairline border, rounded corners (`--paper-radius`), and the elevation shadow by default. Hover state lifts the shadow per §9.
4. Add a `premium` variant to `GlassButton`.
5. Refactor existing exam previews and PDF embeds to use `<Paper>`.
6. Audit existing components against §11 (Component Personality) and refactor as needed.
