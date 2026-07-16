# What we're building — the plain version

*Read this first. The full design doc is `project-guide.md` (DESIGN), and it'll make
a lot more sense after this.*

---

## The idea

There are two halves to this product, and the demo shows both.

**Half one: you book the whole trip by talking.** Open the app in a browser, hit
Talk, and say "I want four days in Cancún next weekend." Flights, hotel, rental
car — you pick everything by voice while the screen fills in live. At the end the
agent books it. A real reservation, in Sabre, with a confirmation number.

**Half two: the travel agent who calls you.** Two days later your flight gets
cancelled. Today that means three hours on hold, and then you realise your hotel
thinks you're arriving Saturday and your rental car is about to be given away.

Instead, your phone rings, and a voice says *"your 2pm to Cancún just got
cancelled — I've already found a way through it."* **One call.** By the time you
hang up, everything is fixed — the flight, the hotel, the car — and you *heard it
happen*, because mid-call the agent put you on a brief hold, phoned the hotel, and
came back with the answer.

---

## Why this wins

Every other team will demo an AI that books a flight. Booking a flight alone isn't
impressive anymore — which is why we book the flight *and the hotel and the car,
into Sabre, for real* in Act 1... and then treat that as merely the setup.

**The real argument is Act 2: the agent handled the things you didn't think to ask
about.**

Nobody calls their travel agent about the rental car. You're panicking about the
flight. The car is the thing you remember at 11pm two days later when it's too
late. An agent that quietly notices the car is broken, and fixes it, and *asks you
first* — that's not a chatbot. That's a person.

**The car is the point.** If you remember one thing from this doc, that's it.

And because Act 1 created a *real booking*, Act 2 is disrupting something true.
The confirmation number the agent reads back on the recovery call is the same one
you watched get created five minutes earlier.

---

## What the demo actually looks like

One video, two acts. Roughly three minutes total.

### Act 1 — "Book it" (~60–90s, browser)

Split screen: the user talking to the browser on one side, the dashboard filling
in on the other.

| | What you hear | What you see |
|---|---|---|
| **1** | "I want four days in Cancún, leaving Friday." | Flight card: loading → four options appear. |
| **2** | "The morning one." → "Got it. Hotels near the beach?" → "Something with a pool, under $200." | Flight card locks in. Hotel options populate. |
| **3** | "The second one. And a mid-size car." | Hotel selected. Car card fills. |
| **4** | "Book it." → "Done — you're confirmed, ABC123. Have a great trip." | Everything flips green. Confirmation number on screen. |

### Act 2 — "The call" (~90–120s, phone)

Title card: *two days later.* Split screen — phone call on one side, dashboard on
the other.

| | What you hear | What you see |
|---|---|---|
| **1** | *(phone ringing)* | The flight card turns red: CANCELLED. Then the hotel and car cards turn amber — **they broke too, and nobody told them.** |
| **2** | "Your 2pm to Cancún just got cancelled. I've already found a way through it — got a minute?" | |
| **3** | "I'd put you on the 6:05am — or there's an 11:40 if you'd rather sleep in." → *"6:05."* | Flight card goes green. Hotel and car immediately recalculate against the new arrival. |
| **4** | "That shortens the hotel to 2 nights. I'll need to call them — okay?" → *"Go ahead."* | Hotel card: pending. |
| **5** | "And I'll move the car to Sunday noon." → *"Yep."* | Car card updates. |
| **6** | "Hold tight for a moment — I'm calling the hotel now." | |
| **7** | *(you hear, faintly, our agent on the phone with the hotel, negotiating — then it comes back)* "All sorted. 2 nights, car at noon, itinerary's in your inbox." | Dashboard shows the hotel call happening live. Then: everything green. |

**The 4 seconds in Act 2 row 1 are doing the heaviest lifting in the whole demo.**
Two cards go amber *before the phone even rings*. That's the entire pitch,
delivered before anyone says a word.

**Row 7 is the moment nobody else will have.** Our agent, mid-call with you, picks
up a second phone and calls a hotel. You'll be playing the hotel front desk, on a
real phone, for real. And it all happens inside **one call** — the agent never
hangs up on the traveler.

---

## How it works

Four moving parts. That's genuinely it.

```
   🖥️ Browser mic (Act 1)      📞 Traveler's phone (Act 2)
            │                          │
            ▼                          ▼
   ┌─────────────────────────────────────────┐
   │  THE VOICE (Vocal Bridge)               │
   │  Talks. Listens. Decides nothing.       │
   │  Knows nothing about travel.            │
   └───────────────────┬─────────────────────┘
                       │  "the user said 6:05 — what now?"
                       ▼
   ┌─────────────────────────────────────────┐
   │  THE BRAIN (our Python)                 │
   │  Decides everything. Books, replans,    │
   │  sequences. Never speaks. Never picks   │
   │  up a phone itself.                     │
   └────────┬───────────────────┬────────────┘
            │                   │
            ▼                   ▼
      ┌──────────┐    ┌──────────────────────┐
      │  SABRE   │    │  THE DASHBOARD       │
      │ Real     │    │  Shows the work      │
      │ flights, │    │  happening, live.    │
      │ hotels,  │    │  Nobody clicks it —  │
      │ cars —   │    │  the camera watches  │
      │ and real │    │  it.                 │
      │ bookings │    └──────────────────────┘
      └──────────┘
```

**The one idea that makes this whole thing work:**

> The voice never decides anything. The brain never speaks.

The voice is a mouth and a pair of ears — in Act 1 it lives in the browser, in
Act 2 it lives in a phone call, and **it's the same brain behind both.** Every
time the voice needs to *know* something or *do* something, it asks the brain.
That's why the dashboard can show you exactly what's happening — every question
passes through us, so we always know where we are.

It also means if the voice dies mid-demo, the dashboard still tells the story.

**And the agent never does anything without a yes.** In Act 1 it confirms before
booking. In Act 2 it stops and asks three separate times. That's not politeness —
it's the difference between a demo and a product. Judges have all seen agents that
book things. Almost nobody demos an agent that provably asks first.

---

## Who does what

We're splitting by **surface** and **brain**. Clean line, no overlap.

### 🎙️ SURFACE — the voice and the visuals

- Set up and tune the three voice agents (the browser planner, the one that calls
  you, the one that calls the hotel)
- Build the dashboard — the cards that go red, amber, green
- **Play the hotel front desk** on the phone, for real
- Record the demo

*Character note for the hotel role: be a slightly annoying front desk. Put our agent
on hold once. Ask one clarifying question. A hotel clerk who says yes immediately
is the tell that it's staged.*

### 🧠 BRAIN — the decisions and the data

- The booking flow: search, selection, and the real Sabre write
- The disruption logic: what broke, what to fix, in what order
- Keeping track of where we are in the conversation
- Feeding the dashboard

**Soham takes Brain.** It's the critical path.

### The one rule

Early on, we sit down together for an hour and write down **exactly how the voice
asks the brain questions** — the list of questions, and what the answers look like.

Then we freeze it.

After that, both of us build independently and it just... fits together at the end.
Skip this hour and we spend the last two hours of the hackathon discovering our two
halves don't speak the same language. This is the single most important hour of the
build and it looks like the least productive one.

---

## How we build it (and why the order is weird)

**We are not building the brain first**, even though it's the most important part.

Here's why: we're *sure* the brain will work. Soham's built that kind of thing over
and over. Being sure is a reason to do it *later*, not sooner.

The scary bits are the joins:
- Can the browser voice agent actually reach our code?
- Can a *phone* agent reach our code?
- Can our code make the agent phone a hotel *mid-call*, while the traveler holds?
- Does Sabre's sandbox let us actually *create* a booking?

**So we prove those things first, with everything else faked.** Fake flight data,
fake logic, one hardcoded sentence. Roughly five hours to answer "is this demo even
possible?" — and then we build the real thing knowing the answer is yes.

The alternative is spending four hours on beautiful logic and finding out at hour
five that the hotel call doesn't work. Then we have nothing.

---

## What could sink us

| | |
|---|---|
| **The rules** | We're planning to build most of this before the hackathon starts. If that's not allowed, we scale back. **We need to ask the organizers today.** |
| **Sabre's write tool** | The whole "real booking" in Act 1 assumes the sandbox MCP server exposes a create-booking tool. If it doesn't, Act 1 falls back to a confirmed itinerary in our own DB — on camera it looks identical, but find out *now*. |
| **Sabre's test data** | If it doesn't have realistic flights for Cancún, we pick a different city. The story doesn't care. Better to find out now than at hour four. |
| **The agent making things up** | The voice might invent a flight time instead of asking the brain. The demo would look *fine* and the data would be fake. This is the scary one because it's silent. |
| **The hold** | The hotel negotiation now plays in real time while the traveler waits. If it drags past ~25 seconds it kills the pacing — the front-desk script has to be tight. |
| **Runtime** | Two acts is ~3 minutes. If the hackathon enforces 2:00, Act 1 compresses into a ~30-second montage. Confirm the limit before storyboarding. |

---

## The four questions to answer today

1. **Are we allowed to build before the hackathon starts?** (Ask the organizers.)
2. **Can we create three separate voice agents?** (Browser planner + traveler caller + hotel caller. Everything depends on it.)
3. **Does Sabre's test data have real flights for our scenario?** (If not, change the scenario now.)
4. **Does Sabre's sandbox expose a booking/write tool via MCP?** (Decides whether Act 1 books for real or into our DB.)

Ninety minutes. All four are yes/no. Everything else waits on them.

---

*Full technical detail: `project-guide.md`. Start with §9 (build order) — it's the map.*
