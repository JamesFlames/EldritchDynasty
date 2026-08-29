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

**The one thing that is still convergent.** The blood **dilutes** across a run
and no play concentrates it: measured, an oracle player who always takes the
card whose person actually carries the most font still watches the family's
carried font fall from ~25 in the founding generation to 6–11 and stay there
for eight centuries. Cousin marriage — §7's One Permutation, "not a temptation,
it is the mechanism" — is on 46% of hands now and does not beat recombination
plus the deleterious load, which kills concentrating lines before the channel
can rise. Everything downstream follows: the ladder stalls at Adept, the
Vessel's cost is never paid, and the Broken Line cannot happen. This is a
genetics balance problem in the family that issue #26 and `gate:drag` already
exist for, and it wants a measured session of its own — not a nudge.

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
