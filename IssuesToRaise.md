# Issues to Raise

This file records the ten highest-priority **new GitHub issues** identified from the project's Markdown documentation.

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

## 6. Add biased living advisers to high-value decisions

### Suggested issue title

**Let living family members advise the player from their own interests and knowledge**

### Why this matters

`market research.md` ranks biased living advisers as a P0 improvement because one feature can improve tutorialisation, character attachment, worldbuilding, uncertainty, and replay at the same time.

The family already contains readers, priests, soldiers, stewards, brokers, old Heads, and career specialists. At present those people mostly matter as simulation state or as event cast. They can also become the game's way of explaining difficult decisions without turning the UI into a neutral strategy guide.

The key is that advice must be **situated and biased**. A priest should not say the objectively correct thing about a rite. A broker should value a match differently from an archivist. Two advisers may disagree because they know different facts or want different outcomes.

### Shape

Attach one or two contextually relevant living advisers to high-value decisions such as:

- Match;
- Record / Omit / Embellish;
- Muster;
- land decisions;
- succession;
- rites and Respect-sensitive choices.

Advice should be generated from information that adviser could reasonably know, their role/career, their relationship to the people involved, and their interests. It must never be a hidden-state oracle.

### Acceptance

- At least four decision surfaces can request contextual advice from existing living family members.
- Adviser selection is derived from current family state and relevant careers/roles rather than from a fixed narrator list.
- Two eligible advisers can disagree on the same decision for explainable reasons.
- Advice never exposes genomes, hidden event weights, future RNG, Bearing values, or other information unavailable to the adviser/player.
- The adviser is named and their reason for caring is visible.
- Advice changes when the adviser, relationship, career, or known record changes.
- No new universal `opinion` score or diplomacy meter is introduced.
- Deterministic tests prove that advice is based on permitted knowledge and that conflicting advice can occur.
- Human playtest: players should remember at least one adviser as a person, not only as a tooltip source.

### Related work

- #44 established the small foreground cast; this should reuse named living people rather than invent a separate adviser cast.
- #174 and #184 both argue that attachment should come from attention and recurring people rather than portrait art or generic relationship bars.

---

## 7. Make Ages change what the player cares about

### Suggested issue title

**Make each Age mechanically recognisable from play, not just from its name**

### Why this matters

The design repeatedly says an Age is a **setting**, not merely a modifier. `EngagingAndFunSuggestions.md` and `market research.md` both sharpen that into the same test: a player should be able to identify an Age from date-stripped play because it changes priorities, not simply because some event weights or penalties are larger.

A long campaign needs its centuries to ask different strategic questions. If the same marriage qualities, careers, Record temptations, and resource pressures remain optimal throughout, the Age labels are atmosphere rather than structure.

### Shape

Each Age should materially change at least two of these:

- which marriage qualities are attractive;
- which event types are dangerous;
- which resource is under pressure;
- which Chronicle lie is tempting;
- which careers or kinds of people become valuable.

Do not solve this as a universal late-game difficulty multiplier. The player should change plans because the **kind of problem** changed.

### Acceptance

- Every shipped Age has at least two player-facing strategic priorities that differ materially from the neutral/default state.
- Those differences are expressed through systems the game already owns: marriage, careers, economy, Record, events, Church attention, mortality, library, land, Muster, or similar existing mechanics.
- At least one Age changes what makes a good Match candidate.
- At least one Age changes which career/person type becomes strategically valuable.
- At least one Age changes the immediate temptation around Record/Omit/Embellish or another recurring decision.
- Do not introduce a generic `lateGameMultiplier` or equivalent catch-all scaling system.
- Add a date-stripped diagnostic/playtest set: a player given representative states from different Ages should be able to distinguish them from what matters strategically, not from the displayed Age name.
- Existing Age scheduling, clause cadence, and campaign-relative late-phase rules remain intact unless evidence from this work requires a separately raised balance issue.

### Related work

- The existing Age scheduler, Age-exclusive content, chaptering, and #85 longitudinal work provide the foundation.
- This issue is about **player-facing strategic differentiation**, not simply adding more Age events.

---

## 8. Give the campaign two or three recurring external relationships

### Suggested issue title

**Turn rival houses and institutions into recurring relationship threads**

### Why this matters

The world already has rival houses, the Church, grudges, records, marriage links, careers, rumours, and outside witnesses. The engagement docs argue that those systems become much more memorable when the same external names recur across generations instead of every conflict arriving from a fresh stranger.

Recurring opposition creates social memory. A later event matters more when the player recognises the house that refused them, the clerk who saw the lie, or the institution that once helped them.

The goal is not a diplomacy system. It is to make existing simulation relationships **recur in fiction and decisions**.

### Shape

Keep roughly two or three active external threads at a time. A thread may be:

- a rival house;
- a Church/institutional relationship;
- an old witness, archive, creditor, broker, or family connection.

Each should have a remembered origin and a current pressure or desire. Over time the same relationship can reappear in different roles: rival, marriage partner, witness, ally, source of records, keeper of a book/heirloom, or cause of a grudge.

### Acceptance

- A run can sustain two or three named external threads concurrently without adding a generic relationship bar.
- Each thread records or derives a specific origin that later callbacks can name.
- At least three existing systems can consume the same thread across time, for example Match + Record + event, or grudge + book + Church challenge.
- A relationship is allowed to change direction; a rival can become useful, an ally can become hostile, and a rejected house can return through descendants.
- Recurrence uses existing people/houses/records where possible rather than minting a parallel diplomacy-state model.
- Chronicle/event text references the concrete origin of the relationship instead of generic "old rivalry" wording.
- Deterministic tests demonstrate a relationship surviving across generations and affecting more than one kind of decision.
- Human playtest: after several generations, a player should be able to name at least one outside house/institution and explain **why this family cares about them**.

### Related work

- Existing grudges, Bearing, Match history, Record evidence, careers, and rival houses should be reused.
- This should not become a CK-style universal opinion system; both recommendation documents explicitly reject that direction.

---

## 9. Make deliberate rites feel like campaign climaxes

### Suggested issue title

**Give major rites a deliberate before-and-after presentation**

### Why this matters

The top rites are among the most expensive decisions in the entire campaign: they consume named people, preparation, books, heirlooms, standing, or years of family work. The mechanics now expose deliberate rite calls, but the engagement docs warn that a mechanically deliberate verb can still feel like "an event fired" if presentation does not acknowledge the scale of the choice.

A rite should feel like the moment several generations of preparation are being spent at once.

### Shape

Before a major rite, show a concise **assembly** of what makes the attempt possible and what is at risk:

- who is attempting it;
- who else is being risked or consumed;
- which books, Regalia, readers, or family preparations matter;
- what cannot be undone.

After resolution, give the result enough Chronicle/prose weight to match the cost, including on failure.

The mechanical resolution remains in the existing rite/decision path.

### Acceptance

- Vessel, Great Rite, and Unmaking each receive a dedicated pre-resolution summary built from current run facts.
- The summary names the people and irreplaceable resources involved rather than presenting generic ritual copy.
- The player explicitly confirms the irreversible action from that presentation layer.
- Resolution still goes through the existing core rite mechanics; no duplicate resolution logic is introduced in the client.
- Success and failure both produce Chronicle treatment proportional to the significance of the attempt.
- A failed rite still names what was spent/lost and does not collapse into a generic failure toast.
- The UI does not expose hidden probabilities or outcomes before commitment.
- Tests cover the data supplied to the pre-rite assembly and the resulting Chronicle entry for both success and failure paths.
- Human playtest: a player who has performed a major rite should be able to name who/what made it possible and what it cost.

### Related work

- #185 and the deliberate-rite work established reachability and player-callable mechanics. This issue is presentation and memory, not balance.

---

## 10. Compress mastered low-stakes routine without creating auto-play

### Suggested issue title

**Let the player delegate mastered low-stakes repetition while interrupting for meaningful choices**

### Why this matters

A twenty-generation campaign can turn good recurring mechanics into clerical work if the player is repeatedly asked to make decisions whose answer they already know.

Both major recommendation documents call this out. The goal is not to reduce the number of meaningful decisions and not to create an auto-play mode. The goal is to protect the player's attention so that a Match, sacrifice, rare event, or important Record choice still feels like an interruption worth reading.

### Shape

Allow narrow standing preferences for decisions that are demonstrably routine, for example:

- default education for low-stakes cadet children;
- routine low-value career placement;
- collapsing obviously irrelevant Match detail after inspection;
- handling genuinely harmless Chronicle entries according to a chosen policy.

Delegation must break whenever the decision becomes important.

### Acceptance

- At least two categories of low-stakes repeated decisions can be delegated through explicit player preferences.
- Delegation is opt-in and narrow; there is no general "play for me" switch in the default experience.
- Delegation automatically stops and surfaces the decision when any of these are involved: heir, sacrifice, major rite, Discrepancy, rare/mythic event, active House Ambition, or another clearly ending-relevant state.
- If pinned/watched-person functionality exists when this issue lands, any decision involving such a person also interrupts delegation.
- The player can inspect what was delegated afterward through the Chronicle or another existing record.
- Delegated decisions use the same underlying verbs/rules as manual decisions rather than a shortcut simulation path.
- Deterministic tests prove that interrupt conditions cannot silently delegate an important choice.
- Measure decision counts before and after on Short and Long Line; the result should remove repeated low-stakes prompts without materially reducing the meaningful decision stream.
- Human playtest: players should report fewer clerical decisions without being surprised that the game made a consequential choice for them.

### Related work

- #88 measured the ambient choice stream and established that decision density needs evidence rather than intuition.
- This issue should use that instrumentation rather than simply lowering event frequency.

---

## Why these ten

These are the strongest unowned themes repeated across the Markdown corpus:

1. **Make the future readable** — House Ambitions.
2. **Make the past readable** — consequence echoes.
3. **Make long-term progress understandable** — ladder diagnosis.
4. **Make generations memorable** — question and answer.
5. **Make the main recurring choice emotionally and strategically distinct** — three-future Match.
6. **Make explanation come from people** — biased living advisers.
7. **Make centuries strategically different** — mechanically recognisable Ages.
8. **Make the outside world remember** — recurring external relationships.
9. **Make irreversible progress feel irreversible** — rite presentation climaxes.
10. **Protect the player's attention** — narrow delegation of mastered routine.

They are deliberately preferred over adding a new combat layer, world map, generic relationship meters, more currencies, or more event volume. The project's own research repeatedly argues that Eldritch Dynasty already has enough systems; the higher-value work is making the existing systems produce clearer plans, causality, attachment, strategic differentiation, social memory, and better use of player attention.
