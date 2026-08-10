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

```bash
npm run validate     # 14 rules; exits non-zero on any error
```

## Events

- **Exactly three distinct purposes**, from the closed vocabulary.
- **Frequency is a rationing tier, not a weight.** It decides caps, cooldowns,
  whether a Record block is required, whether the world remembers, and how the
  chronicle renders it. Tune the profile and measure in the harness; never tune
  by nudging a per-template `weight`.
- Bodies reference slots as `{SLOT}`. Undefined slots are errors.
- An arc-bound slot with `onMissing: continue_absent` **must** supply `absentBody`
  — otherwise it renders a token for a man forty years in the ground.
- **IDs are `snake_case` and are never renamed after commit.** Save files
  reference them.
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
