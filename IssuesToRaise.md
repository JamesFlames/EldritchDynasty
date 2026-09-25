# Issues to Raise

This file records the five highest-priority **new GitHub issues** identified from the project's Markdown documentation.

Scope: all 46 `.md` files on `main` were reviewed for documented gaps, risks, recommendations, and unresolved product work. The GitHub issue tracker was checked only to avoid proposing work that already has an open or completed issue.

The ordering below favours work that improves the core player experience before adding more systems. In particular, the strongest recommendations from `EngagingAndFunSuggestions.md` (#174) and `market research.md` (#184) were compared against the current tracker. Both research issues are closed, but several of their highest-priority implementation recommendations still have no issue of their own.

---

## 1. Add a visible House Ambition

### Suggested issue title

**Give the house one visible multi-generation ambition**

### Why this matters

The clearest repeated product risk in the documentation is that a player can make locally sensible decisions without being able to say what the family is trying to become over the next few generations.

Both `EngagingAndFunSuggestions.md` and `market research.md` rank a visible House Ambition among the highest-value changes. The point is not to add quests or another reward track. It is to make an existing long-term plan legible enough that the player can hold onto it while generations turn over.

Examples already supported by the design include:

- deepen the blood;
- prepare a named candidate for the next Ascension rung;
- restore another Ledger clause;
- repair the house's standing;
- secure a second viable branch;
- build a family capable of sustaining the final reading.

### Shape

Allow the player to choose **one voluntary active ambition**. It should be a lens over state and choices the game already has, not a new currency and not a source of bonuses.

Relevant decisions should be able to say that they advance, endanger, or are irrelevant to the current ambition. The player may abandon or replace it without penalty.

### Acceptance

- The player can choose, replace, and clear one House Ambition.
- The initial set contains at least four materially different ambitions using existing systems.
- Progress is derived from existing game state; no duplicate persistent progress ledger is introduced.
- The ambition grants no hidden bonus, score, reward currency, or forced objective.
- Relevant Match, table, Record, or ladder decisions can explain in plain language why they matter to the ambition.
- The UI can answer **"what is this house trying to do next?"** without requiring the player to reconstruct the plan from several screens.
- Short Line and Long Line ambitions respect their campaign-specific horizons and available Ledger/endgame rules.
- Add focused tests for ambition selection and derived progress.

### Related work

- #174 produced the recommendation but did not implement it.
- #184 independently made the same recommendation from market research.
- This should use the existing systems rather than reopen the balance work completed under #85, #133, #185, or #201.

---

## 2. Make delayed consequences follow act → echo → bill

### Suggested issue title

**Make important delayed consequences echo before they bill the house**

### Why this matters

Delayed consequences are one of the game's strongest ideas and one of its biggest readability risks.

Bearing, grievances, old Record claims, omitted knowledge, lost books, rival memories, and marriage decisions can all matter generations later. If the player sees only the original act and the eventual penalty/payoff, the result can feel like unrelated RNG rather than a consequence of something they chose.

This is explicitly called out in:

- `EngagingAndFunSuggestions.md` as **three-beat consequences**;
- `market research.md` as **act → echo → bill**;
- `BoringThingsAndHowToPreventThem.md` as a need to make delayed causality explicit in prose.

### Shape

For important long-memory decisions, prefer three beats:

1. **Act** — the player makes the choice.
2. **Echo** — within roughly a generation, a person, letter, Chronicle line, candidate description, rumour, or other fiction acknowledges it.
3. **Bill / payoff** — the material consequence arrives later.

The echo should normally be fiction or presentation, not a new stat popup.

### Acceptance

- Audit the main delayed-causality systems and identify the highest-value chains to expose.
- Ship at least three complete cross-generation act → echo → bill chains spanning different systems.
- Each echo contains a specific callback to a person, place, object, claim, or earlier decision rather than generic "your past has consequences" text.
- The later bill/payoff remains mechanically resolved by the system that already owns it; this issue must not introduce a second consequence engine.
- Hidden probabilities and internal readings such as Bearing remain hidden.
- A player can reconstruct the causal chain from the Chronicle/player-visible record without inspecting simulation state.
- Deterministic tests prove the echo is caused by the originating act and is not generic ambient flavour.
- Content/reach measurements verify the echoes are common enough to teach causality without becoming repetitive.

### Related work

- #36 owns Bearing's final evidence/playtest and should not be duplicated.
- This issue is broader presentation/causality work and should reuse Bearing, Record, grievance, tale, and Chronicle state rather than retune them.

---

## 3. Explain the next Ascension blocker in prose

### Suggested issue title

**Make the next Ascension obstacle legible without turning the ladder into progress bars**

### Why this matters

The Ascension Ladder is the headline long-term goal, but a multi-condition rung can fail in two bad ways:

- the player does not understand why they cannot progress;
- the game exposes every threshold and turns a mythic rite into checklist optimisation.

Both `EngagingAndFunSuggestions.md` and `market research.md` call for a short diagnosis of the next meaningful blocker. The recent longitudinal work also showed that intentional ascendant play materially changes ladder height and late movement, so the remaining player-facing need is to make those opportunities understandable rather than lower the gates.

### Shape

For the most relevant current candidate, surface:

- the next rung;
- the one or two dominant blockers;
- one concrete kind of action the house can take to improve each;
- uncertainty where the world genuinely cannot know the answer.

Examples:

- "He has the power, but has not learned enough beyond Fire."
- "The house is not yet held in enough regard for this to be tolerated."
- "There is nobody living who can carry the missing art into the final circle."
- "His mind cannot safely bear what the next rite requires."

Exact numbers can remain in deep inspection where already intended, but the primary diagnosis should be expressed in the language of the world.

### Acceptance

- The playable client exposes a diagnosis for the next relevant Ascension step.
- The diagnosis is derived through the existing `GameSession`/read-model boundary; the client does not inspect live simulation internals.
- It distinguishes at least the major blocker categories already documented by the ladder: Awakening/expression, Power, books/affinities, Respect, Mind/Madness, rites, Regalia, Ledger clauses, and final-circle family requirements.
- It prioritises the **one or two dominant blockers** instead of rendering a wall of thresholds.
- It updates immediately when a relevant decision changes the diagnosis.
- It does not reveal future RNG, hidden event weights, unborn children, or other unknowable state.
- Tests cover representative blocker transitions and prove the UI explanation follows the actual gate.
- No Ascension threshold is lowered as part of this issue.

### Related work

- #201 diagnosed late-ladder movement and was closed after succession/player exposure work. This issue should not reopen that tuning question.
- #61 and #185 established reachability/endgame evidence; this is a legibility issue, not an endings-balance issue.

---

## 4. Give every generation a question and a closing answer

### Suggested issue title

**Make each generation a small dramatic arc with one question and one answer**

### Why this matters

The concept says a generation is a chapter, but a chapter can still feel like a bundle of unrelated events. Both engagement documents recommend giving each generation one legible pressure so the player remembers it as a decision rather than as a date range.

Examples:

- The heir is brilliant and unstable — **do we risk him?**
- The line is thin — **do we marry for blood or survival?**
- The house is respected but lying — **do we protect the legend or the knowledge?**
- A daughter carries the best line — **do we spend it outward for an alliance?**
- The Ledger is close to another clause — **do we fund the reader or something more immediate?**

The simulation still determines what actually happens. The question is a framing device, not a scripted quest.

### Shape

At the start of a generation, derive one meaningful current question from the family's state. At the generation's close, answer what became of it using facts that actually occurred.

This should sit below the existing Age/chapter structure: Ages distinguish eras; generation questions distinguish the human-scale chapters within them.

### Acceptance

- A generation opening surfaces one concrete, family-specific question when a meaningful one can be derived.
- The question is generated from existing state and named people rather than selected from generic flavour alone.
- The closing view says what became of that question using actual events/decisions from the generation.
- The system does not promise an outcome or force the player to pursue the question.
- It does not introduce a new persistent simulation resource merely to remember the question; use derived/current chapter state unless persistence is demonstrably necessary.
- Questions can cover several systems rather than always defaulting to Ascension or marriage.
- Repeated consecutive generations do not produce the same question when the underlying pressure has materially changed.
- Deterministic tests cover opening selection and closing resolution.
- Add the playtest check: after a generation, a player should be able to answer **"what was that generation about?"** without consulting the UI.

### Related work

- This complements the completed Age/chapter work rather than replacing it.
- #174 and #184 both recommend this as a high-value way to make a long campaign memorable.

---

## 5. Make the Match present three futures and remember the roads not taken

### Suggested issue title

**Make each Match feel like choosing between three futures**

### Why this matters

Marriage is the game's central recurring strategic verb. The matchmaker panel work in #68 correctly made the choice informed without leaking genomes, but the engagement research identifies a separate problem: three well-informed dossiers can still read as three rows to optimise.

The Match should make the player feel they are choosing what kind of family comes next.

The strongest card identity might be:

- **Blood** — the dangerous line-concentration choice;
- **Standing** — the politically valuable alliance;
- **Continuity** — fertility, health, wealth, family depth;
- occasionally **Mystery** — incomplete evidence worth gambling on.

The detail panel can retain the simulation depth. The card face should answer: **"what kind of future is this person offering the house?"**

The unchosen candidates should not always disappear from history. A rejected suitor can later become a rival spouse, parent of another candidate, source of a grudge, book, title, scandal, or Chronicle callback.

### Shape

Build on the existing evidence-only matchmaker panel. Add a concise, diegetic interpretation of each candidate's strongest visible strategic identity, and allow a small fraction of rejected candidates to recur through systems that already remember people/houses.

### Acceptance

- Each Match card can present a concise "future of the house" reading derived only from information the player is allowed to know.
- The reading never accesses a candidate's genome or hidden truth directly.
- The three cards are allowed to express genuinely different strategic identities when the evidence supports them; do not fabricate contrast when the candidates are actually similar.
- The existing detailed matchmaker evidence remains available and remains the source behind the interpretation.
- At least one supported path lets a rejected candidate re-enter the run later as a named person or family connection.
- Rejected-candidate recurrence is occasional and meaningful, not a mandatory callback after every Match.
- Tests prove that interpretation uses observable/claimed evidence and cannot leak forbidden values such as a woman's hidden Fecundity.
- Human playtest: immediately after choosing, ask what future each candidate represented and why the player rejected the other two.

### Related work

- #68 is complete and should remain the epistemic foundation. This issue is about **decision identity and memory**, not adding more raw panel information.
- #174 and #184 both identify the Match as a highest-value recurring screen worthy of disproportionate polish.

---

## Why these five

These are the strongest unowned themes repeated across the Markdown corpus:

1. **Make the future readable** — House Ambitions.
2. **Make the past readable** — consequence echoes.
3. **Make long-term progress understandable** — ladder diagnosis.
4. **Make generations memorable** — question and answer.
5. **Make the main recurring choice emotionally and strategically distinct** — three-future Match.

They are deliberately preferred over adding a new combat layer, world map, generic relationship meters, more currencies, or more event volume. The project's own research repeatedly argues that Eldritch Dynasty already has enough systems; the higher-value work is making the existing systems produce clearer plans, causality, attachment, and memory.
