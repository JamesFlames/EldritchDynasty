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

**Not built.** Three of the five endings cannot fire yet — the rites (#43) and a
ladder that reaches God in a measured run (#41). They are authored anyway, and
#42 is the gate that grades the distribution once they can. **Packaging** — no
`electron-builder`, no signing, no auto-update. **A Save/Load menu** — the
shell's disk layer is built and tested end to end by `npm run smoke`; the client
keeps its run in `sessionStorage` so a reload does not end it, and that is not a
menu.

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
| 2 / 2 | `frame_nothing_worth_the_ink` |
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
