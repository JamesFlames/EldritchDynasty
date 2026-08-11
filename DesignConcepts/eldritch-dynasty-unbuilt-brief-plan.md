# Implementing the Unbuilt Brief

## Context

`DesignConcepts/eldritch-dynasty-unbuilt-brief.md` is the only written design for twelve
systems that exist in the schema and nowhere else. The pattern across all of them is the
one `docs/FAILURES.md` names as this codebase's signature: a field is declared, saved,
validated, and read by nothing — and the symptom is never a crash, it is a subsystem that
looks like a working feature which has not come up yet.

`AGENTS.md:9` and the brief's own §6 carry the rule this work runs under: **a section is
deleted from the brief the moment it ships.** Every phase below ends with that deletion.

Four decisions were made before sequencing:

- **The record layer goes deep** — a structured `Claim` vocabulary, not entry-state alone.
- **Per-Age clause assignment gets built**, and the CI clause gate ships as the brief specifies.
- **Library first, then the full §14 auction.**
- **Gates and instruments are the first tranche.**

One finding reshaped the order. The claim layer is *not* a shared dependency of four
sections. §5's `reads` example is a discrepancy id and state (`world.discrepancies` at
[world.ts:63](packages/core/src/world.ts:63) — written on every Embellish, saved at
[save.ts:274](packages/schema/src/save.ts:274), **read by nothing**). §1's Record pool
scores off `ChronicleEntry` as it stands. §6's tales key off event ids. Only §3 needs
claims. So claims land in Phase 7, designed against content that exists by then, and the
actual keystone — making discrepancies readable — moves to Phase 2 at about thirty lines.

---

## The highest-risk surface, stated once

`ModifierS` ([attributes.ts:96-105](packages/schema/src/attributes.ts:96)) is **the only
closed union in the codebase with no `assertNever` consumer.** `presenceMultiplier`
([selection.ts:117-130](packages/core/src/events/selection.ts:117)) is an `if` chain over
`m.kind` with no default and no compiler pressure. Every other union — `EffectS`,
`Condition`, `Filter`, `SlotRole`, `Target` — ends in `assertNever`. This is a live
Invariant 5 violation sitting in the file Phase 3 edits.

Three of the fourteen entries in `docs/FAILURES.md` are exactly this shape. Phase 3
therefore carries a hard gate, restated there.

---

## Phase 0 — Gates and instruments

Nothing new for the player. Everything after this is measured rather than assumed.

**CI.** `.github/workflows/check.yml` — `npm ci`, `npm run typecheck`, `npm run validate`,
`npm test`. Brief gates 1, 3 and 9 (prose lint as annotation, never a failure). Gates 2, 4,
6, 7, 8 land in the phase that makes each non-vacuous; a gate written against a feature
whose shape you have forgotten is a gate that passes.

**Gate 4, the fire-rate gate** — the brief calls this the important one. New
`packages/core/src/tools/gates.ts` with subcommands and exit codes. 100 runs, fast profile,
fail if any non-frame event fires in under 0.5% of runs. Distinct from
[arcs.slow.test.ts:29](packages/core/src/arcs.slow.test.ts:29), which only asserts
*at least once* across the batch.

**Gate 6, the purpose gate** — `event/purposes` and `event/purpose-overlap` already exist
in [rules.ts](packages/schema/src/rules.ts) as warnings. Raise duplicate clusters of three
or more to error.

**Harness instruments** ([harness.ts](packages/core/src/harness.ts)) — these are what make
§12's open questions answerable:
- `regencyYears` is declared at line 24, hardcoded `0` at line 79, never printed.
  `ensureHead` returns `{ regency }` ([succession.ts:19](packages/core/src/people/succession.ts:19))
  and [phases.ts:162](packages/core/src/year/phases.ts:162) discards it. Compute it, print
  it as Regencies-per-generation — §12 q2's recommended target is a median of one per 8–12.
- Mundane-son fraction (null-font sons over all sons) — the other half of q2.
- Per-Age occurrence rate across runs — the brief's "an Age appearing in 4% of runs is an
  Age whose content will never be seen."
- Per-template fire rate, feeding gate 4.

**§9 group A — pure genetics, ~10,000 pedigrees.** New
`packages/core/src/genetics.slow.test.ts`. These need no world: build parents with
`randomGenome`, then `conceive(meiosis(...))` in a loop, and read `eldritch` /
`realizedHomozygosity` / `deleteriousLoad` directly. Fast enough for the real N. Five
assertions: regression toward mid-parent; realized F under full-sib mating converging on
0.25; deleterious expression scaling with F; font zero in all sons of double-null mothers;
a father's X identical in all his daughters. The brief: if these hold, everything
downstream is tuning.

**§9 group B — the expression gate, asserted rather than printed.**
[harness.ts:63](packages/core/src/harness.ts:63) computes `madWomen` and `madIncapable`
and line 166 prints "(both must be 0)". Phases 3, 6a and 6b each add a new path by which
Madness can move. This assertion must precede all three.

**§9 group D — the Age scheduler pass.** Realised duration distribution against authored
`minYears`/`medianYears`/`shape`, with a tail fat enough that a 12-year and a 90-year Wars
both occur. Every Age occurring in enough runs. **And the deadlock:** `isEligible`
([scheduler.ts:99-112](packages/core/src/ages/scheduler.ts:99)) bars a register that just
ended *and* a register already active, with `MAX_CONCURRENT = 2` over three registers. The
brief warns the symptom is "a hundred flat years rather than a crash." Assert no run has a
stretch beyond N years with zero active Ages. Measure this before authoring Age-exclusive
content — it may change the design.

**Per-Age clause assignment + gate 7.** An `ages` list on
[clauses.yaml](packages/content/clauses.yaml); `revealClause`
([scheduler.ts:165](packages/core/src/ages/scheduler.ts:165)) picks from the active Age's
assigned set rather than global weight order. Gate 7: every clause assigned to ≥2 Ages;
headless sim fails if the median run recovers fewer than 6 of 9. Updates the weight-order
assertions in [ledger.slow.test.ts](packages/core/src/ledger.slow.test.ts) — the current
measured median is 7, so the floor should hold.

**`presenceMultiplier` gets its `assertNever`.** Cheap now, and it is Phase 3's guard.

Note in passing: `ages/coverage` ([rules.ts:314](packages/schema/src/rules.ts:314)) warns
below 4 exclusive events per Age. With 27 events over 7 Ages it is almost certainly firing
on nearly all of them. Confirm before treating warning counts as a signal.

---

## Phase 1 — The decision log and replay (§8)

Cheapest item on the list, and every later phase gets easier to debug for it. Built first
because phases 4–6 each add a decision kind, and retrofitting means re-reading every commit
path.

`LoggedDecision` as a **closed union ending in `assertNever`**, so a new decision kind is a
compile error rather than a silent omission — the same discipline `EffectS` runs under.

Three hook points, not one:
- `commitOutcome` ([decisions.ts:174](packages/core/src/events/decisions.ts:174)) is the
  Invariant 9 single commit path, but its signature never receives the choice id. It needs
  one. This is the function `AGENTS.md` names as sacred; change it deliberately.
- `applyRecord` ([decisions.ts:257](packages/core/src/events/decisions.ts:257)) — Record is
  a decision and it does **not** go through `commitOutcome`. Called from `resolveRecord`
  and from `afterRecord` ([phases.ts:319](packages/core/src/year/phases.ts:319)).
- `renameChild` ([sim.ts](packages/core/src/sim.ts)) — naming mutates `ctx.takenNames`,
  which feeds name generation, which is deterministic state.

**Two bugs are replay prerequisites, fixed here:**
- `present()` ([phases.ts:305](packages/core/src/year/phases.ts:305)) picks the auto-path
  choice with `rng.pick(...)` and never calls `choiceAvailability`, so the chronicler can
  take a choice whose `requires` fail while the player cannot. `autoResolveDecision`
  ([decisions.ts:316](packages/core/src/events/decisions.ts:316)) honours it. Two
  let-him-decide paths, two rules — this surfaces as a replay mismatch.
- `applyRecord` finds its chronicle entry by `(eventId, year)`
  ([decisions.ts:277](packages/core/src/events/decisions.ts:277)) with no entry id. A
  template firing twice in one year rewrites the wrong line. Give entries a stable id;
  Phase 7's claims need it too.

`decisionLog` goes into `SavedGameS` ([save.ts:246](packages/schema/src/save.ts:246)) —
omitting it does not fail, it resets silently on load, which is the trap
`ARCHITECTURE.md:134-142` names. `SAVE_FORMAT` bumps to 2.

New `packages/core/src/replay.ts` and `npm run replay`.

**Acceptance, non-negotiable:** `digest(replay(log)) === digest(original)` across `SEEDS`.
`digest` and `canonical` already exist at [save.ts:271](packages/core/src/save.ts:271). A
decision log without this test is the canonical dead feature.

---

## Phase 2 — Discrepancies become readable (§4, first half)

Roughly thirty lines that turn three write-only systems on and unblock two later phases.

- A `discrepancy` variant in [conditions.ts](packages/schema/src/conditions.ts) —
  `{ discrepancy: string, state?: 'open'|'proven'|'buried' }` plus an aggregate form for
  counting open ones. [docs.test.ts:55](packages/core/src/docs.test.ts:55) greps
  `'${c.name}' in c` in the source, so it *forces* the matching branch in
  [core/src/events/conditions.ts](packages/core/src/events/conditions.ts) to exist.
- The **PRESSURE selection pass**. `Candidate.source` declares `'pressure'`
  ([selection.ts:13](packages/core/src/events/selection.ts:13)), the header comment at
  lines 24–26 describes "an open Discrepancy near proof", and `selectEvents` has two passes,
  not three. Build the third.
- Proving costs a full Respect tier and seeds a scandal chain (concept §6). `provableBy`
  gets consulted; `severity` gets read.
- Authored content that emits `prove` and `bury` — the first in the game's history.
  Note [age_scoped.yaml:131,143](packages/content/events/age_scoped.yaml:131) already prove
  `the_thin_papers`, which **nothing ever creates**; that silent no-op is fixed here.
- Validation rule `discrepancy/wiring` in the same PR: every proved or buried id is created
  somewhere, and `provableBy` names a known house.

---

## Phase 3 — Checks (§1) and the dead modifiers (§2)

### Checks

- `DifficultyExpr` in the schema, widening `difficulty` from its current bare `z.number()`
  ([event.ts:120](packages/schema/src/event.ts:120)). Scaling with Age, respect and year is
  the stated intent. Ship it now: there are zero authored checks today, so the cost is zero,
  and non-zero the moment there are any.
- **`ChronicleQuery` v1** — entry-state vocabulary only: eventId, tag, Record option
  (`record`/`omit`/`embellish`), discrepancy state, `greyed`, plus counts and ratios over
  them. This is what `pool.kind: 'record'` scores against, and what §5's `reads` consumes.
  Phase 7 extends it with claim predicates; it does not replace it.
- New `packages/core/src/events/checks.ts`: `poolScore(ctx: SimCtx, spec, fill)` covering
  all six pool kinds, and `evalCheck(...)` applying `variance` through `rng.normal` and
  selecting the band. **Do not widen `attr()`** — it is
  [factory.ts:85](packages/core/src/people/factory.ts:85), takes `GeneticsCtx` not
  `SimCtx`, and has four call sites. `poolScore` calls it internally.
- Wire into `resolveChoice`, `autoResolveDecision` and `present`. A choice carrying a check
  resolves by band; one without resolves by weight as now.
- Validation rules **in this PR**: band ordering, `bands[].outcome` naming an outcome that
  exists, `choice.check` naming a declared check.

### The modifiers

- `check_bonus` — in `checks.ts`, honouring `DispatchEffectS.whenCastAs`. This is the
  dispatch half of the influence system, currently inert in its entirety.
- `outcome_weight` — `pickOutcome` ([effects.ts:182](packages/core/src/events/effects.ts:182))
  gains `ctx`; three call sites.
- `unlock` — a new `unlocked` Condition kind evaluated against household traits' grants. No
  new world state.
- `resource` — one additional term inside `tickEconomy`
  ([economy.ts:161](packages/core/src/economy.ts:161)), not a second place money moves.
- `attribute` — a new `influencedAttr(ctx, p, key)` used by checks, `Choice.requires` and
  filters. **Not** folded into `phenotypeOf`; Invariant 6 forbids storing derived state.
- `reveal_signs` — deferred to Phase 7, where `RecordView` is its consumer.

### The gate

The risk stated above is concentrated here. Three requirements, all in this PR:

1. `presenceMultiplier` and every new modifier consumer ends in `assertNever`.
2. A slow test asserting **every `ModifierS` kind appearing in `traits.yaml` was applied at
   least once** across `SEEDS`. There is no equivalent today for modifiers of the fire-rate
   test that exists for events.
3. At least one authored trait per implemented kind. `traits.yaml` has seven traits; code
   for a kind no trait declares is unreachable, and the whole suite stays green.

---

## Phase 4 — Frame events (§5)

- `reads: ChronicleQuery[]` on `EventTemplateS`, replacing `conditions` for `tier: frame`.
- A **new `frame` entry in `YEAR_PHASES`** ([phases.ts:72](packages/core/src/year/phases.ts:72)),
  after `generation`. Frame cannot come out of `ambientPool`: it is filtered at
  [selection.ts:72](packages/core/src/events/selection.ts:72) and every gate after that line
  assumes an ambient event. `EVENT_BUDGET_PER_YEAR` is 0.35; twelve to eighteen interludes
  over a thousand years is ~0.015/yr and is not rationed by `frequencyWeight`. Concept §5
  puts them every third or fourth generation, after an emotional peak.
- Narrow `listener_record` and `listener_blood` in
  [slots.ts:108-115](packages/core/src/events/slots.ts:108), where they currently fall into
  the whole-household pool.
- Validation, in this PR: a frame event carries no effects, no record block and no rumour
  (it "never dispenses systems information, never resolves mechanically"); it declares ≥1
  read; its prose budget is tighter than the standard five sentences.
- Content: an authored set of interludes, plus removal of the frame exclusion at
  [arcs.slow.test.ts:31](packages/core/src/arcs.slow.test.ts:31) in favour of a
  frame-specific fire test — twelve to eighteen per run is the target, and a frame layer
  that fires four times is 5% of the game's text that a player never sees.

---

## Phase 5 — Nested tales (§6)

- `TaleDefS` per the brief's YAML — `form`, `teller`, `bias`, `about`, `accuracy`,
  `circulates_from`, `mutates_every_years`, `text`. **`teller` and `bias` are required**:
  a tale with no teller is the game speaking in its own voice, which the design forbids and
  `AGENTS.md` lists under "Do not".
- A `tales` collection: one field on `ContentBundleS`, one row in `CONTENT_LAYOUT`
  ([assemble.ts:33](packages/schema/src/assemble.ts:33)), one index and lookup on `Content`.
  It then appears in both loaders at once. `TaleId` already exists at
  [ids.ts:29](packages/schema/src/ids.ts:29), used nowhere.
- `refs/known` extension so `accounts[]` and `tale.about` resolve. Today
  [rules.ts:113](packages/schema/src/rules.ts:113) counts `accounts` and checks nothing;
  content already names thirteen tale ids across nine events, all pointing at nothing.
- **Gate 8, the account gate**: every consequential event has ≥2 accounts with at least one
  contradicting field. Differing `bias` is the minimum bar; Phase 7's claims raise it to
  field-level contradiction. Two accounts that agree are one account written twice.
- Circulation state — `world.tales` keyed by `TaleId`, folded into an existing phase, with
  its save field. `SAVE_FORMAT` bumps.

---

## Phase 6 — The Library, careers, and the auction (§4, §7)

### 6a — The Library (concept §12)

`spellbooks.yaml` as a collection: affinity, tier, study years, degradation. The
`spellbook` effect case is empty by design at
[effects.ts:167](packages/core/src/events/effects.ts:167); it gains `gain`/`lose`/`degrade`
against `Person.spellsKnown`, with `canLearn` enforced (Invariant 4).

**§9 group C lands in this PR, and the ordering is not cosmetic.** "No female character ever
learns an Elemental spellbook" would pass **vacuously** over an empty set — a test that
proves nothing and looks green forever. Written here, it asserts the set is non-empty first.
The companion assertion — an ascendant can reach Madness ≥ 90 through purchased sources
alone — is unreachable until the Library exists.

### 6b — Careers (§7)

`careers.yaml` and `CareerDefS` over concept §17's five rows. A `career` Effect kind writing
`Person.career` (declared at [person.ts:132](packages/schema/src/person.ts:132), saved, and
never once written or read). Income in `tickEconomy`, Respect accrual, and the costs that
make the rule true — "the careers that pay Respect cost you either the person's body or
their bloodline; Respect is bought with descendants": clergy removed from the breeding pool
in `demography.ts`, military mortality. `TraitAcquisitionS`'s `career` kind
([attributes.ts:126](packages/schema/src/attributes.ts:126)) is **also** dead — light it up
here, or the schema grows another dead branch during the phase that fixes dead branches.

### 6c — The auction (concept §14)

The largest single subsystem. An `auction` phase and `AuctionState`; lots announced years
ahead so the player can liquidate or borrow; named rival bidders with visible motives read
from [houses.yaml](packages/content/houses.yaml) (House Marrow always wants Death texts, the
Church bids on Light and burns it); the four bid currencies including marriage promises.
`House` gains `chronicle: ChronicleId` and holdings.

Stock includes **pages of rival chronicles**, which is what makes Phase 2's `prove` path
reachable by purchase rather than only by authored event — the brief's "THIS IS HOW
DISCREPANCIES GET PROVEN."

Fix `heirloom` op `transfer` here: it is declared at
[event.ts:79](packages/schema/src/event.ts:79) and **silently falls through** at
[effects.ts:158](packages/core/src/events/effects.ts:158), uncaught by `assertNever`
because `op` is not the discriminant. The auction needs it.

`SAVE_FORMAT` bumps.

---

## Phase 7 — Claims, RecordView, sigil drift (§3)

Built last on purpose: by now, real content exists to design the vocabulary against.

- A `Claim` vocabulary — `attr`, `trait`, `death`, `deed` — attached to chronicle entries,
  to `RecordBlockS`'s three options ([event.ts:161-185](packages/schema/src/event.ts:161)),
  and to tales. Roughly 24 record blocks across `packages/content/events/*.yaml` get
  re-authored. `ChronicleQuery` gains claim predicates. `SAVE_FORMAT` bumps.
- `RecordView` **derived, never stored** — one source of truth for the lie. This is the
  first and only reader of `AttributeDef.recordable`
  ([attributes.ts:63](packages/schema/src/attributes.ts:63)), declared, authored twice, and
  read by nothing.
- **The forging path, without which half of §3 is inert on arrival.**
  [sim.ts:99](packages/core/src/sim.ts:99) and
  [testing.ts:96](packages/core/src/testing.ts:96) both do
  `claimedParents = { ...trueParents }` unconditionally; `LineageDocumentS` has a `forged`
  flag and is authored in zero files; no `pedigreeF` function exists. Add a `lineage` Effect
  kind that forges, `pedigreeF` over claimed parents against `realizedHomozygosity` over
  genomes, and content that uses it. The two disagreeing is the forged-dowry economy
  working, not a bug to reconcile.
- `reveal_signs` from §2 lands here — `signsVisibleTo(observer, subject, ctx)`, reading the
  blood. `RecordView` is the perception layer it was always waiting for.
- **The read model that actually matters is `session.ts`, not the editor.**
  [session.ts:220](packages/core/src/session.ts:220)'s `MemberView.attrs` and
  [sim.ts:206](packages/core/src/sim.ts:206)'s `familySnapshot` hand out ground truth today.
  These are what a real client consumes. `FamilyTree.vue` calls `bootstrap()` itself and is
  a debug inspector; a `drift` prop on `Sigil.vue` is roughly ten lines.
- **Acceptance test:** across `SEEDS`, at least one household member has non-empty
  `divergence` by 1500, and divergence count correlates with the embellish rate. Without it
  this ships as a derived view over claims nothing writes.

---

## Phase 8 — The editor (§11)

**Prerequisite, and it is a gap rather than a feature:** `writeFile`, `toYaml` and
`fileOfEvent` exist in [content.ts:33-72](packages/editor/src/lib/content.ts:33) with
**zero callers**, while both transports are live (Vite `PUT /api/content` middleware,
Electron IPC). Today's editor is a read-only inspector whose form edits die on tab switch.
Wire write-back first; a condition builder that edits a discarded copy is worse than none.

Then v1: the condition builder (nested all/any/not, drag to reorder and regroup); the choice
and outcome tree (hand-rolled SVG is the house style already — `FamilyTree.vue`, `Sigil.vue`
— and no graph library is installed); the body editor (CodeMirror is a new dependency —
worth a second look for 27 events and one author); chronicle preview with the three Record
outcomes side by side **including Omit as the dated blank line**, since `applyRecord` clears
`entry.title` on omit at [decisions.ts:282](packages/core/src/events/decisions.ts:282) and
nobody has ever looked at that rendering; git-adjacent YAML diff before writing.

Then v1.1: test families — including **the honest house** and **the storybook house**, since
most Record-dependent content only misbehaves against one of those two, and they are what
makes **CI gate 2** (slot-fillability) non-vacuous; the coverage report; in-editor fire-rate
sim; pronoun and grammar preview; the clause board against Phase 0's per-Age assignment; the
tale pairs view, which is the only human-facing enforcement point §6 has.

`App.vue` needs a store or at least a shared dirty set — state is prop-drilled and each
component keeps a local shallow copy.

---

## Phase 9 — The open design decisions (§12)

Not a build phase. Phase 0's instruments make q2 (mundane-son fraction, Regency frequency)
and q5 (founder deleterious load) measurable — the brief's instruction on both is *do not
guess it, measure it*. The Library and auction make q7 (does Fecundity change the Vessel)
concrete. Record the answers where they belong — `do-to.md` for fertility, the brief for the
rest — and delete what is settled.

---

## Verification

Per phase:

```bash
npm run check
```

Typecheck (including Vue templates) + content validation + the full suite. The one command
before claiming anything works.

```bash
npm run harness -- 16 1000
```

Balance numbers, and after Phase 0 the Regency rate, mundane-son fraction and per-Age
occurrence that §12 needs.

```bash
npm run digest -- 8 400
```

Run before and after any change claimed to be a refactor. If the block moves, it was not one.

Phase-specific acceptance, each of which is the difference between the feature and its
lookalike:

| Phase | The test that proves it is not dead |
|---|---|
| 0 | The expression-gate invariant fails the suite, not just the printout |
| 1 | `digest(replay(log)) === digest(original)` across `SEEDS` |
| 2 | A discrepancy reaches `proven` in a headless run and costs a Respect tier |
| 3 | Every `ModifierS` kind authored in `traits.yaml` was applied ≥1 time across `SEEDS` |
| 4 | Frame interludes fire 12–18 times per run |
| 5 | Every `accounts` entry resolves, and each pair contradicts on ≥1 field |
| 6a | The Elemental assertion runs against a non-empty spellbook set |
| 6c | A purchased rival chronicle proves a discrepancy end to end |
| 7 | ≥1 household member has non-empty `divergence` by 1500 |

**Save format.** Phases 1, 5, 6 and 7 each bump `SAVE_FORMAT`, and
`format: z.literal(SAVE_FORMAT)` means older saves hard-fail rather than migrate. That is
the right trade pre-release; it is a decision, not an oversight. `save.test.ts`'s "continues
identically after loading" is the only guard against a new world field that resets silently.

**And each phase ends by deleting its section from
`DesignConcepts/eldritch-dynasty-unbuilt-brief.md`.** A specification that duplicates
working code does not stay accurate — which is the reason that file exists at all.