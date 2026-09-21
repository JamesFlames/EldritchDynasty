/**
 * IS THE RUN LOSABLE? THE ENDING DISTRIBUTION (issue #42).
 *
 *   npm run gate:endings -- [runs] [years]
 *   npm run gate:endings -- 250 1000
 *
 * `assize.ts` has carried the finding this exists to close since it shipped:
 *
 *   > Measured across fourteen thousand-year runs, the shipped game could not
 *   > be lost and could not be won differently: zero houses died out, the
 *   > household never fell below ten people, every player-driven run finished
 *   > with nine of nine Ledger clauses, and standing landed on exalted or
 *   > eminent nearly every time. Five endings are authored (§23) and the
 *   > simulation could not tell them apart.
 *
 * ─── The target, and where it came from ────────────────────────────────────
 *
 * Recorded on the issue before this file existed, so the gate is written
 * against a decision rather than fitted to whatever the batch produced:
 * **about one run in three ends in a loss the player feels as one.** The harsh
 * end of the genre, chosen over "rare and memorable" on the grounds that a
 * collapse one house in ten suffers is a story about luck.
 *
 * Four of the five endings are losses of different kinds and they do not all
 * feel like one, so the target is read over the three CATASTROPHES —
 * `unmade`, `broken_line`, `devoured` — and `forgotten` is held to its own
 * floor. The reason for splitting it out is §29's own acceptance clause (*the
 * Forgotten stays reachable*: the modest house has to lose too, and
 * differently), which a gate that pooled them could not see.
 *
 * ─── The judgement is split from the playing ───────────────────────────────
 *
 * `verdictOver` is a function over runs, so `ending-gate.test.ts` can hand it
 * a distribution where the run is losable and one where every house arrives
 * at the same place — which is the state this issue was filed about, and the
 * one thing a gate over the real bundle can never demonstrate it would catch.
 *
 * ─── It IS in `npm run gate` ────────────────────────────────────────────────
 *
 * Registered in `GATES` (`tools/gates.ts`) and pinned there by
 * `gates.test.ts`. An earlier draft of this comment said otherwise — written
 * before `endings` was added to the registry and never updated once it was.
 * `gate:endings -- 250 1000` is still how to run it standalone with a bigger
 * batch than CI's default carries.
 *
 * ─── The second column: `ascendant` (issue #61, Stage D) ───────────────────
 *
 * `playToTheEnd` is played by the chronicler by design (see its own doc
 * comment) — that answers "what does the shipped game do", and is the
 * column the catastrophe band and the per-ending floors are read against.
 * It cannot answer "is Apotheosis reachable at all", because a house that
 * never plays for the ladder is not the house #22 is describing, and
 * #61's own trail measured this directly: `gate:ladder`'s `climb` and
 * `scion` columns diverge from `chronicler` by design, on exactly the
 * choices that decide whether the top of the ladder is ever reached.
 *
 * `ascendant` is a house pulling every lever the game gives a player for
 * building the ladder, at once: it takes Madness bargains like `climb`
 * (`answer`, `tools/ladder-policy.ts`), names and holds a Scion and Heir via the pair mechanism
 * (`nameScion` / `nameScionHeir`), and marries in like `blood-gate.ts`'s `marry_in`.
 * Unlike `gate:ladder`'s three columns — deliberately one verb apart to
 * isolate a single mechanism — this is the composite on purpose: the
 * question here is whether the top is reachable to a house TRYING, not
 * which lever does the trying.
 *
 * It also gets a bid ceiling (`gate:ladder`'s own default, 600) that the
 * chronicler column has never had: `world.bidCeiling` defaults to 0, so
 * `playToTheEnd`'s chronicler has never bought a book at auction. Books were
 * a binding blocker in every ladder measurement on this issue; a composite
 * column that could not buy one would understate what a trying house can
 * reach for a reason unrelated to the ladder itself.
 *
 * `verdictOver`'s policy denominator (owner's decision 2, in #61's trail):
 * Apotheosis' 8–29% target (widened 2026-09-20 from the original 8–15%, low
 * bound unchanged, at the owner's request) is read against `ascendant`. The chronicler is
 * held only to non-zero and strictly below it — a game that hands a god to
 * a house that never played for one is not the game §22 describes.
 */
import { loadContent } from '@ed/content';
import { indexContent, type CampaignId, type Content, type ContentBundle, type EndingId, type Rung } from '@ed/schema';
import { bootstrap, clearNamingQueue } from '../sim.js';
import { stepYear } from '../year/step.js';
import { makeRng, hashSeed } from '../rng.js';
import { autoResolveAll } from '../events/decisions.js';
import { closeTheLedger, livingBlood, readTheChronicle } from '../ending.js';
import { rungIndex } from '../ascension.js';
import { campaignDef } from '../campaign.js';
import { nameScion, nameScionHeir, resolveYear, type LadderPolicy } from './ladder-policy.js';

type Source = ContentBundle | Content;

/**
 * Only two of `LadderPolicy`'s five values apply here. This file never
 * isolates a single lever the way `gate:ladder` does — `chronicler` plays
 * the shipped game, `ascendant` pulls every lever at once. `climb`, `spare`
 * and `scion` are `gate:ladder`'s own vocabulary for isolating one mechanism
 * at a time and have no meaning as a standalone column here.
 */
export type EndingPolicy = Extract<LadderPolicy, 'chronicler' | 'ascendant'>;

/** `gate:ladder`'s own default bid ceiling — see the header comment above. */
const ASCENDANT_BID = 600;

/** The three that are catastrophes. `forgotten` is a loss and is not one of these. */
export const CATASTROPHES: readonly EndingId[] = ['unmade', 'broken_line', 'devoured'];

/** Every ending §23 authored, so a zero is visible rather than absent. */
export const ALL_ENDINGS: readonly EndingId[] = [
  'apotheosis', 'unmade', 'broken_line', 'forgotten', 'devoured',
];

export interface EndingRun {
  seed: number;
  policy: EndingPolicy;
  ending: EndingId;
  /** The highest rung the BOOK attests, which is what the creditor read. */
  attested: Rung;
  clauses: number;
  /** Living members of the house on the last night. */
  survivors: number;
  /**
   * The fewest living members the house ever had, in any year of the run.
   *
   * `survivors` says whether the line reached the term; this says how close it
   * came to not. A batch where nothing dies out AND nothing ever dips is a
   * different problem from one that keeps nearly dying and recovering, and
   * `broken_line` at zero cannot tell them apart on its own.
   */
  householdLow: number;
  /**
   * Living members OF THE BLOOD on the last night, as against everyone living
   * under the roof. `livingBlood` counts the household — retainers, wives
   * married in, wards — and the recurring cast is re-minted forever, so the
   * building never empties whatever happens to the family.
   */
  bloodLeft: number;
  /** The fewest of the blood the house ever had living at once. */
  bloodLow: number;
}

export interface EndingVerdict {
  ok: boolean;
  lines: string[];
}

/**
 * One run, played to the term by `policy` — `chronicler` (the default) or
 * `ascendant`. See the header comment's "the second column" for what
 * `ascendant` pulls and why: this asks what the game does BY DEFAULT versus
 * what it does for a house trying for the top, and those are different and
 * both worth asking, so the policy is a parameter rather than a fixed choice.
 *
 * The chronicler path is untouched from before this file took a policy —
 * same RNG salt (`'ending-batch'`), same loop — so every existing chronicler
 * measurement on this gate stays reproducible. `ascendant` reuses
 * `tools/ladder-policy.ts`'s `resolveYear`/`nameScion`/`nameScionHeir` rather than a second
 * copy of the decision loop `gate:ladder` already has.
 */
export function playToTheEnd(
  source: Source,
  seed: number,
  years: number,
  policy: EndingPolicy = 'chronicler',
  campaign: CampaignId = 'long',
): EndingRun {
  const def = campaignDef(campaign);
  const ctx = bootstrap(indexContent(source), seed, def.startYear, campaign);
  const w = ctx.world;
  if (policy === 'ascendant') {
    // Both levers `gate:ladder`'s own comments already price: marrying in
    // concentrates the blood, the bid ceiling lets the house reach for a
    // book. The chronicler column gets neither, because it is playing the
    // shipped game rather than a house trying for the ladder.
    w.marriagePolicy = 'in';
    w.bidCeiling = ASCENDANT_BID;
  }

  let householdLow = Number.POSITIVE_INFINITY;
  let bloodLow = Number.POSITIVE_INFINITY;
  const tally = { asked: 0, paid: 0 };
  for (let y = 0; y < years; y++) {
    // THE TERM, OR THE LINE RUNNING OUT BEFORE IT (issue #42). `stepYear`
    // itself now stops turning the year on either — see its own comment —
    // so once `w.ending` is set every further call is a cheap no-op, but a
    // batch loop still has no reason to keep making it 900 times over.
    if (w.year >= def.endYear || w.ending) break;
    if (policy === 'ascendant') {
      nameScion(ctx);
      nameScionHeir(ctx);
    }
    stepYear(ctx, false);
    if (policy === 'ascendant') {
      resolveYear(ctx, seed, policy, tally);
    } else {
      let guard = 0;
      while (w.pendingDecisions.length && guard++ < 200) {
        autoResolveAll(ctx, makeRng(hashSeed(seed, 'ending-batch', w.year, guard)));
      }
    }
    clearNamingQueue(ctx);
    householdLow = Math.min(householdLow, w.people.household(w.playerHouse, w.year).length);
    bloodLow = Math.min(bloodLow, livingBlood(w));
  }

  // AND THE READING ITSELF. `closeTheLedger` runs INSIDE `stepYear`, on a year
  // that has already reached the term (or emptied the blood) — so a loop that
  // stops the moment either happens never calls it on its own, and the run
  // would finish with no ending at all.
  //
  // The first cut of this file defaulted that to `forgotten`, and the batch
  // came back 100 runs of 100 forgotten with `attested above adept 35` printed
  // underneath it. Thirty-five houses whose book attests a Hierophant are
  // thirty-five `devoured` by `selectEnding`; the two numbers could not both
  // be true, and the one that was lying was the default. A silent fallback in
  // the instrument is worse than one in the game: it reports the finding the
  // issue predicted, in the issue's own words, and is wrong.
  if (w.year >= def.endYear || w.ending) closeTheLedger(ctx);

  const r = readTheChronicle(ctx);
  return {
    seed,
    policy,
    // Never defaulted. A run with no ending is a broken measurement and
    // `verdictOver` fails on it rather than counting it as anything.
    ending: w.ending?.id ?? ('none' as EndingId),
    attested: r.attested,
    clauses: r.clauses,
    survivors: w.people.household(w.playerHouse, w.year).length,
    householdLow: Number.isFinite(householdLow) ? householdLow : 0,
    bloodLeft: livingBlood(w),
    bloodLow: Number.isFinite(bloodLow) ? bloodLow : 0,
  };
}

/**
 * THE FLOOR EACH ENDING IS HELD TO.
 *
 * A share rather than a count, so the gate means the same thing at 250 runs
 * and at 1,000. `apotheosis` is deliberately absent from the floors: §22's God
 * is the terminal outcome a family has to be built for, and a floor under it
 * would be a gate demanding the rarest thing in the design happen on schedule.
 * It is printed, and a zero there is a finding rather than a failure.
 */
const ENDING_FLOOR = 0.01;

/** The recorded decision, as a band rather than a number. */
const CATASTROPHE_BAND = { low: 0.22, high: 0.45 };

/**
 * #61's own acceptance, and owner's decision 2 on what it is read against:
 * a house PLAYING for the ladder, never the chronicler. Banded both ways
 * like `CATASTROPHE_BAND` — an Apotheosis that fires on every ascendant run
 * would say the top of the ladder stopped being a climb.
 *
 * Widened 2026-09-20 from the original 8–15% to 8–29% at the owner's request,
 * to make the top of the ladder easier for the player to reach — a deliberate
 * relaxation of the target, not a measurement. The low bound is untouched;
 * only the ceiling moved. See #61's acceptance section and BALANCE-LOG.
 */
const APOTHEOSIS_BAND = { low: 0.08, high: 0.29 };

/**
 * Below this the batch cannot see a five-way distribution and says so.
 *
 * A floor of 1% needs at least a hundred runs to be judged at all: at sixty it
 * is 0.6 of a run, so an ending that fires in one run of sixty — which is
 * ABOVE the floor — reads as below it whenever the next batch happens to
 * contain none. That failed a batch on `unmade` while the same content was
 * resolving fine in gate 8's 250 runs, which is a gate reporting sampling
 * noise as a defect.
 */
const JUDGEABLE_BATCH = 100;

export function verdictOver(runs: EndingRun[]): EndingVerdict {
  const lines: string[] = [];
  // THE TWO COLUMNS (issue #61, Stage D). Everything below that existed
  // before this split — the per-ending shares, the catastrophe band, the
  // low-water lines — reads the CHRONICLER column only, unchanged in
  // meaning: it is still "what does the shipped game do". A caller that
  // supplies chronicler-only runs (every test predating this split did)
  // gets byte-identical behaviour, because `ascendant` is simply empty.
  const chronicler = runs.filter((r) => r.policy === 'chronicler');
  const ascendant = runs.filter((r) => r.policy === 'ascendant');
  const n = chronicler.length;
  const count = (id: EndingId) => chronicler.filter((r) => r.ending === id).length;

  for (const id of ALL_ENDINGS) {
    const c = count(id);
    lines.push(`  ${id.padEnd(12)} ${String(c).padStart(4)}  ${n ? (100 * c / n).toFixed(1) : '0.0'}%`);
  }

  const catastrophes = CATASTROPHES.reduce((a, id) => a + count(id), 0);
  const share = n ? catastrophes / n : 0;
  lines.push(
    `  --- ${n} runs · catastrophes ${catastrophes} (${(100 * share).toFixed(1)}%)`
    + `  target ${(100 * CATASTROPHE_BAND.low).toFixed(0)}-${(100 * CATASTROPHE_BAND.high).toFixed(0)}%`,
  );
  if (n) {
    lines.push(
      `  survivors ${(chronicler.reduce((a, r) => a + r.survivors, 0) / n).toFixed(1)}`
      + `  clauses ${(chronicler.reduce((a, r) => a + r.clauses, 0) / n).toFixed(2)}`
      + `  attested above adept ${chronicler.filter((r) => rungIndex(r.attested) > rungIndex('adept')).length}`,
    );
    // HOW CLOSE THE TAIL GETS. A house that never dips is a different problem
    // from one that keeps nearly dying, and `broken_line` at zero looks the
    // same either way.
    const lows = chronicler.map((r) => r.householdLow).sort((a, b) => a - b);
    const bloods = chronicler.map((r) => r.bloodLow).sort((a, b) => a - b);
    lines.push(
      `  low-water household: min ${lows[0]}  p05 ${lows[Math.floor(n * 0.05)]}`
      + `  median ${lows[Math.floor(n * 0.5)]}  under 5: ${lows.filter((v) => v < 5).length}`,
    );
    lines.push(
      `  low-water BLOOD:     min ${bloods[0]}  p05 ${bloods[Math.floor(n * 0.05)]}`
      + `  median ${bloods[Math.floor(n * 0.5)]}  at zero: ${bloods.filter((v) => v === 0).length}`
      + `  blood alive at term: ${(chronicler.reduce((a, r) => a + r.bloodLeft, 0) / n).toFixed(1)}`,
    );
  }

  // THE ASCENDANT COLUMN. Printed even at zero runs, so a caller who forgot
  // to supply it sees why the checks below never ran rather than a silently
  // skipped one.
  const aN = ascendant.length;
  const aCount = (id: EndingId) => ascendant.filter((r) => r.ending === id).length;
  const aApo = aCount('apotheosis');
  const aShare = aN ? aApo / aN : 0;
  lines.push(
    `  ascendant (playing for the ladder): ${aN} runs`
    + (aN ? `  apotheosis ${aApo} (${(100 * aShare).toFixed(1)}%)` : ' — none supplied'),
  );

  // VALIDITY FIRST, and at every sample size, over BOTH columns — a run that
  // reached the term with no ending is a broken measurement whichever policy
  // played it, and counting it as `forgotten` is how this file spent its
  // first batch confirming the issue's premise with a number it had invented.
  const bad = runs.filter((r) => !ALL_ENDINGS.includes(r.ending));
  if (bad.length) {
    lines.push(`  FAIL: ${bad.length} run(s) reached the term without an ending`);
    return { ok: false, lines };
  }

  const chronJudgeable = n >= JUDGEABLE_BATCH;
  const ascJudgeable = aN >= JUDGEABLE_BATCH;
  if (!chronJudgeable) {
    lines.push(`  (${n} chronicler runs cannot see a five-way distribution; nothing asserted but validity)`);
  }
  if (aN > 0 && !ascJudgeable) {
    lines.push(`  (${aN} ascendant runs cannot see whether apotheosis is reachable; nothing asserted)`);
  }
  if (!chronJudgeable) {
    return { ok: true, lines };
  }

  const failures: string[] = [];

  // The premise this issue was filed about: every house arriving at the same
  // place. One ending taking nearly everything is that state, whichever it is.
  for (const id of ALL_ENDINGS) {
    if (id === 'apotheosis') continue;
    if (count(id) / n < ENDING_FLOOR) {
      failures.push(`  FAIL: ${id} is below the floor (${count(id)} of ${n}, floor ${(100 * ENDING_FLOOR).toFixed(0)}%)`);
    }
  }

  if (share < CATASTROPHE_BAND.low) {
    failures.push(`  FAIL: the run is not losable enough (${(100 * share).toFixed(1)}%, band opens at ${(100 * CATASTROPHE_BAND.low).toFixed(0)}%)`);
  }
  if (share > CATASTROPHE_BAND.high) {
    failures.push(`  FAIL: the run is losable to the point of being a punishment (${(100 * share).toFixed(1)}%)`);
  }

  // OWNER'S DECISION 2 (issue #61's trail): the 8-29% Apotheosis target is
  // read against a house PLAYING for the ladder, never the chronicler — a
  // game that hands a god to a house that never tried is not the game §22
  // describes. Both halves of this need their own judgeable batch, which is
  // why it sits behind `ascJudgeable` rather than `chronJudgeable` alone.
  if (ascJudgeable) {
    if (aShare < APOTHEOSIS_BAND.low) {
      failures.push(`  FAIL: apotheosis is below the ascendant target (${(100 * aShare).toFixed(1)}%, band opens at ${(100 * APOTHEOSIS_BAND.low).toFixed(0)}%)`);
    }
    if (aShare > APOTHEOSIS_BAND.high) {
      failures.push(`  FAIL: apotheosis is above the ascendant target (${(100 * aShare).toFixed(1)}%, band closes at ${(100 * APOTHEOSIS_BAND.high).toFixed(0)}%)`);
    }
    // THE STATE THIS HALF OF THE ISSUE WAS FILED ABOUT: a house that never
    // tried reaching God as often as, or more often than, a house that did —
    // which would mean playing for the ladder buys nothing.
    const chronApo = count('apotheosis') / n;
    if (chronApo >= aShare) {
      failures.push(`  FAIL: the chronicler reaches apotheosis (${(100 * chronApo).toFixed(1)}%) at least as often as ascendant (${(100 * aShare).toFixed(1)}%) — trying for the ladder buys nothing`);
    }
  }

  lines.push(...failures);
  return { ok: failures.length === 0, lines };
}

export function gateEndings(source: Source = loadContent(), runs = 24, years = 1000): EndingVerdict {
  const played: EndingRun[] = [];
  for (let i = 0; i < runs; i++) {
    // SAME SEED, BOTH POLICIES — `gate:ladder`'s own pairing, not a fresh
    // seed pool per column: it isolates the policy's effect from the
    // founding generation's own randomness rather than mixing the two.
    played.push(playToTheEnd(source, 5100 + i, years, 'chronicler'));
    played.push(playToTheEnd(source, 5100 + i, years, 'ascendant'));
  }
  const v = verdictOver(played);
  return { ok: v.ok, lines: [`gate (endings): ${runs} played runs x ${years} years, per policy`, ...v.lines] };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('ending-gate.ts');
if (isMain) {
  const runs = Number(process.argv[2] ?? 24);
  const years = Number(process.argv[3] ?? 1000);
  const { ok, lines } = gateEndings(loadContent(), runs, years);
  console.log(lines.join('\n'));
  process.exit(ok ? 0 : 1);
}
