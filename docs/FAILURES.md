# FAILURES

Bugs that shipped. Every one of them was silent — nothing threw, nothing logged,
and each looked from the outside exactly like a working feature that had not come
up yet.

Read this before writing a test. The pattern to learn is not any individual bug;
it is that **this codebase fails by doing nothing**, so the assertion that catches
it is almost never "does the function return".

---

## The clamp outside the square

```ts
Math.max(0, (age - 45) ** 2)     // the square is ALWAYS positive
```

The clamp did nothing, so the mortality curve ran backwards. A one-year-old
carried a 12% annual hazard, almost no child reached seventeen, and every run
went extinct. The clamp belongs *inside* the square.

**Caught by:** a run that never had a household.
**Now guarded by:** `demography.slow.test.ts` — "lets children reach adulthood".

## And then the house doubled every twenty-five years

Fixing the above removed the only brake there was. Every adult married and bred
for twenty-seven years. The real brakes are completed fertility per couple and a
per-hall soft cap.

**Now guarded by:** `demography.slow.test.ts` — "does not breed without bound".

## Attribute effects evaporated

Every `attribute` effect in the game wrote into the phenotype **cache**, which is
derived and recomputed whenever the year changes. It appeared to work and was
gone by next spring. Acquired modifiers belong in `Person.acquired`.

**Now guarded by:** invariant 6, and `economy.slow.test.ts`.

## There was no annual economy

The treasury only moved when an event spent it, and every money event spends. The
house passed −1,000 crowns by 1400 and stayed there. Nothing checks a negative
treasury, so the only symptom was that `maintainCast` silently stopped hiring
around 1150 — the tutor, the midwife and the archivist quietly left the game, and
with the archivist went the Ledger.

**Now guarded by:** `economy.slow.test.ts`, `ledger.slow.test.ts`.

## Two arc bugs killed a three-node substory

A node that did not declare the arc's bound slot was treated as having an
unfillable one, and cancelled the whole arc. Separately, `inherit` gave up when a
man died childless — which is most men. The seal feud's final scene fired **zero
times in twenty thousand simulated years**.

**Now guarded by:** `arcs.slow.test.ts`. The fire-rate gate is the only thing that
catches this class. Measure fire rates whenever you touch arcs, slots or selection.

## `kind: relationship` was handled by nobody

The effect switch listed the case, commented that another subsystem handled it,
and broke. There was no other subsystem. Four authored outcomes — including the
seal feud's inherited grudge — discarded themselves in silence.

**Now impossible:** the switch ends in `assertNever`, and every case does the work
or does not exist.

## Contracts bound to a house, so the employer could never die

`onEmployerDeath` was unreachable, and `term` with it. Every field deciding how
service ends was dead. Contracts bind to a **person**.

## Every Age reveals a clause — and none did

`ActiveAge.paid.clause` was written by nothing; `clauseBearing` was read by
nothing. Runs reached 2042 with two clauses of nine, and the God rung needs
seven, so the ending the whole game points at was unreachable. Nothing said so.

## Respect only ever ratcheted

It moved when an authored effect moved it and never otherwise, so half the
measured runs sat at their high-water mark from the century they reached it. The
endgame squeeze — Madness to ascend, Respect to be allowed to, Madness destroys
Respect — had one of its three jaws missing.

## One ledger for two things

`world.frequency` rationed events and minted people at once, so a rare *event*
firing barred rare *character* templates for fifty-five years — and minted people
were never recorded at all, so a mythic cap of three produced five and a half per
run.

## An id counter at module scope

Shared by every simulation in the process, so the same seed diverged as soon as a
third run existed between two others — and conception seeds derive from parent
ids, so the divergence reached into genomes. The harness runs thousands of runs.

**Now guarded by:** `world.counters`, and `demography.slow.test.ts`.

## A preview that changed the run it was previewing

`previewTemplate` removed its people and refunded the ration, so it looked clean.
But every rolled person had already advanced `counters.person`, and conception
seeds derive from parent ids — so previewing twenty-four suitors renamed every
child born afterwards and gave them different genomes. The editor's own
inspection tool altered the world, and only on the worlds somebody had inspected.

## The seal left the main house, twice

`foundCadetBranch` moves a man's wife and unmarried children with him. Twice that
quietly moved the sitting **Head** into a branch — once as somebody's unmarried
son, once as a Regent whose husband founded a hall. Afterwards `speakerOf` found
no head in the main hall, nobody there could ever leave again, and succession
never noticed because the seat was filled.

## The browser loaded a different game

The node and browser content loaders each carried their own copy of which
collection came from which file. The browser one never collected
`characterTemplates`, so the editor minted no spouses, every line died out by
1150, and the tree view disagreed with the harness for a whole session.

**Now impossible:** there is one loader and one `CONTENT_LAYOUT`.

## A permissive default in the condition evaluator

`evalCondition` ended in `return true`. A condition kind added to the schema and
not handled there did not fail — it **passed**, so every event carrying it fired
unconditionally, forever, looking exactly like content meant to be common.

**Now impossible:** `assertNever`.

---

## Found before it shipped: a negative locus group pays out instead of costing

Not a bug that shipped — `FECUNDITY_DRAG_COUPLING` is zero, so nothing in the
game runs this path. It is here because the next person to turn that constant up
will walk into it, and because the shape generalises past fertility.

`completedFertility` measures a couple against `expectedAttribute('fecundity')`,
the population mean derived from the locus table. That mean is **theoretical and
unclamped**; the attribute a real body carries is clamped to the authored range,
which floors at zero. Add a strong one-sided negative group of loci — option B's
drag is six of them — and the two come apart: at coupling 2 the computed centre
has fallen from 26 to 4 with a quarter of all mothers sitting on the floor, and
by coupling 4 it is **-18 against a floor that has not moved**.

Every family in the game then reads as *above* average, and the drag hands out
children. Across 200 thousand-year runs per coupling, births per run rose
monotonically — 748 at coupling 0, 795, 870, and 1,009 at coupling 4. The feature
made the house bigger the whole way up, and nothing threw.

**Caught by:** `npm run gate:drag`, which prints the computed centre and the
floored share next to the outcome columns for exactly this reason.
**Now guarded by:** `attributes.slow.test.ts` — "does not pin the founding cast
against the ends of its own range", which trips at coupling 1, well before the
sign flips.

---

## Two tests that were wrong, not the code

Worth its own heading, because the reflex is to fix the code.

- `writes the clause into the chronicle in the contract's own hand` pinned seed
  909 to revealing a clause within 600 years.
- `does not ratchet` asserted that six seeds end on more than one tier.

Both failed the day the RNG streams were split. The harness showed sixteen seeds
landing across four tiers on the same commit — the behaviour was intact, and the
tests were describing a sample rather than a mechanism. They assert the mechanism
now.
