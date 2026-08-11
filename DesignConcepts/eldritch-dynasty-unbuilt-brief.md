# ELDRITCH DYNASTY — What Is Not Built Yet
## Design brief for the unimplemented systems

**Provenance.** This is what survived of `eldritch-dynasty-data-model-brief.md` and `eldritch-dynasty-event-editor-brief.md` after the systems they specified were built. Everything those two documents described that now exists in `packages/` has been deleted from them, because a specification that duplicates working code does not stay accurate — the data-model brief was still asserting "twelve heritable attributes" three times after Fecundity made it thirteen, and still described a `House` with a `roster`, `holdings` and a chronicle id that were never built.

**The rule this document exists under.** For anything that IS built, the code is the specification, `ARCHITECTURE.md` says where it lives, and `AGENTS.md` carries the invariants. For anything below, this is the only written design, and **it should be deleted from here the moment it ships** — §4 and §8 were already cut back on the day this file was created, because heirlooms and the save format landed while it was being written.

Both originals are recoverable in full from git history if a decision here needs its original reasoning.

---

## 1. Checks — all four challenge tiers, one structure

Declared in `packages/schema/src/event.ts` as `CheckS` and `PoolSpecS`, referenced by `Choice.check`, and **evaluated nowhere**. A choice carrying a check resolves by outcome weight exactly as if it had none, and nothing says so. No authored template uses one yet, which is the only reason this has not bitten.

One check structure covers all four challenge tiers from concept §21, which means one balance surface and one set of tests.

```ts
interface Check {
  id: CheckId;
  pool: PoolSpec;
  difficulty: number | DifficultyExpr;      // may scale with Age, respect, year
  bands: { atLeast: number; outcome: OutcomeId }[];   // degrees of success, ordered
  variance: 'none' | 'narrow' | 'wide';
}

type PoolSpec =
  | { kind: 'slot';       slot: SlotId; attrs: { attr: AttributeId; weight: number }[] }
  | { kind: 'party_sum';  slots: SlotId[]; attr: AttributeId }
  | { kind: 'family_sum'; attr: AttributeId }
  | { kind: 'family_max'; attr: AttributeId }
  | { kind: 'family_any'; attr: AttributeId; atLeast: number }
  | { kind: 'record';     against: ChronicleQuery };   // Record challenges, concept §21
```

`family_any` is the anti-specialization check the brief asks for: forty generations chasing Death, and then a fire, and nobody can call water.

**Note for whoever builds this.** The five person-pool kinds are straightforward. `kind: 'record'` needs `ChronicleQuery` — the same type §5 below needs for frame events — and it is the one that cannot be built by guessing: a Record challenge tests the chronicle against itself, and what counts as a strong record has to be decided, not inferred.

`DifficultyExpr` is likewise undefined here. Scaling with Age, respect or year is the stated intent.

---

## 2. Influence modifiers that are declared and never applied

`ModifierS` in `packages/schema/src/attributes.ts` enumerates seven kinds. Selection applies **two** — `event_weight` and `suppress`. The other five are read by nothing:

| Modifier | What it was for |
|---|---|
| `unlock` | A trait grants access to something otherwise closed |
| `check_bonus` | The dispatch half of the influence system — a trait that only matters on missions |
| `outcome_weight` | Reweight outcomes by tag once an outcome group is reached |
| `resource` | Per-year income or drain attached to a person rather than a contract |
| `reveal_signs` | Reading the blood — how a character perceives font in others |

The presence/dispatch split is the design's stated extensibility surface: a designer adds a trait that makes plague events rarer, or one that only matters on missions, without an engineer. Half of it works.

---

## 3. Truth and record as two layers — sigil drift

Concept §6 and §8 require that the UI shows what the chronicle says, not what happened. The Record mechanic now writes the chronicle, but nothing derives a **record view** of a person from it, so the family tree still draws the truth.

```ts
interface RecordView {
  person: PersonId;
  /** Only attributes with `recordable: true` can diverge. */
  attrs: Map<AttributeId, number>;
  claimedTraits: Set<TraitId>;
  claimedDeath?: { year: Year; cause: DeathCauseId };
  divergence: Set<AttributeId | TraitId>;    // non-empty ⇒ sigil drift, concept §8
}
```

Rules:

- The simulation resolves against `Person`. The interface renders `RecordView`.
- `RecordView` is **derived** from chronicle entries, not stored independently — one source of truth for the lie.
- `divergence` non-empty is exactly the condition for sigil drift: the tree draws the recorded person; hover shows the real one.
- Pedigree F computes over `claimedParents`; realized homozygosity computes over genomes. The two disagreeing is not a bug to be reconciled — it is the forged-dowry economy working. (`claimedParents` exists on `Person` and is currently always a copy of the truth; nothing ever forges it.)

---

## 4. The auction, and how a Discrepancy gets proven

*Heirlooms shipped separately while this document was being written — `schema/src/heirloom.ts`, `content/heirlooms.yaml`, `core/src/people/heirlooms.ts`, with a `regalia` kind and its own tests. What remains unbuilt is the market they move through and the use the design puts a rival's records to.*

The house record the original brief carried, minus everything since built:

```ts
interface House {
  roster: PersonId[];
  standing: { holdings: HoldingId[] };
  /** Buyable at auction — THIS IS HOW DISCREPANCIES GET PROVEN. */
  chronicle: ChronicleId;
}
```

That comment is the whole of the current spec for proving a Discrepancy. Discrepancies open, accumulate, and are never proven or buried: the `discrepancy` effect has `prove` and `bury` operations that work, and **no authored content emits either**, so `provableBy` names sources nothing consults. A rival house's chronicle being purchasable is the mechanism the design intends, and the auction (§14) does not exist.

Spellbooks are the other half of the same gap — `kind: 'spellbook'` is an `Effect` with an empty case, and the Library (§12) has no content.

---

## 5. Frame events — the 2042 layer

`tier: 'frame'` is filtered out of selection and read by nothing else. Concept §2 Layer 1 is ~5% of the game's text and twelve to eighteen interludes across a run; none of them can fire.

`tier: frame` has no slots against the living family — only `listener_record` and `listener_blood` — and it takes a **chronicle query** instead of conditions:

```yaml
tier: frame
reads:
  - { chronicle_entry: seal_gift_lie, state: unproven }
```

Frame events react to what the player wrote. They never dispense systems information, never resolve mechanically, and are held to a tighter prose budget.

---

## 6. Nested tales

Concept §19 is ~5% of the text and the rule that "no nested tale is neutral." No tale exists, and there is no collection for one.

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

Events already carry an `accounts` array naming tales; the array is validated for length and refers to nothing.

---

## 7. Careers

`CareerId` and `Person.career` exist. There is no career content, no assignment, no income, no Respect effect. Concept §17's shape — "the careers that pay Respect cost you either the person's body or their bloodline; **Respect is bought with descendants**" — is a rule the simulation currently cannot express.

---

## 8. The decision log

*Persistence shipped separately while this document was being written — `saveGame` / `loadGame` / `digest` in `core/src/save.ts`, versioned in `schema/src/save.ts`. What that leaves is the second half of the original spec.*

The save is a snapshot. The brief also asked for an **append-only decision log** beside it — which choice, which slot casts, which seeds — because the snapshot makes loading O(1) and only the log makes a run *replayable*. That is what the harness would need to bisect a balance change, and it is the only practical way to reproduce a bug reported eleven hours into somebody's playthrough.

---

## 9. The statistical test suite

The current suite asserts the *shape of a healthy run* and catches silence. It is not statistical. These assertions must hold over ~10,000 simulated pedigrees and none of them are written:

- Mean offspring attribute regresses toward mid-parent by the expected fraction.
- Realized F under full-sib mating converges on 0.25.
- Deleterious expression rate scales with F as predicted.
- Font is zero in all sons of double-null mothers.
- A father's X is identical in all his daughters.

Three further assertions cover the expression gate, and they are the ones most likely to be broken by a later change:

- **No character with `canExpress: false` ever holds nonzero Madness or nonzero expressed Power**, from any source, in any run. This is the assertion that catches a new Madness effect written without the gate. *(The harness reports this per batch today; it is not a test.)*
- **No female character ever learns an Elemental spellbook**, and no female character ever holds nonzero Eldritch Power.
- **An ascendant can reach Madness ≥ 90 through purchased sources alone** — the God rung is otherwise unreachable in a way that surfaces only eleven hours into a run.

If those hold, the genetics is correct and everything downstream is tuning.

**The Age scheduler needs its own statistical pass** over the same runs:

- Each Age's realised duration distribution matches its authored `minYears` / `medianYears` / `shape`, with a fat enough tail that a 12-year Wars and a 90-year Wars both occur.
- Every Age occurs in enough runs to justify authoring exclusive content for it. An Age appearing in 4% of runs is an Age whose content will never be seen.
- Register alternation holds without deadlocking — a scheduler that has excluded every eligible Age will silently stall, and the symptom is a hundred flat years rather than a crash.

---

## 10. CI

There is no `.github/`. Nothing runs on push. Every gate below is currently a thing somebody has to remember.

1. `zod` validation across all content — any error fails the build
2. Slot-fillability check against all test families
3. `vitest` on `core` and `schema`
4. Headless fire-rate sim (100 runs, fast profile) — fails if any event fires in under 0.5% of runs
5. Diff coverage report against the previous commit
6. **Purpose gate** — any template with fewer than three purposes fails; purpose-duplicate clusters are reported, and a cluster of three or more fails
7. **Clause gate** — all nine clauses assigned to ≥2 Ages; headless sim reports the clause-recovery distribution and fails if the median run recovers fewer than 6 of 9
8. **Account gate** — every consequential event has ≥2 accounts with at least one contradicting field
9. **Prose lint** — reported as an annotation, never a failure

The fire-rate gate is the important one. It is the difference between shipping 400 events and shipping 400 events *the player will actually see*. The clause gate is its equal for the narrative spine.

> **The clause gate disagrees with what was built, deliberately noted.** It requires every clause to be assigned to **at least two Ages**, "because a clause pinned to a single Age is a clause some runs never see." The implemented Ledger has no clause↔Age assignment at all: any named clause-bearing Age reveals the next clause in weight order, to a house keeping an archivist. That satisfies the spirit (order is stable, recovery is earned, the measured median is 7 of 9, above the gate's floor of 6) and not the letter. If per-Age assignment is wanted — so that *which* clauses a run recovers varies, not just how many — it is unbuilt, and this gate is its specification.

---

## 11. Editor features not built

Of the v1 must-haves, these do not exist:

- **Condition builder** — nested all/any/not groups, drag to reorder and regroup. Conditions are hand-edited YAML today.
- **Choice & outcome tree** — a graph view; choices branch to weighted outcomes, weights shown as percentages with a warning when they do not total 100. (The validator warns; nothing draws it.)
- **Body editor** — CodeMirror with slot-token highlighting, `{CHALLENGER}` as a chip, `{` opening slot autocomplete, undefined slots underlined live.
- **Chronicle preview** — the three Record outcomes side by side as they would appear on the page, *including Omit rendered as the dated blank line*, because that blank is a designed artefact and authors need to see it land.
- **Git-adjacent** — detect uncommitted changes, show a YAML diff before writing. No embedded git client.

And the v1.1 set, all unbuilt:

- **Test families** — hand-crafted fixtures: the Barren Generation, the demigod-stagnant house, the single-survivor line, the 40-member sprawl, plus **the honest house** (recorded everything, poor and knowledgeable) and **the storybook house** (embellished everything, exalted and hollow). Most Record-dependent content only misbehaves against one of those two.
- **Coverage report** — which tiers, Ages and ascension rungs are under-served. This answers "what should I write next," which is the question that stalls content production.
- **Fire-rate simulation** in the editor — the harness does this headlessly; the editor cannot.
- **Pronoun and grammar preview** — every event rendered against a male-slot and a female-slot fill, side by side.
- **The clause board** — the nine clauses against the Age table, unassigned and single-assignment clauses in red. See the note in §10.
- **The tale pairs view** — every consequential event with its `accounts` listed, warning where two accounts do not actually disagree. Two accounts that agree are one account written twice, and the whole nested-tale layer collapses into decoration.

**Won't-have, still:** multi-user real-time collaboration (git handles it), localisation tooling until content is locked, WYSIWYG typography, embedded audio, and any automated rewriting of body text — the linter reports, the writer fixes.

---

## 12. Open design decisions

Answered ones have been dropped. These are still live, and they are design calls rather than engineering ones.

1. **Do father's X-linked contributions to daughters feel bad?** The model gives a Head no genetic influence on his sons' Eldritch at all. This is correct, elegant, and thematically perfect — the family's power visibly runs through its women — but it is counter-intuitive for a player raised on "strong father, strong son." Recommend keeping it and *teaching* it: it is the single most interesting thing the system knows.

2. **What fraction of sons should be mundane?** Null-font sons drive Regency frequency and are the only men who cannot go mad. Too few and marrying outward carries no real threat; too many and the Barren Generation stops being an event and becomes the weather. Recommend targeting a **median of one Regency per 8–12 generations** and tuning outsider `fontCarrierRate` to hit it, rather than setting the rate and hoping. **Never measured.** The harness reports no Regency statistic at all.

3. **Does the female half of the game now carry too much?** Women hold the font, are usually the only safe people in the house, own the endgame concealment instrument, and are barred from the one thing that wins the game. The structure is coherent and the injustice is the point rather than an oversight. The failure mode is a player who reads the male line as a formality and the daughters as inventory. That is a UI and event-authoring problem rather than a data one, and it is the largest remaining design risk in the genetics. Watch it from the first playtest.

4. **Are births rerollable on reload?** The default is no. This is the more honest game and the harder sell. Nothing is implemented either way, since there is no save format (§8).

5. **Deleterious allele count in the founder genome.** Too few and inbreeding is free; too many and the first cousin marriage ends the run. Needs the harness before it can be set — do not guess it, measure it.

6. **Do rival houses simulate genetics fully, or only the player's family?** Full simulation makes the world coherent and rival ascension (The Quickening) real. It also multiplies cost by roughly eight. Recommend full genomes for the four named houses and pool-sampled shades for the rest.

7. **Does Fecundity change the Vessel?** *(new)* Spending a relative now costs the family her descendants as well as her attributes, and the rite does not know that. A fertile daughter and a barren one are the same Vessel to the rules and very different Vessels to the house.

---

*Related: `DesignConcepts/eldritch-dynasty-concept-brief.md` (the authority on game rules), `ARCHITECTURE.md` (where built things live), `AGENTS.md` (invariants and the operating manual), `do-to.md` (fertility options, decided and outstanding).*
