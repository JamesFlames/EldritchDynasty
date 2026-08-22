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
CLAUDE.md         Entry point for agents: orientation, commands, where to look next.
ARCHITECTURE.md   Where a thing lives, and how to add one.
AGENTS.md         The invariants, and the bugs that shipped.
DesignConcepts/   The concept brief. The authority on game rules.
.claude/skills/     eldritch-story (architecture + the frame), rothfuss-prose (events),
                    lovecraftian-prose (the frame's register).
```

What is not built yet — and every open design question — lives in
[the issue tracker](https://github.com/JamesFlames/EldritchDynasty/issues), one issue per system,
in build order.

```bash
npm install
npm run check     # typecheck + validate content + 699 tests
npm run dev       # authoring tool at localhost:5173
npm run shell     # the same tool, in the desktop shell

npm run harness -- 16 1000   # 16 headless thousand-year runs, with balance numbers
npm run digest  -- 8 400     # fingerprint 8 runs; diff across commits
```

## The interesting part: genetics

Characters do not inherit stats. They inherit **alleles**, and stats are computed. Real diploid genomes — loci, dominance, recombination over centimorgan positions, mutation. Everything the design asks for is a consequence of that rather than a special case:

- Regression to the mean and a fat tail for throwbacks fall out of Mendelian segregation.
- Cousin marriage concentrates the wanted alleles *and* exposes the founder's deleterious recessives, from one mechanism, in opposite directions.
- **Eldritch Power is X-linked and family-exclusive.** A son's font comes only from his mother; a father passes his single X intact to every daughter. So marrying outward genuinely dilutes the blood, cousin marriage is *the* mechanism rather than *a* mechanism, and daughters are the family's vault.
- Men are hemizygous on the X, so they express what women only carry — and break for the same reason. The setting's central law is a fact about chromosomes that the Church has built a doctrine on misexplaining.
- **Fertility is inherited too**, weighted seventy-thirty toward the mother. A man of a thin line is a mild disappointment; a woman of one is the whole marriage. So a fertile daughter is at once the best bride to give away and the worst one to lose. Fecund couples leave more descendants, so the family's fecundity climbs for two centuries and then settles — concentration pushes it up, marrying outward pulls it back, which is exactly the shape the blood itself has.
- Strength is sexually dimorphic: men are the stronger in about nineteen pairs in twenty. The twentieth is a woman worth writing down.

The attribute list is **open** — an attribute is six loci and a description, and nothing in the engine counts them.

## The family is more than one household

Name an heir and everyone else becomes a **cadet branch** — a hall of its own, with its own crowding brake, its own books, and its own memory. The family grows sideways the way real ones did, roughly seventy living across six halls by 2042 rather than twenty in one room.

Branches pay a tithe while they are content and stop while they are not. Grievance rises in a hall that holds a man who could have led and watches somebody lesser hold the seal, and it fades when nothing is wrong. When the main line runs out of men the seal goes to a cousin, and he is sent for, and everyone learns his name by spring.

## The debt pays out on a schedule

The 1042 contract has nine clauses and you begin knowing one. Every named Age reveals another — but only to a house that is keeping records, which means an archivist in service and paid for. Runs reach 2042 having recovered anywhere from four clauses to all nine, and the difference is not luck: it is whether anybody was writing things down during the centuries you were busy.

Clauses arrive in the chronicle in the contract's own hand. They are the one thing in the book nobody in the family wrote, and the only entries you are never offered the chance to edit.

## You are the one deciding

Choice events, the slots a mission asks you to cast, and the Record block — Record, Omit, Embellish — all go on a docket, and **the year does not turn while a decision stands**. Choices you cannot afford are shown anyway, greyed, with the reason: an unavailable option is information.

Omitting an entry does not remove it. It prints as a dated blank line, and the blanks are the thing players screenshot.

Hand the pen back whenever you like — the chronicler answers through exactly the same code, which is what the headless harness runs for a thousand years at a time.

## Frequency

Every event and character template declares `common | uncommon | rare | mythic`. It is a **rationing tier**, not a weight synonym — it reaches into scheduling (caps, cooldowns, a drought curve), presentation (a common event is one grey line; a mythic one is an illuminated page named in the chronicle forever), folklore, and whether a Record choice is required.

A mythic event is not *unlikely*. It is rationed: at most three in a thousand years, and the drought curve makes sure you get them.

## The engine, from outside

A run is reached through one narrow surface — `advance`, `choose`, `record`, `name`, `view`, `save` — so a client can be written against a documented seam rather than the whole simulation:

```ts
const game = newGame(loadContent(), { seed: 1042 });
game.advance(400);                       // stops the moment something needs an answer
const [decision] = game.pending;
game.choose(decision.id, 'send_the_boy');
const view = game.view();                // plain data: halls, chronicle, docket, clauses
const save = game.save();                // versioned, validated, and it reloads bit-identically
```

A year is an ordered table of named phases, each with its own RNG stream, so a system can be added, reordered or retimed without moving anybody else's dice. Content is loaded by one loader from one declared layout, indexed once, and every closed union in the engine ends in `assertNever` — the failure mode here is silence, and the compiler is the cheapest thing that breaks it.

## Contributing

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the map and [AGENTS.md](AGENTS.md) for the rules. It carries the invariants, the prose contract for event text, and a list of bugs that shipped — because the failure mode in this codebase is **silence**. Nothing throws. A house that quietly goes extinct, a chronicle that stops updating, an event that never fires: all of them look like a working simulation from the outside.
