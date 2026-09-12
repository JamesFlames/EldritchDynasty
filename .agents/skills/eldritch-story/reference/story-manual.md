# Story Design for Eldritch Dynasty

A working manual for architecting the run: **Rothfuss's structure, Dunsany's register, Lovecraft's unknowable.** It covers structure, character, world, magic, escalation, plot and pacing, and it is the voice contract for the **frame** and the **myth layer**.

It is not the voice contract for events. Individual event bodies, outcome text and blurbs are **pure Rothfuss** — see `.claude/skills/rothfuss-prose/reference/prose-manual.md`. When this manual says "write," it means the frame, the interludes, the Ledger clauses, the nested tales and the Age blurbs.

### How to use this document

§0–§3 are the architecture, and nothing else works without them. §4–§11 are design components, usable in any order. §12–§15 are plot, escalation and theme. §16–§19 are craft procedure. §20–§21 are warnings and portability. §22–§24 are for auditing a finished design.

| Part | Sections | What it covers |
|---|---|---|
| **I — Architecture** | §0–§3 | The thesis, the three traditions, the three layers, the frame's own arc |
| **II — Components** | §4–§11 | Prologue, the line, cast, two-tier antagonism, magic, world, nested tales, hidden truth |
| **III — Plot and escalation** | §12–§15 | Episodic structure, the seven stages, tension engines, motif and tone |
| **IV — Procedure** | §16–§19 | Scenes, pacing, endings, the two-class ledger |
| **V — Warnings and reuse** | §20–§21 | What not to copy; porting the architecture |
| **VI — Audit** | §22–§24 | Failure modes, generation procedure, quick reference |

---

## 0. The One-Sentence Thesis

> **This is the true story of how the house became the thing people sing about — told by the last of the line, on the last night, to the creditor sitting across the table.**

Everything in this document is downstream of that sentence. The structural claim inside it is Rothfuss's: **a story about a story, where the gap between the legend and the truth is the actual subject.** If your design does not have a gap between *what people say happened* and *what happened*, you are writing epic fantasy.

There is a second sentence, and it governs tone rather than structure:

> **A beautiful myth, told by someone who has glimpsed something behind the myth.**

The first sentence tells you what to build. The second tells you what it should feel like standing in. A design that satisfies one and not the other is half-built: architecture with no dread, or dread with nothing holding it up.

The genre furniture — the house, the blood, the affinities, the Church — is interchangeable. The architecture is not.

---

## 1. The Three Traditions, and What Each One Owns

Three sources, three jobs. They are complementary at the level of function and genuinely contradictory at four specific points. Those four points are resolved below, and the resolutions are load-bearing — do not re-open them mid-design.

### Division of labour

| Tradition | Owns | Does **not** own |
|---|---|---|
| **Rothfuss** | Architecture: the three layers, Ages-as-episodes, the three debts, cast slots, tension engines, ledger discipline, the legend/truth gap, human-scale stakes | The cosmic tier. The frame's diction. Anything that is supposed to be incomprehensible |
| **Dunsany** | Register of the frame and the myth layer. Beauty before dread. Melancholy. Mythic narrative distance. Motif. Impossible and lovely things that do not last | Event bodies. The weekly conflict. The arithmetic of poverty |
| **Lovecraft** | The unknowable: the cosmic tier, epistemic escalation, knowledge-as-danger, what is never explained, the inadequacy of human categories | Gore. Cults as furniture. Villain plans. Anything with a stated motive |

The shorthand: **Rothfuss builds the house, Dunsany decides what the light is like in it, Lovecraft decides what is underneath it.**

### The four resolved conflicts

**1. The Ledger demands answers; the unknowable demands mystery. → Two classes of question.**

Rothfuss's ledger (§19) requires every mystery to have a written answer, a scheduled partial payoff, and one question closed completely per volume. Lovecraft requires the unknown to survive the ending. Both are right, about different questions.

- **Mundane questions** — who poisoned the heir, what the rival house wants, why the Church moved against the family in 1408 — get the full Rothfuss treatment. Written answer, scheduled payoff, closed on time, and the player is *told*.
- **Cosmic questions** — what the other party is, what the contract is actually for — get an answer **written before anything ships** and **never spoken in the game's own voice**. Their payoffs eliminate possibilities rather than confirm one.

The "one question closed per Age" rule is satisfied only by mundane questions. Full procedure in §19.

**2. The mythic antagonist is tragic; the cosmic entity has no motives. → Two tiers of antagonism.**

The **proximate mythic tier** — the ancestor who signed, the signatories, the servants, the rival houses, the Church — is tragic, knowable in principle, and denied by educated society. It supplies the epistemic quest and the weekly friction. The **cosmic tier** — the other party — is indifferent and never explained.

The horror lives in the seam: the tragic tier believed it was **bargaining with someone**. Full design in §7.

**3. Plain diction versus elevated diction. → Split by ownership, not by sentence.**

This skill writes **Dunsanian**: elevated but not archaic, long accumulating clauses, mythic distance, "it is said," "few now remember." That register belongs to the frame, the interludes, the Ledger clauses, the nested tales, the Age blurbs and the prologue.

Event bodies, outcome text and character blurbs are **pure Rothfuss** and are not this skill's business. Do not apply Dunsanian diction to them, and do not apply the five-sentence prose rule to the frame.

The boundary is a feature. When the game's prose goes ornate, the player is being told they have left the ledger and entered the myth — and the myth is the layer that lies.

**4. A short-story escalation across a thousand years. → One stage per Age.**

The seven-stage ontological escalation is a short-story shape. It maps to the run at **Age granularity**: each Age occupies exactly one stage, some stages take two Ages, and the stage an Age occupies determines what its Ledger clause is permitted to say. Individual events do not escalate internally — they pay spine debts in the Rothfuss way. Full mapping in §13.

---

## 2. The Three-Layer Narrative Architecture

A nesting doll with three layers, each with its own person, tense, tempo, register and clock. Design all three deliberately, and do not let them blur.

| Layer | What | Volume | Tempo | Register |
|---|---|---|---|---|
| **The Frame** | 2042. Two at a table, and the chronicle between them | ~5% | Slower than everything around it | **Dunsanian** |
| **The Tale** | 1042–2042. The run itself, in the chronicler's voice | ~90% | A generation is a chapter | **Rothfuss** |
| **Nested tales** | What the world says about the family | ~5% | Interruptions | **Dunsanian** |

### Layer 1 — The Frame (2042)

- **Person/tense:** Third person, present tense. Cool, elegiac, slow.
- **Content:** The legend, arrived at its bill. One is the last of the blood. One is not a person. Between them sits the chronicle the player spent the run writing.
- **Function:** It is the *promise*. Every generation is played against *how does this become that?*
- **Rule:** The frame is *quieter* than the tale. Its register is loss, restraint and waiting.
- **Rule:** The frame never dispenses systems information. It reacts to the record.
- **Rule:** The frame must be able to *contradict* the tale. A present-day layer that can never call the record a lie is decoration. See §3.

### Layer 2 — The Tale (1042–2042)

- **Person/tense:** Told in the chronicler's voice, past tense, warm and wry and confiding.
- **Function:** It is the *engine*. This is 90% of the text.
- **Rule:** It is being **performed** for someone who can interrupt. The chronicler knows how it ends, chooses what to include, and is allowed to say so.
- **Rule:** This layer is where the **warmth** lives. Humour, rooms the player wants to be in, people worth losing. The cosmic layers have no room for warmth in their tone budget (§15) and do not need any, because the Tale carries it. A run with no warmth is a chore however good the dread is.

### Layer 3 — The Nested Tales

- **Content:** Songs, sermons, court testimony, children's rhymes, drunk accounts, rival houses' versions — told *by someone inside the world*.
- **Function:** Three jobs at once — deliver mythology without an exposition dump, provide *conflicting* versions so the player must adjudicate, and rhyme thematically with the line's arc so the folktale is secretly a warning.
- **Rule:** **No nested tale is neutral.** Every one is told by someone with a stake, and the teller is always named and always biased. Construction procedure in §10.

### Design procedure

1. Write the frame situation first: **who is at the table, and what is each of them pretending to be?**
2. Decide why the telling happens *now*, after a thousand years of silence.
3. Decide what each party wants from the telling. One wants the record settled. One does not want anything in a way a person would recognise.
4. Only then design the run, working backwards from the last night.

---

## 3. The Frame's Own Arc — and How to Write It

The commonest failure in imitating this architecture is treating the frame as a *mood* rather than a story. A frame that is the same in the last interlude as in the first teaches the player to skim it, and once they skim it the structure collapses — because the frame is the only thing making the run mean anything.

### The compressed three acts

- **Act one: the disguise holds.** Quiet, formal, diminished. The player's question is *why*.
- **Act two: it stops holding.** The record and the room start disagreeing. The question becomes *what did this to them*.
- **Act three: it acts.** Badly, or too late, or in a way that reveals what the house became. The question becomes *was any of it ever avoidable*, and the honest answer is complicated.

### The five techniques

1. **A worsening clock.** Something in 2042 is going wrong on a schedule that has nothing to do with the telling. Every interlude, one notch worse. This is what stops the frame feeling like a framing device.
2. **A relationship that changes.** The listener begins as audience and ends as participant. By the final interlude one of them should want the other to stop.
3. **Escalating contamination.** Early interludes stand apart from the tale. Late ones bleed: the frame answers a question the tale just asked, an object from the tale is on the table, the creditor reacts to a name before the record reaches it.
4. **The competence gap.** Show the last of the line failing at something an ancestor did easily. The frame's single strongest move, and precisely because of that, use it **at most three times** in a run.
5. **Contradiction.** At least once, let 2042 prove the record wrong — an object that does not match its description, a scar in the wrong place, a witness who was there. The player must learn early that the chronicle can be caught.

### Interlude placement

- **After** an emotional peak, never before one. The interlude is the exhale.
- At Age breaks, which the run gives you for free.
- Never two in a row.
- **Lengths fall.** The first interlude can breathe. The last should be very short.

### The frame's register — Dunsanian

This is where the register split (§1) becomes a writing instruction. The frame is the game's most elevated prose.

**Favour:**

- **Elevated diction, not archaic diction.** *Beneath, beyond, upon, ancient, unremembered, innumerable, accursed, desolate, melancholy, elder.* Never *ere*, *mayhap*, *betwixt*, *whilst*, *'twas*. Age is carried by weight and cadence, not by grammar that has been dead for four hundred years.
- **Long, accumulating sentences.** Let clauses gather. *Beyond the last of the family's holdings, where the tenants said the river had once run the other way and the older ones would not say why, there stood a house whose foundations were older than the name above its door.* Not: *There was a house. It was very old.*
- **Short sentences for impact, used rarely.** The long line is the frame's default; the short line is its punctuation.
- **Mythic distance.** *It is said. Few now remember. The oldest of the family's books relate. There are matters concerning which even the chronicle is silent.* Do not overuse these — three or four per interlude is already too many. The narrator should feel **ancient, informed, and slightly unreliable**.

**Describe the unseen by its effects, never by its features.** The less comprehensible a thing is, the less literally it should be described. Reach for metaphor, absence, sensory contradiction, impossible geometry, distorted time, incomplete perception, the reactions of witnesses, the state of the room afterward.

> He saw something at the end of the table, though *something* is a word that assumes a great deal.

> It had no face, and it was looking at him.

> The candles behind it were not blocked, but seemed to have forgotten that they had ever been lit.

**Do not write the creditor's dialogue as a person's dialogue.** Never *I have come to collect what is mine.* Prefer the registration of an event that has no stated motive:

> It turned toward the box, though the box had been behind it a moment before, and every clock in the house lost the same four minutes.

---

## 4. The Prologue as Thesis Statement

Open not on an inciting incident but on a **prose poem about a state of being**, structured as a formal triad. The project's opening does this: the house on the last night, and a quiet of three parts — the ordinary quiet of a great house with too few people in it, the smaller quiet made on purpose by two people not talking about the box, and underneath both, the ledger-paper sound of a debt that has finished waiting.

Design rules:

- **Open on absence, not action.** Describe what is *missing*. Negative description is the house style, in both traditions.
- **Use a numbered structure and honour it.** Announce three parts, deliver three, in ascending order of weight.
- **Do not name the protagonist.** *The last of the line. The one at the table.* Names are thematically loaded; withhold them.
- **End on the sentence that states the emotional thesis of the whole game.** The last line of the prologue is the note the player hears under every subsequent scene.
- **Echo it in the epilogue** with the same structure and one element changed, so the run closes a ring. The changed element is what the thousand years cost.

---

## 5. The Line as Protagonist

The Rothfuss protagonist is one person; here the protagonist is a **house**, instanced across forty generations. The components survive the change of scale, and each generation's heir is a fresh draw against the same pattern.

| Component | Function | At dynasty scale |
|---|---|---|
| **Extraordinary talent, early** | Earns the legend | The blood. One primary gift per generation, and competence elsewhere flowing from a single trait |
| **Catastrophic loss** | The engine of the whole plot | The signing. Violent, unresolved, and caused by the tier the world denies exists |
| **A season in the gutter** | Earns sympathy, grounds the fantasy in the body | Every house has centuries it does not put in the chronicle. Hunger, cold, the arithmetic of a bad harvest |
| **Pride** | The fatal flaw | The house knows what it is, narrates it ruefully, and does it again |
| **Impatience** | The secondary flaw, thematically load-bearing | Every wisdom tradition in the world says *understand the thing before you name it*. Forty generations, and not one of them waits |
| **A performer's instinct** | Ties craft to character | The family is always aware of the record. Always shaping the story of itself |
| **Chronic under-resourcing** | The renewable tension source | Always one bad generation from ruin. See §14 |

### The competence problem

The loudest criticism of the Kingkiller books is that the protagonist wins too easily — entrance exams, duels, masteries, lovers. Take it as a design warning, not a model. In a dynasty game the risk is worse, because the player's own optimisation naturally produces a run of triumphs.

**Counterweights:**

1. **The frame is the counterweight.** The player knows every triumph ends at that table. Use interludes to puncture a run of victories.
2. **Let victories be expensive.** The house wins the seat and cannot afford the household. It impresses the Church and makes a permanent enemy.
3. **Let it fail at what it cares about most.** A family that can buy a duchy and cannot keep a son alive past thirty.
4. **Give a rival genuinely superior on one axis,** and never let the family beat them on that axis.
5. **Let the frame contradict the record.** One line of *that is not how she was, and the house knew it* does more work than a chapter of humility.
6. **Cap the wins per Age.** If three consecutive scenes exist to show the family is formidable, you have written one scene three times. Cut two.

**The measurable version:** count the scenes whose *primary* purpose is "the family is impressive." More than one per Age is a design fault, not a taste question. Count again after each pass; the number rises on its own, because impressive scenes are the easiest to write.

---

## 6. Supporting Cast Architecture

Write to **roles that get refilled**, not to characters. A thousand years rhymes without an author wiring it, and a recurring role whose occupant dies and is not recast silently removes every scene that referenced it.

- **The Mentor Who Is Taken Away.** Warm, funny, teaches the fundamentals, exits before the midpoint. The lessons become the chronicle's aphorisms for the next two hundred years.
- **The Unattainable.** Appears early, disappears and reappears without warning, refuses to be possessed or explained, and is idealised by the record in a way the *text* quietly flags as unreliable. Three tests below.
- **The Institutional Rival.** Wealthy, connected, personally vicious, and — crucially — *correct* about the family's arrogance. Fed by class, not just personality.
- **The Found Family.** Three to five with one strong trait each, existing to be funny and loyal and to make a hall feel warm. The player's rest stops. Give at least one a wound the house is too busy to notice.
- **The Fragile One.** A damaged, cryptic figure who speaks in slant-logic and represents the numinous system pushed too far. Handle with tenderness; never solve them. **But give the fragility a price someone else pays** — a cryptic character who costs nothing is decoration, and this slot rots into whimsy faster than any other.
- **The Frame Companions.** Two at the table with opposed agendas — one wanting the record accurate, one wanting something the word "wanting" does not properly cover.
- **The Authority Board.** A committee of specialists, each reducible to one memorable trait, who periodically judge the family. Cheap, effective, endlessly recurring conflict machine.

### The Unattainable: three tests, all of which must pass

This slot is the most fairly criticised element of the source. A warning is not enough; here is the procedure.

1. **The offstage plot.** Write her half of the story — the part the record never sees. If you cannot summarise it in five sentences with its own goals, obstacles and turns, she is a mood and not a person.
2. **Right when the record is wrong.** At least twice she must be correct about something that matters while the chronicle is wrong, and the player must be able to see it *before* the chronicle admits it.
3. **The contradiction test.** At least once she must do something the idealisation cannot account for, and the record must report it without noticing.

**The technique that makes all three work:** the adoration is the lens, so put the evidence in the *unretouched detail*. The record says she was careless with money; the scene shows her quietly paying someone else's debt. The record says she was untouchable; the scene shows her flinch. Let the facts inside the telling disagree with the summary of them. This is the whole game's thesis applied at the scale of one relationship, which is why it matters more here than in any other slot.

---

## 7. Two-Tier Antagonism

Do **not** design a villain who shows up every fifty years with a plan. Design two tiers that do not know they are in the same story.

### Tier A — The proximate mythic antagonist

Tragic, knowable in principle, and the source of the epistemic quest.

- **Appears once, early, catastrophically,** then vanishes.
- **Exists mainly as folklore.** People sing warding songs. Children's rhymes keep the names long after they have lost the story.
- **Is denied by educated society.** The scholars call it peasant superstition. This gives the family an *epistemic* problem — it must first prove the thing exists — which is far more interesting than a chase, and far more dangerous, because the institution will ruin you for saying so.
- **Has signs, not tactics.** Iron rusting overnight. Dogs that will not enter a room they have slept in for years. A chill, a bad taste, blue flame guttering. Sensory omens do the work that on-page menace would do.
- **Has a tragic backstory delivered through contradictory nested tales.** The greatest of the age became the worst of it. Different tellers disagree about why, and this is where the tragedy lives.

Then supply a **mundane antagonist** for the body of each Age: a rival house, a corrupt magistrate, a bishop with a grudge. Beatable, weekly, and entirely human.

### Tier B — The cosmic tier

The other party to the contract. This is the tier that must never become a character.

Design it by answering six questions in your notes, in this order:

1. **What ordinary people believe it is.**
2. **What the family's scholars and priests believe it was.**
3. **What the house currently believes it is.**
4. **What evidence contradicts all three.**
5. **What the last of the line eventually realises.**
6. **What remains impossible to understand.**

Six must be the largest of the six. If it is not, you have designed a monster.

**Emphasise:**

- **Scale.** The family is not significant at the size the thing operates at.
- **Indifference.** It does not hate the house. It may have no reason to have noticed the house as a house. This is more frightening than malice and much harder to write.
- **Incomprehensibility.** The family encounters things it cannot describe because the language has no concepts for them.
- **Contradiction.** A thing may hold mutually impossible properties. *The door was both at the end of the hall and had never been built.* Do not explain how.
- **Perception.** The realisation that human senses were never built to register the thing they are registering.
- **Knowledge as danger.** Learning more makes the situation worse, never better. This is the same law the numinous magic runs on (§8), which is not a coincidence — make them the same law.

**Avoid:** gore, mutilation, screaming monsters, conventional demons, excessive tentacles, explicit violence, and above all **stated intent**.

> Never: *"I shall have what I am owed."*
>
> Prefer: *The seal on the box had not been broken, and the box was open.*

### The seam between the tiers — where the horror actually is

The tragic tier believed it was **bargaining with someone**. The ancestor who signed in 1042 negotiated terms, argued over clauses, and felt clever afterward. The cosmic tier did not negotiate. Whether it noticed a negotiation was happening is a question the game must raise and never answer.

Everything the family has done for a thousand years — every marriage, every murder, every line of the record — rests on the assumption that the other party has interests that can be satisfied. That assumption is the family's real inheritance, and it is the thing the last night takes away.

**The load-bearing caveat:** an absent antagonist is only frightening while the player believes the designer knows what it is. Write Tier B's true nature, in full, before the vertical slice (§19). Mystery without an answer behind it reads as mystery for exactly as long as it takes players to compare notes.

---

## 8. Magic System Design: Two Tiers

A spectrum from the **scientific** — explicit rules, so the player enjoys watching a clever character work inside them — to the **numinous**, where wonder lives. Put one system at each end.

### Tier 1 — The rigorous system

- Governed by conservation, efficiency losses, and a discipline that can be trained and measured.
- Costs are physical: heat drawn from your own blood, exhaustion, burns, chills.
- Taught in classrooms, with textbooks, examinations and workplace accidents.
- **Function:** enables clever-solution set pieces the player can audit. They must be able to predict, and be delighted when a character sees one move further.
- **Rule:** do the arithmetic. Players do not need the numbers, but the prose must smell like someone ran them.

### Tier 2 — The numinous system

- Cannot be taught directly, only *approached* — through immersion, sleep, intuition, the deliberate quieting of the conscious mind.
- Its practitioners are damaged. Deep practice costs sanity or self.
- Its rules are never fully stated. It works when the character has stopped trying.
- **Function:** supplies awe, and supplies your climaxes. A Tier 1 solution wins a scene; a Tier 2 eruption wins an Age — and terrifies everyone, including the person who did it.
- **Rule:** never let it be reliably controlled. The moment it becomes a tool, the wonder dies.

### The interface, and the law both tiers share

The interesting design work is where the two meet: an institution that teaches Tier 1 and half-embarrassedly admits Tier 2 exists in a locked room upstairs. The tension between mechanism and mystery *is* the world's central argument.

And note the law that runs through Tier 2, the cosmic tier, and the Ledger alike: **understanding costs.** Every system in this world charges for comprehension, and charges more the deeper you go. That is one rule wearing three costumes, and the design is stronger if you keep them consistent than if you let them drift apart.

---

## 9. Worldbuilding Method

1. **Pick the few things you actually love and build those deeply.** Build one institution like a character. Sketch everything else. Resist giving every nation a history.
2. **Change one thing, then follow the consequences all the way down.** One rigorous permutation beats fifty invented nouns.
3. **Filter all detail through attention.** A hungry, ambitious, musically-trained heir notices the price of things, whether the innkeeper waters the beer, whether a lute is well made. This discipline keeps lush prose from becoming a travelogue.
4. **Let characters take the world for granted.** A throwaway reference to something never explained creates more depth than a page of explanation. Unfooted references, and trust.
5. **Money is worldbuilding.** Design the economy at the level of what a meal costs. The ledger is the player's stress.
6. **Deliver history as competing folklore, never as chronicle.** See §10.
7. **Every faction despises the others in specific, prejudiced ways.** Bigotry against the family is a recurring engine — it costs them jobs, trust and safety.

### Beauty before dread

This is Dunsany's contribution to worldbuilding, and it is not decoration — it is the mechanism by which the horror lands.

The world must possess **beauty before it possesses dread**. The player's first question should be *what wondrous place is this?* Only gradually should it become *what is this place really?* And at the end: *was any of it ever meant for people?*

**The beautiful should be temporary.** That is what makes it Dunsanian rather than merely pretty:

- a hall that is only ever full once in a generation
- a garden that blooms in a year the family cannot afford to enjoy it
- a rite whose worshippers have all forgotten what it was for
- an heir who reaches everything the house wanted after everyone who wanted it has died
- a great house being slowly forgotten by the country around it

Beauty is not a break from the horror. It is the emotional contrast that gives the horror somewhere to land, and it is the reason the player minds. Design it first, in every Age, and let the dread arrive into a place worth losing.

**Let beauty open the door through which the horror enters.**

---

## 10. Designing the Nested Tales

§2 states the rules; this is the construction procedure, because contradictory folklore written by instinct produces noise, and players who chart the contradictions need to find a shape.

1. **Write the true version in your notes.** One paragraph. Nobody will ever read it. Skip this and your versions will not cohere, because they will not be distortions *of* anything.
2. **List the tellers, and what each gains from telling it.** A teller with nothing to gain has no reason to be talking, and the tale reads as the author clearing their throat.
3. **Distort along one axis per teller.** The axes: *who acted* · *why they acted* · *what it cost* · *who was present* · *who won* · *whether it happened at all*. One axis per version keeps the versions comparable and the puzzle solvable.
4. **Match the form to the teller.** A song does not remember motives. A doctrine does not remember weather. A drunk remembers the room in perfect detail and gets the year wrong. A children's rhyme keeps the names long after it has lost the story — which makes it the best vehicle for a name the player must carry for four hundred years.
5. **Let one version be right about the thing the family most needs to be wrong.**
6. **Make one version load-bearing.** A fact delivered only inside a nested tale that the endgame later requires. This teaches the player that folklore is worth attending to, and everything else you plant in folklore gets read carefully from then on.
7. **Never adjudicate.** No narrator says *in fact*. The player assembles the truth, or does not.

**Two further rules:**

- **The rhyme rule.** A nested tale should resemble the family's arc structurally and must never comment on it. The ballad about the house that fed its own daughter to a door is about a family four hundred years dead. It is about them. Nobody says so.
- **Never tell one for the player's benefit.** Someone in the room asked for it, or is being persuaded by it, warned by it, or flattered by it. If you cannot name that person and their reason, the tale is an exposition dump wearing a costume.

**Quantity:** three surviving versions of a central event is rich. Five is a puzzle nobody finishes.

**Register:** nested tales are Dunsanian (§1). They are the one place in the game where the elevated voice is doing characterisation rather than atmosphere — a teller who reaches for grandeur is a teller who is hiding something.

---

## 11. Hidden Truth Architecture

Every cosmic mystery in the game runs on three layers of explanation. Build all three before writing any of them, and know which layer each piece of text is speaking from.

### Layer 1 — The common account

What ordinary people believe.

> The house rose because an ancestor was shrewd, and it has been lucky ever since.

### Layer 2 — The learned account

What priests, scholars and the family's own chronicle claim. More detailed, more confident, and wrong in a more interesting way.

> The ancestor made an arrangement in 1042 with something that came to the house in a bad winter, and the terms have been honoured on both sides.

### Layer 3 — The unknowable

What the last of the line gradually suspects, and what the design knows in full.

> There was no arrangement. There was a thing that was already happening, and an ancestor who wrote his name on it and believed he had caused it.

**Rules:**

- **Layer 3 is written in full in the notes and never delivered in full in the game.** This is the two-class ledger (§19) expressed as a content structure.
- **Every layer must be internally coherent and satisfying.** A player who stops at Layer 2 should have a complete, defensible reading of the whole game. Layer 2 is not a strawman; it is the best wrong answer available, and most players will end on it.
- **Layer 3 is reached by contradiction, not by revelation.** Nobody tells anyone. Details accumulate that Layer 2 cannot hold.
- **The layers should be separated by centuries, not by chapters.** Layer 1 is the common account for the first three Ages. Layer 2 becomes the family's working model in the middle Ages of the run. Layer 3 begins to be suspected only in the last two, and is never confirmed.

---

## 12. Plot Design: Episodic Body, Mythic Spine

Structurally the run is a **picaresque strung on a mythic spine**. This is the design's great strength and its notorious weakness. Do it consciously.

### The shape

- **Spine (mythic):** what the contract is, what the other party is, what the family is becoming. Advances a few inches per Age.
- **Body (episodic):** an Age is a phase, and a phase that shares all its content with every other phase is a modifier wearing a name.

### Every Age must pay three debts

Decided before the Age is authored, not after:

1. **One Ledger clause** — a hard fact about the contract, not a hint. What *kind* of fact is determined by the Age's escalation stage (§13).
2. **One standing change** — the family ends materially richer, poorer, more feared or more exposed.
3. **One Rumour** — a story about the family entering the world distorted.

An Age delivering none of these is a beautiful two hundred years in which nothing happened, and that is precisely the drift long games die of.

### Two scheduling rules

- **Name Ages late.** The player should feel two decades of effects before being told what the Age is called.
- **Alternate the register.** Never two of the same texture consecutively: warm and prosperous → cold and lethal → institutional and political.

### Further guards against sprawl

- **Cap the digression length.** A subplot exceeding ~15% of an Age needs its own three-act shape and a hard tie into the spine at both ends.
- **No Age may pay its spine debt with the same *kind* of fact as the Age before it.** Two consecutive Ages that both confirm the contract exists have confirmed it once.

---

## 13. The Escalation: Seven Stages Across Nine Ages

The ontological escalation is a short-story arc, and the run is a thousand years. It maps at **Age granularity**: one stage per Age, with two stages taking two Ages each. The stage an Age occupies is a design fact decided at the outset, and it governs three things — the Age's intensity, what its Ledger clause is permitted to say, and how far the frame is allowed to drift from plain reporting.

| Age | Stage | Intensity | What the Ledger clause does |
|---|---|---|---|
| 1 | **Wonder** | Dreamlike | Establishes that a contract exists and has terms. Favourable-seeming, even beautiful |
| 2 | **Mystery** | Dreamlike | Shows the family's account of the signing is incomplete |
| 3 | **Wrongness** | Strange | States a term that does not behave like a term |
| 4 | **Wrongness** | Strange | A second such term, and the first hint the two are related |
| 5 | **Revelation** | Unsettling | Proves the other party predates the family, the house, the language the contract is written in |
| 6 | **Incomprehension** | Unsettling | Invalidates a reading the player has operated under for centuries |
| 7 | **Incomprehension** | Cosmic | A second invalidation, of the correction itself |
| 8 | **Cosmic implication** | Cosmic | Implies the family's contract is one of many, or was never the point |
| 9 | **Silence** | Abyssal | **Delivers no clause.** See below |

### What each stage means

- **Wonder** — something strange and beautiful, discovered. The player should want it.
- **Mystery** — the legends around it prove incomplete. Not wrong yet. Incomplete.
- **Wrongness** — small details contradict ordinary reality, and nobody in the world will discuss them.
- **Revelation** — evidence of something vastly older or larger than the family.
- **Incomprehension** — the realisation that the interpretation was fundamentally wrong. This is the hardest stage to write and the one that most justifies the whole structure, because it requires the player to have been confidently wrong for two hundred years, which requires you to have built a *good* wrong answer (§11, Layer 2).
- **Cosmic implication** — the discovery suggests something much larger, of which all of the above was an instance.
- **Silence** — do not explain. End on an image, a realisation, or an implication that leaves the player understanding that this extends far past the run.

### The ninth Age breaks the rule, and must earn it

Age 9 pays no Ledger clause, which is the only permitted violation of §12's three debts, and it is permitted only if the preceding eight Ages paid theirs in full. It still pays the other two debts — a standing change and a rumour — and it still closes mundane questions (§19). What it withholds is the cosmic clause. The last Age of a thousand-year game does not explain; it reads back what has already been written, and the frame reaches the end of the record.

If the first eight Ages did not deliver, the ninth reads as evasion rather than restraint, and no amount of good prose will disguise it.

### The intensity dial

Applied per Age, and the column above is a schedule rather than a suggestion:

- **Dreamlike** — beauty, mystery, mythology, melancholy. The horror is not present, only possible.
- **Strange** — contradictions and impossible phenomena, with the dread kept subtle.
- **Unsettling** — the mythology becomes unreliable and the implications become disturbing.
- **Cosmic** — evidence of an immense reality beyond the family, with uncertainty preserved.
- **Abyssal** — a glimpse of something fundamentally incompatible with human understanding.

**Even at Abyssal, do not completely explain.**

### Escalation is not the only thing happening

The stage governs the cosmic layer. Underneath it, every Age is still an episode with a standing change, a rumour, a mundane antagonist and its own register (§12). An Age that is *only* its escalation stage is an atmosphere, not a phase.

---

## 14. Tension Engines

This mode is low on chase scenes and high on *pressure*. Install several and rotate them:

- **The Ledger.** Debt, tuition, rent, a broken thing that must be replaced. Enormous tension from a family that cannot afford the next generation. Concrete, endlessly renewable, and it makes every triumph provisional.
- **Reputation.** The legend is being built in real time and can be lost in an afternoon. Rumours mutate on the page.
- **Class and prejudice.** Doors closed for reasons of birth. People who can ruin the house with a word.
- **The Secret.** The family knows a true thing nobody believes. Institutional disbelief is the main obstacle for most of the early run.
- **Grief.** Recurrent, unresolved, ambushing the house at odd moments. It should get *worse* when things are going well.
- **The Unreachable.** The thing that cannot be held, the magic that cannot be commanded, the name that will not come. Design at least one thing the family wants that the game will never grant.
- **Physical want.** Cold, hunger, an untreated injury, the specific misery of wet boots.
- **Knowledge as danger.** Every advance in understanding makes the position worse. The one engine the other traditions do not supply, and the one that ties the tension directly to the escalation (§13).

Note what is *not* on the list: an army marching, a countdown to an apocalypse, a villain's stated plan.

**Rotation rule:** no single engine drives two consecutive Ages. They fatigue individually and fast — money pressure in particular stops registering by the fourth time it is the whole of an Age's stakes.

**The anti-nihilism rule.** Cosmic insignificance is the *frame* against which human stakes become poignant; it is not a solvent that dissolves them. A revelation about the scale of the other party must never, in the game's own voice, make an earlier human loss trivial. The daughter who died in 1388 still matters at the last table. If the cosmic layer is allowed to retroactively cancel the human layer, every engine above stops working and the remaining six hundred years are unplayable.

---

## 15. Theme, Motif and the Tone Budget

### Core thematic set (choose two or three, not all)

- **Story vs. truth.** Legends are lies that carry a true feeling. The record's own reliability is in question.
- **Names and power.** To know the true name of a thing is to have power over it; to be named is to be caught. Applied to people, this becomes a theory of identity and of love.
- **Understanding before mastery.** Every wisdom tradition says *slow down and know the thing*. The family's tragedy is that it is too quick and too hungry.
- **Grief that will not be discharged.** No settlement will be sufficient, and the story knows it.
- **The inadequacy of human categories.** The family spends a thousand years applying the words *debt*, *party*, *terms* and *payment* to something for which no such words were ever appropriate.

### Motif discipline

**Triads.** The most identifiable structural habit: three silences, three things all wise men fear, three-part structures inside chapters and inside sentences. Use them deliberately — one announced triad in the prologue, recurring three-part folk formulations as the world's proverbial style — and do not overuse. If everything comes in threes the pattern stops signifying.

**Darkening motifs.** Select **two to five** and repeat them across the run. The requirement that makes them Dunsanian rather than decorative: **the meaning of each motif must become progressively more disturbing.** A motif that means the same thing in Age 8 as in Age 1 is wallpaper.

Candidates, project-flavoured and generic:

- the seal on the box
- the seventh grate, never lit
- bells heard under the floor of the old wing
- a door in a wall that was never built with one
- a name the family has stopped writing down
- statues in the long gallery that seem to have been rearranged
- dogs that will not enter a room they have slept in for years
- a page in the chronicle written in a hand nobody can place
- a debt-figure that is always the same number in different currencies
- the house's shadow falling the wrong way at a particular hour

Take one and track its readings: in Age 1 the seal is a merchant's formality; in Age 5 it is evidence the box has been opened and closed; in Age 9 it is unbroken, and the box is open.

### The tone budget

For the **frame and myth layers only** — this skill's territory. The Tale layer is Rothfuss's and carries the warmth (§2).

| | Share |
|---|---|
| Wonder | 35% |
| Melancholy | 25% |
| Mystery | 20% |
| Dread | 15% |
| Outright horror | 5% |

Dread rises toward the last Ages, but **wonder and beauty must remain present throughout**. The goal is not to frighten. The goal is to leave the player feeling they briefly looked through a window into an immeasurably larger universe, and minded what was on this side of it.

---

## 16. Scene and Chapter Architecture

### Chapter design

- **Short chapters** with evocative, slightly formal titles. Titles are part of the voice — write them as a folk index of the game.
- Chapters usually contain **one scene and one turn**.
- **Interlude chapters** are explicitly labelled and return to the frame. Keep them short.

### Scene design

Break each chapter into scenes, then into **French scenes** — a new one begins every time a character enters or leaves. Then ask what purpose each serves, aiming for **about three purposes per scene**.

> For every scene, name three jobs it does. If you cannot name three, either give it more jobs or cut it. If two adjacent scenes have the same three jobs, you have written the same scene twice.

Jobs include: advancing the spine; changing a relationship; delivering worldbuilding through action; establishing a rule of magic that will pay off later; changing the family's material standing; planting a detail that will become a rumour; being funny enough to buy patience for the next slow chapter.

### Revision doctrine

- Write the complete thing, then revise it repeatedly.
- Circulate it widely and revise against responses.
- Apply "the 10% solution" — cut 10% — **repeatedly**, months apart, because each pass exposes structural problems the last pass hid.
- Get **distance** deliberately: time, sleep, a change of venue, before re-reading.
- Remove unresolved threads that do not serve the central question.

For an AI applying this: after drafting, do a pass that *labels* each scene's three purposes, flags duplicates, and cuts the weakest instance of each duplicated purpose.

---

## 17. Pacing and Proportion

| Element | Share | Placement |
|---|---|---|
| Prologue | ~0.5% | Once, front |
| Frame interludes | ~5% total | 12–18 across a full run, at Age breaks and after peaks; lengths falling |
| The tale | ~90% | Everything else |
| Nested tales | 3–5% | Embedded; none in the first 10%, where the player is still learning who to trust |
| Epilogue | ~0.5% | Once, back |

**Age length:** per-Age duration bands rather than one global span. An Age too short to establish a texture is an incident; one long enough to hold two escalation stages is two Ages fighting each other.

**Compression ratio.** The mode runs on *decades in a paragraph, minutes in a scene*. Alternate deliberately and often. If three consecutive chapters all cover comparable spans of story time, the player has stopped feeling time pass.

**The first hour** must contain all six of: the frame, the prologue's promise, the wound, one nested tale, one scene of physical want, and one thing of unambiguous beauty. If any is missing, the game has not started — it is still introducing itself.

**Register alternation** (§12) applies at every scale: Age to Age, and chapter to chapter within an Age.

---

## 18. Endings

### Structural requirements

- **Do not resolve the spine.** The run ends with the cosmic question wider open than it started.
- **Do resolve the Age.** The immediate arc closes cleanly.
- **Return to the frame** for the last movement. Something in 2042 has quietly worsened while the record was being read.
- **Close the prologue's ring.** Restate the opening structure with one element changed.
- **End on a short, plain sentence** that reaches back to the prologue's thesis line. This is the one place the frame drops its elevated register, and the drop is the effect.

### The five ending shapes

Prefer endings that leave a **cosmic afterimage**:

- **The revelation.** One terrible fact, understood, and nothing else.
- **The reversal.** The thing believed to be the cause turns out to be a symptom.
- **The recurrence.** Evidence that what happened is happening again, elsewhere, now.
- **The perspective shift.** The realisation that the family was never the intended party.
- **The quiet ending.** Nothing dramatic happens. One final detail reveals that reality has changed.
- **The unanswered question.** A question whose answer would be more frightening than the ignorance.

**Never end with a complete explanation of the cosmic mystery.**

### Promise debt, stated plainly

This architecture accrues debt. Enormous questions get opened and readers' patience becomes the work's central controversy if they are not paid. Decide the answers **before** shipping, and place at least one substantial payoff in every Age. Deferred mystery is a loan, not income. The instrument for managing it is §19.

The two-class ledger is what makes an unresolved ending honest rather than evasive: the player finishes the run holding a complete set of answers to the human questions and a precisely-shaped hole where the cosmic one was. A hole with edges is a design. A hole with fog in it is a failure.

---

## 19. The Two-Class Mystery Ledger

Keep this from the first day of design. It is the single highest-leverage artefact in the method, and it costs an afternoon.

Every question is classified **mundane** or **cosmic** the day it is opened. The classification is permanent and it changes what the question owes.

### Class M — Mundane

Human-scale questions: who poisoned the heir, what the rival house wants, why the Church moved in 1408, which daughter forged the entry.

| Question | Opened | The answer, written in full | Partial payoffs | Full payoff | Expiry |
|---|---|---|---|---|---|
| *Who poisoned the third heir?* | Age 2 | *(a written paragraph, not a direction)* | Age 3: it was inside the house | Age 4 | End of Age 5 |

**Rules:**

1. **No question enters the game without a written answer.** Not a direction, not a shortlist — an answer, in a paragraph, you could hand to a player. If you cannot write it, you do not have a mystery. You have a hole with atmosphere on it.
2. **Scheduled partial payoff within one Age of opening.** A hard fact the player can hold and reason with. A hint is not a payoff, and players can tell the difference immediately.
3. **An expiry** — the point past which it stops being intriguing and becomes a debt the player resents.
4. **Closed completely, on schedule, and the player is told.** This is what buys patience for the cosmic class, and it is the specific discipline the source material lacks.
5. **At least one closes per Age.** Including Age 9.

### Class C — Cosmic

What the other party is. What the contract is for. Whether the signing caused anything.

| Question | Opened | The answer, written in full | Narrowing schedule | Last narrowing | Never stated |
|---|---|---|---|---|---|
| *What is the other party?* | Age 1 | *(written in full, before the vertical slice, and never shipped)* | One clause per Age, per §13 | Age 8 | The answer itself |

**Rules:**

1. **The answer is written in full before anything ships.** The discipline is identical to Class M; the difference is only in what reaches the player. An unwritten cosmic answer produces incoherent clues, and players comparing notes will find that out faster than you expect.
2. **Payoffs eliminate, they do not confirm.** Each cosmic clause removes readings from the space of possible answers. It never says what the thing is; it says what it is not, or what it cannot be, or what it must have been doing before the family existed. The mystery narrows and never closes.
3. **The game never adjudicates in its own voice.** No narrator says *in fact*. Every cosmic statement is attributed to a teller with a stake.
4. **Expiry works differently.** A cosmic question does not expire by going unanswered — it expires by going **un-narrowed**. Two consecutive Ages with no narrowing clause and the question is dead weight the player has stopped believing in. Track narrowings per Age, not answers.
5. **Cap the live cosmic set at two.** Two is a spine. Six is a fog bank. Class M can carry six comfortably.
6. **No Class C question is ever closed.** Not in the last Age, not in the epilogue, not in an achievement description, not in a wiki-facing design document. The answer exists so that the clues cohere, and for no other reason.
7. **Reclassification is forbidden.** A cosmic question cannot be demoted to mundane late in development because the ending needs tidying. That is the exact move this table exists to prevent.

### The rule that governs both

**When you open an unplanned question mid-draft** — and you will, because it is fun — you either classify it and write its answer that day, or cut it that day. Nothing else.

---

## 20. What Not to Copy

None of this is a case against the sources. It is a list of the places where a working designer copying the architecture falls through the floor.

1. **The unfinished promise.** The defining problem of the Rothfuss model. The architecture makes promises faster than almost anyone can pay them. *Fix:* outline every Age before shipping the first, and write the last night early. Then design backwards from it (§19).
2. **The competence spiral.** Drift into wish-fulfilment is gradual enough to reproduce accidentally, and a dynasty game's own optimisation loop accelerates it. *Fix:* the count in §5. It is a number, and it rises unless someone watches it.
3. **The sprawl.** Ages that pay no spine debt because they were pleasant to write. *Fix:* §12's three debts, applied before authoring, not after.
4. **The beloved as a locked box.** Mystery is not characterisation, and inaccessibility is not depth. *Fix:* the three tests in §6.
5. **The withheld answer nobody believes in.** Withholding works only while the player trusts the answer exists. That trust is spent, not renewed. *Fix:* the narrowing schedule in §19.
6. **Prose as the load-bearing element.** Good sentences carry weak structure for one Age. They cannot carry it for nine.

And the failure modes specific to the other two traditions:

7. **Cosmic horror as furniture.** Tentacles, madness, cults and forbidden books deployed because the genre has them. If the mythology has no identity of its own, the dread is borrowed and reads as such. *Fix:* the six questions in §7, answered in your own notes with your own material.
8. **The explained god.** The single commonest failure. An entity given a motive, a plan, or a grievance is a villain, and a villain is comprehensible, and a comprehensible thing at that scale is merely large. *Fix:* §7's prohibition on stated intent, enforced at the line level.
9. **Ornament without structure.** Elevated diction applied to a scene that is doing nothing. Dunsanian register makes a good scene mythic and makes an empty scene insufferable. *Fix:* the three-purpose test (§16) before the register is applied, never after.
10. **Beauty skipped.** Rushing to the dread because the dread is the point. It is not the point; it is the payload, and beauty is the delivery mechanism. An Age with no wonder in it has nothing for the horror to spoil (§9).
11. **Nihilism as a substitute for stakes.** Cosmic indifference used as a reason nothing matters. *Fix:* the anti-nihilism rule in §14.

### On imitation

Do not reproduce passages, characters, plots or distinctive expressions from any of the three sources. Rhythm, structure, sensory ordering, description-by-absence, the frame architecture and the escalation shape are **techniques**, and techniques are free. The **furniture** is not: named characters, invented terms, coined proverbs, actual sentences. If a phrase would make a reader of any of the three nod in recognition, it is a quotation. Cut it.

Express the influences through cosmic scale, epistemic uncertainty, dangerous knowledge, incomprehensible entities and human insignificance — never through imitation of specific stories or phrases.

---

## 21. Adapting the Architecture

The architecture survives the move out of prose, because it is fundamentally about *who is telling this and why*.

- **The frame becomes the interface.** The device through which the audience receives the story — a document, a room, a save file, a ledger — can be diegetic, and is stronger for it.
- **The listener becomes the audience's proxy.** They ask what the audience is thinking, object when the audience would object, disbelieve on the audience's behalf.
- **Nested tales become findable content.** Still biased, still contradictory. Their particular virtue in interactive media is that they cost nothing to skip and reward attention — the ideal shape for optional content.
- **The legend/truth gap becomes a mechanic** the moment the audience can *author* the record: choosing what is written down, and meeting the consequences later. This is the strongest available translation of the thesis sentence, and it is not available in prose at all.
- **The bounded telling becomes session structure.** Ages, runs, acts.
- **What breaks: the narrator's foreknowledge.** In prose the narrator knows the ending and can foreshadow. If the audience determines events, they cannot. Move the foreknowledge into the *frame situation* — we know where this ends, we do not know how — rather than into individual foreshadows.
- **What gets stronger: unreliability.** A reader can only be *told* a narrator is unreliable. An audience that shaped the record knows it, and is implicated in it.
- **What gets stronger: the unknowable.** A reader can put the book down and reason about the entity at leisure. An audience that has spent forty generations acting on a wrong model of it has *lived inside* the misapprehension, which is what §13's Incomprehension stage is for and why it is worth the difficulty.

---

## 22. Failure Modes Checklist

Run a design against these before authoring.

**Structure**

- [ ] **Frame with no function.** Does 2042 *do* something besides look mysterious? Does it contradict, complicate or reframe the record?
- [ ] **Static frame.** Is the last interlude different in kind from the first? Does something in the present worsen on its own clock?
- [ ] **Uncontradicted record.** Can any layer prove the chronicle wrong? Does it, at least once, early?
- [ ] **Spine stall.** Chart clause recovery per 200 years. A flat stretch is a redesign, not a tuning pass.
- [ ] **Formidability spam.** Count the scenes whose real job is *the family is impressive*. More than one per Age is too many.
- [ ] **Digression sprawl.** Any subplot over ~15% of an Age without its own arc and a two-ended tie to the spine.
- [ ] **Duplicate spine debts.** Two consecutive Ages paying the same *kind* of fact.

**The cosmic layer**

- [ ] **Unwritten ending.** Does Tier B's true nature exist, in full, in the notes, before the vertical slice?
- [ ] **The explained god.** Does the entity anywhere have a stated motive, a plan, or a grievance?
- [ ] **Un-narrowed cosmic question.** Two consecutive Ages with no eliminating clause.
- [ ] **Reclassification.** Has any Class C question quietly become Class M?
- [ ] **No good wrong answer.** Is Layer 2 (§11) coherent and satisfying enough that a player could stop there happily? If not, the Incomprehension stage has nothing to break.
- [ ] **Nihilism.** Does any cosmic revelation, in the game's own voice, make an earlier human loss trivial?

**Texture**

- [ ] **No beauty.** Does every Age contain something the player would mind losing?
- [ ] **No warmth.** Is any of it funny? Is there a room the player wants to be in? A thousand years without warmth is a chore, however good the dread is.
- [ ] **Static motifs.** Does each motif mean something worse in Age 8 than it did in Age 1?
- [ ] **Motif inflation.** Triads used so often they have become wallpaper.
- [ ] **Register bleed.** Dunsanian diction in event bodies, or plain reportage in the frame.
- [ ] **Folklore that agrees.** If the nested tales are consistent with each other, they are exposition in costume.
- [ ] **Exposition dumps.** Any history delivered by the narrator rather than performed by a biased teller.

**Systems**

- [ ] **Costless magic.** Any Tier 1 use without a physical price; any Tier 2 use controlled on demand.
- [ ] **No arithmetic.** Can you state what a meal, a room and a marriage cost? If not, the world has no pressure.
- [ ] **Idealised love interest.** Does she have a plot the record knows nothing about? Can she be right when it is wrong? Does its account of her visibly fail once?
- [ ] **Promise debt.** Every question classified, with a written answer, a schedule, and an expiry (§19).

---

## 23. Generation Procedure

Work in this order. Do not skip to plot.

1. **Write the thesis sentence,** and the tonal sentence beside it (§0).
2. **Write the frame.** Who is at the table, what is each pretending to be, and what small detail betrays it? Write the prologue's triad and its final line.
3. **Give the frame its own three acts** and its worsening clock (§3). Decide what in 2042 gets worse while the record is read.
4. **Choose the wound.** What was signed, by whom, and why does no educated person believe the other party exists?
5. **Design both antagonist tiers** (§7). Answer the six questions for Tier B in full. Write the seam: what the signatory believed he was doing.
6. **Open the two-class ledger** (§19). Classify the wound's questions. Write the cosmic answer in full **now**, before going further. Every question opened from here gets a row the day it opens.
7. **Build the three truth layers** (§11), and make Layer 2 genuinely good.
8. **Assign the escalation stages** (§13). Nine Ages, seven stages, one intensity setting each, and one sentence per Age saying what its clause does.
9. **Design the two magic tiers.** Three hard rules and one hard cost for the rigorous system; one thing the numinous system requires and one thing it takes away. Check both against the knowledge-costs law (§8).
10. **Fix the economy.** Meal, room, marriage, the price of a title, the interest rate.
11. **Cast the slots** (§6), each with a want that conflicts with the house's. Run the Unattainable's three tests now, not after authoring.
12. **Choose two to five motifs** (§15) and write each one's reading in Age 1, Age 5 and Age 9.
13. **Write the folklore first.** Two or three nested tales from different biased tellers that disagree. One distortion axis per teller. Decide which is closest to true. Do not tell the player.
14. **Lay out the nine Ages** in alternating registers, and write next to each: its escalation stage, the clause it pays, the standing change it causes, the rumour it generates, and the one beautiful thing in it.
15. **Place the frame interludes** at Age breaks and after peaks, with falling lengths.
16. **Write the epilogue** as the prologue's ring, one element changed.
17. **Check the proportions** (§17) and the tone budget (§15) before authoring a word.
18. **Only now, author.** Then revise per §16: label purposes, cut duplicates, cut 10%, rest, repeat.

---

## 24. Quick Reference Card

| Element | Default |
|---|---|
| Thesis | Structural: the gap between what happened and what was written. Tonal: a beautiful myth told by someone who has glimpsed what is behind it |
| Frame | 3rd person present, 2042, ~5% of text, **Dunsanian register** |
| Frame arc | Its own three acts; worsens on an independent clock; contradicts the record at least once |
| Tale | Chronicler's voice, past tense, ~90%, **Rothfuss register**, carries the warmth |
| Nested tales | Biased, contradictory, performed by named tellers; one distortion axis each; never adjudicated; Dunsanian |
| Prologue | Triadic prose poem on absence; ends on the thesis line |
| Protagonist | The line. Prodigy + wound + poverty + pride + impatience + performer, instanced per generation |
| Impressive-scene cap | No more than one per Age |
| Antagonist Tier A | Mythic, near-absent, tragic, denied by scholars, known by omens |
| Antagonist Tier B | Cosmic, indifferent, no stated motive, never explained |
| The seam | The signatory believed he was negotiating. Nothing confirms he was |
| Magic | Tier 1 rigorous and costly; Tier 2 numinous and uncontrollable; both charge for understanding |
| Truth layers | Common account · learned account · unknowable. Layer 2 must be a *good* wrong answer |
| Escalation | Seven stages across nine Ages; one stage per Age; the stage governs the clause |
| Age | Pays a clause, a standing change, and a rumour. Named late. Register alternates |
| Age 9 | Pays no clause. Permitted only if the other eight paid |
| Primary tension | Money, reputation, class, grief, disbelief, knowledge — rotated, never twice consecutively |
| Scene test | Three named purposes, no duplicates |
| Motifs | Two to five, and each means something worse by Age 9 |
| Tone budget (frame/myth) | 35 wonder · 25 melancholy · 20 mystery · 15 dread · 5 horror |
| Ledger Class M | Answer written; payoff within an Age; closed on schedule; ≥1 closed per Age; ≤6 live |
| Ledger Class C | Answer written and never shipped; narrows every Age; never closes; ≤2 live |
| Run ending | Age closed, spine widened, frame darkened, ring closed, mystery intact with edges |

---

## Prime Directives

Two, and they are not in tension — the first is about the design, the second about the design's honesty.

**Let beauty open the door through which the horror enters.** Wonder is not a break from the dread; it is what gives the dread somewhere to land, and the reason the player minds.

**When forced to choose between explaining the mystery and preserving it, preserve it — but only if the answer is written down.** Preserved mystery with an answer behind it is restraint. Preserved mystery with nothing behind it is a hole with fog in it, and players find out which one they were given.

---

## Sources Consulted

**Rothfuss — architecture, cast, pacing, the ledger discipline**

- [Writing Excuses 15.04: Revision, with Patrick Rothfuss](https://writingexcuses.com/15-04-revision-with-patrick-rothfuss/) — French scenes, the repeated 10% solution, scene purposes, distance
- [Writing Excuses 15.45: Worldbuilding Fantasy, with Patrick Rothfuss](https://writingexcuses.com/15-45-worldbuilding-fantasy-with-patrick-rothfuss/) — the scientific/numinous spectrum, one-permutation worldbuilding, selective depth
- [Fiction Unbound: Rules Are For Fools — Rothfuss's *The Name of the Wind*](https://www.fictionunbound.com/blog/rothfuss-nameofthewind) — prologue as prose poem, prologue/epilogue ring, beta readers
- [Sarah Kay Moll: On beginnings — the prologue to *The Name of the Wind*](https://sarahkaymoll.com/2015/09/07/on-beginnings-the-prologue-to-the-name-of-the-wind/) — structure of the three silences
- [Broken Mirrors: A Silence of Three Parts](https://tobiasmastgrave.wordpress.com/2015/03/02/a-silence-of-three-parts-discourse-grammar-in-the-name-of-the-wind-part-2/) — opening on state rather than action
- [TV Tropes: The Kingkiller Chronicle](https://tvtropes.org/pmwiki/pmwiki.php/Literature/TheKingkillerChronicle) — frame/tale person and tense split, narrator unreliability
- [Wikipedia: The Kingkiller Chronicle](https://en.wikipedia.org/wiki/The_Kingkiller_Chronicle) — metafictional nested stories
- [Rothfuss's Big Fish: Tall Tales and *The Wise Man's Fear*](https://marietoday.wordpress.com/2020/04/13/rothfusss-big-fish-tall-tales-and-the-wise-mans-fear/) — reputation-building and unreliable narration as design
- [Fantasy Book Critic and assorted reviews of *The Wise Man's Fear*](https://fantasybookcritic.blogspot.com/2011/02/wise-mans-fear-by-patrick-rothfuss.html) — the stitched-novella and competence critiques used in §5, §12 and §20

**Dunsany and Lovecraft — register, beauty-before-dread, the unknowable**

The material in §1, §3 (register), §7 (Tier B), §9 (beauty before dread), §11, §13, §15 (motifs and tone budget), §18 (ending shapes) and §20 (items 7–11) derives from the **literary characteristics** of the Dunsanian mythic-fantasy tradition and the Lovecraftian cosmic-horror tradition rather than from any documented method statement by either author. It was previously held in this repository's `lovecraftian-prose` skill and has been reorganised here as architecture; the sentence-level craft remains in that skill.

**On what is extrapolation.** §1, §3, §7's seam, §11, §13, §17 and §19 are this manual's argument rather than reportage. They formalise structures the sources use implicitly, or resolve contradictions between the three traditions that none of them had reason to address. Treat them as decisions, not as inherited authority — but do not re-open them mid-design.
