# Eldritch Dynasty

A text-based generational strategy game. One thousand years, roughly forty generations, one bloodline.

You are not a character. You are the will of a bloodline — the thing that persists while individuals are born, ruined and buried. You never fight, never explore, and never speak a line of dialogue. You decide **who marries whom**, **who is spent**, **what gets written down**, and what each child is called.

> In year 1042 your ancestor signed something. In 2042 the other party comes to collect.

**Status:** pre-production. The simulation, content pipeline, authoring tool and desktop shell are working; the game client is not built yet.

---

## What's here

```
packages/
  schema/    Zod schemas + types. The single source of truth.
  core/      Pure simulation. Zero DOM, seeded RNG, deterministic.
  content/   Authored YAML: events, ages, characters, templates, arcs, loci.
  editor/    Vue 3 + Vite authoring tool. Imports core directly.
  shell/     Electron wrapper. Owns the window and the disk, and no rules.
DesignConcepts/   Concept brief, data model, event editor brief.
Writing/          Voice contract and story-design references.
do-to.md          Open design questions, with options and a recommendation.
```

```bash
npm install
npm test          # 98 tests
npm run typecheck
npm run dev       # authoring tool at localhost:5173
npm run shell     # the same tool, in the desktop shell

# 12 headless thousand-year runs
npx tsx --tsconfig tsconfig.base.json packages/core/src/harness.ts 12 1000
```

## The interesting part: genetics

Characters do not inherit stats. They inherit **alleles**, and stats are computed. Real diploid genomes — loci, dominance, recombination over centimorgan positions, mutation. Everything the design asks for is a consequence of that rather than a special case:

- Regression to the mean and a fat tail for throwbacks fall out of Mendelian segregation.
- Cousin marriage concentrates the wanted alleles *and* exposes the founder's deleterious recessives, from one mechanism, in opposite directions.
- **Eldritch Power is X-linked and family-exclusive.** A son's font comes only from his mother; a father passes his single X intact to every daughter. So marrying outward genuinely dilutes the blood, cousin marriage is *the* mechanism rather than *a* mechanism, and daughters are the family's vault.
- Men are hemizygous on the X, so they express what women only carry — and break for the same reason. The setting's central law is a fact about chromosomes that the Church has built a doctrine on misexplaining.
- **Fertility is inherited too**, weighted seventy-thirty toward the mother. A man of a thin line is a mild disappointment; a woman of one is the whole marriage. So a fertile daughter is at once the best bride to give away and the worst one to lose, and the mean fecundity of the family visibly climbs over a run, because fecund people leave more descendants.
- Strength is sexually dimorphic: men are the stronger in about nineteen pairs in twenty. The twentieth is a woman worth writing down.

The attribute list is **open** — an attribute is six loci and a description, and nothing in the engine counts them.

## The family is more than one household

Name an heir and everyone else becomes a **cadet branch** — a hall of its own, with its own crowding brake, its own books, and its own memory. The family grows sideways the way real ones did, roughly seventy living across six halls by 2042 rather than twenty in one room.

Branches pay a tithe while they are content and stop while they are not. Grievance rises in a hall that holds a man who could have led and watches somebody lesser hold the seal, and it fades when nothing is wrong. When the main line runs out of men the seal goes to a cousin, and he is sent for, and everyone learns his name by spring.

## You are the one deciding

Choice events, the slots a mission asks you to cast, and the Record block — Record, Omit, Embellish — all go on a docket, and **the year does not turn while a decision stands**. Choices you cannot afford are shown anyway, greyed, with the reason: an unavailable option is information.

Omitting an entry does not remove it. It prints as a dated blank line, and the blanks are the thing players screenshot.

Hand the pen back whenever you like — the chronicler answers through exactly the same code, which is what the headless harness runs for a thousand years at a time.

## Frequency

Every event and character template declares `common | uncommon | rare | mythic`. It is a **rationing tier**, not a weight synonym — it reaches into scheduling (caps, cooldowns, a drought curve), presentation (a common event is one grey line; a mythic one is an illuminated page named in the chronicle forever), folklore, and whether a Record choice is required.

A mythic event is not *unlikely*. It is rationed: at most three in a thousand years, and the drought curve makes sure you get them.

## Contributing

Read [AGENTS.md](AGENTS.md) first. It carries the invariants, the prose contract for event text, and a list of bugs that shipped — because the failure mode in this codebase is **silence**. Nothing throws. A house that quietly goes extinct, a chronicle that stops updating, an event that never fires: all of them look like a working simulation from the outside.
