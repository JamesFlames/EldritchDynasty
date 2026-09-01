# BALANCE LOG

What is built, what is not, and what every content drop did to the numbers.

This lived in `CLAUDE.md` until it was 283 of that file's 658 lines — 44% of the
one document that loads in full at the start of every session, before the task
is even known. It is not routing, and routing is what that file is for. It is
the measured record of what each drop cost the tiers it joined, which is
exactly what an agent about to add content in bulk needs and no other agent
needs at all.

Read it before adding or reweighting content, and add to it when you do. The
arithmetic in here has been learned five separate times; the whole reason it is
written down is so it is not learned a sixth.

---

## What is built, and what is not

Verified against the code on 2026-08-23; `npm run check` green.

**Built.** Diploid genetics (loci, dominance, recombination, mutation, X-linked
Eldritch font); heritable Fecundity driving both family size and annual
conception, with the marriage market now reading a *line* off a woman's mother
and sisters rather than her genome; demography and mortality; cadet branches and
halls; succession and recall; the Match (three cards, one marriage); the docket
and player choice; Checks and party deciders; substories, inline `next` chains
and per-instance story memory; the frame layer and its interludes; Ages, the
Ledger and clause payout; Discrepancies and the record layer; nested tales with
teller and bias; grudges as inherited edges; standing decay; careers; the
library, study and spellbooks; the auction; heirlooms; the economy; all
eight household posts, hired off whichever templates can fill them; save/load
with bit-identical continuation, and saves on disk in named slots; the decision
log and `replay()`; the session surface; secrets that walk out of the house
with a released retainer and become Discrepancies somebody else can prove; the
Vue authoring tool with generated forms; the Electron shell.

**Also built, in the fun pass.** The **Assize** — the world's reading of the
house, and fifteen explicit responses across two arms (`assize.ts`). The
**table** — five standing orders the player gives on a turn of their own
choosing, and a steward who acts when they have not (`table.ts`). The
**Ascension Ladder** — §22's six rungs, their gates, and what is in the way of
the next one (`ascension.ts`). Bynames and dynastic ordinals, so no person in
the game is called `Garrick 788`.

**Also built, in the presentation pass (concept §24).** A **mark set** —
twenty-nine hand-drawn scribal marks in `editor/src/lib/marks.ts`, a closed
union with a `Record` over it, rendered by `Mark.vue`. They are not a toolbar
icon set: a manicule for *attend to this*, a pilcrow, an obelus for a line
struck, an asteriskos for a line not warranted. **Every event wears its own
metadata** — one mark per declared `purpose` and one for its `tier`, mapped in
`PURPOSE_MARK` / `TIER_MARK`, so nobody picks an icon and two templates with
the same row of marks are doing the same three jobs (the duplicate sweep, §25,
made visible). A procedural **wax seal** (`Seal.vue`), on the sigils' own
bargain, stamped on the illuminated tier. And **sound**: `lib/sound.ts`
synthesises §24's page turn, seal and bell, plus a boon, a blow and a plain
note read off each outcome's own effects by `lib/valence.ts` — no authored
valence field to drift. The **drone shifts by Age through the Age's authored
`register`**, so a new Age gets the right drone with no code change, and the
2042 frame kills it entirely.

Three things about that pass are worth knowing before touching it. The sound is
**synthesised, not sampled**, and the CSP on the built page (`default-src
'self'`) means it has to be — but the better reason is that a described bell can
be tested and a wav that plays silence cannot. Everything above the `Sound`
class is pure data for exactly that reason, and `sound.test.ts` never builds an
`AudioContext`. The **frame interrupts a deliberate step and not a fast-forward**:
holding every interlude from a "to 2042" press put twenty two-colour panels
above the docket, so long jumps send them to a ledger panel instead. And
`marks.test.ts` fails the build on a mark **nothing renders** — invariant 11 for
pictures, because a drawn-and-unwired icon typechecks forever.

**Built since: the vertical slice** (`packages/client`, `npm run play`, issue
#37). Three generations against `session.ts` and nothing else — the docket in
all three of its kinds plus the party cast, the table's five orders, the tree
drawn from the record, the chronicle with frequency as typography, one held
interlude, and a stub where the collection goes. Four fields were added to the
read model in the building of it, each because the client could not draw
something honestly without it: `houseName`, the content's own names for
attributes and traits, lineage and a living spouse on a member, and
`record.claimed` — which attributes the chronicle has actually spoken about,
without which a card announces a woman's Fecundity and §7's marriage market is
over.

**Built since: the two ends of the run** (#38, #39, #40). The signing is a
screen and two choices that are simulation inputs — the founding gift goes into
`world.heirlooms` and the first grudge is a `Relationship` edge, authored
`house_wide` because every narrower policy is deleted the first year that house
has nobody minted and alive. The term is a terminus: `stepYear` closes the
ledger at 2042 and does not turn another year, and one of five endings is
chosen by **reading `world.chronicle`** — not `world.ascension` — so a house
that climbed and a house that can prove it climbed end differently. Every
ending replays the prologue's triad with exactly one element changed, and
`ending/ring` fails the build on two. The three layers that reached no client
(`tales`, `looseSecrets`, `marriagePromises`) are one screen now, and
`MarriagePromise.lot` is filled at last — the auction wrote it empty, so the
record could not say what the daughter had been promised for.

The one measured note: `npm run digest -- 4 300` moves by exactly the bytes of
the new `ChronicleEntry.rung` field and not one byte more. Strip that key and
every fingerprint is identical to the commit before. The simulation did not
change; the record carries one more fact.

**Built since: who the generation is about** (#44). `castOf` reads the
household down to five or seven people with a reason each, the client draws
them above the tree, and clicking one opens their card in it. The section
below has the measurements and the two bugs proving it derived nothing that
was already true.

**Built since: a ladder that can be climbed** (#41). §22's book counts asked one
man for forty books of a game containing twenty-one; they are read off the
catalogue now, and Hierophant is reached in 6 of 20 played runs by a player who
pays for it against 2 of 20 by one who does not, where it was 0 of 16 before.
The section below has the frontier table any further work starts from.

**Built since: the long gallery (#46).** A motif in four readings, banded by a
new `agesElapsed` condition, darkening from *there is a great deal of wall
left* to *the wall is full*. Its third reading joins the record layer — the
chronicle does not say who came off the wall — and its fourth is the frame
reading the page that leaves. All four fire in most runs, in order; the
section below has the sweep and what it cost the rest of the library, which
is about one common firing a run.

**Built since: the Vessel (#43).** The first of §22's three rites is a real
verb — attributes and carried blood into the ascendant, the Vessel's Madness in
full and uncapped, `kill` as the death gate with a mark that is not the mark
for death — and `Person.rites` is what rungs four to six read as their last
requirement. Rung four is reached in one played run in twelve to twenty-four by
a house that takes it, and never by one that refuses. The section below has the numbers and the
three things that had to be fixed underneath it.

**Built since: the house stops being told (#45 stage 3, first bite).** An
outcome tagged `warning` is drawn less often as the world comes to read the
house as carrying itself, every withheld warning is written to
`world.bearing.unheard`, and a rival's day-book sells it back to the family
forty years on. Measured, it more than doubles the spread between the top and
bottom bearing bins.

**Not built.** Two of the five endings cannot fire yet — the Great Rite and the
unmaking (#43's second and third halves), and a ladder that reaches Demigod and
God, which those rites gate. #42 is the gate
that grades the distribution once they can. **Packaging** — no
`electron-builder`, no signing, no auto-update. **A Save/Load menu** — the
shell's disk layer is built and tested end to end by `npm run smoke`; the client
keeps its run in `sessionStorage` so a reload does not end it, and that is not a
menu.

## Is bearing a moral or a tax? (issue #45's acceptance)

§29 rests on one asymmetry, and [#45](https://github.com/JamesFlames/EldritchDynasty/issues/45)
states it as a test rather than as a hope: *high-bearing runs reach HIGHER
rungs on average AND show materially higher variance in outcome. If they are
simply worse, this is a difficulty setting and players will play around it
rather than feel it.*

That measurement was deferred when stages 1 and 2 shipped, on the grounds that
it wants a ladder that can be climbed. The ladder moves now — Hierophant in 6
of 20 played runs, the Vessel occasionally — so it is answerable, and
`npm run gate:bearing` is the instrument.

### The columns exist to spread the reading; the verdict is read off the bins

Three played columns, 84 seeds each, differing only in how the house carries
itself:

| | bearing (mean / peak) | cards on the table | hands | declined | cousins taken |
|---|---|---|---|---|---|
| **proud** — cousin where there is one, refuse where there is not, hold the carriers, embellish | 0.81 / 0.98 | **2.11** | 45 | 37 | 9 |
| **modest** — the outsider every time, release everybody, record honestly | 0.40 / 0.67 | **2.56** | 43 | 15 | 4 |
| **unattended** — the chronicler decides | 0.31 / 0.48 | — | — | — | — |

The market thinning is stage 2 working: 2.11 cards against 2.56, and §29's own
end state (*until the cousin card is the only card on the table*) inside reach.

Then the 252 runs are **pooled and cut in three by the reading itself**, which
is what "binned by bearing" means and is not the same question as a column
comparison — a proud column also carries whatever else that strategy does, and
a verdict read off it is a verdict about the strategy:

| bin | n | bearing | mean rung | var | reached |
|---|---|---|---|---|---|
| kept its head down | 84 | 0.27 | **2.20** | 0.21 | touched / adept / hierophant / vessel |
| the middle | 84 | 0.43 | **2.30** | 0.21 | adept / hierophant |
| carried itself | 84 | 0.82 | **2.36** | 0.23 | adept / hierophant |

### The first half of the acceptance holds. The second does not, and the reason is structural.

**Monotone in bearing, 2.20 → 2.30 → 2.36.** The standard error on a bin mean
is about 0.05, so the range spans three of them: a signal rather than a seed.
§29 rule 2 — *pride must usually be correct* — is measurably true, which is the
half that decides whether this is a moral at all.

**The spread is 0.21 / 0.21 / 0.23**, which is inside its own noise. And the
missing variance is not a number waiting to be nudged: a distribution gets its
tail from the runs that go wrong spectacularly, and **both of the mechanisms
that would produce those are §29's unbuilt stage 3** — the house that stops
being told, and the record read back on the last night (which wants the
endings). A house that is merely offered fewer cards loses slowly and
predictably; a house that is not warned loses all at once.

So `gate:bearing` asserts the rung half and PRINTS the spread with a line
naming stage 3, and a floor on the spread belongs here the day stage 3 ships.
Gating on it today would be gating on a difference this batch cannot see.

One more thing worth carrying: the bottom bin holds **both** extremes — the
only run that never got past Touched and the only one that reached the Vessel.
The house that keeps its head down is not living a narrower life yet; it is
living the same one, one sixth of a rung lower.

### Stage 3's first bite, and what it did to the spread

The measurement above says the missing variance is stage 3's, so stage 3's
first bite was built and the same batch re-run. One tag — `tags: [warning]` on
the outcome where somebody actually says the thing — and `bearing.ts` decides
how often the house gets it: full weight at zero, `WARNING_FLOOR` of a fifth at
the top of the reading. A weight and not a gate, because a hard cutoff is a
rule a player can name and rule 1 is that this is never named.

| | before stage 3 | with it |
|---|---|---|
| kept its head down | 2.20 (var **0.21**) | 2.23 (var **0.20**) |
| the middle | 2.30 (var 0.21) | 2.27 (var 0.20) |
| carried itself | 2.36 (var **0.23**) | 2.35 (var **0.25**) |
| the gap in spread | **+0.02** | **+0.05** |
| warnings the top bin got | — | **2.1** against the bottom bin's 2.6 |

The mean rung stays monotone and the spread gap more than doubles, **off a
single authored warning**. That is the direction the acceptance asks for and it
is not yet "materially higher": one scene carrying the tag suppresses about
twenty per cent of one warning. The lane wants more scenes, and the tag is the
whole of what an author has to write.

**The trace is what makes it fair, and it is a rule rather than a nicety.**
`world.bearing.unheard` is written the moment a warning was on the table and
was not the branch taken, the `unheard` condition reads it, and
`the_ledger_at_marrow` is a rival's day-book — bought at auction forty years
later, listing by year every afternoon somebody in the family tried to say
something and was not heard. Suppressing information with no recoverable trace
is indistinguishable from bad dice, which is the issue's own sentence.

### The instrument is not in `npm run gate`

For the same reason `gate:blood` and `gate:drag` are not: the assertion is a
three-standard-error effect at eighty-four runs a bin and is meaningless at the
dozen a CI budget allows. `bearing-gate.test.ts` holds the JUDGMENT instead —
`verdictOver` is a function over runs, handed a distribution where pride
climbed and one where it only cost, because a gate nobody has watched fail is
indistinguishable from a gate that cannot fail. The ladder gate's trick of
handing over a declawed bundle is not available here: bearing's consequence
lives in `marketAppetite`, in the engine, so there is no authored charge to
take away.

## The long gallery, and what a window costs (issue #46)

§27 wants two to five motifs across the run and one requirement that makes a
motif structural rather than decorative: **its meaning must become
progressively more disturbing.** The long gallery is the one pride gets, and
all four of its readings were written down before any of them was authored —
the same discipline the nine clauses are held to, because the way a motif ends
up as wallpaper is never a decision. The first reading gets authored, a later
one gets invented to match whatever the earlier one became, and it stops
darkening without anybody choosing that.

### The bands are not the issue's, and the reason is measured

The issue assigns the readings to Ages 1-2, 3-5 and 6-8. **A run lives through
21.7 Ages** (twelve runs to 2042; min 19, max 25), because an Age is a hazard
process that stacks. Banded as written, all three tale-layer readings would
have fired inside the first three centuries and the remaining six hundred years
would have had the last one standing — a motif that stops darkening two thirds
of the way in, which is the exact failure §27 names.

The bands below are the same THIRDS, counted in the Ages a run actually has:

| reading | band | fires around |
|---|---|---|
| the founder goes up | `agesElapsed <= 3` | 1044–1218 |
| the cadet is not on the wall | `4-12` | 1255–1515 |
| somebody is taken down | `>= 13` | 1659–2006 |
| the wall is full (frame) | reads the page | 2042 |

`agesElapsed` is a new condition and reads `world.age.ended.length`. `year` and
`generation` both answer "how far in are we" in the wrong unit: two houses at
year 1400 may have lived through four Ages or eleven.

### A window is a ration, and pricing one flat is this log's oldest mistake

Measured at the ordinary weights the three readings first carried — 130, 150,
220 — the first appeared in **3 runs of 12** and the second in **one**.

| | weight | of 12 runs |
|---|---|---|
| the founder goes up | common 130 → **900** | 3 → 11 |
| the cadet | uncommon 150 / 700 → **common 900** | 1 → 2 → 12 |
| taken down | rare 220 → 420 → **1200** → 2400 | 3 → 6 → 11 → 11 |
| the frame reading | rare 92 → **110** | 9 |

Two things in that table are worth carrying forward.

**The third reading saturates at 1200.** 2400 buys nothing, so the knee is
where it is priced. That is what a sweep is for.

**The second reading moved tiers, on arithmetic rather than on taste.** A tier
cooldown is global to its tier: uncommon is drawable about one year in twelve,
and in those years it is drawn against two hundred commons in the same pool. At
uncommon/700 it reached 2 runs of 12; at common/900 it reaches all twelve. It
carries no Record block and enters no folklore, which is what `common` means
and what the scene is — a conversation on the stairs. The general form, which
has now bitten in three separate places: **a template gated to a window is
rationed by the window, and its tier is then only deciding how often it is
allowed to be looked at.**

### And what the three of them cost everything else

Eight runs either side, changing nothing but the presence of the file:

| | common | uncommon | rare | mythic |
|---|---|---|---|---|
| without | 268.9 | 56.6 | 20.1 | 0.9 |
| with | 267.6 | 57.9 | 20.0 | 1.0 |

Nothing, to a run's own noise. The year's budget is fixed, so a lane like this
**spends rather than adds** — the same finding the ladder scenes produced, and
the reason a high weight inside a narrow window is not the tier-wide raid it
looks like. What it does spend is about one common firing a run.

### The budget, and what was deliberately not banded

The house keeps THREE motifs: the long gallery (banded, authored), the seven
grates (already woven through `frame.yaml`, `age_plague.yaml`, `assize.yaml`,
`customs.yaml` and `household.yaml` as texture) and the seal in the box (the
prologue's own image, carried by the seal arc). Banding the other two means
re-authoring bodies that already work, which is a content drop of its own and
not this one. A fourth motif wants one of these three taken out first.

## A line with nobody left to lose (issue #42)

`broken_line` is one of §23's five endings and it fired in **0 of 60 runs**.
Half of that turned out to be a counting problem and half a demographic one.

### The counting half: the ending was reading the servants

`atTheTable` was the HOUSEHOLD — retainers, wives married in, wards, and a
recurring cast that `succession.ts` re-mints for a thousand years whatever
happens to the family. Measured, the household's low-water mark is **9 in the
worst of sixty runs and 10 at the median**: a floor, not a distribution. The
ending named for a line ending could not fire while anybody's cook was alive.

The same bug had a second site. `measureFortune`'s `blood` term graded the
house's health on `household.length` too, so the one input meant to say *this
family is ending* could not fall far enough to say it, and the Assize's
steadying arm was reading a number that could not see a dying line.

Both now count the blood, alive. The guardian is excluded: Daveed does not die
(invariant 3) and is of the blood, so counting him makes the family immortal by
construction — and §23's sentence for this ending is *"the creditor read the
chronicle alone"*, which is a room with a ghost in it.

### The demographic half: there was no tail to count

Counting correctly changed nothing, which is the useful part. The blood's
low-water mark is **3 at the worst and 4 at the median, both at the FOUNDING**,
and from there it climbs monotonically to about 46 by the term. One window in a
thousand years, and nothing sharpened it.

A large family absorbs a bad year: somebody else marries, somebody else bears,
a cousin comes home. A family of four has nobody else. The simulation modelled
the deaths and never modelled the absence of slack, so a house of four and a
house of forty ran the same hazard per person and only the large one could
actually lose people.

Two terms, both **1 for any house with a buffer**, so the median run — past the
threshold inside its first century and never back — is untouched:

- `fragility` raises mortality as the line thins, squared in the shortfall so
  almost all of it sits in the last three people;
- `thinLine` cuts the house's fertility when it is visibly ending, because
  killing the last of a line does nothing if the last of a line breeds back at
  full rate. Measured without it: low-water reached **1** in 40 runs and none
  of them ended.

### The sweep, and what it cost the middle

`THIN_LINE_FLOOR`, 60 runs each, everything else fixed:

| floor | `broken_line` | catastrophes | `devoured` | above adept |
|---|---|---|---|---|
| 0.30 | 1 (1.7%) | 25.0% | 21.7% | 14 |
| 0.20 | 1 (1.7%) | 25.0% | 21.7% | 14 |
| **0.16** | **4 (6.7%)** | **30.0%** | **21.7%** | **14** |
| 0.12 | 6 (10.0%) | 33.3% | 21.7% | 14 |

Target was about one run in twenty. **0.16 gives 6.7%**, which at sixty runs
is inside a standard error of 5%, and the middle of the distribution does not
move across the whole sweep: `devoured` is 21.7% at every setting and the count
of runs attesting above Adept is 14 at every setting.

**One earlier cut did move it, and that is the lesson.** With the fertility
threshold set equal to the mortality one at ten, every house was throttled
through its founding century — because the low-water mark of 3 or 4 is passed
on the way UP — and `devoured` fell from 25% to 12.5% with the runs attesting
above Adept halved. A tail must not be bought with the median, and the way to
tell is to watch a column that has nothing to do with the tail.

### And then the founding turned out to be the whole tail

The sweep above was measured against a FLAT threshold of ten, and the full
check caught what that meant: two batch statistics moved that have nothing to
do with extinction. Runs where anybody fell out with anybody fell from 9 to 7
of the seed set, and `the_reeve_at_ingathering/forgive` went from 0.4% of 250
runs to never firing at all — gate 8's floor is *never*, so it failed.

Both from the same cause. **A new house has four people because it is new**,
and a flat threshold punished every run's founding century.

So the threshold is the house's own high-water mark, capped at `FRAGILE_LINE`:
a house that has never held more than four is measured against four, and one
that held forty and is down to four is measured against ten. `bloodHighWater`
is a new world field, written once a year in `lifecycle` before anybody dies,
and carried in the save (`SAVE_FORMAT` 9, defaulted so a format-8 save loads).

That restores the middle exactly — `devoured` 28.3%, runs attesting above Adept
18, survivors 65.1, all at their pre-change values — **and takes the tail with
it**: `broken_line` 0 of 60, and runs coming within one death of the end fall
from 8 to 1.

Which is the finding, and it is worth stating plainly rather than tuning
around: **the only natural extinction window in a thousand years is the
founding.** After the first century the household grows monotonically to about
46 and never comes back down, so there is nothing for a small-line hazard to
bite on. The 6.7% measured above was, essentially, houses dying in their first
hundred years — which is a loss the player cannot have caused and cannot read
back out of the chronicle, and #42 asks for losses that are legible.

Reaching one run in twenty therefore wants a mechanism that can knock a LARGE
house down — a plague that scales with the family, a war that takes a
generation of men — rather than a sharper edge on a house that is already
small.

### The Age that said it killed people and did not

That mechanism turned out to be authored already, in prose. The Plague's blurb
has read *"Mortality catastrophic, weighted against low Strength. Life affinity
becomes the most valuable thing in the world. **Small families die out**"*
since the Ages were written, and **none of it was implemented.** An Age was a
condition content could gate on and nothing else: `AgeDef.modifiers` is
declared, authored by no Age in the content directory, and read by nothing in
`core` — every reader of that field belongs to traits. Invariant 11, three
times over, on the one system whose whole job is to make a century dangerous.

So an Age carries a `mortality` multiplier the engine reads, applied as a
product across stacked Ages because two catastrophes at once are worse than
either. It is a plain number rather than another entry in the trait modifier
union: what an Age does to mortality is a rule about bodies and belongs beside
the other terms in `rollDeath`.

| plague `mortality` | `broken_line` | catastrophes | `devoured` | above adept | survivors |
|---|---|---|---|---|---|
| 1 (as shipped) | 0.0% | 30.0% | 28.3% | 18 | 65.1 |
| 7 | 1.0% | 28.0% | 27.0% | 27 | 65.8 |
| 9 | 2.0% | 31.0% | 29.0% | 29 | 65.2 |
| **10** | **5.0%** | **31.0%** | **26.0%** | **26** | **61.2** |
| 11 | 7.0% | 30.0% | 23.0% | 24 | 60.9 |

**One run in twenty, which was the target**, and the middle holds: `devoured`
26%, runs attesting above Adept 26, catastrophes 31% inside the 22-45% band.
The Wars carry 1.35 for the same reason at a tenth of the strength — a war does
not empty a house the way a plague does, and it runs three times as long.

And the loss is now the kind #42 asks for. A house does not quietly fail to
exist in its first century; it is **caught by a named Age**, in a year the
chronicle records, having been thinner going in for reasons the player can read
back. The near-miss column says the same thing from the other side: 10 runs in
100 touch zero blood and half of them come back, usually on a posthumous heir.

### The near-misses, and the posthumous heir

Eight of sixty runs touch **zero living blood** and four of them come back. That
is not an instrumentation error: a widow already pregnant when the last man of
the blood dies bears a blood child the following year. The line hangs on a
pregnancy, and the ending is read at the term rather than at the worst moment,
which is why it is right that it is read there.

## The fertility drag does not drag. It pays out. (issue #26)

#26 ships `FECUNDITY_DRAG_COUPLING` at zero and names one condition for moving
it: *"turn the constant up in the harness, in batches of two hundred runs, and
look for the death spiral before anyone plays it. If a house that concentrates
its blood cannot reach 2042 more than half the time, the constant is wrong —
not the idea."* `npm run gate:drag -- 40 1000 0 1 2 4`:

| coupling | survive | living | births | rank sqz | font sqz | centre | floored |
|---|---|---|---|---|---|---|---|
| 0 | 100% | 68.9 | 697 | 0 | 0.02 | 26.1 | 0% |
| 1 | 100% | 70.6 | 715 | −0.01 | −0.02 | 15.1 | 5% |
| 2 | 100% | 73.6 | 806 | 0.02 | 0.06 | 4.0 | 25% |
| 4 | 100% | 80.2 | 939 | −0.02 | 0.02 | −18 | 63% |

**The gate's own question is answered and the answer is misleading.** No death
spiral at any coupling — survival is 100% across the sweep. But it cannot
spiral, because it is not taking children away. Read the two columns the
survival line cannot see:

- **The squeeze never appears.** `rank sqz` and `font sqz` sit inside ±0.06 at
  every coupling. The entire design claim — *the blood you are trying to
  concentrate is the blood that breeds least* — is not happening at any
  strength. A coupling that does not separate those columns has not
  implemented option B, whatever the loci say.
- **Families get BIGGER as the drag gets stronger.** Living 68.9 → 80.2 and
  births 697 → 939 from k=0 to k=4. The drag is a fertility bonus.

### The cause is in the gate's own legend, written before the batch that needed it

> `centre` is `expectedAttribute('fecundity')`, the theoretical mean
> `completedFertility` measures every couple against; `floored` is the share of
> real mothers sitting on the attribute's own zero. When those two disagree — a
> negative centre and a floored population — **every family in the game reads
> as ABOVE average and the drag hands out children instead of taking them.**

That is exactly the row at k=4: centre −18, floored 63%. The drag loci carry
negative weights, so raising k drives the *theoretical* mean below the
attribute's floor while real mothers are clamped at it. Every mother is then
above a mean nobody can be at, and the further the constant is turned up the
more children the house has.

This is invariant 10 failing in the direction it usually fails: *a cap is not
an effect — measure whether the ceiling ever binds.* Here the FLOOR binds, for
two thirds of the population, and the centre is computed as though it never
does.

**So option B is not blocked on tuning and never was.** The constant cannot be
turned up until the centre is computed against what the population actually
produces rather than against the locus table's arithmetic mean.

### The centre was fixed, and the inversion went with it

`expectedAttribute` now takes the attribute's range and returns the mean of the
CLAMPED distribution, convolved exactly. Same sweep, after:

| coupling | living | births | centre | floored |
|---|---|---|---|---|
| 0 | 68.6 (was 68.9) | 696 (was 697) | 26.1 | 0% |
| 1 | 70.3 (was 70.6) | 728 (was 715) | 15.7 | 5% |
| 2 | **69.4** (was 73.6) | **716** (was 806) | 9.8 (was 4.0) | 24% |
| 4 | **69.9** (was 80.2) | **728** (was 939) | **5.7** (was −18) | 50% |

**Household size is flat across the sweep** — 68.6 to 69.9, against 68.9 to
80.2 before — and births with it. The drag has stopped handing out children.
At the shipped coupling of zero every core attribute's centre is unchanged to
the last decimal, so this cannot have moved the current game.

### And the squeeze still does not appear, which is a second finding

`rank sqz` runs −0.02 to 0.03 and `font sqz` 0.01 to 0.07 across the whole
sweep, exactly as before. The drag is no longer backwards; it is **inert**.

The reason is visible in the `floored` column: at k=4 half of all mothers sit
on fecundity's floor of zero. A subtractive drag on an attribute bounded below
saturates — a deep-font woman and a shallow-font one both clamp to the same
zero, and a difference that has been clamped away cannot be measured. The
harder the coupling is driven, the more of the population lands in the region
where the design's own distinction no longer exists.

So option B wants either a fecundity range that permits going below zero, or a
drag applied multiplicatively rather than additively. Both are design changes
rather than constants, and neither is a thing to pick without saying so.

### And it does not deliver `broken_line` either

The hope going in was that #26's drag was the mechanism that could give #42 its
missing floor — a house that concentrates hard enough to die out. It cannot:
survival is 100% at every coupling measured, and the tail that would produce an
extinction is the tail the inversion removes.

## The ending distribution, and the default that invented one (issue #42)

`gate:endings` plays runs to the term and reads what the creditor read. The
target it grades against was **recorded on the issue before the file existed**,
so it measures a decision rather than being fitted to the batch: about one run
in three ends in a loss the player feels as one, read over the three
catastrophes (`unmade`, `broken_line`, `devoured`) with `forgotten` held to its
own floor.

### The first batch confirmed the issue's premise, in the issue's own words, and was wrong

100 runs, and every one of them `forgotten` — which is exactly what #42 says
the shipped game does (*"the simulation could not tell them apart"*). It was a
bug in the instrument, and the printout carried its own refutation two lines
down:

```
  forgotten     100  100.0%
  survivors 65.8  clauses 8.42  attested above adept 35
```

`selectEnding` sends any house whose BOOK attests Hierophant or better to
`devoured`. Thirty-five of them did. Both numbers could not be true.

The cause: `closeTheLedger` runs INSIDE `stepYear`, on a year that has already
reached the term, so a loop that stops the moment the year hits 2042 never
calls it — and the run finishes with no ending at all. `playToTheEnd` then
defaulted `w.ending?.id ?? 'forgotten'`, and a hundred missing endings became a
hundred quiet confirmations of what the issue predicted.

**A silent default in the instrument is worse than one in the game.** It does
not merely hide a failure; it manufactures the finding you went looking for.
Validity is now checked at every sample size, and a run that reaches 2042
without an ending fails the batch instead of counting as anything.

### What the game actually does

24 runs, chronicler-played, once the reading actually happens:

| | |
|---|---|
| `forgotten` | 12 (50.0%) |
| `devoured` | 12 (50.0%) |
| `apotheosis`, `unmade`, `broken_line` | 0 |

`devoured` matching `attested above adept` exactly is the instrument agreeing
with itself, which is the check the first batch could not pass.

### The distribution, at a hundred runs

| | | |
|---|---|---|
| `forgotten` | 65 | 65.0% |
| `devoured` | 34 | 34.0% |
| `unmade` | 1 | 1.0% |
| `broken_line` | 0 | 0.0% |
| `apotheosis` | 0 | 0.0% |
| **catastrophes** | **35** | **35.0%**, against a target band of 22-45% |

**The recorded target is met.** About one run in three ends in a loss the
player feels as one, which is the decision written on the issue before this
file existed, and it is met without anything having been tuned toward it —
the band was set first and the batch came in at 35%.

So #42's premise is half true and needs restating rather than repeating. *The
simulation could not tell them apart* is no longer the case: two endings carry
real share and a third fires. What is still true is the narrower half of it,
**zero houses died out** — `broken_line` at 0 of 100 is the one floor this
batch misses, and it is a demography finding rather than an endings one. A
house that never falls below ten people has nobody to be absent from the
table.

`apotheosis` at zero is expected and deliberately carries no floor: §22's God
is the terminal outcome a family has to be built for, and the ladder above
Hierophant is still gated on power the late-run blood does not produce.

## The Great Rite: the wall, and the room it makes (issue #43)

The frontier table two sections down is the whole reason this rung existed on
paper only: **power 85 with three books is zero person-years in twelve runs.**
Not rare. None. Every previous pass read that as a genetics problem wanting one
more sweep, and the shape of it says otherwise — `factory.ts` has carried the
sentence beside `MADNESS_OVERFLOW_YEARS` since long before the ladder existed:

> Madness from the blood is `font - ceiling` and power is `min(font, ceiling)`,
> so the man who has fifty of the one has none of the other by construction.

Rungs five and six ask for more expressed power than any channel in the game
can pass. No amount of breeding reaches them, because every extra drop of font
lands on the Madness side of the same subtraction. **The decision taken on the
issue is that the blood is not supposed to carry that far and the rites are
what close the gap** — so the Great Rite widens the CONTAINER.

### REACH was swept, and nine was wrong in the direction this log is worst at

A man offered this stands at a known place on the EP scale, and the scale is
arithmetic rather than opinion: `eldritchPower` normalises against `maxPower`
(66) and `ASCENT_REACH` (0.45), so EP 85 is raw 25.25 and EP 98 is raw 29.11.

| reach | his ceiling before the rite: 20.8 | 22 | 24 | 26 | 28 |
|---|---|---|---|---|---|
| 0 | 70 | 74 | 81 | 88 | 94 |
| 3 | 80 | 84 | 91 | 98 | 100 |
| **4** | **84** | **88** | **94** | 100 | 100 |
| 5 | 87 | 91 | 98 | 100 | 100 |
| 9 | 100 | 100 | 100 | 100 | 100 |

At **nine**, where this was first written, every man who takes the rite arrives
at EP 100 — God's power gate handed over free, at every starting ceiling, by
one act. That is the forty-books mistake inverted: not a gate with no key, a
gate with a master key. **Four** leaves both rungs earned — a man at the bare
threshold reaches 84 and does *not* make Demigod, so the rite is necessary and
not sufficient.

The rite is also **once for a man**, enforced in the engine rather than by the
template's cooldown. Without that line `repeatable: true` is an unbounded
ceiling and EP 100 is bought with patience instead of arithmetic, which is the
same free gate arrived at by waiting.

### The cure was gated on the disease

The content was written first against `ascension: { atLeast: vessel }` — rung
five's rite belongs to a man holding rung four. Measured over forty played runs
per column, **that condition is met by no run at all**:

| | best rung reached, 40 runs | |
|---|---|---|
| **climb**, before | hierophant 21 | adept 19 |
| **spare**, before | hierophant 5 | adept 35 |

Ten runs stalled in front of the Vessel's power gate, at **51, 52, 54, 57, 61,
62, 64, 65, 66 and 69 of the 70** it wants. And what stalls them is this rite:
the Vessel's gate is a power gate, power is `min(font, ceiling)`, and the only
thing in the game that moves a ceiling is the widening. Gating the widening on
rung four gated the cure on the disease.

Asked of a **Hierophant** instead, the same forty seeds:

| | best rung reached | | |
|---|---|---|---|
| **climb**, after | **vessel 1** | hierophant 20 | adept 19 |
| **spare**, after | — | hierophant 5 | adept 35 |

The Vessel rung is reached in a played batch for the first time, and the
column's last blocker is now **72 of 85** — a man standing in front of Demigod
rather than nowhere near it. Six of the ten near-misses moved.

This does not reorder §22. The Great Rite is still rung five's requirement and
`gateFor` still reads it there; what changed is that a man may be made wide
before he is asked to hold a relative. Both orders work and they are not the
same: widened first, the Vessel FILLS the new room; taken first, the Vessel is
ruin the widening then converts.

### What this leaves, stated rather than claimed

**Demigod is not reached in forty runs.** One man stands in front of it at 72
of 85, and one Great Rite cannot carry him the rest: his post-rite ceiling is
21.4 against the 25.25 the rung wants, and he may not be widened twice. Rung
five therefore now wants a man whose OWN channel was better bred, which is
§22's *"a house has to be built for it"* — but it is a claim this batch does
not yet demonstrate, and the honest reading is that the wall moved one rung
rather than that the top of the ladder is open.

**The Vessel at 1 in 40 is a thin tail.** Non-zero for the first time, and thin
enough that a batch of forty is the smallest instrument that can see it at all.

## The Vessel: the first rite that does anything (issue #43)

`ascension.ts` has been honest since it shipped that the top three rungs gate
on everything §22 asks for EXCEPT the rite itself, and that `gateFor` names the
rite as the thing still missing. What that meant in practice is that rungs
four, five and six returned a reason on every path: **unreachable in principle,
by three lines of code, for as long as they stood.**

The Vessel was the one of the three with content already written for it.
`the_vessel_rite` had been in `events/rites.yaml` for a whole content pass, and
it said everything §22 says — in prose. Mechanically it was a `status` effect
and a flat `madness: 35`:

- nobody's attributes moved, so *"their attributes are added to the
  ascendant's"* was a sentence in a body;
- the Vessel's own Madness went nowhere, so *"transfers in full and uncapped"*
  was decoration, and the safe-versus-gifted choice the event offered was two
  flavours of one outcome — both branches consumed **the same cast person**,
  because there was one `VESSEL` slot and the branches only differed in what
  the text said about them;
- `status: vessel_consumed` was written straight onto the person, which is a
  second death gate wearing a different word (invariant 2): no marriage closed
  out, no archive, and the Narrator would have been consumable;
- and the man was left exactly as far from the rung as before he consumed a
  relative to reach it.

### What was offered, before anything changed

Twelve played thousand-year runs, chronicler policy at a bid ceiling of 600,
counting every time the rite reached the docket:

| | measured |
|---|---|
| the rite offered | **0.42 times a run** |
| the ascendant it cast, every time | rung `none`, power 6.7 |
| person-years at Hierophant or above (climbing policy) | 173 in 12 runs |
| … of those, with the 4 books rung four wants | **0** |
| … with `mind >= 70` | **0** |

Two separate findings in one table. The event was **mythic**, and mythic is
rationed to three fires a run at a 170-year cooldown across every mythic
template in the game — so the largest decision in the design was a lottery
ticket, and it was drawn against no ascension condition at all, which is why
the man it cast was standing at rung `none` with power 6.7. And the gate above
it wanted two quantities on one man that the game does not put there together.

### The rite is what crosses the gate, and that is the design rather than a fix

§10 states the mechanism the event never had: *"a relative incapable of
expression transfers her attributes and carried blood with no Madness at all;
anyone capable transfers theirs in full and uncapped."* Read against the gate
above it, §22's numbers stop being unreachable and start being **post-rite
numbers**:

| | before the rite | after |
|---|---|---|
| Yarrow, 1114 | mind 23 | **98** |
| Verrick the sixth, 1758 | mind 48 | 55 |
| Varen the fourth, 1927 | mind 48 | **105** |
| Doran, 1185 | mind 46 | **86** |
| Garrick the fourth, 1281 | power 53.9 | **57.1** |

`mind >= 70` is not a gate the blood was ever going to pass — measured, the
median expresser is at 20.8 and the 99th percentile at 59.9. It is a gate
**the rite is for**, and the same sentence explains why nothing needed
renormalising here: the number was written against a man who had just consumed
somebody.

The blood is different, and the difference is the whole bargain. `withGift`
raises what a man can WIELD and leaves `carriedFont` — what the market prices
and what a mother's meiosis draws from — exactly where it was, so §22's *"what
the ascendant gains, he cannot pass on"* is true by construction rather than by
a rule somebody has to remember. And expressed power is still `min(font,
ceiling)`, so blood past his own channel is not power: it is overflow, arriving
every year for the rest of his life. Measured across the offers above, four
ascendants of five were already at their ceiling and gained **nothing but
Madness** from the blood; Garrick had headroom and gained 3.2 points of power.
That is §22's *"the strongest play and the worst idea"*, and it is one line of
arithmetic rather than an authored warning.

### What it moved

`rites.slow.test.ts` plays two columns that differ by one verb, the way
`gate:blood` and `gate:ladder` do — the docket is parked, one policy answers
the rite, and the chronicler is left everything else:

| | offered | taken | best >= hierophant | best >= vessel |
|---|---|---|---|---|
| **take** (12 seeds) | 6 | 6 | 4 of 12 | **2 of 12** |
| **refuse** (12 seeds) | 9 | 0 | 4 of 12 | 0 of 12 |
| **take** (20 seeds) | 7 | 7 | 6 of 20 | **2 of 20** |
| **refuse** (20 seeds) | 12 | 0 | 6 of 20 | 0 of 20 |
| **take** (24 seeds, after the gallery drop) | 8 | 8 | 7 of 24 | **1 of 24** |
| **refuse** (24 seeds, after the gallery drop) | 8 | 0 | 7 of 24 | 0 of 24 |

**The rung is a genuine tail and the test does not gate on it.** One run in
twelve to twenty-four is about one in seven of the runs that ever stand a man
at Hierophant, and which runs those are is a property of the blood rather than
of this rite — a floor of "at least one in twelve" was measured at 2 of 12 the
day it was written and went to 1 of 24 on the very next content drop, which is
a one-in-three chance of a red on content that is working. `rites.slow.test.ts`
asserts the half that cannot be a coin (a taking house has men who took it; a
refusing house has none and cannot stand on rung four at all) and
`rites.test.ts` holds the rung itself deterministically.

Read the offers rather than the rung. **Every run that ever stands a man at
Hierophant is offered the rite** — the CAST rations
this event and the tier never did, which is the same argument `the_drowning`
makes at weight 600 forty lines above it in the same file. So the tier moved to
**uncommon**, where a record block is optional, and the record block moved to a
second beat.

The refusing column is offered the rite MORE often, and that is not noise: a
house that takes it gets a man carrying blood he cannot hold, who dies sooner,
which is fewer Hierophant-years left to be asked in.

### Three things underneath it that were doing nothing

Each of these was silent, and each would have made the rite look like it worked.

**1. An arc cancels itself when its cast is not `alive`.** §22 wants a mandatory
Record choice with no good option, and a Record block is authored per TEMPLATE
rather than per branch — its three lines overwrite whatever the outcome wrote —
so an event that can be refused cannot carry one. The rite is therefore two
beats, and the second one is about the person the first one consumed. It never
fired: `repairBindings` in `events/arcs.ts` tested `status === 'alive'` and
cancelled the whole substory. The mandatory Record choice could not happen and
`the_vessel_lie` could not be created, in any run, ever. `stillCastable` is the
predicate that was missing — the guardian and a consumed Vessel are both people
a scene can still be about — and it fixes a second latent case nobody had hit,
since an arc bound to the Narrator would have cancelled the same way.

**2. Omitting the rite was free.** §22: *"record it and lose two Respect tiers,
or omit it and create the largest Discrepancy in the game."* Record cost two
tiers; omit cost nothing at all, which made "no good option" a choice between
one bad option and two free ones. `the_vessel_omission` is that Discrepancy,
and it is the only one in the game with no claim under it to check: there is
nothing to catch the house out in, only somebody who was here and then was not.

**3. The tree could not show them.** *"The tree shows them greyed, with a mark
that is not the mark for death"* — and the tree draws the living household, so
a consumed woman vanished exactly like a corpse. `halls` is what the SIMULATION
reads, where a consumed woman must not be marriageable, so the read model is
where the difference is made: `MemberView.status` carries it, and one person in
the game stays on the tree after she stops being in the house.

### And one thing downstream that the gating cost

`frame_the_northern_house` waited on `the_vessel_lie` — the Embellish, and only
the Embellish, of one Record block under an event that is now gated on the
house having a Hierophant. Measured over thirty chronicler runs: the rite fires
in 7, the record block is reached in 4, and the lie was told in **none** of
them. It fired in 0 of the sixty-seed coverage batch, and `arcs.slow.test.ts`
caught it, which is what that batch is for.

The premise was never rare — it was a three-deep conjunction. It reads the PAGE
now (`chronicled: the_vessel_remembered`, true for an honest page, a false one
and a dated blank alike), which is the fifth interlude to make that move, and
one clause of its body was rewritten so it is true of all three: what the
guardian is reading is the last page there is about her, whatever it says. **4
of 30 runs**, at weight 130.

### What this leaves

The Great Rite and the unmaking are declared in `RiteS`, refuse with a reason
naming the issue, and are named by their rungs in `gateFor`. Demigod also wants
power 85 with 7 books and the Regalia whole, and God wants 98 with 11 — the
frontier table below says power 85 with 3 books is 0 person-years in twelve
runs, so those two rungs are still gated on the blood rather than on their
rites. That is #43's second and third halves, and the order matters: building
them now would be authoring against a zero, which is the mistake this issue's
own Depends-on warned about and the reason the Vessel went first.

## Bearing, stages one and two (issue #45)

§29's Bearing is how the house carries what it has, as distinct from what it
has. `core/src/bearing.ts` sits beside `assize.ts` and is deliberately its
opposite: the Assize announces itself in the chronicle because a hidden rubber
band is a lie the player can feel (invariant 13), and bearing never announces
itself at all, because the whole of what it is for is that the player runs out
of options and does not immediately know why.

Stage 1 and stage 2 only. The issue says **measure this for a season before
building anything else**, and stage 3's two further bites are not built.

### What is stored, and what is not

Four of the seven inputs are live readings off things the world already holds.
Three leave **no trace at all** — a hand refused is forgotten the moment it is
taken, a person held back is a key that gets deleted on release, and a cousin
taken over an outsider looks afterwards exactly like a cousin who was the only
card. Those three, plus the Embellish, are written down at the verb that
performs them, with the YEAR, because rule 3 (*it never costs on the day*)
cannot be kept without one. `SAVE_FORMAT` is 8; the block is defaulted so a
format-7 save loads and is simply not remembered for what it did.

### The calibration, which the first cut got backwards

`PROUD_PER_CENTURY` was sixteen, reasoned from a run's arithmetic: the player
is dealt about one hand a generation, so four a century, so a proud house does
about four proud things a century, so set the reference at four times that.
Every step of that was right except the conclusion, because **a house cannot
do four times what the maximum is.** Measured over twelve played
thousand-year runs, where `proud` refuses every hand it is ever dealt:

| | peak bearing | cards on the table |
|---|---|---|
| modest (always marry out) | 0.37 | 2.75 |
| unattended | 0.56 | 2.45 |
| proud (refuse everything) | **0.74** | **2.02** |

At sixteen the proud column peaked at 0.44 and still saw 2.64 cards, so §29's
stated end state — *until the cousin card is the only card on the table* — was
unreachable by any play at all. At six it happens, and the modest house still
sees 2.75 of its three cards, which is rule 2: **pride must usually be
correct**, and a house that does not carry itself this way is barely touched.

### Rule 1 is narrower than its own sentence, and the content proved it

Rule 1 says no player-facing string may contain *pride*, *arrogance*,
*hubris* or *vanity*. Rule 4, four lines later, says **only other people say
it** — *"one circulating tale calls the house proud, another calls it
dignified, and both stand."* Built as a flat word match over everything a
player can read, it returned five hits of which four were the design working:

- two nested tales, which is rule 4's own named channel
- `the village decides the house is either very poor or very proud and
  settles, after some discussion, on proud` — other people, verbatim, in an
  event body
- a grandmother `not proud of` a household count, the word meaning something
  else entirely

**A rule that fires on four good sentences to catch one teaches authors to
write worse.** So `prose/bearing` checks the half of rule 1 with teeth — *no
stat, no meter, no bar* — and in the content directory the nearest thing to a
meter is a CHOICE LABEL, the words on the button. Prose may report what the
village thinks; the button may not tell the player what he is spending. The
other half lives in the client and is asserted where it belongs, in
`session-api.test.ts`: the read model exposes no bearing at all, checked
against a view that does carry the Assize's own number.

## Why Adept is the ceiling: two curves that cross once and never meet

The previous section left #41 open on one line — *Adept is still the modal
ceiling, and what blocks it is books and power* — with a one-sentence
diagnosis attached: that the fourth book is gated on an affinity attribute
threshold. **That diagnosis was wrong**, and it was stated as measured when
what had actually been measured was two separate maxima. Running the
correlation says the split is total.

| best-POWER man | best-READ man | same man? |
|---|---|---|
| power 87.3, **0 books** | power 20.2, 7 books | no |
| power 81.3, **0 books** | power 13.5, 7 books | no |
| power 72.2, **0 books** | power 6.7, 8 books | no |

**Zero runs in ten** put the power and the reading in the same man, and the
strongest man does not have three books — he usually has none. (Three was an
artefact of ranking by rung first: rung `adept` *requires* three books, so
the man that ranking finds always has at least three.)

### It is not the shelf, and it is not the threshold. It is the century.

Every strongest man in six sampled runs was born in the first 150 years —
1004, 1008, 1052, 1059, 1104, 1149 — and the shelf during their lives held
two to five books. Sampled every twenty-five years over twelve runs:

| century | strongest man | most carried font | shelf | best-read expresser |
|---|---|---|---|---|
| 1042 | **61.3** | 25.4 | 2.8 | 2.2 |
| 1142 | 43.8 | 16.8 | 3.8 | 2.4 |
| 1242 | 28.5 | 10.0 | 5.1 | 2.8 |
| 1342 | 24.9 | 8.0 | 6.4 | 3.1 |
| 1442 | 19.9 | 6.8 | 7.5 | 2.2 |
| 1542 | 14.9 | 5.7 | 8.2 | 2.7 |
| 1642 | 14.1 | 6.2 | 8.9 | 2.8 |
| 1742 | 11.5 | 3.8 | 9.3 | 2.8 |
| 1842 | 13.3 | 4.5 | 10.3 | 3.0 |
| 1942 | 13.4 | 4.6 | **11.3** | 2.9 |

**The blood declines monotonically from the founding and the shelf rises
monotonically toward 2042.** Hierophant wants power 50 and eight books ON THE
SAME MAN. Power 50 exists in century one, when the shelf holds three books.
The shelf reaches eight in century six, when the strongest man in the house
stands at fifteen. The house spends eight hundred years assembling a library
the blood is no longer there to read.

Counted directly, over twelve runs sampled every twenty-five years:
**zero person-years with power ≥ 50 and books ≥ 8 on one man.** Not rare —
none.

### And the concentrating play does not fix it. One half of it makes it worse.

All three policies, same measurement, strongest man by century:

| century | chronicler | concentrate | concentrate + **withhold** |
|---|---|---|---|
| 1042 | 61.3 | 60.5 | 62.6 |
| 1142 | 43.8 | 37.9 | 31.4 |
| 1242 | 28.5 | 30.3 | 19.0 |
| 1442 | 19.9 | 20.4 | 11.3 |
| 1642 | 14.1 | **18.9** | 12.8 |
| 1942 | 13.4 | **16.9** | 4.5 |

Two things worth separating, because the previous session measured them
together.

**Concentrating on its own is a real if modest gain in the back half** —
century six onward, the strongest man goes 14.1 → 18.9 and 13.4 → 16.9, and
the best-read expresser 2.8 → 3.6. It is worth playing and it is nowhere near
enough: it never reaches 50.

**Withholding is a trap.** §7's `withhold` order is described further down this
file as *"a real strategy, playable today at the table, and no part of the
game says so"* — and on the ladder it is the worst column measured, taking the
late-run strongest man to **4.5**, a third of what leaving it alone produces.
Holding carrying daughters off the market until there is a man of the blood
for them costs the house the children it needed, and the deleterious load
finishes the lines that do concentrate. That is BALANCE-LOG's own original
sentence — *"recombination plus the deleterious load, which kills
concentrating lines before the channel can rise"* — showing up on the axis the
ladder actually reads.

### What this leaves open, and what it does not

It is not a library bug, so the "library session" the previous section named
is not the work. **Any fix has to put books where the power is, or power where
the books are, or move §22's numbers onto what the game actually produces**
— which is the move `ASCENT_REACH` already made once for power, under
invariant 10, and which nobody has ever made for the book counts (3 / 8 / 15 /
25 / 40 are §22's prose, taken raw). That is a design decision with three
different games behind it, and #41's own Rules say **do not nudge**. It is
recorded here rather than guessed at.

### The fork was taken: §22's book counts, renormalised

**Decided, not inferred.** Of the three games above, the third — move §22's
numbers onto what the game produces — was chosen, on the grounds that
`ASCENT_REACH` has already made exactly that move for power under invariant 10
and the book counts were the half nobody had made it for.

**And the first measurement said it was worse than a scale problem.** §22 asks
one man for forty books at God and twenty-five at Demigod. **The game contains
twenty-one spellbooks.** Two of the six rungs were not difficult, they were
gates with no key, and they typechecked for as long as the raw power scale did
and for the same reason: an absolute count, written in prose, against content
authored afterwards to a different size (invariant 11).

Measured over twelve played thousand-year runs at a bid ceiling of 600:

| | measured |
|---|---|
| the catalogue | **21** books — 8 at threshold 0, 13 gated at affinity 12–35 |
| the shelf the house assembles by 2042 | 12.1 of the 21 |
| the best-read man of a run | **7.0**, and never more than 9 |
| his books by tier | minor 55, notable 23, foreign 4, named 2 |

So normalising against the catalogue itself would have been
`maxExpressiblePower` again in better clothes — the mistake `ASCENT_REACH`
records making once. The scale is anchored where a thousand years can actually
put books in ONE MAN'S hands: `BOOK_REACH = 0.5` of what exists, with §22's
counts read as fractions of its own top of forty.

| rung | §22 | derived | against the measurement |
|---|---|---|---|
| Adept | 3 | **1** | an ordinary reader has it; a rung, cleared early |
| Hierophant | 8 | **3** | and the 3-affinity gate beside it binds first |
| the Vessel | 15 | **4** | a well-read man is past it; the blood is not |
| Demigod | 25 | **7** | exactly the best-read man of a typical run |
| God | 40 | **11** | two past the best ever measured, half the shelf |

**The affinity counts were left alone, and that is the line.** Three of eight,
five, all eight — and the game has exactly the eight affinities §22 counts.
Those were already written against what exists, which is the whole difference
between them and the book counts beside them.

**One coherence bug the renormalisation created and the code now forbids.** A
book carries ONE affinity, so a man with *n* books covers at most *n* of them,
and §22's own numbers respect that everywhere — 8 against 3, 25 against 5, 40
against 8. Scaling the books and not the affinities crosses those two lines at
Hierophant, where a scaled 2 sits under an unscaled 3 and the declared book
count becomes a number nothing can ever be stopped by: the affinity gate one
line below refuses him first. `booksFor` takes the affinity count as a floor.
It is not a difficulty choice — Hierophant wanted three books before the floor
and wants three after it — it is the difference between a gate that says what
it does and a gate that does not.

### What it moved: the ladder is climbable

`npm run gate:ladder -- 20 1000`, twenty played thousand-year runs per column:

| | best rung reached | deepest Madness on a man on the ladder | ladder-years past the floor |
|---|---|---|---|
| **climb** | **hierophant 6, adept 14** | 34.7 | 16% |
| **spare** | hierophant 2, adept 18 | 16.5 | 1% |

Sixteen played runs of sixteen ended at Adept before this. Hierophant is now
reached in **six of twenty** by a player who pays, against **two of twenty**
by one who does not — so the fourth rung exists, and the decision the previous
section built (`role: foremost`, the three bargains) is what buys it.

**#41's acceptance is met on the ladder being climbable and NOT on its own
words.** Adept is still the modal ceiling of the climbing column, 14 of 20. The
difference is what stops the other fourteen, printed by the gate: *the blood
does not carry that far* — 37, 41, 46, 47, 48, 49 of the 50 Hierophant wants —
against two runs stopped on books. That is §22's own sentence about what should
stop a house, and it is a different question from the one this fork answered.

**The power scale was re-measured before saying so, because a second stale
normalisation would look exactly like this.** `ASCENT_REACH`'s calibration was
taken before the meiotic drive, the founding library, the founder's bias and
the bid fix shipped, and its docstring claims *the best ever seen -> EP ~90*.
Measured now over twelve runs: the highest power anybody reaches is **87.3**.
Still calibrated. The remaining gap is the blood, not a number waiting to be
renormalised.

### And the frontier, which is the table any further work starts from

Person-years across twelve played runs with power at least P and books at
least N, on one man:

| P \ N | 1 | 2 | 3 | 4 | 5 | 6 | 8 |
|---|---|---|---|---|---|---|---|
| 25 | 16613 | 15381 | 10024 | 5482 | 2963 | 1014 | 42 |
| 50 | 4236 | 3931 | 1899 | 589 | 197 | 0 | 0 |
| 70 | 632 | 571 | 173 | 34 | 0 | 0 | 0 |
| 85 | 47 | 44 | 0 | 0 | 0 | 0 | 0 |

Read down a column and the frontier is **anti-correlated**: the more power a
man has, the fewer books he has, because power is a founding-century quantity
and the shelf is a 2042 one. That is the same two curves as the section above,
counted rather than plotted, and it is why one scale factor cannot make every
rung reachable at once. It is also why the Vessel at 4 books is a genuine tail
— 34 person-years in twelve runs, before its mind, respect and rite gates —
which is the number [#43](https://github.com/JamesFlames/EldritchDynasty/issues/43)
should expect to be authored against.

### The ration that was an accident, and the lane that grew when it went

Making Adept typical — which is §22's own word for it — took the three ladder
scenes from **6.5% of every template fire in the game to 10.1%**, measured over
forty thousand-year runs. Their own header says why, and says it in a sentence
that stopped being true: *"the cast rations these far harder than the tier does
— one man, and only while he stands at Adept or above."* That clause was doing
most of the work, and it was doing it because Adept was hard for the wrong
reason.

Their declared ration is `cooldownYears`, and at 25 and 60 against a natural
spacing of sixty-eight years it never bound — a declared ration that holds
nothing back, one layer down from the declared book count that stopped nobody.
Swept at forty runs:

| cooldown | lane fires a run | share of all fires |
|---|---|---|
| 25 / 25 / 60 (shipped) | 36.1 | 10.1% |
| 100 / 100 / 200 | 12.2 | 3.4% |
| 50 / 50 / 100 | 19.3 | 5.4% |
| **40 / 40 / 80** | **22.2** | **6.2%** |

Forty and eighty put the lane back where the previous session measured and
accepted it (23.4 a run, 6.5%) without the accident holding it there, and forty
years is a working life — the house asks the climbing man about twice before he
dies, which is what that header wanted in the first place.

**And the thing this looked like and was not.** `gate:outcome-reach` went red on
`who_gets_the_physician/the_weak_one -> bought_days`, which is uncommon and
Age-scoped inside the Plague, and the obvious story was the common-tier lane
rationing the uncommon pool — this file's own headline failure, the one that has
bitten five times. Measured, the two do not track:

| | lane share | `who_gets_the_physician` |
|---|---|---|
| before the renormalisation | 6.5% | 0.10 a run, 10% of runs |
| after it | 10.1% | 0.07, 8% |
| cooldown 100 / 100 / 200 | 3.4% | **0.04, 4%** |
| cooldown 40 / 40 / 80 | 6.2% | 0.10, 10% |

The lowest lane share produced the lowest physician rate, which is the opposite
of a squeeze. That template fires in one run in ten and splits four outcomes
across two branches, so a 250-run gate is counting between zero and three
hits — and its own YAML comment records that *"the weight alone had already
failed to keep all four of its endings above gate 8's floor twice running."*
This was the third time. The lane's ration is worth fixing on its own terms;
the gate went green at 1.2% when it was.

### Two tests that had been passing on a coin, again

Both went red on this change and neither is a regression, which makes three
sessions running that the coverage suite has surfaced a coin rather than a bug.

**`attention.slow.test.ts` — "never lets one kind of prompt own the run."** A
`choice` share of 58% against a line of 55%, measured on ONE seed. Six seeds
either side of the change:

| | mean choice share | per-seed range |
|---|---|---|
| before | **53.0%** | 49.7 – 54.7 |
| after | **52.9%** | 49.1 – 57.8 |

The mean did not move at all. Seed 4103 went 53.0 to 57.8 and seed 4108 went
54.7 the other way to 49.1; the per-seed spread is five points and the line was
two points above the mean, so the before column was already sitting 0.3 points
under it on one seed of six. It is a batch statistic now — mean under 58%, no
seed over 65%, both set from the twelve runs above — and the file runs six
seeds through one shared pass where it ran four through three separate ones.

**`ledger.slow.test.ts` — "does not hand every run the whole contract."** A
`min` over six seeds, and every one of the six came back at nine of nine. Two
batches of twenty-four fresh seeds:

| | mean recovered | runs short of nine |
|---|---|---|
| before | 8.42 | 7 of 24 |
| after | 8.33 | **10 of 24** |

The change moved it the OTHER way on the wider sample, and the twelve-seed
sample that suggested otherwise was noise. What is real is underneath the
assertion: **two runs in three recover all nine clauses**, which is §18's own
worry and is [#42](https://github.com/JamesFlames/EldritchDynasty/issues/42)'s
subject — the run must be losable — not something a `min` over six draws can
police. The assertion now says the sentence in its own title (some run falls
short) and that the batch spans at least two clauses, both robust at sixteen
seeds, and the file shares one pass across three tests that were each running
the same six.

## The founder's blood did not exist

While measuring the above: `bias: { eldritch_power: 0.9 }` on Daveed Gearithy
— founder, Narrator, guardian, and the strongest statement of authorial intent
in the content directory — **reached zero loci**.

`applyBias` walks `table.byAttribute`, which is built from each locus's
`contributes`. The font and channel loci declare none, deliberately, because
eldritch is not an attribute and shares no code with one (invariant 4). So the
key had no entry, the loop ran zero times, and the founder was rolled at
random from the house pool. Invariant 11, on the most important person in the
game. `biasEldritch` writes both groups, and both is the point: power is
`min(font, ceiling)` and the ceiling is the AUTOSOMAL channel, so biasing the
font alone authors a man who carries more than he can pass — which is the
definition of Madness, not of strength.

The authored 0.9 was therefore never calibrated against anything, and at 0.9
the working mechanism puts the founder past §22's Demigod gate in the year
1042. Measured over forty seeds:

| bias | carried font | power on §22's scale |
|---|---|---|
| 0 (what the pool alone gave) | 16.8 | 48.5 |
| **0.2** | **25.6** | **60.4** |
| 0.35 | 34.0 | 71.2 |
| 0.9 (as authored) | 60.7 | 91.7 |

0.2: above Hierophant's 50, below the Vessel's 70 — the man who could have
been a Hierophant and never had the books, which is the tragedy the rest of
the game is about, and a ceiling a played house can still hope to pass.

**And it does not move the ladder**, which is worth stating plainly so nobody
reads this as the fix for the section above: at 0.2 the century curve is
unchanged from century three onward and the count of person-years with power
≥ 50 and eight books is still zero. A strong founder passes his X to his
daughters and it is diluted out on the same schedule as before. This is a
correctness fix, not a balance one.

## Two things the ladder drop knocked over, and what they were

Adding `events/the_ladder.yaml` and promoting `ascension` to a pressure signal
moved the event stream, and three assertions in `arcs.slow.test.ts` went red.
None of them was a regression, and finding that out was worth more than the
green.

### The fourth interlude to read the page instead of the lie

`frame_nothing_worth_the_ink` went from firing in the sixty-seed coverage
batch to not. It is in the table above at **2 eligible / 2 fired of 60**, and
this file's own note says a red naming one of those is the tail rather than a
regression — measured, both before and after the drop it fired in **0 of the
first 30 seeds**. It was a coin, and the coin landed differently.

It was also filed, with `frame_two_of_three`, as one of the two that could not
take the fix the other three took, *because what they say first is what the
embellishment says*. That was true of the body and not of the premise. The
guardian's point about those eleven days — that the record is not wrong about
the room, and that being adequate to the room is the whole of the lie — is
true of a careful account, a flattering one and a dated blank alike, and is
better for not knowing which it is looking at. One clause rewritten and
`{ discrepancy: the_ordinary_birth }` becomes `{ chronicled:
the_rule_of_the_sickroom }`:

| | eligible / fired |
|---|---|
| before | 2 / 2 of 60 — and 0 / 0 of the first 30 |
| after | **14 / 11 of 30** |

`frame_two_of_three` still cannot take it, and its first line is still the
reason.

### And a third thing: an Age-scoped event that gate 4 could not see

`the_hall_after` went from 2 runs in 100 to 0, and gate 4's floor is half a
per cent. It is worth being exact about what happened, because the obvious
reading is wrong: the drop did not starve it. Measured over forty runs,
before and after, **eligible-years 436 against 433 and one firing in one run
in both columns**. It has always been a ~2% event, and a ~2% event lands under
a 0.5% floor whenever anything moves the stream.

The reason it is a ~2% event is structural and is `the_drowning`'s argument
one layer over. **What rations an Age-scoped template is its window, not its
tier.** The Plague reaches all forty runs, but `ageElapsed >= 5` inside it
leaves this template eligible for about **eleven years of a thousand** — and a
flat weight of 105 prices those eleven years as if they were the whole run,
against seventy-nine uncommon templates eligible in nearly all of it.

At 600 it is 12 runs in 60, gate 4 is green, and its Age siblings are unmoved
inside noise (the river road 13 → 12 of 60, the quarry match 6 → 6, the cart
4 → 1, which is the same coin from the other side). **Six hundred is a partial
correction** — closing the window ratio in full would want four figures.

The thing to carry forward is not this weight. It is that **the whole
Age-scoped block sits within a factor of ten of gate 4's floor**, and a
hundred-run batch cannot tell a 2% event from a 0% one. Any content drop that
moves the stream will keep landing on one of them, and the answer each time is
the window ratio rather than the drop.

**Which it promptly did, one gate over.** The founder-bias fix below moved the
stream again and gate 8 went red on
`what_came_up_the_river_road/hold_the_gate -> broken_through`, reported at
1.2%, 0.8% and then 0% on three consecutive batches **without its content
changing at all**. Same shape: rare tier AND `ages: { only: [the_wars] }`,
priced at a flat weight of 100, firing in 12 runs of 60 — and the failing
outcome is one check band of one of two choices under that. At 400 the event
reaches 30 runs of 60 and the check's own difficulty is left alone, because
how often the house loses the gate is a different question from how often it
is asked.

Two instances in one session is what makes this a class. **Age scoping and a
flat weight are being multiplied when they should be divided**, and every
content drop from here will keep surfacing one member of that block until
somebody prices the whole thing off its window.

### Three tests that had been passing on a coin

The other two reds were both `arc_the_given_seal`, and the arc is measurably
HEALTHIER after the drop — over 30 runs, seal openings **21 → 26**, the
`presses` node **19 → 24**, the regalia node **10 → 19**. What went red was
the sample size:

| over 30 runs | |
|---|---|
| reaches `our_letter` | 5 |
| writes `answered_in_writing` | 5 |

The binding test drew **six** seeds and asked whether a one-in-six event
happened at least once — a two-in-three coin. The memory test drew **twelve**
and failed outright about one time in ten. Both had passed for months, and
both said nothing at all about the guard they exist to check on the runs where
they passed.

That is CLAUDE.md's own rule — *never pin a test to seeds reaching a state* —
and the fix was to stop running small batches beside a big one. The file's
sixty-run coverage batch already walks every arc instance those tests wanted,
so it now collects arc instances too and the seal tests read it. **Eighteen
thousand-year runs deleted, every assertion in the file stronger, and the file
went from 201s to 159s** — which matters on its own, because the slow lane's
floor is its longest file.

**And a third, one package over.** `run.slow.test.ts` plays a whole run
through the client and asserts the docket raised all three of its kinds,
because a kind that never fires is a branch of `Docket.vue` nobody has
rendered. It played ONE run. Measured, a `record` decision arises in **27 runs
of 30** — Record blocks live on the rare and uncommon tiers and a thousand
years draws only a couple — so that was a nine-in-ten coin, and it came up
tails the first time an unrelated weight moved the stream. Three seeds put it
near one in a thousand. Only that assertion pays for the extra runs; it is the
one thing in the file about a RATE rather than a shape, and the file goes from
14s to 37s.

**Three in one session is the point.** Every one of them was green for months,
none of them was testing what it claimed at the confidence it implied, and all
three surfaced only because something unrelated moved the event stream. A
suite full of these reports a regression whenever anything changes and reports
nothing when something actually breaks.

## The man who was climbing, and what nobody ever asked him (issue #41)

The Hierophant gate writes the finding on its own face:

```ts
if (p.madness < 20) return 'nothing has been asked of him that cost anything';
```

Sixteen played thousand-year runs put men at that gate with everything but the
price paid — power 57, ten books, eight affinities, Madness **0** — and the
previous session established that no constant can fix it. Expressed power is
`min(font, ceiling)` and blood-Madness is `(font - ceiling) x 0.85`: the same
subtraction with opposite signs, so the man who has fifty of the one has none
of the other by construction. Halving `MADNESS_OVERFLOW_YEARS` doubled the ruin
and moved the ladder not one rung in eight of eight runs.

So the ladder has to be charged by **content**, and the reason no content
charged it was that **there was no way to name him**. Every slot role in the
game named a POSITION — the seat, a hall, a marriage, a contract — and all
twenty-two authored `madness` effects landed on one: HEAD, BEARER, CHILD,
SECOND. The ladder is not a position. It is climbed by whoever the blood
happened to land in, and measured, that man spends his life in a cadet hall.

### `role: foremost`

One man or nobody: the house's highest standing, ranked by rung and then by
power, and **expressers only** — which is what makes it safe to deal Madness to
without a filter (invariant 1: the pool is the gate, and `madness/gate` knows
the role by name).

`foremostOf` is now the single definition, and `measureAscension` and the cast
panel read it rather than each rolling their own. That closed a small lie:
ranking the whole household ranked seventy people all tied at rung `none` and
handed back whichever the store listed first, whom the panel then printed as
*stands highest of anyone* with *he cannot express it* after it. Engine change
alone, `npm run digest -- 8 1000`: **byte-identical across all eight**.

`the_vessel_rite`'s ASCENDANT moved to it too. §22 wants the rite taken by the
man who can reach the gate, and it was being offered to whoever happened to be
holding the seal.

### The lane it had to fire in

Three scenes, in `events/the_ladder.yaml` — the house asks, he asks himself,
the province asks — each a real bargain with a real refusal. One slot each:
the head of the house is very often the foremost expresser himself, and a body
carrying both tokens renders *Daveed puts it to Daveed* in every run where he
is. Where they need the seat they use the bare `head` TARGET, which is a
person without being a token.

In the ambient pool they fired **three times in a thousand years**, behind two
hundred templates about weather and pantry.

`ascension` is a PRESSURE signal now (`selection.ts`). A house with a man
standing at Adept is in a state it was not in last generation and will not be
in after he dies, which is that lane's own definition, and the one decision the
fourth rung waits on cannot be a coin flip against the price of cloth. The
promotion alone took `the_boy_who_woke` to **83 firings a run** — a house
holding the same ceremony every twelve years — which is what the next section
is about.

### `repeatable` and `cooldownYears` did nothing

Rationing pressure content needs a per-template cooldown, and the field was
already there, authored, validated, saved, and **read by nothing outside the
frame lane** (invariant 11). Nine shipped templates declare `repeatable: false`
and could fire twice; seventeen Age templates declare cooldowns of twelve to
sixty years that held nothing back. `templateRationAllows` is the author's
ration, kept beside `canTemplateFire`, which is the tier's — they ration
different things and are owed to different people. `FrequencyLedger` carries
`templateLastFired`, defaulted in the save shape so an older save still loads.

With the ladder's own cooldowns at 25/25/60 years:

| | firings per thousand-year run |
|---|---|
| `past_what_the_book_says` | 11.5 |
| `the_race_silted_through` | 11.2 |
| `what_the_province_asks_to_see` | 5.0 |
| `the_boy_who_woke` (texture, rationed with them) | 16.7 |

About one demand every thirty-six years — once or twice in a climbing man's
life, which is what a bargain has to be to still feel like one.

### What it moved, measured

`npm run gate:ladder` PLAYS, the way `gate:blood` does: the docket is parked,
one policy answers every ladder bargain and the chronicler answers everything
else, so two columns differ by exactly one verb. Neither column reads a choice
id — the policy is a rule over content (*take, or refuse, the branch that costs
somebody their mind*), so it still means what it says after the next event is
authored. Twelve played thousand-year runs:

| | deepest Madness on a man ON THE LADDER | ladder-years past §22's floor of 20 |
|---|---|---|
| **climb** | **40.8** | **21%** |
| **spare** | 9.4 | 2% |

Note which number that is. *Deepest Madness on anyone* is a much easier and
much less honest figure: the house's most ruined man is usually somebody the
blood overflowed in his twenties who never opened a book. This is the men who
were actually on the ladder.

**The attention budget did not move, because the lane spends rather than
adds.** The year's event budget is fixed, so the ladder's bargains displace
other prompts instead of stacking on them — measured over six played runs, the
docket went from **360.2 to 347.5 decisions a run**. What it cost is real and
belongs here: roughly twenty-six of the year's choices are ladder bargains now,
and every one of them came out of something else.

### What is still in the way, and it is not this

Nobody reached Hierophant in the batch, and the gate prints why rather than
judging it: **books and power**, in that order. The Madness floor is no longer
what stops an Adept in the climbing column. The next binding constraint is one
level up the funnel and is a library question — the fourth book is gated on
`SpellbookDef.threshold` against an AFFINITY ATTRIBUTE, and the man with the
power reliably has three books and the man with nine books reliably has no
power. That wants its own measured session; it is not a genetics problem and it
is not this one.

## Five people out of seventy (issue #44)

A run holds about seventy living people across six halls by 2042, there are no
faces by design, and the tree is the primary UI. **A player asked to care about
seventy people cares about none of them** — and every beat the design is built
on assumes an attachment nothing was manufacturing.

`cast.ts` is the reading that answers it: five to seven people a year, each
with the one fact that is true of them and of nobody else in the house. Head,
heir, the one at risk, the daughter carrying the line, the hall with the wound,
whoever married in, and the man standing highest — deduplicated, because the
head is very often four of those at once and a list that said so four times
would be a list of seventy again. Measured over six thousand-year runs sampled
every twenty-five years: never empty while anybody lives, never over seven,
never a name that is not living in the house, and every one of the seven roles
fills somewhere in the batch.

It is derived and stored nowhere (invariant 6), and proving that turned up the
bug this section exists for.

**A reading that elected speakers.** `speakerOf` records its answer — a hall
without a speaker gets one the moment anybody asks who speaks for it — so the
first cut of the cast quietly appointed speakers in every branch each time a
client drew a panel. The save caught it. `wouldSpeakFor` is the reading and
`speakerOf` is that plus the writing down, which is the same split
`heirApparent` and `ensureHead` now have, for the same reason: **a rule shared
by a reading and a mutation has to be one function, and the mutation is the
wrapper.**

**And the founder never had a reign.** `world.headSince` was written by
`ensureHead` and by nothing else, so the man who is sitting there in 1042 had
no start date: `tickBranches` reads it for §22's Demigod Stagnation — the same
man in the same chair past forty-five years, worth 0.2 of grievance a year to
every hall — and for the founder that could not fire, in any run, ever. It is
set at bootstrap now. Measured, `npm run digest -- 8 400`: **seven of the eight
fingerprints are byte-identical and one moved**, which is exactly the shape of
a fix that only bites where the founder's reign actually crossed forty-five
years with a hall standing to feel it.

## The ladder's second half: where the books were going

#41's acceptance has two halves. The first — a concentrating strategy beats a
diluting one — is measured further down this file. This is the second:
**Adept is not the modal ceiling**. The one-line diagnosis the first session left behind was "eight
books read against a shelf that reaches five to seven, and power 50 against a
house that peaks near 30", and once the funnel was measured properly both
halves of that turned out to be wrong.

**Power is not the blocker any more.** With the drive shipped, the strongest
man in a played thousand-year run reaches 57 to 83 on §22's scale. Fifty is
met, and often.

**The books were not reaching him.** The steward handed out books to
`hall(MAIN_BRANCH)` — the seat — and the family's strongest men were living
and dying in cadet halls. Six runs, the strongest men and what they had read:

| | power | books | years in the seat |
|---|---|---|---|
| Yarrow the second | 71.6 | **0** | 0 of 84 |
| Uthred the second | 66.3 | **0** | 0 of 84 |
| Merrick | 67.9 | **0** | 0 of 39 |
| Cuthard | 45.3 | **0** | 0 of 80 |
| Nevin of Calder (best-read man in his run) | **0** | 8 | 66 of 66 |

§22 wants power and books ON THE SAME MAN and the two halves were in different
halls. `measureAscension` has always walked the whole household, with the
reason written beside it — a Hierophant in a cadet hall is still the family's
Hierophant (invariant 15) — and the library disagreed with it. The steward
reads the whole house now, blood first, exactly as before.

**And the player's money was wired to nothing.** `world.bidCeiling` — the
`bid` standing order, printed by the client as "the house will bid up to 400
at the next auction", saved, loaded, and read by NOTHING (invariant 11). Worse,
the steward's own fallback bid ran only under `autoResolve`, so a house whose
player was answering the docket never bid on anything at all:

| played run, 6 seeds | shelf at 2042 | best reader | best rung |
|---|---|---|---|
| before | **2** in five runs of six | 2–4 books | touched |
| the steward bids in a played year too | 7–11 | 6–8 books | adept |
| …and the player says "up to 600" | 10–15 | 6–10 books | adept |

A ceiling is a limit and not a price: the house bids what the lot takes, over
the rival where it can, and never past what it said or what it holds. Rivals
were taking eleven to sixteen of the twenty-odd book lots in a run; over
sixteen played runs at a ceiling of 600 the house takes six to twelve.

**What is left, and it is one number: the Madness floor.** With the books
where the blood is and the money doing something, sixteen played runs put men
at the Hierophant gate with everything but the price paid:

| | power | books | affinities | Madness | mind |
|---|---|---|---|---|---|
| Lorcan the ninth | 57 | 9 | 8 | **0** | 61 |
| Jarret the seventh | 57 | 10 | 8 | **0** | 42 |
| Nevin the seventh | 57 | 8 | 7 | **0** | 27 |
| Wulfric the seventh | 53 | 8 | 7 | **3** | 20 |

Every one of them is stopped by the same line — *nothing has been asked of him
that cost anything* — and the ladder tops out at Adept in 16 runs of 16.

**The pace of Madness is not the lever, and this is the sweep that says so.**
`MADNESS_OVERFLOW_YEARS` was an inline `/ 40` in `accrueMadness` and §22 fixes
only the floor, never the pace, so it looked like the obvious knob. Halved,
over eight played runs with nothing else changed:

| pace | mean Madness among living expressers | men dead carrying 20+ | modal rung |
|---|---|---|---|
| 40 | 1.53 | 14 | adept, 8 of 8 |
| 20 | 2.94 | 28 | adept, 8 of 8 |

Twice the ruin and not one rung, because the men at the gate have no overflow
to accelerate. The arithmetic is the whole answer and it is worth writing
down: expressed power is `min(font, ceiling)` and Madness from the blood is
`(font − ceiling) × 0.85`, so **power and Madness come out of the same
subtraction with opposite signs.** Power 50 on §22's scale needs 14.8 raw
through the channel; Madness 20 needs the font to stand 23.5 raw ABOVE that
channel. A man needs a font near 38 raw with a channel near 15 to hold both,
and the highest font measured in a run is 39 against a ceiling of 16.3 — one
man, at the edge, whose overflow tops out at 19.3.

So the blood cannot pay this price, and it was never supposed to be the only
thing that could: the gate's own text says *nothing has been ASKED of him*.
Twenty-two authored `madness` effects exist and every one of them lands on a
slot — HEAD, BEARER, CHILD, SECOND — so whether the family's foremost
expresser is ever asked for anything is chance. The next session's lever is
therefore content and the slot vocabulary under it, not a constant: a role
that casts the man who is actually climbing, so the ladder can charge him. It
is the same shape as #43's rites, one rung lower down.

## Two events that were passing on luck

`arcs.slow.test.ts` asserts that every authored event fires at least once
across sixty thousand-year runs, and after the blood session below resplit
the RNG streams two of them came back zero: `the_guardian_disagrees` and
`frame_the_missing_third_returns`. Neither was broken by that change. Both had
been passing on a coin that had come up heads.

**The guardian's payoff, measured before anything was touched.** The scene is
gated on `the_chair_is_kept`, a flag set by exactly one uncommon template's
only outcome:

| | measured |
|---|---|
| `the_guardian_at_the_table` fires (sets the flag) | 25 runs in 60 |
| …the year it sets it, instrumented year by year | 7 of 12 runs, 1074–2018, median 1396 |
| eligible years left for the payoff | 134–337 |
| rare templates sharing the draw in those years | 94 |
| `the_guardian_disagrees` fires | **0 in 60** — 8 in 60 before the resplit |

Two chances, each about one in three, multiplied. The fix is a second premise
rather than a bigger number: a house ten generations old has nobody alive who
remembers a head it did not overrule, so `generation >= 10` reaches the same
place the kept chair reaches, the long way. Where the chair WAS kept the
payoff still lands early. Measured after: **11 in 60**, with the flag itself
unmoved at 25.

**The interlude, and the second time this exact failure has been recorded
here.** `frame_the_missing_third_returns` was fixed once already, further down
this file, by dropping `state: open` from its read. It went dark again, for
the half of the reason that was left:

| | measured over 36 runs |
|---|---|
| the arc reaches `seal_the_regalia_incomplete` | 11 |
| Record decisions that firing raises | 11 — one each, no losses |
| …answered record / omit / embellish | 7 / 2 / 2 |
| `regalia_lie` therefore exists | 2 runs — **5.6%** |

So the premise was not the count coming up short. It was the chronicler
choosing, at one in five, to write that it did not. The interlude does not
need the lie — its own lines are about the count, not about the book — so it
now reads **the page** rather than the lie: `chronicled:
seal_the_regalia_incomplete`, a fifth `FrameRead` shape, true whenever that
event left an entry in the chronicle, whatever the entry ended up saying. An
omission is a dated blank line and a blank is a page; the frame is still
reading the record and not the world, which is the whole reason it is a
`reads` and not a `condition`. Measured after: **20 in 60**, against a ceiling
of the 23 runs that wrote the page at all.

`frame_two_of_three` keeps `{ discrepancy: regalia_lie }` and therefore keeps
5.6%, because its first line IS the embellishment — "the record says entire"
is not a sentence a truthful page supports.

**And it is not alone, which is the part worth carrying forward.** The
sharper instrument is two columns rather than one: how many of sixty runs an
interlude was ever ELIGIBLE in — its premise came true — against how many it
actually fired in. The two failure modes look identical from the gate and are
not the same bug at all. Measured after the three fixes named under this
table, against a frame that cuts about seventeen times a run:

| eligible / fired, of 60 | interlude |
|---|---|
| 1 / 1 | `frame_the_northern_house` |
| 6 / 1 | `frame_the_copy_that_was_short` |
| ~~2 / 2~~ **14 / 11 of 30** | `frame_nothing_worth_the_ink` — fixed, see below |
| 4 / 2 | `frame_read_out_in_a_hall_at_cawdry` |
| 8 / 2 | `frame_what_the_ledger_says_of_the_seal` |
| 3 / 4 | `frame_two_of_three` |
| 3 / 4 | `frame_the_second_time` |
| 14 / 13 | `frame_the_cost_not_written`, `frame_the_drowning_remembered` |
| 22 / 17 | `frame_the_missing_third_returns` |
| 60 / 52–60 | the five that read the record in general |

(Fired can exceed eligible: a template that becomes eligible and fires in the
same year never appears in a pool sampled after the step.)

**Every interlude in the top block waits on ONE named lie**, and a lie costs
the carrying event firing — a third of runs at best — times the chronicler's
Embellish at one in five. That is what makes the sixty-seed coverage batch a
coin across that block: **a red in `arcs.slow.test.ts` naming one of these is
the tail, not a regression.** The answer, now proven three times, is to read
the PAGE and not the lie wherever the interlude's own lines do not actually
depend on the lie having been told:

- `frame_the_missing_third_returns`: 0 → 22 eligible, 17 fired.
- `frame_the_cost_not_written` and `frame_the_drowning_remembered`: **0
  eligible in 60** — their premise never once became true — → 14 and 13.

Two of the remaining seven cannot take it, because what they say first is what
the embellishment says (`frame_two_of_three`: *the record says entire*). The
rest are a pass of their own, and each wants its own funnel measured rather
than a batch edit.

## The blood: issue #41's measured session

`npm run gate:blood` is the instrument, and it is different in kind from every
other batch tool here: it PLAYS. `runYears` is the chronicler deciding, which
cannot answer a question about the player, so this one parks the docket, answers
every Match by a policy and leaves everything else to the chronicler. Two
columns then differ by exactly one verb.

**Where the blood actually went.** The first measurement was not of the
genetics at all. One thousand-year run, chronicler-played, seed 4000 — the
shape held across the three that were counted:

| | |
|---|---|
| People born to the house | 767 |
| Marriages touching the house | 481 |
| …of which cousin marriages | 247 |
| …of which **both partners carried** | **4** |
| Hands the player is ever dealt | ~46 |

The pairing §7 calls "the mechanism" was happening four times in a thousand
years, by accident, in a house whose whole identity is the blood. The player's
own hands cannot fix that: the Match is one chapter beat a generation, so
choosing perfectly on eight percent of the weddings is swamped by the
ninety-two the house makes on its own.

**And the ladder was blocked by the library, in the wrong century.** The same
runs, printing what the foremost man of the house was blocked on:

| Year | Blocked on |
|---|---|
| 1142 | `he has read 0 of the three books it takes` — power 37, past Adept's gate |
| 1242 | `not enough of it comes through (20 of 25)` |
| 1342 onward | `he cannot express it` — no expressing man at all, for seven centuries |

The shelf was empty until about 1250 and held one book until about 1450. The
blood gate and the book gate were never open in the same century.

**Three things shipped, and one lever rejected.**

- **The font loci drive** (`gen-loci.mjs`, `LocusDef.drive`, shipped at 0.8). A
  mother hands on the hotter of her two X's four times in five. This is the
  only lever that separated the strategies:

  | drive | concentrate, font at 2042 | dilute | hot pairings |
  |---|---|---|---|
  | 0.5 (before) | 0.2 | 0.3 | 5.0 / 2.5 |
  | **0.8** | **1.0** | **0.1** | **20.0 / 11.2** |
  | 0.85 | 0.9 | 0.8 | 17.8 / 11.3 |

  Six seeds a column, thousand-year runs. At 0.5 the two strategies are the
  same game. At 0.85 they converge again, because the drive is doing the work
  and the player is not — which is the argument for 0.8 rather than for more.

- **A founding library** (`HouseDefS.library`, two Threshold books). Modal best
  rung over four seeds: `touched` before, `adept` after, and the best reader in
  the house goes from four books to between five and seven.

- **A standing order on marriage** (`TableOrder.marriages`). The Match is a
  chapter beat; this is the policy, and it reaches all 481 marriages instead of
  46. `as_it_falls` is the shipped default and is the arbitrary line it
  replaced, so a house given no orders plays exactly as it did.

- **Linkage was the suspect and is not the lever.** Font spacing swept at 18, 6
  and 2 cM — 90 cM of X between the six loci down to 10 — moved nothing beyond
  noise at four seeds. The haplotype being shredded is not what was killing the
  blood; which haplotype gets handed on is.

**What this also answers.** #24 item 5 — which deleterious load is right — has a
played answer now, and it is that the load is not the culprit: realized
homozygosity sits at 0.485–0.492 and expressed curses at 0.10–0.16 per person
in EVERY column, concentrating and diluting alike. Concentration is not being
punished by the curses; it was simply not happening.

**And one thing it broke on the way, which is the reason to measure the whole
funnel.** Carriers persisting means more people qualify for a hand —
`matchWeight` gives every carrier 80 — and the Match went from about 46 hands a
run to 82, past the ceiling §5's attention budget sets at one chapter beat a
generation. `attention.slow.test.ts` caught it. The fix is a house-wide market
cooldown beside the per-person one, and it had to be measured against BOTH ends
of that budget, because taking prompts out of a run raises the share of
everything left in it:

| house cooldown | hands a run | choice share |
|---|---|---|
| 15 | 26–30 | 55.4% — over |
| 12 | 26–30 | 55.2% — over |
| 8 | 32–47 | 55.2% — over on one seed |
| **6** | **32–58** | **49.7–53.3%** |

**Still true after all of it: Adept is the modal ceiling.** Nobody passed it in
any column of any batch. What blocks Hierophant is measured and is not the
blood: eight books read against a shelf that reaches five to seven, and power
50 against a house that peaks near 30. That is the next session's work, and it
is a library and auction question rather than a genetics one.

**One thing to watch.** Gate 8 wants every authored outcome reached at least
once, and a handful sit at 2-4%. Any change anywhere in the simulation re-rolls
those, so a gate that goes red on an outcome you did not touch is usually
saying that outcome was passing on a coin. The fix is reach, measured — the
weight note at the top of `age_insurrection.yaml` and the one on
`the_archive_and_the_wage_roll` both say what was tried and where the ceiling
is — not a nudge until the gate goes quiet. **Measure the whole funnel before
moving anything**: both frame interludes that sat at 1-2% were starved four
events upstream, and nothing about the interlude itself was wrong. The thinnest
now are `the_registrar_asks_for_the_book`, `who_gets_the_physician`,
`the_coat_hung_up` and `the_turn_of_the_stave`; every frame interlude is at 7%
or better.

A content drop moves this list wholesale and that is not a sign of damage. The
forty-four templates added in `village`, `customs`, `roads`, `the_trade`,
`papers` and `the_quiet_names` took the outcome count from 243 to 338, and the
thinnest are now `who_gets_the_physician` and `the_turn_of_the_stave`, both of
which were on the previous list too. Nothing went dead.

The fifty added in `the_hall`, `feasts`, `the_turning_year`, `bramme`,
`the_young` and `neighbours` took it from 338 to 474, and cost one thing that
is worth reading before the next drop. `frame_the_missing_third_returns` went
to zero in `arcs.slow.test.ts`'s sixty-seed batch — and it had been at two
fires in sixty all along, because its whole reach was one lie, told when the
chronicler embellishes a rare arc node, and OPEN only until somebody proved
it. Sampled over an independent 120 seeds the premise holds in 17.5% of runs
and the coverage batch happened to draw 5%; the fix was to drop `state: open`
from its read, which is what `FrameReadS`'s own note has been warning about
since the frame was built — an interlude waiting on one particular lie in one
particular state is an interlude most runs never see. It is at 12.5% now.
Nothing else went dead. The thinnest outcomes after that drop sit at 0.8%,
1.2% and 1.6% — `retained` under `the_physician_from_bramme`, `forgiven`
under `the_reeve_at_ingathering`, `opened` under `the_match_that_never_comes`
— and the thinnest templates are `the_hall_after` at 2% and
`the_physician_from_bramme` at 3%, both of them Plague Age, which is
Age-gated and thin by construction.

**The fifty RARE templates after that are the most instructive drop so far,
because the tier they joined was not the size it looked.** `frequency: rare`
returned 44 templates; the AMBIENT rare pool — what actually competes in the
yearly draw — was **nine**, because 25 of the 44 were `tier: frame` (rationed
off `world.frame`) and 10 were arc nodes (excluded by construction). Nine
templates were sharing 7.25 firings a run, and every raise of the rare weight
from 40 to 320 had been buying share for those nine. **Count the pool you are
joining, not the tier you are declaring.**

Fifty more took that pool to 59 and three things followed, all measured:

- **The weight stopped mattering.** 320 → 14.0 ambient firings a run, 220 →
  13.6, 150 → 12.7. A pool that big wins the draw whenever it is *eligible*,
  and eligibility is the cooldown. That is the state a rationed tier is
  supposed to be in and it took content rather than a knob to get there.
- **So the cooldown moved, 55 → 30**, and it is the first time that lever has
  been pulled. Not to quiet a gate: `rites.yaml` has always opened by calling
  this tier "a few per century" and at 55 years with nine templates it
  delivered 0.7. Measured: cd 55 → 14.0 firings and the median template
  reached in 17% of runs, cd 40 → 18.1 / 25%, cd 30 → 21.8 / 33%, cd 22 →
  22.0 / 33%. It stops at 30 because `perRunCap` takes over, which is the
  right place for a rationed tier to stop. The cost is eight common firings a
  run and nothing from uncommon or mythic.
- **Every pre-existing rare template lost six sevenths of its share**, and the
  two that other content hangs off went dark. `the_drowning` fell from 13 runs
  in 60 to **two**, taking `the_drowning_lie` — which three frame interludes
  read — to zero; `the_seal_questioned`, which is the mouth of `arc_seal`, took
  the whole arc down with it. Both are now weighted for what actually rations
  them (600 and 340) with the measurement written next to them, and the
  argument is `the_drowning_repeated`'s: **what rations a template can be its
  CAST or its CONDITION rather than its tier, and a flat weight is then wrong.**
  `the_cart_from_the_chapter_house` is the same shape one tier down — it only
  fires while the Assize reads the house at −0.25 or worse — and went to zero
  in the same batch at weight 105. It is 320 now and back to 11 runs in 60.

Four more frame interludes were reading one specific lie in one specific
state, which is the failure `FrameReadS`'s own note describes and the second
time this list has recorded it. All four now read the lie's existence rather
than its state.

The drop also moved two thresholds that were sitting *on* their statistic
rather than above it, and both were checked against the content before being
touched. Late motherhood measured 1.97% with the drop and 2.00% without it,
against a ceiling of 2% — the drop did not move it, the ceiling was a coin
flip, and it is 2.5% now. The auto-player's Adept rate genuinely did fall,
from 9 chronicler runs in 24 to 7, because the rare tier's firings come out of
the common pool where the library and the table live; that test now samples 24
seeds instead of 12, and the number it asserts is that the second rung is
*reachable*, not that it is reached at a rate.

**A hundred more COMMON templates after that, and the tier arithmetic behaved
exactly as this list now predicts it will.** `the_kitchen`, `wick_trades`,
`weather`, `indoors`, `cloth`, `the_body`, `letters`, `small_money`, `beasts`
and `the_old` took the common pool from 105 to 205 and cut uncommon from 71.3
firings a run to 62.5, rare from 21.5 to 19.8 and mythic from 1.1 to **0.67**,
which is most runs seeing no mythic event at all. The profile answers it —
uncommon 800 → 1100, rare 320 → 400, and **mythic 5 → 9, the first time that
number has ever been touched.** Mythic had never needed draw weight because it
is rationed by its cap and its drought curve; at 5 it had almost none, and
every common drop had been quietly pushing it further under. All three are
back (64.2 / 20.4 / 1.13) and the thousand-year treasury is back with them,
1766 against 1772 before the drop.

**What that drop actually cost was four tests, and three of them were finding
real things.** A suitor template minted brides at 16 against `eligibleToMarry`'s
own floor of 17 — a bride the marriage code would have refused had she already
existed, who can then bear at 16, which `demography.slow.test.ts` calls a bug
and is right to. Gate 2 found that no test fixture had anybody over 70 or any
woman over 52, which is a real gap in a game that now has a whole file about
the old. And the relationship-edge guard turned out to be asserting a LEVEL
when the bug it was written for is an ACCUMULATOR: a hundred templates that
each note what the household thought took the count at 2042 from about 7 to
about 35 with nothing about pruning changed at all. It samples across the run
now and asserts the sawtooth — 72, 65, 5, 2, 73 across a millennium — because
a map that never comes back down is the bug and a map that peaks and empties
is the system working.

The fourth was the fourth occurrence of the same lesson. Branch grievance is
one number per surviving hall at one instant, with a heavy tail; six seeds is
thirty observations and the top of that sample is carried by one hall. Over 24
independent seeds the maximum is 100.0 both before and after the drop; over
the test's own six it moved from 98.2 to 49.8. Same for the oldest surviving
feud, which clears thirty years in about four runs in five and came up 19 on
the one seed that test sampled. Both take a batch now.

**And a check that the drop is the reason for.** `events/player-share`
(rule 25) fails the build if fewer than a quarter of templates actually ask
the player something — `decidedBy: player`, a `party` decider, a
`castBy: player` slot, or a Record block. A `state` ladder, a `chance` draw
and a narration resolve themselves, and that is the cheap half of the library
to write: a run full of texture looks exactly like a run full of decisions
from the outside, with the same fire rates and the same green gates. The
floor is at 25% against content standing at 81%, which is where a guard
belongs — it is for the six-hundredth template, not this one.

After all of that: 382 templates, 832 authored outcomes, 140 nested tales, and
all five gates green. The thinnest outcomes are `held` under
`the_guardian_disagrees` and `it_was_the_yard_man` under `what_hangs_in_smoke`
at 0.8%, and the thinnest templates are `the_hall_after` and
`the_year_two_woke` at 2% — one Age-gated and one needing the rarest person in
the game, twice, at once. The thinnest outcomes are `spent_well` under
`who_gets_the_physician` and `the_room_notices` under `the_turn_of_the_stave`
at 0.4%, and the thinnest template is `the_hall_after` at 2% — Plague Age,
Age-gated, and thin by construction, as it was two drops ago.

The gate measures **250 runs rather than 100**, which is the other half of the
same problem: at a hundred, a third of that tail showed zero on any given
measurement, and across one afternoon it named nine different casualties in
nine consecutive runs on content that was getting steadily healthier — four of
them the heavier half of their own branch. 250 costs about four minutes of CI
and buys a red that means something. The arithmetic is in `gates.ts`, and the
same lesson has now been learned three times in `record.slow.test.ts`: a fixed
seed block is a sample, and a threshold asserted on one sample of a noisy
statistic reports the sample rather than the game.

Two scheduling facts are worth knowing before adding content in bulk, both
measured and both counter-intuitive. **The frequency cooldown is global to its
tier**: uncommon bars the whole tier for twelve years after any uncommon
template fires, so a run has room for about 83 uncommon firings shared by every
uncommon template in the game, and each one you add divides that pool again.
Ordinary texture therefore belongs at `common`, which has no cooldown at all.
And **the rare tier is rationed by its draw weight, not by its cap** — the
22-a-run cap almost never binds, because a rare template loses the yearly draw
to the common pool long before the cap or the fifty-five-year cooldown is
reached.

**And a fifth, which is the one to read before adding anything in bulk: the
size of a tier's pool is not what `frequency:` reports.** Frame events ration
off `world.frame` and arc nodes are excluded from the ambient pool by
construction, so a tier can look like 44 templates and behave like nine. Count
it. The rare drop above is what happens when nobody does.

**A third fact, and it is the one that actually bites: a tier's share of the
year is not a property of the tier.** It is the tier's weight times how many
templates carry it times their own weights, over the same product summed across
every other tier — so twenty-eight new COMMON templates ration uncommon and rare
without one line of their content changing, and nothing anywhere reports it.
Measured over sixty thousand-year runs when those twenty-eight went in: uncommon
fell from 93.1 firings a run to 75.0, rare from 24.0 to 14.1, and
`the_coat_hung_up` from 13.3% of runs to zero, which is how gate 4 found it. The
answer is the profile and not the templates — uncommon and rare live in
`schema/src/frequency.ts`, both with every measurement written next to them,
and raising them restores the tier's share of the draw without touching its
ration.

**And a fourth, which is where that knob stops.** Fifty more COMMON templates
(`the_hall`, `feasts`, `the_turning_year`, `bramme`, `the_young`,
`neighbours`) took the common pool from 55 templates to 105 and did it again:
uncommon 79.6 firings a run to 65.8, rare 15.5 to 11.8, over 24 thousand-year
runs with nothing else changed. Sweeping the weight back, over 32 runs:
400 → uncommon 66.0, rare 11.5 · 700 → 71.4 / 13.5 · 1000 → 73.7 / 13.8.
**The curve flattens and does not reach**, and that is not the weight failing.
It is the twelve-year cooldown, which caps uncommon near 83 firings a run and
had it at 79.6 — within four per cent of its own ceiling — before the drop. A
tier already pressed against its ration cannot be given its old share back by
weight, because the years it wants are years it is barred from. Uncommon is
800 now and rare 320, which recovers about three quarters of it; the last
quarter is the cooldown's, and the cooldown is the ration. Gate 4 and gate 8
are green there, which is the test that actually matters.

**Presence modifiers are the same instrument.** Seven career traits with
`event_weight` multipliers, none above 1.3 and none suppressing anything, took
`wend.yaml`'s inline two-beat scene from 53% of runs to 35%: a tag lifted is
every untagged template in the pool pushed down. They pay out in `check_bonus`
and `attribute` now. And watch the money — a new common template is cheaper on
average than the expensive scenes it displaces, which is why the median
thousand-year treasury rose by half before the new commons were repriced against
the ones they crowd out.

This list was reconciled against the code on the date above, and AGENTS.md's
"Known gaps" was corrected to match — including barrenness as a recessive, which
both files listed as unbuilt for months after it shipped. Where any prose here and the code disagree,
**the code is the spec** — fix the prose.
