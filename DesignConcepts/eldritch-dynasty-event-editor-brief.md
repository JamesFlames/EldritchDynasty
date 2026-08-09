# ELDRITCH DYNASTY — Event Editor
## Technology & Technical Design Brief

**Version:** 0.2 (aligned to concept brief v0.2)
**Date:** August 2026
**Status:** Pre-production. **This tool is built before the game.**

> **On this revision.** Concept brief v0.2 added four things the editor must now carry: the **three-purpose rule** for every template, the **player-authored chronicle** (Record / Omit / Embellish and its Discrepancies), the **nine Ledger clauses** on a per-Age schedule, and **nested tales** — accounts of the same event that contradict each other. It also imposed a **voice contract** (`Writing/PatrickRothfussProse.md`). All of that is authoring work, so all of it belongs in the tool. Nothing from v0.1 is removed. New material is marked *(v0.2)*. The honest cost of these additions is in §12.

---

## 1. Purpose

Eldritch Dynasty needs 300–500 event templates to survive a thousand-year run without repetition. Hand-authoring those as raw data files, with no validation and no preview, is the single most likely reason this project fails to ship.

The editor exists to make event authoring a **content task rather than a programming task**, and to make it possible for a non-programmer collaborator to contribute.

### Success criteria
- A new event goes from idea to validated, previewed, committed file in **under 15 minutes**
- Zero runtime crashes caused by malformed event content
- A writer with no TypeScript knowledge can author independently
- Every event can be tested against a synthetic family before it ships
- *(v0.2)* No template reaches `main` without three declared purposes, and no two templates do the same three jobs
- *(v0.2)* Every Ledger clause is assigned, reachable, and provably fires within its Age

---

## 2. Architectural Position

```
eldritch-dynasty/
├── packages/
│   ├── core/          Pure TS simulation. Zero DOM. Seeded RNG. Deterministic.
│   ├── schema/        Zod schemas + generated TS types. SHARED.
│   ├── content/       Event YAML, tales, frame, ledger, spellbooks, heirlooms, Ages.
│   ├── game/          Vue 3 + Electron. The shipped product.
│   └── editor/        Vue 3 + Electron. This document.
└── tools/
    ├── sim-harness/   Headless batch simulation runner.
    └── prose-lint/    (v0.2) Voice-contract checks. Shared by editor and CI.
```

**The critical rule:** `packages/schema` is the single source of truth. The editor validates against it, the game loads against it, and the CI pipeline checks the entire content directory against it. There is no second definition of what an event is.

**The editor imports `core` directly** — the same simulation code the game runs. This is what makes preview trustworthy: the editor is not approximating resolution logic, it is executing it.

pnpm workspaces. TypeScript project references. Vite for both apps.

---

## 3. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Shell | **Electron** | Same runtime as the game. Native filesystem access without a server. One toolchain to maintain. |
| UI | **Vue 3, Composition API, `<script setup>`** | Team familiarity. |
| Language | **TypeScript, strict** | `noUncheckedIndexedAccess` on. |
| State | **Pinia** | Editor state (open document, dirty flags, selection) separate from content state. |
| Validation | **Zod** | Runtime validation *and* static type inference from one definition. |
| Content format | **YAML** | Human-readable, diff-friendly, comment-supporting. JSON is unreadable for prose. |
| YAML parsing | **`yaml` (eemeli)** | Preserves comments and formatting on round-trip. Critical — writers annotate their work and a naive parser destroys it. |
| Text editing | **CodeMirror 6** | Custom syntax highlighting for slot tokens and inline conditions. Lighter than Monaco. |
| Graph view | **`@vue-flow/core`** | For branching event chains *(v0.2: and for the clause/Age schedule board)*. |
| Prose analysis | *(v0.2)* **`compromise`** + hand-written rules | Small, fast, no model download, adequate for POS tagging adverbs and sentence splitting. Runs in the same worker as validation. |
| Testing | **Vitest** | Shared config with core. |

**Explicitly rejected:**
- *Web-based editor with a server* — needs hosting, auth, and sync. Local files and git are better.
- *A Vue GUI over a JSON blob without schema* — the failure mode this tool exists to prevent.
- *Twine or Ink* — excellent for branching prose, wrong for attribute-driven, slot-filled, condition-gated events with mechanical outcomes.
- *Monaco* — 5× the bundle for features not needed.
- *(v0.2) An LLM-based style checker* — non-deterministic, unreviewable in CI, and it would generate disagreement rather than resolve it. The voice contract is checkable with counting rules; count.

---

## 4. The Event Model

### 4.1 Anatomy

```yaml
id: marrow_confrontation_heirloom
title: "The Question of the Seal"
tier: family              # individual | head | family | record | frame
weight: 40
repeatable: false
cooldown_years: 80

tags: [rival, heirloom, regalia, political]

# (v0.2) MANDATORY. Exactly three. Save is blocked below three.
purposes: [change_standing, change_relationship, plant_rumour]

slots:
  HEAD:
    role: head
  CHALLENGER:
    role: family_member
    filters:
      - { attr: age, op: gte, value: 25 }
      - { attr: eldritch_power, op: gte, value: 20 }
      - { relation: not, of: HEAD }
  SEAL:
    role: heirloom
    filters:
      - { class: regalia }

conditions:
  all:
    - { flag: house_marrow_hostile }
    - { respect: gte, tier: regarded }
    - { age_active: not, value: the_crusade }

body: |
  {CHALLENGER} does not raise their voice. That is the frightening
  part. They ask, in front of the assembled house, by what right
  {HEAD} holds {SEAL} — and whether a man whose sons have not
  woken can be said to hold anything at all.

choices:
  - id: strike
    label: "Answer as the Head answers."
    requires:
      - { slot: HEAD, attr: strength, op: gte, value: 55 }
    outcomes:
      - weight: 70
        text: "..."
        effects:
          - { slot: CHALLENGER, set_status: dead }
          - { family: respect, delta: -1 }
          - { slot: HEAD, attr: madness, delta: 5 }
      - weight: 30
        text: "..."
        effects:
          - { slot: HEAD, set_status: dead }
          - { flag: succession_crisis, set: true }

  - id: concede
    label: "Give up the Seal."
    effects:
      - { heirloom: SEAL, transfer_to: CHALLENGER }
      - { family: discontent, delta: -20 }

# (v0.2) What the chronicler asks afterward. Optional; required when
# the event's outcome is something a family would want to lie about.
record:
  subject: "the loss of the Seal"
  options:
    record:
      chronicle: "The Seal passed sideways, and was never fully recovered."
      grants_knowledge: seal_held_by_marrow
      effects: [{ family: respect, delta: -1 }]
    omit:
      chronicle: null            # prints as a dated blank line
    embellish:
      chronicle: "The Seal was given, as a gift, to a lesser cousin of good blood."
      effects: [{ family: respect, delta: 1 }]
      discrepancy: { id: seal_gift_lie, severity: major, provable_by: [house_marrow, church] }

# (v0.2) What the world starts saying.
rumour:
  id: rumour_the_given_seal
  accuracy: 0.4
  spread: 2

# (v0.2) Two accounts, disagreeing. At least two for any consequential event.
accounts: [ballad_of_the_given_seal, marrow_chronicle_fragment_1408]
```

### 4.2 Slots

The heart of the system. A slot is a **query against the living family** at resolution time, resolved by `core` before the event fires.

Roles: `head`, `family_member`, `spouse`, `child`, `sibling`, `cadet`, `unwoken`, `rival_house`, `heirloom`, `spellbook`.

*(v0.2)* **Cast-slot roles**, for the recurring narrative figures in concept brief §16: `tutor`, `rival`, `fragile`, `the_match`, `listener_record`, `listener_blood`. These differ from ordinary slots in one way: **they persist and are re-cast.** When the Tutor dies, `core` selects a new person to occupy the role within a few generations, and event text referencing `{TUTOR}` continues to work. The point is that the family's history rhymes without the author hand-wiring it.

Filters compose over attributes, age, status, Awakening state, career, affinity thresholds, and relations to other slots.

**If any required slot cannot be filled, the event does not fire.** This is the primary mechanism by which the same 400 templates produce different content across different families — a house full of scholars sees a different game than a house full of soldiers.

### 4.3 Conditions

Gate on: active Age, Respect tier, family flags, Ledger year, ascension rung, treasury, library contents, and prior event history.

*(v0.2)* Also on: **clauses recovered**, **open Discrepancies**, **knowledge flags** (what the chronicle actually taught the descendants), and **rumour state**. The knowledge gate is the important one — it is how an omitted ritual cost becomes a descendant repeating the mistake at full price, and it must be as easy to write as any other condition:

```yaml
conditions:
  all:
    - { knowledge: not, value: knows_drowning_cost }
```

### 4.4 Effects

Typed and enumerated — **never free-form script**. This is a deliberate constraint. Scriptable events mean every writer can break the simulation. An enumerated effect vocabulary means the schema can validate every possible outcome.

Categories: attribute deltas, status changes, Madness/Mind adjustments, heirloom transfer, spellbook gain/loss, treasury, Respect, flags, relationship changes, chronicle text injection, and scheduling a follow-up event N years hence.

*(v0.2)* Added categories: `grants_knowledge` / `revokes_knowledge`, `discrepancy` (create, prove, bury), `rumour` (seed, feed, correct), `clause_reveal`, and `recast` (retire and refill a cast slot).

### 4.5 The purposes vocabulary *(v0.2)*

Closed set. Exactly three per template, no repeats within a template.

`advance_clause` · `change_relationship` · `worldbuild_through_action` · `establish_magic_rule` · `test_magic_rule` · `change_standing` · `plant_rumour` · `force_record_choice` · `buy_patience` (i.e. it is funny, warm, or a rest stop)

The vocabulary is deliberately short. A longer list would let an author justify anything, which defeats the purpose of having the rule.

### 4.6 Frame events *(v0.2)*

`tier: frame` is the 2042 layer. It has no slots against the living family — only `listener_record` and `listener_blood` — and it takes a **chronicle query** instead of conditions:

```yaml
tier: frame
reads:
  - { chronicle_entry: seal_gift_lie, state: unproven }
```

Frame events react to what the player wrote. They never dispense systems information, never resolve mechanically, and are held to a tighter prose budget (§6).

---

## 5. Editor Features

### 5.1 Must-have (v1)

**Event list**
Filterable by tier, tags, Age, validation status. Sortable by weight, last modified. Shows orphaned events (unreachable given their conditions). *(v0.2)* Also filterable by purpose, and flags purpose-duplicate clusters inline.

**Slot builder**
Visual filter construction. No hand-written query syntax. Live count: *"41 of 120 test-family members match this slot."* An empty match count is highlighted red — that's an event that will never fire.

**Body editor**
CodeMirror with slot-token highlighting. `{CHALLENGER}` renders as a chip. Typing `{` opens slot autocomplete. Undefined slot references underlined in red as you type.

**Condition builder**
Nested all/any/not groups. Drag to reorder and regroup.

**Choice & outcome tree**
Vue Flow graph. Choices branch to weighted outcomes; outcomes carry effect lists. Weights displayed as percentages and warn if they don't total 100.

**Live preview**
Roll a synthetic family, fill the slots, render the body with real names and real pronouns, execute a chosen branch against `core`, and show a before/after diff of the affected characters. Re-roll button.

**Validation panel**
Continuous. Errors block save; warnings don't.

**Git-adjacent**
Detect uncommitted changes. Show a diff of the YAML before writing. No embedded git client — the tool writes clean files and gets out of the way.

**Purpose picker** *(v0.2)*
Three required dropdowns from the closed vocabulary, at the top of the form, not buried in metadata. Save is blocked below three. The panel shows, live, how many other templates share all three, with links.

**Chronicle preview** *(v0.2)*
Renders the three Record outcomes side by side as they would appear on the chronicle page — including Omit, which must be previewed as the dated blank line, because that blank is a designed artefact and authors need to see it land.

### 5.2 Should-have (v1.1)

**Test families** — hand-crafted fixtures representing edge cases: the Barren Generation, the demigod-stagnant house, the single-survivor line, the 40-member sprawl. Preview against any of them. *(v0.2)* Add two: **the honest house** (recorded everything, poor and knowledgeable) and **the storybook house** (embellished everything, exalted and hollow). Most Record-dependent content only misbehaves against one of those two.

**Coverage report** — which tiers, Ages and ascension rungs are under-served by current content. This directly answers "what should I write next," which is the question that stalls content production.

**Fire-rate simulation** — run 1,000 headless thousand-year sims and report how often each event actually fired. Events that never fire are the silent failure mode of this entire genre.

**Pronoun and grammar preview** — every event rendered against a male-slot fill and a female-slot fill, side by side.

**The clause board** *(v0.2)* — a Vue Flow view of the nine Ledger clauses against the Age table. Each clause must be assigned to at least two Ages (because Age order is seeded and a clause pinned to a single Age is a clause some runs never see). Unassigned clauses and single-assignment clauses are shown red. This one view is the difference between a mystery that pays out and a mystery that doesn't.

**The tale pairs view** *(v0.2)* — every consequential event with its `accounts` listed and a warning where the two accounts do not actually disagree. Two accounts that agree are one account written twice, and the whole nested-tale layer collapses into decoration.

**Prose lint panel** *(v0.2)* — see §6.

### 5.3 Won't-have (v1)

Multi-user real-time collaboration (git handles it). Localisation tooling (defer until content is locked). WYSIWYG typography preview. Embedded audio. *(v0.2)* Automated rewriting or generation of body text — the linter reports, the writer fixes.

---

## 6. The Voice Contract *(v0.2)*

`Writing/PatrickRothfussProse.md` is the style spec. Most of it is a matter of judgement, but a useful minority is countable, and the countable part is where imitation usually fails. `tools/prose-lint` runs those checks in the validation worker and reports in a panel beside the body editor.

**Warnings (allow save):**

| Check | Trigger | Rule it enforces |
|---|---|---|
| Adverb density | `-ly` adverbs > 2.5% of words | Strong verbs over verb+adverb (§5.2) |
| Flat rhythm | Sentence-length standard deviation < 5 | The jagged profile; the long–long–short cadence (§2.1–2.3) |
| No landing | Final sentence of the body > 12 words | Paragraphs land on a short sentence (§2.1) |
| Explained landing | Final two sentences both under 12 words and semantically parallel | Never explain the punch line (§2.1) |
| Archaism | `ere, mayhap, betwixt, whilst, 'twas, forsooth` | Age is carried by content, not grammar (§5.4) |
| Aphorism density | More than one detected aphorism per 250 words | One per two or three screens, maximum (§9.5) |
| Sight-first | A location-establishing body whose first sensory noun is visual | Sound and temperature before sight (§7) |
| Triad inflation | More than one announced triad ("three things…") per file | Reserve triads for structural moments (§3.4) |
| Frame overrun | `tier: frame` body over 120 words, or containing an exclamation mark | The frame is quieter and slower than the tale (§1) |

Section references are to `Writing/PatrickRothfussProse.md`. The panel links each warning to its rule; a writer who has to go and find the rule will instead learn to ignore the warning.

### Substitution checks

Four further checks come from the prose spec's §16, which covers text that is assembled rather than written straight through. They are a different kind of rule from the nine above and worth separating in the panel.

| Check | Trigger | Rule it enforces |
|---|---|---|
| Variable in the landing | The body's final sentence contains a slot token | Landings must be fixed text — a five-syllable name destroys a four-beat close (§16.1) |
| Variable at a paragraph tail | A slot token falls within the last three words of any paragraph | A length change costs least at the head of a sentence and most at the tail (§16.2) |
| Variable in a triad | A slot token inside a sentence containing a three-item coordinated list (`a, b, and c`) | Three items are balanced by the author; a substitution unbalances them (§16.4) |
| Commented magnitude | A numeric-rendering token in a sentence also containing a magnitude word — `fortune, pittance, ruinous, trifling, barely, hardly, scarcely, enough to, more than` | The sentence must survive every value the simulation can produce (§16.5) |

**These four are not taste.** The other nine flag prose a reader might defend; these flag a body that reads perfectly in the editor and breaks at runtime, on some fills, for some families, long after the author has moved on. A writer overruling *Adverb density* is usually right. A writer overruling *Variable in the landing* is asserting that every name the game can generate scans the same way, which is not a thing anyone can know by looking at the template. Weight them accordingly in the panel, and exempt them from the deletion rule in §11.

**One schema dependency.** *Commented magnitude* needs `prose-lint` to know which tokens render numbers rather than names. Mark numeric-valued tokens in the schema when they are introduced; until then the check runs against a hand-maintained token list, which is fine for the first hundred events and not fine for four hundred.

**Nothing here blocks save.** A linter that blocks writers gets disabled within a fortnight. These are counts presented next to the text, and the writer overrules them whenever they are wrong — which will be often, and that is fine. The value is that a template failing six checks at once is genuinely off-voice, and the panel makes that visible in a way a style guide in another folder never will.

---

## 7. Validation Rules

**Errors (block save):**
- Schema violation
- Body references an undefined slot
- Choice requirement references an undefined slot
- Effect targets an undefined slot
- Duplicate event ID
- Outcome weights sum to zero
- Circular follow-up scheduling
- *(v0.2)* Fewer than three declared purposes, or a repeated purpose
- *(v0.2)* A `record` block missing any of the three options
- *(v0.2)* A `discrepancy` with no `provable_by` party
- *(v0.2)* `clause_reveal` naming a clause that does not exist in `content/ledger/`
- *(v0.2)* A knowledge condition referencing a flag no event grants

**Warnings (allow save):**
- Slot matches zero members of every test family
- Outcome weights don't sum to 100
- Event has no tags
- Body under 40 words or over 300
- Conditions are so narrow the event is statistically unreachable
- No choice has a requirement (event has no failure mode)
- *(v0.2)* Shares all three purposes with another template
- *(v0.2)* Consequential outcome (death, sacrifice, heresy, Respect change ≥ 1 tier) with no `record` block
- *(v0.2)* Fewer than two `accounts`, or two accounts with no contradicting fields
- *(v0.2)* Every prose-lint check in §6

Validation runs in a **web worker** on a 300ms debounce. It must never block typing.

---

## 8. File Layout & Conventions

```
packages/content/
├── events/
│   ├── individual/     duels.yaml, awakening.yaml, study.yaml
│   ├── head/           church.yaml, rivals.yaml, succession.yaml
│   ├── family/         plague.yaml, fire.yaml, discontent.yaml
│   └── ages/           crusade.yaml, withering.yaml
├── tales/              (v0.2) songs, doctrine, rival chronicles, rhymes
├── frame/              (v0.2) 2042 interludes
└── ledger/             (v0.2) the nine clauses and their Age assignments
```

One file per thematic cluster, roughly 10–20 events each. Small enough for reviewable diffs, large enough to avoid file sprawl.

**IDs are `snake_case`, globally unique, never renamed after commit** — save files reference them.

### Tale schema *(v0.2)*

```yaml
id: ballad_of_the_given_seal
form: song              # song | doctrine | rival_chronicle | rhyme | play | footnote | charm
teller: "House Marrow's household singers"
bias: hostile           # what the teller wants the listener to believe
about: marrow_confrontation_heirloom
accuracy: 0.3
circulates_from: { years_after_event: 40 }
mutates_every_years: 120
text: |
  ...
```

`teller` and `bias` are **required**. A tale with no teller is the game speaking in its own voice about what really happened, and the design does not permit that.

---

## 9. CI

On every push:

1. `zod` validation across all content — any error fails the build
2. Slot-fillability check against all test families
3. `vitest` on `core` and `schema`
4. Headless fire-rate sim (100 runs, fast profile) — fails if any event fires in under 0.5% of runs
5. Diff coverage report against the previous commit
6. *(v0.2)* **Purpose gate** — any template with fewer than three purposes fails the build; purpose-duplicate clusters are reported, and a cluster of three or more fails
7. *(v0.2)* **Clause gate** — all nine clauses assigned to ≥2 Ages; headless sim reports clause-recovery distribution and fails if the median run recovers fewer than 6 of 9
8. *(v0.2)* **Account gate** — every consequential event has ≥2 accounts with at least one contradicting field
9. *(v0.2)* **Prose lint** — reported as an annotation, never a failure

The fire-rate gate is still the important one. It's the difference between shipping 400 events and shipping 400 events *the player will actually see*. The clause gate is its equal for the narrative spine: it is the difference between a thousand-year mystery and a thousand-year tease.

---

## 10. Build Sequence

| Stage | Deliverable | Est. |
|---|---|---|
| 1 | `schema` package: Zod definitions for event, slot, condition, effect | 1 week |
| 1b | *(v0.2)* Schema for purposes, record blocks, discrepancies, rumours, clauses, tales | 0.5 weeks |
| 2 | Minimal `core`: character model, family model, slot resolution, effect application | 2 weeks |
| 2b | *(v0.2)* Chronicle model: knowledge flags, discrepancy state, rumour propagation, cast-slot re-casting | 1.5 weeks |
| 3 | Editor shell: Electron + Vue, file open/save, YAML round-trip with comment preservation | 1 week |
| 4 | Event list + body editor + validation panel + purpose picker | 1.25 weeks |
| 5 | Slot builder with live match counts | 1.5 weeks |
| 6 | Condition builder | 1 week |
| 7 | Choice/outcome graph | 1.5 weeks |
| 8 | Live preview against synthetic families + chronicle preview | 1.25 weeks |
| 9 | CI pipeline + test family fixtures | 0.5 weeks |
| 10 | *(v0.2)* Clause board + tale pairs view | 1 week |
| 11 | *(v0.2)* `prose-lint` + panel | 0.75 weeks |

**≈14.75 weeks**, against ≈10.5 in v0.1. The v0.2 additions cost roughly **4.25 weeks of tooling**.

Stages 1–2 are not editor work — they are game work you'd have to do regardless. Stage 2b is likewise game work; the chronicle model has to exist whether or not there is an editor. The editor-specific cost is roughly **10 weeks**.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Editor scope creep consumes the project | Hard-freeze at the v1 list. Everything else is a text-editor-and-validate fallback. |
| Schema churn breaks existing content | Version the schema from event #1. Write migrations, never hand-edit in bulk. |
| Slot system too rigid for interesting writing | Prototype 20 real events in raw YAML *before* building the GUI. If the model can't express them, fix the model first. |
| YAML comment preservation fails on round-trip | Verified in stage 3 with a round-trip test suite. If `yaml` can't hold it, fall back to writer-only files with a merge step. |
| Preview diverges from shipped behaviour | Editor imports `core` directly. Never a reimplementation. Enforced by lint rule banning simulation logic in `packages/editor`. |
| *(v0.2)* Purpose rule becomes a box-ticking ritual | Review purposes in the three-reader pass, not in CI. CI can only check that three exist; a human checks that they're true. |
| *(v0.2)* Prose linter breeds resentment or homogeneity | Warnings only, never gates. Review the check list after the first 50 events and delete any rule the writers overrule more than half the time — **except the four substitution checks**, which catch runtime defects rather than taste and are not subject to the vote. |
| *(v0.2)* Record mechanic doubles authoring cost | Real, and unavoidable. See §12 — budget for it explicitly rather than discovering it at event 200. |
| *(v0.2)* Discrepancy state explodes combinatorially | Cap open Discrepancies at 6; oldest unprovable ones decay into settled legend. Verified by headless sim, not by hope. |

---

## 12. The Honest Cost of v0.2 *(new)*

The concept brief's narrative additions are not free, and the increase falls almost entirely on writing rather than engineering.

| Content type | v0.1 budget | v0.2 budget | Why |
|---|---|---|---|
| Event templates | 300–500 | 300–500 | Unchanged |
| Record blocks | — | ~90–150 | Consequential events only, roughly 30% of templates. Each is three short variants |
| Nested tales | — | 60–90 | Two accounts for each of ~35 consequential events, plus ambient songs and doctrine |
| Frame interludes | — | 35–50 | 12–18 fire per run; needs variants so a second run differs |
| Ledger clauses | — | 9 + reveal scenes | Each clause needs a reveal scene per assigned Age: ~20 scenes |

**Net: roughly 200–300 additional authored units, a 40–55% increase in writing.** Against a content burden that was already the project's critical path.

Two mitigations worth taking seriously:

1. **Record blocks are short.** Three variants of one or two sentences each. They cost minutes, not hours, and the editor's side-by-side preview makes them fast. Do not let them be written as full scenes.
2. **Tales are the cheapest content in the game and the most reusable.** A ballad written once mutates across centuries by variant swap, is quotable in other events, and is the game's most screenshot-friendly text. If the budget has to give somewhere, give elsewhere.

If the schedule cannot absorb this, the correct cut is **frame interlude variants** (ship 20, accept some repetition on a second playthrough) — not the clause reveals, which are the spine, and not the Record blocks, which are the thesis.

---

## 13. Prototype First

Before writing a line of editor code: **hand-author 20 events in raw YAML.** Include the hardest ones — the Vessel sacrifice, a Regency succession dispute, a Crusade Madness-concealment scene, a multi-generation follow-up chain.

*(v0.2)* Add five more, chosen because they stress the new model rather than the old one:

21. A **clause reveal** inside an Age, written so it works whether the family is exalted or ruined
22. A **Record choice with no clean option** — the Vessel sacrifice's aftermath
23. A **knowledge-gated repeat** — the Drowning attempted by a family that omitted the cost two centuries ago, written so the text carries the tragedy without the game explaining it
24. **Two contradicting accounts** of event 22, one hostile and one adoring, neither true
25. A **frame interlude** that reads a Discrepancy and reacts to it, in 120 words, with no mechanical resolution

If the data model can express all twenty-five cleanly, build the tool. If it can't, the model is wrong, and finding that out in week one costs nothing.

---

*Related: `DesignConcepts/eldritch-dynasty-concept-brief.md` (v0.2 systems and narrative architecture), `Writing/PatrickRothfussStoryDesign.md` (structural principles), `Writing/PatrickRothfussProse.md` (the voice contract enforced in §6).*
