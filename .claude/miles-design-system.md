# Miles — Design System & Visual Guidelines

**Product:** Miles — a voice-conversation travel agent. Formerly "Scout."

**What this document is:** A visual and interaction design system — colors, type, spacing, motion, and component patterns. It defines *how things should look and feel*, not what the product does or when features ship. Nothing here should be read as a statement about backend capability, feature scope, or roadmap.

**What this document is not:** A scope document. Do not infer from this doc what's built, what's planned, or in what order. As Miles adds features — a sign-up/login page, checkout, pre-flight check-in, whatever comes after — this system is what an engineer or Claude Code should reference to keep those new surfaces visually and behaviorally consistent with everything that came before. Extend it; don't wait for a new version of this doc before building the next page.

**Aesthetic thesis:** Vintage travel ephemera (stamps, tickets) reinterpreted through a modern, calm, conversational interface. Premium and quiet at the structural level, warm and tactile at moments that deserve it.

---

## 0. The Core Interaction Pattern

Miles' primary surface is a **two-panel, single-view interface** — no page-to-page routing within the conversation itself.

- **Left panel — Conversation.** A persistent mic control and an **ephemeral transcript.** Only the current utterance (human or agent) is shown, live, as it's spoken. When a turn ends, it's replaced by the next — never appended, never a scrollable log.
- **Right panel — The Canvas.** A real-time, read-only surface reflecting what the agent is doing. Content **accumulates** — once something is confirmed in conversation, it collapses into a persistent summary and stays visible while whatever comes next appears beneath it. This is the only place visual state persists; treat it as the always-current record of the conversation.
- **Voice is the only input** on this surface. No text input, no clickable selection — every element in the Canvas is output, not input.

This pattern applies specifically to the **conversation view**. It is not necessarily the pattern for every future page (see Section 10) — a login screen or a checkout form will look and behave differently, but should still be built from the same tokens.

---

## 1. Color System

### 1.1 Brand tokens

| Token | Hex | Role |
|---|---|---|
| `color-ink` | `#232323` | Primary text, dark surfaces, high-contrast UI |
| `color-blue` | `#2743F4` | Primary brand / active state / links / primary actions |
| `color-rust` | `#DD4110` | Secondary accent — emphasis, tags, illustrative accents |
| `color-cream` | `#FFF7E4` | Primary light background — "paper" |
| `color-gray` | `#D9D9D9` | Neutral — dividers, disabled states, borders |
| `color-white` | `#FFFFFF` | Surface white, cards on cream background |

### 1.2 Semantic tokens

| Token | Hex | Role |
|---|---|---|
| `color-success` | `#2F6B4F` | Deep postal green — confirmations, completed states |
| `color-warning` | `#C8862E` | Mustard ochre — pending, attention needed |
| `color-error` | `#B23A2E` | Deep stamp-ink red — failures, declines, unavailable states |
| `color-info` | `#2743F4` | Reuses brand blue — informational notes |

Each gets a `-bg` tint (12% opacity on cream/dark surface) and `-border` (40% opacity), generated programmatically — never hand-picked.

### 1.3 Dark mode

System-wide, applies to every surface this system produces, present or future. Warm near-black, not pure `#000`.

| Token | Hex | Role |
|---|---|---|
| `color-dark-bg` | `#161512` | Primary dark background |
| `color-dark-surface` | `#211F1B` | Card/surface on dark |
| `color-dark-border` | `#38352E` | Dividers, borders on dark |
| `color-blue` (dark variant) | `#5C74FF` | Brighter blue for AA contrast |
| `color-rust` (dark variant) | `#FF6B3D` | Brighter rust for AA contrast |

Semantic colors get the same +15–20% lightness treatment on dark surfaces. Every component is built with tokens — never hardcoded light-mode hex.

### 1.4 Usage rules

- Cream is the default canvas, not white. White lifts cards off cream.
- Blue is the only primary action/state color. Rust is accent-only, never competing with blue in the same view.
- Keep rust and error red visually separated — they're close in hue.

---

## 2. Typography

**Display / Headings:** Bricolage Grotesque (variable). **Body / UI:** DM Sans (variable).

### 2.1 Weight scale

| Role | Bricolage Grotesque | DM Sans |
|---|---|---|
| Light | 300 — large display only | 300 — dense captions |
| Regular | 400 | 400 — default body |
| Medium | 500 — subheads | 500 — emphasized body, labels |
| Semibold | 600 — card titles | 600 — buttons/labels |
| Bold | 700 — section headers | 700 — rare strong emphasis |
| ExtraBold | 800 — hero/display only | not used |

### 2.2 Type scale — Mobile (base, <768px)

| Token | Font | Weight | Size / Line-height |
|---|---|---|---|
| `display` | Bricolage | 800 | 40px / 44px |
| `h1` | Bricolage | 700 | 32px / 38px |
| `h2` | Bricolage | 700 | 26px / 32px |
| `h3` | Bricolage | 600 | 22px / 28px |
| `h4` | Bricolage | 600 | 18px / 24px |
| `body-lg` | DM Sans | 400 | 17px / 26px |
| `body-md` | DM Sans | 400 | 15px / 22px |
| `body-sm` | DM Sans | 400 | 13px / 18px |
| `label` | DM Sans | 500 | 14px / 18px, tracking +1% |
| `caption` | DM Sans | 400 | 12px / 16px |
| `overline` | DM Sans | 600 | 11px / 14px, uppercase, tracking +6% |

### 2.3 Type scale — Desktop (≥1024px, primary target)

| Token | Desktop Size / Line-height |
|---|---|
| `display` | 64px / 68px |
| `h1` | 48px / 54px |
| `h2` | 36px / 42px |
| `h3` | 28px / 34px |
| `h4` | 20px / 26px |
| `body-lg` | 19px / 30px |
| `body-md` | 16px / 24px |
| `body-sm` | 14px / 20px |
| `label` | 14px / 18px |
| `caption` | 13px / 18px |

Implement with CSS `clamp()` between mobile and desktop values — no fixed breakpoint jumps. Desktop is the primary reading target; mobile is the compressed end of the same clamp, not a separate design.

---

## 3. Layout — Desktop-Primary Responsive Frame

### 3.1 The conversation view frame (≥1024px)

```
┌─────────────────────────┬──────────────────────────────────────┐
│  CONVERSATION PANEL      │  CANVAS PANEL                        │
│  (fixed width, 380px)    │  (fluid, scrollable, accumulating)   │
└─────────────────────────┴──────────────────────────────────────┘
```

- **Conversation panel:** fixed `380px` at desktop, does not scroll, vertically centered mic + ephemeral transcript zone.
- **Canvas panel:** fluid width, independently scrollable, `max-width: 920px` content column centered within it on very wide viewports.
- **Divider:** 1px `color-ink` at 8% opacity, full height.
- Outer margin: 32px at desktop.

### 3.2 Tablet (768–1023px)

Conversation panel narrows to `320px`; keep the split unless testing shows it's cramped, in which case collapse to the mobile pattern below at the higher end of this range.

### 3.3 Mobile (<768px)

Vertical stack — the split doesn't work at this width:

- **Conversation panel becomes a fixed top bar:** mic + ephemeral transcript line, `88px` height, pinned to top.
- **Canvas panel becomes the full-width scrollable body** beneath it.

### 3.4 Spacing scale

`4, 8, 12, 16, 24, 32, 48, 64, 96` — all spacing uses these tokens, no arbitrary values.

### 3.5 Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 8px | Chips, tags, status pills |
| `radius-md` | 16px | Cards, result rows, form inputs |
| `radius-lg` | 24px | Summary cards, checkout card, confirmation card, modals |
| `radius-full` | 999px | Mic button, avatar, pills, primary buttons |

### 3.6 Elevation

Thin ink borders (1px, 8% opacity) over drop shadows, consistent with the printed/ephemera material feel. Reserve soft shadow (`0 8px 24px rgba(35,35,35,0.12)`) for the mic button and transient toasts/notifications only.

---

## 4. The Stamp/Ticket Motif

Miles' visual signature. Used deliberately, not as default card styling.

### 4.1 Where it appears

- **Moments of completion or confirmation** — content feeds in top-to-bottom like paper through a printer, ending with a rotated stamp-mark accent. This is the highest-value animated moment in the product; use it sparingly, wherever a conversation reaches a confirmed, complete state.
- **Accumulated summary items in the Canvas** — once something moves from "in progress" to "confirmed," a perforated-edge, ticket-stub treatment marks that transition.
- **Dividers between a confirmed item and the next in-progress activity** — a dotted/perforated rule instead of a plain hairline.

### 4.2 Where it does NOT appear

- The conversation panel — stays completely clean, no ephemera, ever.
- In-progress/not-yet-confirmed states — this treatment is a reward for confirmation, not a default card style.
- Traditional form-based pages (login, checkout inputs) — keep those clean and functional; save the motif for outcome/completion moments even there (e.g., a checkout *success* state can use it; the checkout *form* should not).

### 4.3 Construction rules

- Perforated edges: repeating radial-gradient or SVG mask, never an image file.
- One ephemera treatment per element — don't stack perforation + stamp + die-cut on the same card.
- The print/stamp reveal: spring-eased clip-path or scaleY, ~400–600ms. Reserved for genuine completion moments only.

---

## 5. Imagery & Iconography

- No vector illustration for content imagery. Any photographic content (destinations, places, items being discussed) should be realistic photography or AI-generated equivalent (Higgsfield / Nano Banana), warm-graded to match the palette.
- Functional UI icons (mic, chevrons, checkmarks, status icons) stay simple line-based vector icons — 1.5–2px stroke, rounded caps, 24px grid.
- Generated imagery should be tinted slightly warm/ink rather than dropped in at full uncorrected saturation.

---

## 6. Voice UI — The Conversation Panel

There is no modal or sheet for voice — it's the permanent state of the interface, not a feature that opens and closes.

### 6.1 States

| State | Visual treatment |
|---|---|
| **Idle** | Mic at rest, `color-ink`, no motion. Transcript zone empty or a quiet prompt. |
| **Listening** | Mic transitions to `color-blue`, soft pulsing ring (spring easing). Transcript zone fills word-by-word with the human's current utterance. |
| **Processing** | Mic shows a subtle dot-sequence or waveform-settling animation. Avoid fabricating agent text before it's ready. |
| **Speaking (agent)** | Mic reflects agent audio (waveform). Transcript zone fills word-by-word with the agent's current utterance. |
| **Turn transition** | Transcript zone clears and resets for the next speaker with a quick fade (~150ms) — never an abrupt cut, never an accumulated log. |

### 6.2 Rules

- Never show more than one utterance at a time. No scrollback in the conversation panel.
- Fixed max-height transcript zone, text vertically centered or bottom-anchored, so the panel doesn't jump around with varying utterance length.
- Because nothing persists on the left, all continuity for the user comes from the Canvas — Canvas legibility matters more than usual here.

---

## 7. The Canvas — Real-Time Accumulating Output

The Canvas is a single continuously-updating column, not a set of screens.

### 7.1 Behavior pattern

1. **Activity indicator** — appears when the agent starts working on something. Quiet, text + subtle motion — a narrated background process, not a loading screen.
2. **Option cards** — read-only, surfaced once activity resolves. Show comparison-relevant facts. Zero interactive affordances (no buttons, no hover-to-select styling implying clickability).
3. **On confirmation**, the chosen item **collapses into a compact summary row** with the ticket/stamp treatment (Section 4) and stays visible as a permanent part of the record — it doesn't disappear.
4. **The next activity appears below it.** This is a general accumulation pattern, applicable to however many steps a given conversation involves — this doc intentionally doesn't enumerate what those steps are.
5. **A running summary** of everything confirmed so far should stay visible near the top or in a persistent mini-header within the Canvas — not something the user has to scroll to piece together.

### 7.2 Component types (illustrative, not exhaustive)

- **Activity indicator** — quiet, text + motion, no skeleton-card bombast.
- **Option card** — read-only, comparison facts, no interactive affordance.
- **Confirmed summary row** — compact, ticket-motif, expandable-to-view only (viewing more detail isn't "selecting").
- **Running summary card** — the top-level running total/state of everything confirmed.
- **Completion state** — see 7.3.

### 7.3 Conversation completion state

When a conversation reaches a natural end point, the Canvas should present:
- A **complete summary card** — the ticket/stamp treatment at full expression, presenting everything confirmed during the conversation as one cohesive, finished document.
- A **"Download transcript" action** — a clearly secondary, quiet control (not a primary blue CTA — this is a utility action, not the emotional peak of the interaction). Use an outline/ghost button style (Section 9) with a download icon, positioned near the completion card but visually subordinate to it.

### 7.4 What NOT to build here

- No back buttons, no inline "edit" links, no recovery-UI patterns (like a "try again" button) inside the Canvas — the Canvas reflects conversation state; changes happen through the next spoken turn, not a click.

---

## 8. Component Principles

- Every color, type, spacing, and radius value is a token/CSS variable — never hardcoded.
- Every Canvas component in the conversation view is **read-only output** — if unsure whether something needs an `onClick`, it doesn't, in that context. (This does not apply to future pages built outside the conversation view — see Section 10.)
- One accent color per view-state — don't let blue and rust compete for attention simultaneously.
- Status/state colors follow Section 1.2 exactly — never ad hoc.
- Respect `prefers-reduced-motion` — disable printing/stamp/pulse animations, fall back to simple fades.
- Build components agnostic to *which specific step* they represent — new step types should slot into the existing patterns (activity indicator → option card → confirmed summary row) without a structural rebuild.

---

## 9. Interactive Components (for form-based / traditional pages)

The conversation view has no clickable UI by design — but future pages (sign-up/login, checkout, check-in) will be traditional interactive surfaces and need real components. Define these once now so they're consistent when built:

### 9.1 Buttons

- **Primary:** solid `color-blue`, `color-cream` text, `radius-full`, used for the single most important action on a page.
- **Secondary:** `color-ink` outline, transparent fill, `radius-full`.
- **Ghost/quiet:** no border, `color-ink` at reduced opacity text, used for utility actions (like "Download transcript") that shouldn't compete visually with primary actions.
- **Destructive:** solid `color-error`, `color-cream` text, reserved for irreversible actions only (cancel booking, delete account).

### 9.2 Form inputs

- `radius-md`, 1px `color-ink` at 16% opacity border (unfocused), transitions to 1.5px `color-blue` border on focus — no glow/shadow focus states, keep it flat and inky.
- Label: `label` token, positioned above the field, not as placeholder-only text.
- Error state: border becomes `color-error`, helper text below in `color-error`, `body-sm`.
- Background: `color-white` on the cream canvas, so inputs read as distinct surfaces.

### 9.3 Cards on traditional pages

Same card language as the Canvas (`radius-lg`, thin ink border, cream/white surface) — a checkout summary card, for instance, should feel like a sibling of the Canvas's confirmed summary row, not a different design language.

---

## 10. Guidance for Future Surfaces

This system should extend to whatever Miles adds next. Some starting notes — not commitments, just how to apply the existing tokens:

- **Sign-up / login:** Traditional centered-form page, `radius-lg` card on cream canvas, Section 9 components. No stamp motif on the form itself; a successful account creation is a legitimate moment for a small confirmation treatment if desired.
- **Checkout:** Form inputs (Section 9.2) for payment/traveler details, but the *outcome* (success/failure) should live in the same visual language as the Canvas's completion state (Section 7.3) — this keeps checkout feeling like part of the same product rather than a bolted-on payment page.
- **Pre-flight check-in (or similar future steps):** Likely another Canvas-style accumulating step if it stays conversational, or a traditional form-based flow if it doesn't — either way, pull from Section 9 for any interactive elements and Section 4 for any completion/confirmation moment.

When in doubt on a new surface: reuse tokens exactly, keep the stamp motif reserved for genuine completion moments, and keep interactive vs. read-only components clearly distinguished per the rules in Section 8.

---

*This document supersedes the prior Scout design system. It is a living visual reference, not a scope or roadmap document — update it as new patterns emerge, but don't treat its current contents as a statement of what's built.*
