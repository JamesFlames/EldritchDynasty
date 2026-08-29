/**
 * DOES THE HEADLINE DECISION MOVE THE HEADLINE NUMBER? (issue #41)
 *
 *   npm run gate:blood -- [runs] [years] [--cm=N] [--del=P] [--fontp=P]
 *   npm run gate:blood -- 12 1000
 *   npm run gate:blood -- 8 1000 --cm=18,9,4 --del=0.08,0.04
 *
 * `docs/BALANCE-LOG.md` records the finding this tool exists to close:
 *
 *   > The blood DILUTES across a run and no play concentrates it: measured, an
 *   > oracle player who always takes the card whose person actually carries the
 *   > most font still watches the family's carried font fall from ~25 in the
 *   > founding generation to 6-11 and stay there for eight centuries.
 *
 * Who marries whom is one of the three things §4 says the player does. If an
 * oracle — someone with perfect information about every card — cannot beat the
 * drift, a real player choosing between three cards is choosing between three
 * identical outcomes with different flavour text. That is a fun bug wearing a
 * balance bug's clothes, and it is why this is a gate and not a harness column.
 *
 * ─── What is different about this instrument ────────────────────────────────
 *
 * Every other batch tool in this directory runs `runYears`, which is the
 * CHRONICLER playing: `autoTakeCard` picks a card by its own rules and the
 * measurement is of the simulation left alone. That cannot answer this
 * question, because the question is about the player.
 *
 * So this one plays. `stepYear(ctx, false)` parks decisions on the docket, the
 * policy answers every `match` and the chronicler answers everything else —
 * which is exactly the shape of a real session, and means the difference
 * between two columns here is a difference in ONE verb.
 *
 * ─── The policies ───────────────────────────────────────────────────────────
 *
 * `concentrate` is the oracle #41 describes: take the card whose person really
 * carries the most font, breaking ties toward kin. It cheats — it reads the
 * genome behind a card the game never shows — and that is the point. It is an
 * upper bound on what any human could do, and if the upper bound does not beat
 * the drift, no human can.
 *
 * `dilute` is its opposite and the control: always marry out. Two columns that
 * do not separate mean the decision does not exist.
 *
 * `chronicler` is what every other tool in this directory measures, kept here
 * so the two played columns can be read against the unplayed one.
 */
import { loadContent } from '@ed/content';
import { indexContent, type ContentBundle, type LocusDef, type Rung } from '@ed/schema';
import { bootstrap } from '../sim.js';
import { stepYear } from '../year/step.js';
import { makeRng, hashSeed } from '../rng.js';
import { autoResolveAll, declineMatch, resolveMatch, type PendingMatch } from '../events/decisions.js';
import { clearNamingQueue } from '../sim.js';
import { phenotypeOf, genomeOf } from '../people/factory.js';
import { realizedHomozygosity, deleteriousLoad } from '../genetics/expression.js';
import { rungIndex } from '../ascension.js';
import { closeTheLedger, END_YEAR, selectEnding } from '../ending.js';
import type { SimCtx } from '../world.js';

export type Policy = 'concentrate' | 'dilute' | 'chronicler' | 'withhold' | 'marry_in' | 'marry_out';

export interface BloodRun {
  seed: number;
  policy: Policy;
  /** Carried font of the house's blood women, first cohort against last. */
  fontEarly: number;
  fontLate: number;
  /** The most any one person of the blood ever carried, and when. */
  fontPeak: number;
  peakYear: number;
  /** The highest rung the house ever stood on. */
  best: Rung;
  survived: boolean;
  living: number;
  /** The funnel: what concentration costs the bodies doing it. */
  meanF: number;
  cursesPerPerson: number;
  /**
   * THE PAIRING THE WHOLE DESIGN TURNS ON: both parties carrying. §7 calls
   * cousin marriage "the only route by which carried power reaches an
   * expressing male heir", and this is the count of times the house actually
   * took that route. Measured before any lever was moved: four times in a
   * thousand years, out of 481 marriages.
   */
  hotPairs: number;
  /** The most anyone of the house ever read, and the deepest Madness reached. */
  booksBest: number;
  madnessPeak: number;
  /** Carriers, and men who can express, alive at the term. */
  carriersAtEnd: number;
  expressingAtEnd: number;
  /** How the policy actually played: hands seen, kin taken, hands declined. */
  hands: number;
  kinTaken: number;
  declined: number;
  ending: string;
}

/**
 * THE SWEEP, as content rather than as constants.
 *
 * Both levers are content — the positions in `loci.yaml` and the pool numbers
 * in `houses.yaml` — so a sweep point is a bundle, exactly as `gate:drag`
 * builds one per coupling. Nothing here reaches into the engine, which is what
 * keeps a sweep honest: whatever it measures is a game somebody could ship by
 * editing two files.
 *
 * `cM` is the distance between font loci on the X, authored at 18. It is the
 * suspect this tool was built to arraign. A son's font comes only from his
 * mother, and a mother passes a MOSAIC of her two X's — so the question of
 * whether the blood can concentrate is the question of whether six font loci
 * travel together through a female meiosis, and that is a distance in
 * centiMorgans and nothing else.
 *
 * `del` is the player pool's `deleteriousLoad`, authored at 0.08 — the other
 * half of `BALANCE-LOG`'s sentence, "recombination plus the deleterious load,
 * which kills concentrating lines before the channel can rise".
 */
export function bloodBundle(
  bundle: ContentBundle,
  opts: { cM?: number; deleterious?: number; drive?: number; books?: number } = {},
): ContentBundle {
  let loci: LocusDef[] = bundle.loci;

  if (opts.cM !== undefined) {
    // Re-place the font block at the new spacing, and carry each paired drag
    // locus along at its authored offset so the sweep moves ONE thing. The X's
    // overall span is set by the core loci beyond the block, so the crossover
    // COUNT per meiosis does not move either: what changes is how many of
    // those crossovers land inside the font block.
    const offset = new Map<string, number>();
    for (const l of bundle.loci) {
      if (l.kind !== 'fecundity_drag') continue;
      const font = bundle.loci.find((f) => String(f.id) === `font_${String(l.id).replace('fecundity_drag_', '')}`);
      if (font) offset.set(String(l.id), l.position - font.position);
    }
    const placed = new Map<string, number>();
    loci = loci.map((l) => {
      if (l.kind !== 'eldritch_font') return l;
      const n = Number(String(l.id).replace('font_', ''));
      const position = opts.cM! * n;
      placed.set(String(l.id), position);
      return { ...l, position };
    });
    loci = loci.map((l) => {
      if (l.kind !== 'fecundity_drag') return l;
      const font = placed.get(`font_${String(l.id).replace('fecundity_drag_', '')}`);
      const gap = offset.get(String(l.id)) ?? 4;
      return font === undefined ? l : { ...l, position: font + gap };
    });
  }

  if (opts.drive !== undefined) {
    loci = loci.map((l) => (l.kind === 'eldritch_font' ? { ...l, drive: opts.drive! } : l));
  }

  let houses = bundle.houses;
  if (opts.books !== undefined) {
    // The founding shelf, cut to `books` volumes — 0 is the game as it was
    // before `HouseDefS.library` existed, which is the column this is here to
    // be read against.
    houses = houses.map((h) => (h.isPlayerHouse ? { ...h, library: h.library.slice(0, opts.books!) } : h));
  }
  if (opts.deleterious !== undefined) {
    houses = houses.map((h) => (h.isPlayerHouse && h.genePool
      ? { ...h, genePool: { ...h.genePool, deleteriousLoad: opts.deleterious! } }
      : h));
  }

  return { ...bundle, loci, houses };
}

/**
 * THE STRATEGY THE GAME ALREADY SUPPORTS AND NEVER MENTIONS.
 *
 * The player is dealt about one hand a generation. The world makes five
 * hundred other marriages in the same run, and `autoMarry` pairs the house's
 * carrying daughters with whoever is available — which is almost always a
 * minted outsider carrying nothing. Choosing well on 46 of 547 marriages
 * cannot beat that, however perfectly it is done.
 *
 * But §7's `withhold` order takes somebody off the market entirely, and off
 * BOTH halves of it: `matchSubjects` will not deal her a hand and `autoMarry`
 * will not pair her. So an oracle can hold every carrying daughter back until
 * there is a man of the blood to marry her to, and release her the year there
 * is. That is a real strategy, playable today at the table, and no part of the
 * game says so.
 *
 * This policy plays it, so the batch can say whether the ceiling is the
 * genetics or the attention budget.
 */
function playTheTable(ctx: SimCtx): void {
  const w = ctx.world;
  const household = w.people.household(w.playerHouse, w.year);
  const carriers = household.filter(
    (p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont > 0,
  );
  const free = (p: typeof household[number]) => !p.marriages.some((m) => m.to === undefined);

  // Somebody of the blood she could actually be married to.
  const menOfTheBlood = carriers.filter((p) => p.sex === 'male' && free(p));

  for (const p of carriers) {
    if (p.sex !== 'female' || !free(p)) continue;
    const holdHer = menOfTheBlood.length === 0;
    if (holdHer) w.withheld[p.id] = w.withheld[p.id] ?? w.year;
    else delete w.withheld[p.id];
  }
}

/** What the oracle can see that the card does not say: the real blood behind it. */
function trueFont(ctx: SimCtx, card: PendingMatch['cards'][number]): number {
  if (!card.person) return 0;
  const p = ctx.world.people.get(card.person);
  return p ? phenotypeOf(p, ctx.genetics, ctx.world.year).eldritch.carriedFont : 0;
}

/**
 * Answer one hand. The two policies are one comparator apart, which is the
 * whole design of this file: any difference downstream is a difference in how
 * a single card was chosen.
 */
function answerMatch(ctx: SimCtx, pending: PendingMatch, policy: Policy, tally: { kin: number; declined: number }): void {
  const open = pending.cards.filter((c) => c.available);
  if (!open.length) {
    declineMatch(ctx, pending.id);
    tally.declined += 1;
    return;
  }

  const ranked = [...open].sort((a, b) => {
    const fa = trueFont(ctx, a);
    const fb = trueFont(ctx, b);
    if (policy === 'concentrate' || policy === 'withhold') {
      return (fb - fa) || (b.kinship - a.kinship) || (a.id < b.id ? -1 : 1);
    }
    // Marry out, every time, and where two cards are both outsiders take the
    // one that shares the least blood.
    return (fa - fb) || (a.kinship - b.kinship) || (a.id < b.id ? -1 : 1);
  });

  const chosen = ranked[0]!;
  if (chosen.person && policy !== 'dilute') tally.kin += 1;
  if (!resolveMatch(ctx, pending.id, chosen.id).ok) {
    declineMatch(ctx, pending.id);
    tally.declined += 1;
  }
}

export function playOnce(bundle: ContentBundle, seed: number, years: number, policy: Policy): BloodRun {
  const content = indexContent(bundle);
  const ctx = bootstrap(content, seed, 1042);
  const w = ctx.world;
  // The standing order the player gives once, at the table, and never again.
  if (policy === 'marry_in') w.marriagePolicy = 'in';
  if (policy === 'marry_out') w.marriagePolicy = 'out';
  const tally = { kin: 0, declined: 0 };
  let hands = 0;
  let fontPeak = 0;
  let peakYear = 0;

  for (let i = 0; i < years; i++) {
    if (w.year >= END_YEAR) break;
    if (policy === 'withhold') playTheTable(ctx);
    stepYear(ctx, policy === 'chronicler' || policy === 'marry_in' || policy === 'marry_out');

    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      const match = w.pendingDecisions.find((d): d is PendingMatch => d.kind === 'match');
      if (match) {
        hands += 1;
        answerMatch(ctx, match, policy, tally);
        continue;
      }
      // Everything that is not a marriage is the chronicler's, in every
      // column: this measures one verb, and a second scripted decision would
      // put a second difference between the columns.
      autoResolveAll(ctx, makeRng(hashSeed(seed, 'blood-decide', w.year, guard)));
    }
    clearNamingQueue(ctx);

    // The peak has to be watched rather than measured at the end: the man who
    // carried the most in a thousand years is usually four centuries dead.
    for (const p of w.people.household(w.playerHouse, w.year)) {
      const font = phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont;
      if (font > fontPeak) { fontPeak = font; peakYear = w.year; }
    }
  }
  if (w.year >= END_YEAR) closeTheLedger(ctx);

  const women: { font: number; born: number }[] = [];
  let f = 0;
  let curses = 0;
  let people = 0;
  for (const p of w.people.blood(w.playerHouse)) {
    if (p.born <= 1042) continue;
    people += 1;
    const g = genomeOf(p, ctx.genetics);
    f += realizedHomozygosity(g);
    curses += deleteriousLoad(g, ctx.genetics.table).count;
    if (p.sex === 'female') {
      women.push({ font: phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont, born: p.born });
    }
  }

  // Both parties carrying, counted once per marriage.
  let hotPairs = 0;
  const seenPair = new Set<string>();
  const fontOf = (id: string) => {
    const q = w.people.get(id);
    return q ? phenotypeOf(q, ctx.genetics, w.year).eldritch.carriedFont : 0;
  };
  for (const p of w.people.all()) {
    if (p.houseOfOrigin !== w.playerHouse) continue;
    for (const m of p.marriages) {
      const key = [p.id, m.spouse].sort().join('>');
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      if (fontOf(p.id) > 0 && fontOf(m.spouse) > 0) hotPairs += 1;
    }
  }

  const household = w.people.household(w.playerHouse, w.year);
  const byBirth = women.sort((a, b) => a.born - b.born);
  const quarter = Math.max(1, Math.floor(byBirth.length / 4));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    seed,
    policy,
    fontEarly: mean(byBirth.slice(0, quarter).map((x) => x.font)),
    fontLate: mean(byBirth.slice(byBirth.length - quarter).map((x) => x.font)),
    fontPeak,
    peakYear,
    best: w.ascension.best,
    survived: w.people.household(w.playerHouse, w.year).length > 0,
    living: w.people.household(w.playerHouse, w.year).length,
    meanF: people ? f / people : 0,
    cursesPerPerson: people ? curses / people : 0,
    hotPairs,
    booksBest: Math.max(0, ...w.people.blood(w.playerHouse).map((p) => p.spellsKnown.length)),
    madnessPeak: Math.max(0, ...w.people.blood(w.playerHouse).map((p) => p.madness)),
    carriersAtEnd: household.filter((p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont > 0).length,
    expressingAtEnd: household.filter((p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress).length,
    hands,
    kinTaken: tally.kin,
    declined: tally.declined,
    ending: w.ending?.id ?? selectEnding(ctx),
  };
}

export interface Column {
  policy: Policy;
  runs: BloodRun[];
}

function summarise(runs: BloodRun[]): Record<string, string> {
  const n = runs.length || 1;
  const mean = (f: (r: BloodRun) => number) => runs.reduce((a, r) => a + f(r), 0) / n;
  const rungs = new Map<string, number>();
  for (const r of runs) rungs.set(r.best, (rungs.get(r.best) ?? 0) + 1);
  const modal = [...rungs.entries()].sort((a, b) => b[1] - a[1])[0];
  const past = runs.filter((r) => rungIndex(r.best) > rungIndex('adept')).length;

  return {
    'font 1st': mean((r) => r.fontEarly).toFixed(1),
    'font last': mean((r) => r.fontLate).toFixed(1),
    peak: mean((r) => r.fontPeak).toFixed(1),
    'hot pairs': mean((r) => r.hotPairs).toFixed(1),
    books: mean((r) => r.booksBest).toFixed(1),
    'mad peak': mean((r) => r.madnessPeak).toFixed(0),
    'carry@end': mean((r) => r.carriersAtEnd).toFixed(1),
    F: mean((r) => r.meanF).toFixed(3),
    curses: mean((r) => r.cursesPerPerson).toFixed(2),
    'modal rung': `${modal?.[0] ?? '-'} ${modal ? `${modal[1]}/${runs.length}` : ''}`,
    'past adept': `${past}/${runs.length}`,
    survive: `${runs.filter((r) => r.survived).length}/${runs.length}`,
    hands: mean((r) => r.hands).toFixed(0),
    kin: mean((r) => r.kinTaken).toFixed(0),
  };
}

function table(rows: { label: string; runs: BloodRun[] }[]): string {
  const cols = Object.keys(summarise(rows[0]?.runs ?? []));
  const head = ['', ...cols];
  const body = rows.map((r) => {
    const s = summarise(r.runs);
    return [r.label, ...cols.map((c) => s[c] ?? '')];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => (b[i] ?? '').length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...body.map(line)].join('\n');
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('blood-gate.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const nums = (raw: string | undefined, fallback: (number | undefined)[]) =>
    (raw ? raw.split(',').map(Number) : fallback);

  const positional = args.filter((a) => !a.startsWith('--'));
  const runs = Number(positional[0] ?? 8);
  const years = Number(positional[1] ?? 1000);
  const cMs = nums(flag('cm'), [undefined]);
  const dels = nums(flag('del'), [undefined]);
  const drives = nums(flag('drive'), [undefined]);
  const books = nums(flag('books'), [undefined]);
  const policies: Policy[] = (flag('policies')?.split(',') as Policy[] | undefined)
    ?? ['concentrate', 'dilute', 'chronicler'];

  const base = loadContent().bundle;
  // What the CONTENT says, so a column that was not swept is labelled with the
  // number the game actually shipped rather than with a remembered one.
  const shipped = {
    cM: base.loci.find((l) => String(l.id) === 'font_2')?.position ?? 0,
    drive: base.loci.find((l) => l.kind === 'eldritch_font')?.drive ?? 0.5,
    del: base.houses.find((h) => h.isPlayerHouse)?.genePool?.deleteriousLoad ?? 0,
    books: base.houses.find((h) => h.isPlayerHouse)?.library.length ?? 0,
  };
  const seeds = Array.from({ length: runs }, (_, i) => 4000 + i * 13);

  console.log(`${runs} runs x ${years} years, ${policies.join(' / ')}`);
  for (const cM of cMs) {
    for (const del of dels) {
      for (const drive of drives) {
      for (const shelf of books) {
      const opts = {
        ...(cM !== undefined ? { cM } : {}),
        ...(del !== undefined ? { deleterious: del } : {}),
        ...(drive !== undefined ? { drive } : {}),
        ...(shelf !== undefined ? { books: shelf } : {}),
      };
      const bundle = bloodBundle(base, opts);
      const label = [
        `cM=${cM ?? shipped.cM / 2}${cM === undefined ? '*' : ''}`,
        `del=${del ?? shipped.del}${del === undefined ? '*' : ''}`,
        `drive=${drive ?? shipped.drive}${drive === undefined ? '*' : ''}`,
        `books=${shelf ?? shipped.books}${shelf === undefined ? '*' : ''}`,
      ].join(' ');
      console.log(`\n── ${label} ──`);
      console.log(table(policies.map((policy) => ({
        label: policy,
        runs: seeds.map((seed) => playOnce(bundle, seed, years, policy)),
      }))));
      }
      }
    }
  }
}
