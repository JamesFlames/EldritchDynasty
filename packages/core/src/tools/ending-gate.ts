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
 * ─── Why it is not in `npm run gate` ───────────────────────────────────────
 *
 * Same reason as `gate:blood`, `gate:drag` and `gate:bearing`: a five-way
 * distribution with floors is meaningless at the dozen runs a CI budget
 * allows, and `BALANCE-LOG` has already recorded what a hundred runs does to
 * a measurement like this — nine different casualties in nine consecutive
 * measurements of content that was getting steadily healthier. This issue
 * asks for 250 for exactly that reason.
 */
import { loadContent } from '@ed/content';
import { indexContent, type Content, type ContentBundle, type EndingId, type Rung } from '@ed/schema';
import { bootstrap, clearNamingQueue } from '../sim.js';
import { stepYear } from '../year/step.js';
import { makeRng, hashSeed } from '../rng.js';
import { autoResolveAll } from '../events/decisions.js';
import { END_YEAR, closeTheLedger, readTheChronicle } from '../ending.js';
import { rungIndex } from '../ascension.js';

type Source = ContentBundle | Content;

/** The three that are catastrophes. `forgotten` is a loss and is not one of these. */
export const CATASTROPHES: readonly EndingId[] = ['unmade', 'broken_line', 'devoured'];

/** Every ending §23 authored, so a zero is visible rather than absent. */
export const ALL_ENDINGS: readonly EndingId[] = [
  'apotheosis', 'unmade', 'broken_line', 'forgotten', 'devoured',
];

export interface EndingRun {
  seed: number;
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
  lowWater: number;
  /**
   * Living members OF THE BLOOD on the last night, as against everyone living
   * under the roof. `atTheTable` counts the household — retainers, wives
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
 * One run, played by the chronicler to the term.
 *
 * Deliberately NOT played by a policy. This asks what the game does, and a
 * column that took every ladder bargain would be measuring that policy's
 * ending distribution rather than the game's — which is a different and much
 * later question than *can this be lost at all*.
 */
export function playToTheEnd(source: Source, seed: number, years: number): EndingRun {
  const ctx = bootstrap(indexContent(source), seed, 1042);
  const w = ctx.world;

  let lowWater = Number.POSITIVE_INFINITY;
  let bloodLow = Number.POSITIVE_INFINITY;
  // Alive, and of the blood. Matches `readTheChronicle`'s `atTheTable`: a
  // guardian is not at the table, and a household is not a line.
  const livingBlood = () => w.people.blood(w.playerHouse)
    .filter((p) => p.status === 'alive').length;
  for (let y = 0; y < years; y++) {
    if (w.year >= END_YEAR) break;
    stepYear(ctx, false);
    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      autoResolveAll(ctx, makeRng(hashSeed(seed, 'ending-batch', w.year, guard)));
    }
    clearNamingQueue(ctx);
    lowWater = Math.min(lowWater, w.people.household(w.playerHouse, w.year).length);
    bloodLow = Math.min(bloodLow, livingBlood());
  }

  // AND THE READING ITSELF. `closeTheLedger` runs INSIDE `stepYear`, on a year
  // that has already reached the term — so a loop that stops the moment the
  // year hits 2042 never calls it, and the run finishes with no ending at all.
  //
  // The first cut of this file defaulted that to `forgotten`, and the batch
  // came back 100 runs of 100 forgotten with `attested above adept 35` printed
  // underneath it. Thirty-five houses whose book attests a Hierophant are
  // thirty-five `devoured` by `selectEnding`; the two numbers could not both
  // be true, and the one that was lying was the default. A silent fallback in
  // the instrument is worse than one in the game: it reports the finding the
  // issue predicted, in the issue's own words, and is wrong.
  if (w.year >= END_YEAR) closeTheLedger(ctx);

  const r = readTheChronicle(ctx);
  return {
    seed,
    // Never defaulted. A run with no ending is a broken measurement and
    // `verdictOver` fails on it rather than counting it as anything.
    ending: w.ending?.id ?? ('none' as EndingId),
    attested: r.attested,
    clauses: r.clauses,
    survivors: w.people.household(w.playerHouse, w.year).length,
    lowWater: Number.isFinite(lowWater) ? lowWater : 0,
    bloodLeft: livingBlood(),
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
const FLOOR = 0.01;

/** The recorded decision, as a band rather than a number. */
const CATASTROPHE_BAND = { low: 0.22, high: 0.45 };

/** Below this the batch cannot see a five-way distribution and says so. */
const MEANINGFUL = 60;

export function verdictOver(runs: EndingRun[]): EndingVerdict {
  const lines: string[] = [];
  const n = runs.length;
  const count = (id: EndingId) => runs.filter((r) => r.ending === id).length;

  for (const id of ALL_ENDINGS) {
    const c = count(id);
    lines.push(`  ${id.padEnd(12)} ${String(c).padStart(4)}  ${(100 * c / n).toFixed(1)}%`);
  }

  const catastrophes = CATASTROPHES.reduce((a, id) => a + count(id), 0);
  const share = catastrophes / n;
  lines.push(
    `  --- ${n} runs · catastrophes ${catastrophes} (${(100 * share).toFixed(1)}%)`
    + `  target ${(100 * CATASTROPHE_BAND.low).toFixed(0)}-${(100 * CATASTROPHE_BAND.high).toFixed(0)}%`,
  );
  lines.push(
    `  survivors ${(runs.reduce((a, r) => a + r.survivors, 0) / n).toFixed(1)}`
    + `  clauses ${(runs.reduce((a, r) => a + r.clauses, 0) / n).toFixed(2)}`
    + `  attested above adept ${runs.filter((r) => rungIndex(r.attested) > rungIndex('adept')).length}`,
  );
  // HOW CLOSE THE TAIL GETS. A house that never dips is a different problem
  // from one that keeps nearly dying, and `broken_line` at zero looks the same
  // either way.
  const lows = runs.map((r) => r.lowWater).sort((a, b) => a - b);
  const bloods = runs.map((r) => r.bloodLow).sort((a, b) => a - b);
  lines.push(
    `  low-water household: min ${lows[0]}  p05 ${lows[Math.floor(n * 0.05)]}`
    + `  median ${lows[Math.floor(n * 0.5)]}  under 5: ${lows.filter((v) => v < 5).length}`,
  );
  lines.push(
    `  low-water BLOOD:     min ${bloods[0]}  p05 ${bloods[Math.floor(n * 0.05)]}`
    + `  median ${bloods[Math.floor(n * 0.5)]}  at zero: ${bloods.filter((v) => v === 0).length}`
    + `  blood alive at term: ${(runs.reduce((a, r) => a + r.bloodLeft, 0) / n).toFixed(1)}`,
  );

  // VALIDITY FIRST, and at every sample size. A run that reached the term with
  // no ending is not evidence about the distribution — it is a broken
  // measurement, and counting it as `forgotten` is how this file spent its
  // first batch confirming the issue's premise with a number it had invented.
  const bad = runs.filter((r) => !ALL_ENDINGS.includes(r.ending));
  if (bad.length) {
    lines.push(`  FAIL: ${bad.length} run(s) reached the term without an ending`);
    return { ok: false, lines };
  }

  if (n < MEANINGFUL) {
    lines.push(`  (${n} runs cannot see a five-way distribution; nothing asserted but validity)`);
    return { ok: true, lines };
  }

  const failures: string[] = [];

  // The premise this issue was filed about: every house arriving at the same
  // place. One ending taking nearly everything is that state, whichever it is.
  for (const id of ALL_ENDINGS) {
    if (id === 'apotheosis') continue;
    if (count(id) / n < FLOOR) {
      failures.push(`  FAIL: ${id} is below the floor (${count(id)} of ${n}, floor ${(100 * FLOOR).toFixed(0)}%)`);
    }
  }

  if (share < CATASTROPHE_BAND.low) {
    failures.push(`  FAIL: the run is not losable enough (${(100 * share).toFixed(1)}%, band opens at ${(100 * CATASTROPHE_BAND.low).toFixed(0)}%)`);
  }
  if (share > CATASTROPHE_BAND.high) {
    failures.push(`  FAIL: the run is losable to the point of being a punishment (${(100 * share).toFixed(1)}%)`);
  }

  lines.push(...failures);
  return { ok: failures.length === 0, lines };
}

export function gateEndings(source: Source = loadContent(), runs = 24, years = 1000): EndingVerdict {
  const played: EndingRun[] = [];
  for (let i = 0; i < runs; i++) played.push(playToTheEnd(source, 5100 + i, years));
  const v = verdictOver(played);
  return { ok: v.ok, lines: [`gate (endings): ${runs} played runs x ${years} years`, ...v.lines] };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('ending-gate.ts');
if (isMain) {
  const runs = Number(process.argv[2] ?? 24);
  const years = Number(process.argv[3] ?? 1000);
  const { ok, lines } = gateEndings(loadContent(), runs, years);
  console.log(lines.join('\n'));
  process.exit(ok ? 0 : 1);
}
