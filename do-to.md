# do-to — Fertility Inheritance

**Status:** design options, nothing built. No decision has been made.
**Owner:** open.
**Reads on:** concept §7 (The One Permutation), §9 (Heritable Attributes), §16 (cadet branches), and `packages/core/src/sim.ts`.

This document exists because fertility is the last major number in the simulation that is not *inherited*, and because the household size question in AGENTS.md ("correct austerity or under-tuned fertility?") cannot be answered honestly until we decide what fertility **is**.

---

## 1. Where it stands today

Completed fertility is a hash:

```ts
// packages/core/src/sim.ts
function completedFertility(motherId: string, fatherId: string, runSeed: number): number {
  return 2 + (hashSeed(runSeed, 'fertility', motherId, fatherId) % 4);
}
```

Two to five children per couple, stable across save and load, drawn from the pair's ids and nothing else. Around it sit three modifiers, none of them heritable either:

| Lever | Where | What it does |
|---|---|---|
| Per-hall crowding | `crowding(size, cap)` | Births and marriages fall away past a hall's soft cap |
| Fertile window | `rollBirths` | Mother aged 17–44, married, spouse alive |
| Annual chance | `rollBirths` | Flat `0.16 × pressure` per eligible mother per year |

**What this costs the game.** Every single thing the player chooses about marriage — deep blood, a thin line, a bought grandmother, cousin against outsider — is a bet on *what a couple's children will be*, and no part of it is a bet on *how many*. A house that marries a famously prolific line gets nothing for it. The word "barren" appears in the design (§7, The Barren Generation) as a description of magical expression, and the marriage market has no vocabulary for the other kind because the simulation has no fact for it to name.

**What it costs the balance.** Fertility is currently the only demographic dial with no in-fiction meaning, which makes it the only one we cannot tune without lying. If runs end small, our options today are "raise a constant" or "raise a cap" — neither of which the player can see, learn, or play against.

Measured now, after cadet branches (12 runs × 1,000 years, `npx tsx --tsconfig tsconfig.base.json packages/core/src/harness.ts 12 1000`):

- ~73 living at 2042, ~20 of them in the main hall, five living branches
- ~38 branches founded per run, ~30 of them extinct by the end
- Completed families cluster hard at 2–5 with no variance between lines

The clustering is the tell. Forty generations of a single family, and every couple in every branch is drawn from the same flat distribution.

---

## 2. Constraints any option must respect

These are not preferences. Breaking one breaks something already shipped.

1. **Determinism is per-world.** Any new number derives from `(runSeed, mother, father, ordinal)` or from the genome. No `Math.random()` in `core`, no module-scope state (AGENTS.md invariant 8).
2. **Fertility is not Eldritch Power.** EP is X-linked, family-exclusive, and gates Madness through `canExpress`. Fertility must not touch that gate, must not become a second font, and must not give women a route to expression (invariants 1 and 4).
3. **Derived state is not storage.** If fertility becomes an attribute it is expressed from the genome and re-derived, with life's contribution in `Person.acquired` (invariant 6).
4. **One birth gate.** Everything still goes through `rollBirths` → `conceiveChild`. No second path that makes a child.
5. **The player must be able to learn it.** A heritable number the player cannot observe, infer, or gossip about is a random number with extra steps. Whatever we choose needs a visible tell — a phrase in the marriage market, a line in the chronicle, a mark on the tree.

---

## 3. The options

### A — Polygenic autosomal fecundity

Fertility becomes the thirteenth heritable attribute, built exactly like Strength: six loci, additive with one major, expressed through `expressAttributes`.

- `completedFertility` reads `attr(mother, 'fecundity')` and `attr(father, 'fecundity')` and maps the pair's mean onto a 1–7 target.
- Generated in `tools/gen-loci.mjs` alongside the other Core attributes; regenerate `loci.yaml`, never hand-edit it.

**Feels like:** lines diverge. Some branches of the family are simply fruitful and everyone knows it by the third generation, because you can count them on the tree.
**Cost:** one attribute, one loci block, one function rewritten, one harness pass to re-tune the constant.
**Risk:** low. It is the same machinery as four attributes that already work.
**Weakness:** it is *only* nice. It adds texture without adding a decision, because more children is unambiguously good and nobody will ever choose against it.

### B — The X-linked drag *(the one that argues with the design)*

Put fecundity on the **X**, in the font block, in negative correlation with carried font. The blood you are trying to concentrate is the blood that breeds least.

- New locus kind alongside `eldritch_font`, sharing the X and therefore linked to it — a daughter who carries deep font tends to carry low fecundity, and recombination occasionally splits them, which is the jackpot the whole marriage market would learn to hunt for.
- Sons express fertility from their single maternal X; daughters from two, so the female side is buffered — the same asymmetry the font already has, running the other way.

**Feels like:** the central squeeze of the game, one layer deeper. §7 already says the path to godhood runs through the thing that produces Madness. This says it also runs through the thing that shrinks the family. Concentrate the blood and the house gets thinner; marry out to breed and the font dilutes.
**Cost:** a locus kind, an expression rule, and a linkage decision in `meiosis.ts` (the recombination map already exists — this is choosing a distance).
**Risk:** medium-high. It couples two systems that are currently independent, and it can produce a death spiral: hot line → few children → fewer carriers → extinction. Needs a floor, and needs the harness to prove the floor holds across a few hundred runs.
**Weakness:** if tuned even slightly hot it makes the optimal play "never concentrate the blood", which is the opposite of the game.

### C — The maternal line

A second, non-X maternal channel: fecundity passes mother to child, unmodified by the father, like mitochondria.

- Stored as a small `maternalFecundity` value on the genome, copied whole from the mother in `conceive`.
- Makes **the bride's mother** the thing you inspect, which is exactly what §7's dowry economy is about: "three generations of maternal records, notarised. Forging them is an industry."

**Feels like:** the lineage documents suddenly matter mechanically instead of narratively. A forged pedigree can now lie about something with a number attached, and the lie can be found out four generations later when the daughters of that marriage bear one child each.
**Cost:** small. One field, one copy rule, one lookup.
**Risk:** low mechanically, medium narratively — a trait with no paternal contribution is a strong claim about this world's biology and the Church will have opinions, which is content we would then owe.
**Weakness:** no variance from the father makes half the marriage market inert on this axis.

### D — Barrenness as a recessive

Not a gradient: a named recessive in the `DELETERIOUS` block, harmless heterozygous, near-sterile homozygous.

- Slots into machinery that already exists (`countLethal` runs over homozygous deleterious loci every conception).
- Cousin marriage — *the mechanism*, per §7 — is exactly what surfaces it. The family's own strategy produces its own barren generation.

**Feels like:** the sharpest version. A specific, named curse in the blood ("the thin bone" has a sibling), discoverable, chartable, and avoidable at the cost of marrying out.
**Cost:** trivial. One entry in `gen-loci.mjs`, one branch in `completedFertility`.
**Risk:** low. Well-bounded by allele frequency.
**Weakness:** binary. It creates dread, not a gradient, and it does nothing for the ordinary demographic question.

### E — Acquired, not inherited

Fertility as an `acquired` modifier only: nutrition (treasury), the midwife retainer, plague Ages, a mother's Strength, the number of years since the last birth.

- Nothing heritable at all; the *appearance* of heritability comes from families staying rich or staying poor across generations.

**Feels like:** the house's fortunes visibly compound. A century of debt is a century of small families, and the recovery takes two more generations.
**Cost:** low, and it composes with every other option.
**Risk:** low.
**Weakness:** answers the balance question and none of the design one. The marriage market still has nothing to bet on.

### F — Leave it alone

Keep the hash, tune the constant and the per-hall caps, and call the small household correct austerity.

**Feels like:** what it feels like now.
**Cost:** none.
**Risk:** none, except that "why is my family always this size" stays unanswerable in fiction.
**Worth stating plainly:** with cadet branches in, the house now grows sideways to ~73 living. The demographic emergency that made this question urgent is *already* less urgent than it was at ~20.

---

## 4. What each option does to the systems around it

| | Marriage market | Cadet branches | Regency | Chronicle |
|---|---|---|---|---|
| **A** polygenic | A real axis to bid on | Fruitful branches out-grow the seat | — | "her mother bore seven" |
| **B** X-linked drag | The central trade, made explicit | Hot main line, broad cadet halls — the branches out-breed the seat *because* they are thinner blood | Regency becomes a breeding recovery as well as a magical drought | The best material in the document |
| **C** maternal | Lineage documents get teeth; forgery gets a payoff | Branches inherit their founder's wife's line, not the family's | — | Rumours about a grandmother |
| **D** recessive | "A thin line" becomes literal | A branch can carry it and the seat not know | A barren generation of both kinds at once | Discoverable, nameable, chartable |
| **E** acquired | Nothing | Poor halls shrink; the tithe becomes demographic | — | Plague and famine leave marks |
| **F** none | Nothing | Nothing | Nothing | Nothing |

Note the row that matters: **B is the only option that makes cadet branches structurally different from the main house rather than just smaller.** Thinner blood breeding faster is why real cadet lines out-survive senior ones, and it would give the recall mechanic — the seal going to a cousin — a demographic engine underneath it instead of luck.

---

## 5. Recommendation

**Build D + A, in that order. Prototype B behind a constant. Do not ship C.**

1. **D first, this week.** It is a day's work, it uses machinery that already runs on every conception, and it converts an existing strategy (cousin marriage) into an existing consequence (a named curse). Ship it and watch the harness.
2. **A second.** Fecundity as the thirteenth attribute gives lines their own character and gives the marriage market a number. Retire the hash; keep the same 2–5 median so the balance does not move on the day it lands.
3. **B as a prototype with the coupling strength as a single constant, defaulted to zero.** Turn it up in the harness, in batches of two hundred runs, and look for the death spiral before anyone plays it. If a house that concentrates its blood cannot reach 2042 more than half the time, the constant is wrong — not the idea.
4. **E only if the harness says the economy should have demographic weight.** It composes with everything above and can wait.
5. **C is a no.** Paternal contribution of zero is too strong a claim about a world whose entire social order is an argument about what passes through which parent, and we would spend the content budget defending it.

---

## 6. Sketch of the work (A + D)

```
packages/content/attributes.yaml     + fecundity (kind: core)
packages/content/tools/gen-loci.mjs  + fecundity in CORE; + del_hollow_year in DELETERIOUS
                                     then: node packages/content/tools/gen-loci.mjs
packages/core/src/sim.ts             completedFertility() reads the couple's expressed
                                     fecundity; the recessive clamps it to 0–1
packages/core/src/people/factory.ts  no change — conception already runs the deleterious sweep
packages/editor                      fecundity appears in the Characters preview automatically
```

### Tests to write with it

Not "the function returns a number" — the shape of a healthy run:

- Completed family size **varies between lines** by 1,000 years (the failure this replaces is that it does not).
- The recessive appears, is survivable, and does not exceed ~3% of couples in a batch.
- Cousin-married couples show a measurably higher rate of it than out-married ones. If they do not, the deleterious sweep is not reaching this.
- 2042 survival rate does not drop below the current baseline across the standard seed set.
- Determinism: same seed, same completed families.

### Harness metrics to add

`mean completed family`, `sd of completed family between lines`, `barren couples per run`, `main hall vs branch fertility` — the last one is how we would find out whether B is worth building.

---

## 7. Open questions, for whoever picks this up

1. Does a fertility attribute belong in the **twelve**, or outside them like Eldritch Power? Twelve is a number the design says out loud (§9); thirteen is a rewrite of a header.
2. Is fecundity **visible** to the marriage market before the marriage? The honest answer is "only through her mother and her sisters", which is the same epistemics as the font and probably right.
3. Does the Church have a position? It has one on everything else, and "be fruitful" is the easiest doctrine in the world to write and the most awkward one to reconcile with a house that marries its cousins.
4. If B ships, does the **Vessel** rung (§22) become a fertility decision as well as a Madness one? Spending a child you could not have replaced is a different scene from spending one of six.
