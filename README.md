# Eldritch Dynasty

A text-based generational strategy game. One thousand years, roughly forty generations, one bloodline.

You are not a character. You are the will of a bloodline — the thing that persists while individuals are born, ruined and buried. You never fight, never explore, and never speak a line of dialogue. You decide **who marries whom**, **who is spent**, **what gets written down**, and what each child is called.

> In year 1042 your ancestor signed something. In 2042 the other party comes to collect.

**Status:** pre-production. The simulation, content pipeline and authoring tool are working; the game client is not built yet.

---

## What's here

```
packages/
  schema/    Zod schemas + types. The single source of truth.
  core/      Pure simulation. Zero DOM, seeded RNG, deterministic.
  content/   Authored YAML: events, ages, characters, templates, arcs, loci.
  editor/    Vue 3 + Vite authoring tool. Imports core directly.
DesignConcepts/   Concept brief, data model, event editor brief.
Writing/          Voice contract and story-design references.
```

```bash
npm install
npm test          # 67 tests
npm run typecheck
npm run dev       # authoring tool at localhost:5173

# 12 headless thousand-year runs
npx tsx --tsconfig tsconfig.base.json packages/core/src/harness.ts 12 1000
```

## The interesting part: genetics

Characters do not inherit stats. They inherit **alleles**, and stats are computed. Real diploid genomes — loci, dominance, recombination over centimorgan positions, mutation. Everything the design asks for is a consequence of that rather than a special case:

- Regression to the mean and a fat tail for throwbacks fall out of Mendelian segregation.
- Cousin marriage concentrates the wanted alleles *and* exposes the founder's deleterious recessives, from one mechanism, in opposite directions.
- **Eldritch Power is X-linked and family-exclusive.** A son's font comes only from his mother; a father passes his single X intact to every daughter. So marrying outward genuinely dilutes the blood, cousin marriage is *the* mechanism rather than *a* mechanism, and daughters are the family's vault.
- Men are hemizygous on the X, so they express what women only carry — and break for the same reason. The setting's central law is a fact about chromosomes that the Church has built a doctrine on misexplaining.

## Frequency

Every event and character template declares `common | uncommon | rare | mythic`. It is a **rationing tier**, not a weight synonym — it reaches into scheduling (caps, cooldowns, a drought curve), presentation (a common event is one grey line; a mythic one is an illuminated page named in the chronicle forever), folklore, and whether a Record choice is required.

A mythic event is not *unlikely*. It is rationed: at most three in a thousand years, and the drought curve makes sure you get them.

## Contributing

Read [AGENTS.md](AGENTS.md) first. It carries the invariants, the prose contract for event text, and a list of bugs that shipped — because the failure mode in this codebase is **silence**. Nothing throws. A house that quietly goes extinct, a chronicle that stops updating, an event that never fires: all of them look like a working simulation from the outside.
