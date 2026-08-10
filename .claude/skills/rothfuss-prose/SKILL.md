---
name: rothfuss-prose
description: Write or revise narrative prose in Patrick Rothfuss's style for Eldritch Dynasty — event bodies, outcome text, chronicle entries, Age blurbs, heirloom and character blurbs, tales and frame interludes. Use when authoring or editing any player-facing text in packages/content/**.yaml, when a body runs longer than five sentences, or when prose-lint warnings need fixing. Also use when asked to make text sound like Rothfuss, land a paragraph, cut adverbs, or fix flat rhythm.
---

# Rothfuss prose

The voice contract for every player-facing sentence in this game. Full manual: `reference/prose-manual.md` — read the section you need rather than the whole thing.

**The rule this project enforces:** any event body longer than **five sentences** is prose, not a note, and is held to what follows. `validateBundle()` counts the countable parts and warns.

## The core principle

Concrete over abstract, always. Name the thing. A reader believes a room they can hear and feel before one they can only see.

## The seven that matter most

1. **Sound and temperature before sight.** Establish a place by what it sounds like and what it does to your hands. Sight comes third, if at all.
2. **Describe by absence.** *No boots in the upper hall. No fire in six of the seven grates.* What is missing characterises a room faster than what is present.
3. **Jagged rhythm.** Long, long, short. Vary sentence length hard — flat rhythm is the commonest failure and the easiest to hear when read aloud.
4. **Land on a short sentence.** End the paragraph on something brief and concrete, and then **stop**. Never explain the landing; the sentence after a good close is the one that ruins it.
5. **Strong verbs, not verb-plus-adverb.** If an `-ly` word is carrying the meaning, the verb is wrong.
6. **Threes, used sparingly.** Announce a triad only at a structural moment. Two items feel incomplete; four feel like a list. If everything comes in threes the pattern stops meaning anything.
7. **One aphorism per two or three screens, maximum.** They are the seasoning. A paragraph of them is a fortune cookie.

## Diction

Plain, concrete, mostly Anglo-Saxon. **No archaisms** — `ere`, `mayhap`, `betwixt`, `whilst`, `'twas`, `forsooth`. Age is carried by *content*, not grammar: quote a price, name a tool, describe a practice.

## Parameterised text — the four that break at runtime

Event bodies are assembled from slot tokens, so some rules are about failure rather than taste (manual §16):

- **Never put a slot token in the final sentence.** A five-syllable generated name destroys a four-beat close.
- **Keep tokens off paragraph tails.** A length change costs least at the head of a sentence and most at the end.
- **No token inside an announced triad.** Three items are balanced by the author; substitution unbalances them.
- **No magnitude word beside a numeric token** (`fortune`, `pittance`, `ruinous`, `barely`, `enough to`). The sentence must survive every value the simulation can produce.

A writer overruling *adverb density* is usually right. A writer overruling these four is asserting that every value the engine can generate scans the same way, which nobody can know by looking at the template.

## On imitation

Rhythm, structure, sensory ordering and description-by-absence are techniques, and techniques are free. The **furniture** is not: named characters, invented terms, coined proverbs, actual sentences. If a phrase would make a Rothfuss reader nod in recognition, it is a quotation — cut it.

## Revising

Read it aloud. Then, in order (manual §20):

1. Cut every adverb that a stronger verb would replace.
2. Find the flat stretch — three sentences of similar length — and break it.
3. Check the paragraph lands short, and delete whatever follows the landing.
4. Move the first sensory detail to sound or temperature.
5. Count the aphorisms. Keep the best one.

## Where to look in the manual

| Need | Section |
|---|---|
| Rhythm, cadence, the long–long–short shape | §2 |
| Threes | §3 |
| Description by absence | §4 |
| Diction and word choice | §5 |
| Metaphor and simile | §6 |
| Sensory ordering | §7 |
| Paragraph shape and landings | §8 |
| Humour | §10 |
| Dialogue | §11 |
| Coining in-world vocabulary | §14 |
| Short passages — chronicle lines, blurbs | §15 |
| Slot tokens and assembled text | §16 |
| Multiple chroniclers with distinct voices | §17 |
| Anti-patterns | §18 |
| Before/after transformations | §19 |
| The revision procedure | §20 |
| Pre-submission checklist | §22 |
