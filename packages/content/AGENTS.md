# content — the authored game

YAML, and a loader whose only job is to hand files over as text. What a bundle
*is* lives in `schema/src/assemble.ts` → `CONTENT_LAYOUT`, which both this
loader and the editor's read. Do not restate it here.

```
attributes.yaml traits.yaml houses.yaml heirlooms.yaml clauses.yaml
loci.yaml         GENERATED. Edit tools/gen-loci.mjs and `npm run gen:loci`.
ages/  events/  arcs/  characters/      split across as many files as you like
```

## Before writing anything

Read **[docs/VOCABULARY.md](../../docs/VOCABULARY.md)** — every effect, condition,
filter, slot role, purpose and frequency obligation, generated from the schemas.
You should not need to open a `.ts` file to author content.

Read **[Background/eldritch-dynasty-world.md](../../Background/eldritch-dynasty-world.md)** for
the world the content is set in — places, distances, coin, law, the Church, the technology line,
and how a name is built. Nothing validates it, so an event set nowhere passes CI. Its §23 is the
checklist to run before you commit one; §24 is what is already fixed and may not be contradicted.

```bash
npm run validate     # 22 rules; exits non-zero on any error
```

## Events

- **Exactly three distinct purposes**, from the closed vocabulary.
- **Frequency is a rationing tier, not a weight.** It decides caps, cooldowns,
  whether a Record block is required, whether the world remembers, and how the
  chronicle renders it. Tune the profile and measure in the harness; never tune
  by nudging a per-template `weight`.
- **The cooldown is GLOBAL to the tier, and this is the single most important
  scheduling fact for anybody adding content in bulk.** `frequencyWeight`
  returns zero for a whole tier for `cooldownYears` after any template of that
  tier fires. Uncommon is 12 years, so a thousand-year run has room for about
  83 uncommon fires in total, *shared by every uncommon template in the game* —
  and each one you add divides that pool again. Common has no cooldown at all.
  So: a new scene that is ordinary texture belongs at `common`, and `uncommon`
  is a place you spend rather than a synonym for "not that often". A drop of a
  dozen uncommon templates measurably starved four existing ones here, and the
  first three attempts to fix it by weight did nothing, because weight cannot
  buy a share of a ration that is already spent.
- Bodies reference slots as `{SLOT}`. Undefined slots are errors.
- An arc-bound slot with `onMissing: continue_absent` **must** supply `absentBody`
  — otherwise it renders a token for a man forty years in the ground.
- **IDs are `snake_case` and are never renamed after commit.** Save files
  reference them. Slot names are not save-referenced and may be renamed — the
  editor rewrites the body's `{TOKEN}`s with them.
- **Slots fill in DEPENDENCY order**, not the order you wrote them. A
  `relation` filter comparing against a slot nothing has cast yet passes, so
  the engine casts the slots a filter points at first. Two filters pointing at
  each other are a cycle and fail the build: one of them can never narrow
  anything.
- **`decidedBy` says who takes the branch**, and defaults to `player`. Reach for
  `state` when the family's own condition has already decided and there is
  nothing to ask, and for `party` when the player's decision is *who goes* and
  a check over exactly those people decides the rest. A `party` decider needs a
  `castBy: player` slot and a check whose bands name CHOICES, not outcomes.
- **A second beat is `next` on an outcome**, with `keep` naming the slots the
  follow-up casts with the same people. Longer than three beats, write an arc.
- **Any body longer than five sentences is held to the prose contract.** Use the
  `rothfuss-prose` skill. `npm run validate` counts the countable half.

## Characters — two different things

- **`characters/founding.yaml`** — the twelve individuals who exist in 1042.
  Genomes are still *rolled*; `bias` nudges an authored intent without pinning it.
- **`characters/templates.yaml`** — recipes for everyone the next thousand years
  produces: suitors, grooms, rivals, tutors, midwives, wanderers.

A template's most consequential field is `houses`, because it decides whether
that person carries anything, and the player can never see it. Review templates
with the editor's **Roll 24** preview, not by reading the form: a recipe that
reads like deep blood and produces nothing but nulls looks correct on paper.

Nothing spawns people outside `core/src/people/minting.ts`.

## Adding a collection

One row in `CONTENT_LAYOUT` (`schema/src/assemble.ts`) and one field on
`ContentBundleS`. Both loaders pick it up; `bundle.test.ts` checks that every
declared collection has a place to come from.
