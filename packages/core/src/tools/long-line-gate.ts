/**
 * #133 Stage 5A-E — the 500-year Long Line as a complete game.
 *
 * This is a MEASUREMENT, not a CI threshold. It keeps the five pre-#61
 * questions in one played batch so they are read from the same worlds:
 * 5A Ledger, 5B decisions, 5C frame, 5D land/Muster, 5E system reach.
 *
 * The upper ladder and endings are deliberately absent. #61 owns them until
 * it lands; #133 Stage 5F starts only after that SHA is known.
 *
 * npm run gate:long -- [runs] [years]
 * npm run gate:long -- 40 500
 */
import { loadContent } from '@ed/content';
import { bootstrap, clearNamingQueue } from '../sim.js';
import { stepYear } from '../year/step.js';
import { autoResolveAll } from '../events/decisions.js';
import { hashSeed, makeRng } from '../rng.js';
import { CAMPAIGN_YEARS } from '../campaign.js';
import { END_YEAR } from '../ending.js';
import { heldAcres } from '../land.js';
import { chapterOf } from '../chapter.js';

const START_YEAR = 1042;

interface LongRun {
  seed: number;
  finalYear: number;
  reachedTerm: boolean;
  generations: number;
  clauses: number;
  clauseYears: number[];
  agesEnded: number;
  agesNamed: number;
  namedClauseBearingAges: number;
  missedClauseAges: number;
  archivistYears: number;
  choices: number;
  matches: number;
  records: number;
  namings: number;
  prompts: number;
  frames: number;
  frameFirst?: number;
  frameLast?: number;
  frameMaxSilence: number;
  chapters: number;
  chaptersNoFrame: number;
  chaptersMultiFrame: number;
  acreageStart: number;
  acreageEnd: number;
  acreageLow: number;
  acreageHigh: number;
  acquisitions: number;
  losses: number;
  improvements: number;
  illuminated: boolean;
  treasuryEnd: number;
  treasuryLow: number;
  musters: number;
  musterSettled: number;
  musterWithdrawn: number;
  musterPositioned: number;
  musterTideLow: number;
  musterTideHigh: number;
  careerPlacements: number;
  taught: number;
  booksOpened: number;
  spellsKnown: number;
  maxBooksOnePerson: number;
  vesselRites: number;
  greatRites: number;
  unmakings: number;
  arcsStarted: number;
  arcsEnded: number;
  arcsExpired: number;
  arcsCancelled: number;
  arcsActive: number;
  assizeSittings: number;
  templatesSeen: Set<string>;
  repeatedTemplates: number;
  templateFires: Record<string, number>;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function quantile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[at]!;
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function summary(xs: number[]): string {
  return 'mean ' + fmt(mean(xs))
    + ' · p25 ' + fmt(quantile(xs, 0.25))
    + ' · median ' + fmt(quantile(xs, 0.5))
    + ' · p75 ' + fmt(quantile(xs, 0.75));
}

function runOne(seed: number, years: number): LongRun {
  const bundle = loadContent();
  const ctx = bootstrap(bundle, seed, START_YEAR);
  const w = ctx.world;

  const foundingParcels = w.parcels.size;
  const acreageStart = heldAcres(ctx);
  let acreageLow = acreageStart;
  let acreageHigh = acreageStart;
  let treasuryLow = w.treasury;
  let improvements = 0;
  const parcelBonus = new Map<string, number>(
    [...w.parcels].map(([id, p]) => [id, p.yieldBonus ?? 0]),
  );

  let choicePrompts = 0;
  let matchPrompts = 0;
  let recordPrompts = 0;
  let namingPrompts = 0;
  let archivistYears = 0;
  let taught = 0;
  let booksOpened = 0;
  let assizeSittings = 0;
  let lastAssize = w.assize.lastSitting;
  let musterTideLow = w.muster.tide;
  let musterTideHigh = w.muster.tide;

  for (let i = 0; i < years; i++) {
    if (w.year >= END_YEAR || w.ending) break;

    stepYear(ctx, false);

    // Count what actually stopped the player's clock, not every resolved
    // outcome in the decision log. This is the same unit #88's attention
    // test uses and keeps state/party choices honest.
    for (const decision of w.pendingDecisions) {
      if (decision.kind === 'choice') choicePrompts += 1;
      else if (decision.kind === 'match') matchPrompts += 1;
      else recordPrompts += 1;
    }
    namingPrompts += w.pendingNames.length;
    if (w.people.living().some((p) => p.contract?.role === 'archivist')) archivistYears += 1;
    taught += w.stewardYear.taught.length;
    booksOpened += w.stewardYear.opened.length;

    if (w.assize.lastSitting !== lastAssize) {
      assizeSittings += 1;
      lastAssize = w.assize.lastSitting;
    }

    const acres = heldAcres(ctx);
    acreageLow = Math.min(acreageLow, acres);
    acreageHigh = Math.max(acreageHigh, acres);
    treasuryLow = Math.min(treasuryLow, w.treasury);
    musterTideLow = Math.min(musterTideLow, w.muster.tide);
    musterTideHigh = Math.max(musterTideHigh, w.muster.tide);

    for (const [id, parcel] of w.parcels) {
      const before = parcelBonus.get(id) ?? 0;
      const now = parcel.yieldBonus ?? 0;
      if (now > before) improvements += Math.round((now - before) / 2);
      parcelBonus.set(id, now);
    }

    autoResolveAll(ctx, makeRng(hashSeed(seed, 'long-line-stage5', w.year)));
    clearNamingQueue(ctx);
  }

  const choices = choicePrompts;
  const matches = matchPrompts;
  const records = recordPrompts;

  const clauseEntries = w.chronicle.filter((entry) =>
    ctx.content.clauses.some((c) => c.name === entry.title && c.text === entry.text),
  );
  const clauseYears = clauseEntries.map((e) => e.year);
  const namedClauseBearingAges = w.age.ended.filter((age) =>
    age.named && ctx.content.age(age.age)?.clauseBearing === true
  ).length;
  const missedClauseAges = w.chronicle.filter((entry) =>
    entry.text === 'Whatever those years had to say about the debt, nobody in the house was writing it down.'
  ).length;

  const frameYears = w.frame.entries.map((e) => e.year).sort((a, b) => a - b);
  const frameEdges = [START_YEAR, ...frameYears, Math.min(END_YEAR, w.year)];
  let frameMaxSilence = 0;
  for (let i = 1; i < frameEdges.length; i++) {
    frameMaxSilence = Math.max(frameMaxSilence, frameEdges[i]! - frameEdges[i - 1]!);
  }

  const chapters = w.age.ended
    .map((ended) => chapterOf(ctx, ended))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  let chaptersNoFrame = 0;
  let chaptersMultiFrame = 0;
  for (const chapter of chapters) {
    const count = frameYears.filter((year) => year > chapter.from && year <= chapter.to).length;
    if (count === 0) chaptersNoFrame += 1;
    if (count > 1) chaptersMultiFrame += 1;
  }

  const arcs = [...w.arcs.values()];
  const fires = { ...w.frequency.templateFires };
  const templatesSeen = new Set(Object.entries(fires).filter(([, count]) => count > 0).map(([id]) => id));
  const repeatedTemplates = Object.values(fires).filter((count) => count > 1).length;

  const allPeople = w.people.all();
  const spellsKnown = allPeople.reduce((n, p) => n + p.spellsKnown.length, 0);
  const maxBooksOnePerson = allPeople.reduce((n, p) => Math.max(n, p.spellsKnown.length), 0);
  const riteCount = (rite: 'vessel' | 'great_rite' | 'unmaking') =>
    allPeople.filter((p) => p.rites.includes(rite)).length;

  const commitments = w.muster.commitments;

  return {
    seed,
    finalYear: w.year,
    reachedTerm: w.year >= END_YEAR,
    generations: w.generation,
    clauses: w.clausesRecovered.size,
    clauseYears,
    agesEnded: w.age.ended.length,
    agesNamed: w.age.ended.filter((a) => a.named).length,
    namedClauseBearingAges,
    missedClauseAges,
    archivistYears,
    choices,
    matches,
    records,
    namings: namingPrompts,
    prompts: choices + matches + records + namingPrompts,
    frames: frameYears.length,
    ...(frameYears[0] !== undefined ? { frameFirst: frameYears[0] } : {}),
    ...(frameYears.at(-1) !== undefined ? { frameLast: frameYears.at(-1) } : {}),
    frameMaxSilence,
    chapters: chapters.length,
    chaptersNoFrame,
    chaptersMultiFrame,
    acreageStart,
    acreageEnd: heldAcres(ctx),
    acreageLow,
    acreageHigh,
    acquisitions: Math.max(0, w.counters.parcel - foundingParcels),
    losses: w.lostParcels.length,
    improvements,
    illuminated: w.platIlluminated,
    treasuryEnd: w.treasury,
    treasuryLow,
    musters: commitments.length,
    musterSettled: commitments.filter((c) => c.status === 'settled').length,
    musterWithdrawn: commitments.filter((c) => c.status === 'withdrawn').length,
    musterPositioned: commitments.filter((c) => c.position !== undefined && c.position !== 'none').length,
    musterTideLow,
    musterTideHigh,
    careerPlacements: allPeople.filter((p) => p.career !== undefined).length,
    taught,
    booksOpened,
    spellsKnown,
    maxBooksOnePerson,
    vesselRites: riteCount('vessel'),
    greatRites: riteCount('great_rite'),
    unmakings: riteCount('unmaking'),
    arcsStarted: arcs.length,
    arcsEnded: arcs.filter((a) => a.status === 'ended').length,
    arcsExpired: arcs.filter((a) => a.status === 'expired').length,
    arcsCancelled: arcs.filter((a) => a.status === 'cancelled').length,
    arcsActive: arcs.filter((a) => a.status === 'active').length,
    assizeSittings,
    templatesSeen,
    repeatedTemplates,
    templateFires: fires,
  };
}

export function measureLongLine(runs: number, years = CAMPAIGN_YEARS): LongRun[] {
  const seeds = Array.from({ length: runs }, (_, i) => 20_000 + i * 37);
  return seeds.map((seed) => runOne(seed, years));
}

export function reportLongLine(runs: LongRun[], years: number): string {
  const bundle = loadContent();
  const lines: string[] = [];
  const countRuns = runs.length;
  const percent = (hits: number, den = countRuns) => den ? (100 * hits) / den : 0;
  const nums = (pick: (r: LongRun) => number) => runs.map(pick);

  lines.push('#133 Stage 5A-E — ' + countRuns + ' runs x ' + years + ' years');
  lines.push('term reached: ' + runs.filter((r) => r.reachedTerm).length + '/' + countRuns
    + ' · final year: ' + summary(nums((r) => r.finalYear)));

  lines.push('');
  lines.push('5A Ledger');
  lines.push('  clauses: ' + summary(nums((r) => r.clauses)));
  lines.push('  all 9: ' + runs.filter((r) => r.clauses === 9).length + '/' + countRuns
    + ' · >=7: ' + runs.filter((r) => r.clauses >= 7).length + '/' + countRuns
    + ' · <=4: ' + runs.filter((r) => r.clauses <= 4).length + '/' + countRuns);
  const reveals = runs.flatMap((r) => r.clauseYears);
  lines.push('  reveal years (new clauses only): ' + (reveals.length ? summary(reveals) : 'NONE'));
  const bands = [0, 0, 0, 0, 0];
  for (const year of reveals) {
    const at = Math.min(4, Math.max(0, Math.floor(((year - START_YEAR) / Math.max(1, years)) * 5)));
    bands[at] = (bands[at] ?? 0) + 1;
  }
  lines.push('  reveals by fifth: ' + bands.join(' / '));
  lines.push('  ended Ages: ' + summary(nums((r) => r.agesEnded))
    + ' · named Ages: ' + summary(nums((r) => r.agesNamed)));
  lines.push('  named clause-bearing Ages: ' + summary(nums((r) => r.namedClauseBearingAges))
    + ' · named Ages ending unpaid: ' + summary(nums((r) => r.missedClauseAges))
    + ' · archivist coverage: ' + fmt(100 * mean(runs.map((r) => r.archivistYears / Math.max(1, r.finalYear - START_YEAR)))) + '% of played years');

  lines.push('');
  lines.push('5B Decision density');
  lines.push('  choices: ' + summary(nums((r) => r.choices)));
  lines.push('  Match:   ' + summary(nums((r) => r.matches)));
  lines.push('  Record:  ' + summary(nums((r) => r.records)));
  lines.push('  naming:  ' + summary(nums((r) => r.namings)));
  lines.push('  total prompts: ' + summary(nums((r) => r.prompts))
    + ' · per generation mean ' + fmt(mean(runs.map((r) => r.prompts / Math.max(1, r.generations))), 2)
    + ' · per ended Age mean ' + fmt(mean(runs.map((r) => r.prompts / Math.max(1, r.agesEnded))), 2));
  const promptTotal = Math.max(1, runs.reduce((sum, r) => sum + r.prompts, 0));
  lines.push('  prompt share — choice ' + fmt(100 * runs.reduce((sum, r) => sum + r.choices, 0) / promptTotal) + '%'
    + ' · Match ' + fmt(100 * runs.reduce((sum, r) => sum + r.matches, 0) / promptTotal) + '%'
    + ' · Record ' + fmt(100 * runs.reduce((sum, r) => sum + r.records, 0) / promptTotal) + '%'
    + ' · naming ' + fmt(100 * runs.reduce((sum, r) => sum + r.namings, 0) / promptTotal) + '%');
  lines.push('  templates repeated in a run: ' + summary(nums((r) => r.repeatedTemplates)));

  lines.push('');
  lines.push('5C Frame cadence');
  lines.push('  frames: ' + summary(nums((r) => r.frames)));
  lines.push('  first frame: ' + summary(runs.flatMap((r) => r.frameFirst === undefined ? [] : [r.frameFirst])));
  lines.push('  last frame:  ' + summary(runs.flatMap((r) => r.frameLast === undefined ? [] : [r.frameLast])));
  lines.push('  max silence incl. campaign edges: ' + summary(nums((r) => r.frameMaxSilence)));
  const chapterCount = runs.reduce((a, r) => a + r.chapters, 0);
  const noFrame = runs.reduce((a, r) => a + r.chaptersNoFrame, 0);
  const multiFrame = runs.reduce((a, r) => a + r.chaptersMultiFrame, 0);
  lines.push('  chapter windows: ' + chapterCount
    + ' · no frame ' + fmt(percent(noFrame, chapterCount)) + '%'
    + ' · multiple frames ' + fmt(percent(multiFrame, chapterCount)) + '%');

  lines.push('');
  lines.push('5D Land / Muster');
  lines.push('  acreage start ' + fmt(mean(nums((r) => r.acreageStart)))
    + ' · end ' + summary(nums((r) => r.acreageEnd)));
  lines.push('  acreage low ' + summary(nums((r) => r.acreageLow))
    + ' · high ' + summary(nums((r) => r.acreageHigh)));
  lines.push('  acquisitions ' + summary(nums((r) => r.acquisitions))
    + ' · losses ' + summary(nums((r) => r.losses))
    + ' · improvements ' + summary(nums((r) => r.improvements)));
  lines.push('  plat illuminated ' + runs.filter((r) => r.illuminated).length + '/' + countRuns
    + ' · treasury end ' + summary(nums((r) => r.treasuryEnd))
    + ' · low ' + summary(nums((r) => r.treasuryLow)));
  lines.push('  Muster commitments ' + summary(nums((r) => r.musters))
    + ' · settled ' + summary(nums((r) => r.musterSettled))
    + ' · withdrawn ' + summary(nums((r) => r.musterWithdrawn)));
  lines.push('  positioned commitments ' + summary(nums((r) => r.musterPositioned))
    + ' · tide low ' + summary(nums((r) => r.musterTideLow))
    + ' · high ' + summary(nums((r) => r.musterTideHigh)));

  lines.push('');
  lines.push('5E Careers / study / rites / arcs / reach');
  lines.push('  career placements ' + summary(nums((r) => r.careerPlacements))
    + ' · tutor completions ' + summary(nums((r) => r.taught))
    + ' · books opened ' + summary(nums((r) => r.booksOpened)));
  lines.push('  spells known total ' + summary(nums((r) => r.spellsKnown))
    + ' · max one person ' + summary(nums((r) => r.maxBooksOnePerson)));
  lines.push('  rites — Vessel ' + runs.reduce((a, r) => a + r.vesselRites, 0)
    + ' · Great ' + runs.reduce((a, r) => a + r.greatRites, 0)
    + ' · Unmaking ' + runs.reduce((a, r) => a + r.unmakings, 0)
    + ' (reported only; #61 owns tuning)');
  lines.push('  arcs started ' + summary(nums((r) => r.arcsStarted))
    + ' · ended ' + summary(nums((r) => r.arcsEnded))
    + ' · expired ' + summary(nums((r) => r.arcsExpired))
    + ' · active at term ' + summary(nums((r) => r.arcsActive)));
  lines.push('  Assize sittings ' + summary(nums((r) => r.assizeSittings)));

  const seenRuns = new Map<string, number>();
  const fires = new Map<string, number>();
  for (const run of runs) {
    for (const id of run.templatesSeen) seenRuns.set(id, (seenRuns.get(id) ?? 0) + 1);
    for (const [id, count] of Object.entries(run.templateFires)) {
      fires.set(id, (fires.get(id) ?? 0) + count);
    }
  }
  // Frame has its own cadence and is measured in 5C. Do not call a frame
  // template "rare content starvation" merely because its frequency metadata
  // also says rare/mythic.
  const nonFrame = bundle.events.filter((e) => e.tier !== 'frame');
  const rare = nonFrame.filter((e) => e.frequency === 'rare' || e.frequency === 'mythic');
  const never = rare.filter((e) => !(seenRuns.get(String(e.id)) ?? 0));
  const neverAny = nonFrame.filter((e) => !(seenRuns.get(String(e.id)) ?? 0));
  const rareReach = rare.length
    ? mean(rare.map((e) => (seenRuns.get(String(e.id)) ?? 0) / countRuns))
    : 0;
  lines.push('  rare/mythic templates seen per template/run: ' + fmt(100 * rareReach) + '%'
    + ' · never seen in batch ' + never.length + '/' + rare.length);
  if (never.length) lines.push('  rare/mythic never: ' + never.map((e) => e.id).join(', '));
  lines.push('  all non-frame templates never seen in batch: ' + neverAny.length + '/' + nonFrame.length);

  const most = [...fires].sort((a, b) => b[1] - a[1]).slice(0, 8);
  lines.push('  most-fired templates: ' + most.map(([id, count]) => id + ' ' + count).join(' · '));

  return lines.join('\n');
}

const runs = Number(process.argv[2] ?? 40);
const years = Number(process.argv[3] ?? CAMPAIGN_YEARS);
const measured = measureLongLine(runs, years);
console.log(reportLongLine(measured, years));
