# client — the game

Vue 3 + Vite, on port 5174. `npm run play`.

The editor is a tool for making the game; this is the game. They share a
palette and nothing else.

## The one rule

**Everything comes through `GameSession`, and every call to it is in
`src/lib/game.ts`.**

`session.ctx` is reachable — the editor needs it for previews — which makes it
the shortcut this package will reach for the first time the read model is
missing something. It is not a shortcut. It is live simulation state that
changes under the render, which is what the editor's `version` counter exists
to work around, and reading it means this is no longer written against the
seam.

If the UI needs something it cannot get from `view()`, `table()` or a verb, the
missing thing is a verb on `core/src/session.ts` — go and add it there. Six
things went on the read model while this package was written, every one of them
found by trying to draw it: the header printed `house_gearithy` at the player,
a card printed `max_age` and `the_tutors_aphorisms`, the halls arrived as flat
lists with nothing joining a parent to a child, the record would not say which
attributes it had actually spoken about, the Ages were not on the view at all,
and the table could not offer a post or say who the market may be shown.

`verbs.test.ts` enforces both halves of that, and neither end of it is a list
anybody maintains:

```
GameSession's methods  →  called in game.ts  →  an action a template calls
```

The first list comes off the prototype, the second off the store. Add a verb to
`session.ts` and this package fails until it is wired all the way to something
clickable — which is the only thing standing between the content's two `party`
deciders and a `send` verb that silently never fires.

## The read model is a photograph

`view()` is values only, by contract. Every verb goes through the store, the
store retakes the whole picture, and Vue re-renders because the object is new.
Nothing holds a reference into the world and nothing needs telling what changed.

A component that mutated `view` or `table` would be editing a photograph.

## The record is the headline

The tree draws `member.record` — claimed attributes, claimed traits, claimed
death, and the claimed parents. The person the simulation generated is under
the card, which is the right amount of friction: the family's own documents are
what the family has.

`record.attrs` fills in the real value for any attribute the record has never
spoken about, so a UI never has to fall back — and drawn unfiltered that puts a
woman's Fecundity on her card, which deletes §7's marriage market in one line.
Draw `record.claimed` and nothing else.

## Typecheck the templates, and compile them

```bash
npm run typecheck:client   # vue-tsc. Plain tsc cannot see .vue files.
npx vitest run packages/client
```

`vue-tsc` catches a property that is not on a prop. It does **not** catch a
template that will not parse: an apostrophe inside a bound attribute got
through `npm run typecheck` clean and then served a 500 and a blank page.
`templates.test.ts` runs the real compiler over every `.vue` for that reason.

The editor's gotcha list applies here too — see
[packages/editor/AGENTS.md](../editor/AGENTS.md). One correction from
measurement: a TypeScript cast in a template expression does work in this Vue,
verified in a browser. It is still avoided here, because `v-model` says the
same thing without the question.

## What is not built

The prologue proper ([#38](https://github.com/JamesFlames/EldritchDynasty/issues/38))
and the collection, the five endings and the epilogue
([#39](https://github.com/JamesFlames/EldritchDynasty/issues/39)). The start
screen and `Ending.vue` are where those land; today the first is a seed field
and the second is a tally and a note saying so.

Four layers the read model already carries reach no screen here —
`looseSecrets`, `tales`, `marriagePromises` and the Assize's arm beyond its one
line in the header. That is
[#40](https://github.com/JamesFlames/EldritchDynasty/issues/40), and it is the
cheapest work in the repository: every one of them is already a value on
`SessionView`.

There is no Save/Load menu on purpose — the shell owns the disk and is covered
end to end by `npm run smoke`. `game.ts` keeps the run in `sessionStorage` so a
reload during a long sitting is not the end of it, and that is all.
