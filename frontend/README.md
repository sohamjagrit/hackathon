# Handoff: Wayfare — Voice AI Travel Planner

## Overview
An all-in-one, voice-first travel planning app. Users speak to an AI agent that searches flights, hotels, car rentals, and activities, then books and pays for the trip — all through conversation, backed by visual cards that update live.

## About the Design Files
The bundled file (`Travel Planner App.dc.html`) is a **design reference built in HTML** — a working prototype demonstrating layout, states, and interaction timing, not production code to copy directly. The task is to **recreate this design in the target codebase's environment** (React, Vue, native, etc.) using its existing component library, state management, and API patterns — or choose React as a sensible default if no environment exists yet.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final-intent. Voice-state timing (listening/thinking/speaking durations) is illustrative — replace with real timings driven by actual STT/TTS/agent latency.

## Screens / Views

### 1. Home (`page: 'home'`)
**Purpose:** Landing view showing all 4 trip-building categories updating live as the user talks.
**Layout:** Two-column app shell. Left rail 320px fixed, right canvas flex-1. Right canvas: top page-nav tabs, below it a caption/confirm bar, below that a scrollable content area with a 2×2 CSS grid of cards (`gap:16px`, `grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr`), min-height 420px.
**Components:**
- **Trip header**: Instrument Serif italic, 30px, color `oklch(0.3 0.01 75)` (title) + 13px `oklch(0.55 0.01 75)` (subtitle: dates/travelers).
- **4 cards** (Flights, Hotel, Car rental, Things to do) — white background, 1px border (`oklch(0.91 0.01 75)` default, `oklch(0.45 0.09 165)` teal when confirmed), 16px radius, 20px padding. Each has: icon (16px stroke, teal `oklch(0.45 0.09 165)`) + title (14px/600) + optional "Undo" text link (11px, underline, gray) + status badge (pill, 11px/600, color varies by state — see State Management).
  - Idle state: centered placeholder copy in gray (12.5px), e.g. "Say where you're headed to search flights."
  - Data state: primary line 15px/600, secondary line 12.5px gray, price 20px/600, then a full-width action button (pill, 9px vertical padding, teal fill when booked / light gray fill "Book X" otherwise).
  - Things-to-do card uses chip tags (pill, `oklch(0.95 0.012 75)` bg, 12px/500) instead of a price, plus a weather line.
- **Review CTA bar**: appears once all 4 categories are confirmed. Teal (`oklch(0.45 0.09 165)`) full-width rounded bar (14px radius), white text left, white pill button "Review itinerary →" right.

### 2. Itinerary (`page: 'itinerary'`)
**Purpose:** Day-by-day plan review before checkout.
**Layout:** Vertical stack of day cards, `gap:12px`, followed by a right-aligned "Continue to checkout →" button.
**Components:** Each day card: white bg, 1px border `oklch(0.91 0.01 75)`, 14px radius, 16/18px padding, flex row — fixed 56px day-of-week/date column (11px uppercase label + 22px/600 teal date number), 1px vertical divider, then flex-1 city title (14px/600) + plan description (13px, `oklch(0.45 0.01 75)`, line-height 1.6).

### 3. Checkout (`page: 'checkout'`)
**Purpose:** Review cost breakdown and pay via PayPal sandbox.
**Layout:** Max-width 560px column.
**Components:**
- Header: "Checkout" (pre-pay) or "Trip confirmed" with a teal checkmark badge (post-pay), Instrument Serif italic 26px.
- Cost summary card: white bg, bordered, 14px radius, 20px padding, rows of label (13.5px gray) / value (13.5px/500) pairs (Flight, Hotel, Car rental, Activities), divider, then Total row (15px/600).
- **Sandbox notice**: amber/warning-tinted banner (`oklch(0.96 0.03 85)` bg, `oklch(0.85 0.05 85)` border), warning triangle icon, 11.5px text: "Sandbox mode — test payment only, no real charge."
- **Pay button**: PayPal-branded pill button (`#ffc439` bg, black text, 24px radius), logo wordmark styled in PayPal navy/blue italics + "· Pay $X" label.
- **Processing state**: replaces the button with a centered spinner row: "Connecting to PayPal sandbox…" (spin animation, 0.7s linear).
- **Card fallback**: secondary outlined button "Pay with card instead" below the PayPal button.
- **Post-payment**: gray pill row showing "Paid via PayPal (sandbox)" and a mock transaction ID (`SANDBOX-XXXXXX`).

## Interactions & Behavior

### Global shell (persists across all 3 pages)
- **Left rail**: brand header (logo mark + "Wayfare" + tagline) with a mute toggle icon button (top-right of header). Below: scrollable conversation transcript (user bubbles right-aligned teal fill, agent bubbles left-aligned light-gray fill, 14px radius with one corner squared per direction). Below transcript: voice indicator area (waveform bars during "listening", bouncing dots during "thinking"), the mic button, a status label, and (once conversation is complete) a "Start over" button.
- **Top page nav**: 3 tabs (Home / Itinerary / Checkout), active tab has white bg + bottom inset shadow to look "attached" to the content below; inactive tabs are transparent/gray text. Clicking navigates instantly (no animation needed beyond the existing `fadeUp` on page content).
- **Caption/confirm bar**: sits between the page nav and the content area. Three mutually exclusive modes:
  1. **Confirm mode** — shown before any booking action. Large text question (16px/500) + "Not now" (outlined) and "Yes, book it" (teal filled) buttons.
  2. **Speaking mode** — shows the agent's current spoken line as a live caption (16px/500), unless muted.
  3. **Waiting mode** — small gray status text: "Tap the mic to talk to your trip" / "Listening…" / "Thinking…" / "🔇 Agent replied (muted)" / "Conversation complete".

### Voice state machine
Four states drive the mic button and indicators: `idle → listening → thinking → speaking → idle`.
- **Idle**: mic pulses gently (2.2s breathing animation) to invite tapping; teal fill.
- **Listening**: mic solid teal, disabled (no double-taps), 4-bar waveform animates (staggered height keyframes, 0.6s loop).
- **Thinking**: mic turns amber/orange (`oklch(0.7 0.13 55)`), 3-dot bounce indicator (staggered 1s loop).
- **Speaking**: caption bar displays the agent's line; mic stays disabled until the line finishes (timed hold, then returns to idle). If a booking is involved, this is replaced by **Confirm mode** instead of just speaking.
- Mic is disabled whenever `voiceState !== 'idle'`, a confirm is pending, or the whole scripted conversation is done.
- In the reference prototype, one "conversation turn" is a fixed, scripted sequence (mock data) advanced by tapping the mic; **in production this should be replaced by real STT input, an LLM/agent call, and TTS output**, with the same four-state UI wrapping the real audio pipeline.

### Confirm-before-book pattern
Any state-changing/booking action (flight, hotel, car) triggers Confirm mode rather than booking immediately: agent asks a yes/no question in the caption bar; "Yes" applies the change and speaks a confirmation line; "No" cancels and speaks an acknowledgment, leaving prior state untouched. Cards can also be booked directly by clicking their in-card "Book X" button (bypasses the voice confirm, since it's an explicit click).

### Undo
Once a card has data (`found` or `confirmed` status), an "Undo" text link appears next to its title. Clicking it reverts the card to its previous status snapshot (taken automatically whenever a category's status changes).

### Mute
Toggle button in the rail header. When muted, the caption bar suppresses the "speaking" mode. Agent responses still land in the transcript (chat log is not affected by mute — mute only silences the live spoken/caption experience, matching how muting affects audio, not the log).

### Checkout / payment flow
Clicking the PayPal button sets a `processing` state (spinner, ~1.4s in the mock) then resolves to `paid`, which reveals the confirmation header and a mock sandbox transaction ID. Replace the mock timer with a real PayPal Sandbox SDK call (see State Management below).

## State Management
Reference implementation uses local component state (a single class with `setState`); production should likely lift this into whatever state layer the codebase uses (Redux/Zustand/Context/etc.), especially since a real agent backend will drive most of these transitions asynchronously rather than on a fixed script.

Key state variables:
- `page`: `'home' | 'itinerary' | 'checkout'`
- `voiceState`: `'idle' | 'listening' | 'thinking' | 'speaking'`
- `captionText`: string, current caption/confirm question
- `pendingConfirm`: `null | { onYes, onNo }` — presence toggles Confirm mode
- `muted`: boolean
- Per category (`flight`, `hotel`, `car`, `things`): `<key>Status`: `'idle' | 'searching' | 'found' | 'confirmed'`, plus `<key>Prev` (last status, for Undo)
- `payStatus`: `'idle' | 'processing' | 'paid'`, `txnId`: string
- `messages`: derived transcript array built from conversation history (user + agent turns)

State transitions in production should be driven by:
1. Real speech-to-text → agent/LLM call → tool calls (flight/hotel/car/activity search & booking APIs) → text-to-speech, mapped onto the same `idle/listening/thinking/speaking` cycle.
2. Real PayPal Sandbox SDK (`paypal.Buttons()` or REST orders API) replacing the mock `setTimeout` in `pay()` — use PayPal's Sandbox order creation/capture flow and surface the real order ID as `txnId`.

## Design Tokens

**Colors** (all OKLCH, with hex fallback reference):
- Background: `oklch(0.97 0.012 75)` (~`#F6F3EE`, warm off-white)
- Rail background: `oklch(0.985 0.006 75)` (~`#FBFAF8`)
- Primary/teal accent: `oklch(0.45 0.09 165)` (~`#3A6E5E`) — used for CTAs, active/confirmed states, user chat bubbles
- Warm accent (thinking/found states, budget bar): `oklch(0.7 0.13 55)` (~`#D98E4A`)
- Borders: `oklch(0.91 0.01 75)` / `oklch(0.92 0.01 75)` (~`#E6E3DC`)
- Text primary: `oklch(0.22 0.01 75)` (~`#2C2A26`)
- Text secondary/gray: `oklch(0.55 0.01 75)` (~`#8B8880`)
- Sandbox warning banner: bg `oklch(0.96 0.03 85)`, border `oklch(0.85 0.05 85)`, icon/text `oklch(0.55 0.1 70)` (amber family)
- PayPal button: `#ffc439` bg, `#003087` / `#0070ba` wordmark colors, `#111` text

**Typography:**
- Sans (UI/body): Instrument Sans, weights 400/500/600/700
- Display/serif (page titles): Instrument Serif, italic
- Sizes used: 11–11.5px (badges/fine print) · 12–13.5px (secondary text, buttons) · 14–16px (body/emphasis, captions) · 20–22px (prices, dates) · 26–30px (page titles)

**Spacing/radius:**
- Card radius: 14–16px · pill buttons/badges: 20–24px (fully rounded) · rail width: 320px
- Grid/flex gaps: 8–20px depending on density (chip rows 6px, card grid 16px, checkout rows 14px)

**Shadows:** none used flat design; active tab uses an inset bottom shadow trick instead of elevation.

**Motion:**
- `pulse` — mic breathing, 2.2s infinite, box-shadow ring expand/fade
- `bar1/2/3` — waveform bars, 0.6s ease-in-out infinite, staggered
- `dotBounce` — thinking dots, 1s infinite, staggered 0.15s
- `fadeUp` — page content entrance, 0.35s ease, translateY(6px)→0
- `captionIn` — caption bar entrance, 0.25s ease
- `spin` — payment spinner, 0.7s linear infinite

## Assets
No external image assets — all icons are inline SVG (Feather/Lucide-style, 2px stroke, 16–22px). Hotel photo, map, and any real imagery are represented as gray placeholder blocks in the prototype and should be swapped for real photography/map tiles (e.g. Mapbox/Google Maps) in production.

## Files
- `Travel Planner App.dc.html` — full high-fidelity prototype (all 3 pages, voice state machine, confirm flow, PayPal sandbox checkout mock). This is the primary reference.
- `Travel Planner Wireframes.dc.html` — earlier low-fidelity layout exploration (3 directions); included for context on why the split-rail layout was chosen, not needed for implementation.
