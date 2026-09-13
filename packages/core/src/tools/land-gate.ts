/**
 * DOES A THOUSAND YEARS OF LAND HAVE A SHAPE? (issue #101)
 *
 *   npm run gate:land -- 12 1000
 *
 * The policy buys an affordable offered holding, takes authored land routes
 * when the docket offers one, and sells one non-seat holding every two
 * centuries. It is deliberately a policy, not an AI: the gate asks whether
 * the verbs can make a history, not whether a steward can optimise one.
 */
import { loadContent } from '@ed/content';
import { indexContent, type Content, type ContentBundle, type EventTemplate } from '@ed/schema';
import { buyParcel, heldParcels, landView, sellParcel } from '../land.js';
import { clearNamingQueue } from '../sim.js';
import { autoResolveAll, resolveChoice, type PendingChoice } from '../events/decisions.js';
import { hashSeed, makeRng } from '../rng.js';
import { bootstrap } from '../sim.js';
import { stepYear } from '../year/step.js';
import { expectMean, expectRate } from '../testing.js';

type Source = ContentBundle | Content;
export interface LandGateResult { ok: boolean; lines: string[] }

export interface HoldingPortrait {
  acres: number;
  holdings: number;
  newestHoldingSince: number;
  latestChange: number;
  names: string[];
}

export interface PortraitReading { later: 0 | 1 | undefined; why: string }

/**
 * Read only what the plat/land ledger can say: acreage, deeds and dated
 * changes. The caller may hand these over in either order; there is no year
 * label to give the answer away.
 */
export function distinguishHoldingPortraits(a: HoldingPortrait, b: HoldingPortrait): PortraitReading {
  const score = (p: HoldingPortrait) => Math.max(p.newestHoldingSince, p.latestChange);
  const as = score(a);
  const bs = score(b);
  if (as === bs) return { later: undefined, why: 'neither holding record carries a later dated change' };
  const later = as > bs ? 0 : 1;
  const newer = later === 0 ? a : b;
  const older = later === 0 ? b : a;
  return {
    later,
    why: `${newer.holdings} holdings and ${newer.acres} acres carry a latest change in ${score(newer)}, `
      + `later than the other record's ${score(older)}`,
  };
}

interface LandRun {
  seed: number;
  early: HoldingPortrait;
  late: HoldingPortrait;
  terminalTreasury: number;
  routes: Set<string>;
  acreageLost: boolean;
  eventFires: Record<string, number>;
}

const landEffects = (event: EventTemplate, outcomeId: string) => {
  if (event.interaction.kind === 'narration') {
    return event.interaction.outcomes.find((o) => o.id === outcomeId)?.effects.filter((e) => e.kind === 'land') ?? [];
  }
  return event.interaction.choices
    .flatMap((c) => c.outcomes)
    .find((o) => o.id === outcomeId)?.effects.filter((e) => e.kind === 'land') ?? [];
};

/** Prefer a branch whose outcomes reliably carry a land effect. */
function answerLandChoice(ctx: ReturnType<typeof bootstrap>, pending: PendingChoice, seed: number, turn: number): boolean {
  if (!pending.choicesAreOpen || pending.event.interaction.kind === 'narration') return false;
  const ranked = pending.choices
    .filter((c) => c.available)
    .map((choice) => {
      const authored = pending.event.interaction.kind === 'choice'
        ? pending.event.interaction.choices.find((c) => c.id === choice.id)
        : undefined;
      const outcomes = authored?.outcomes ?? [];
      const carrying = outcomes.filter((o) => o.effects.some((e) => e.kind === 'land')).length;
      return { choice, carrying, reliability: outcomes.length ? carrying / outcomes.length : 0 };
    })
    .filter((x) => x.carrying > 0)
    .sort((a, b) => b.reliability - a.reliability || b.carrying - a.carrying);
  const chosen = ranked[0];
  if (!chosen) return false;
  return resolveChoice(ctx, pending.id, chosen.choice.id, makeRng(hashSeed(seed, 'land-choice', ctx.world.year, turn))).ok;
}

function acreage(ctx: ReturnType<typeof bootstrap>): number {
  return heldParcels(ctx).reduce((sum, state) => {
    const def = state.defId ? ctx.content.parcel(state.defId) : undefined;
    return sum + (def?.acres ?? 0);
  }, 0);
}

function portrait(ctx: ReturnType<typeof bootstrap>, latestChange: number): HoldingPortrait {
  const rows = heldParcels(ctx).flatMap((state) => {
    const def = state.defId ? ctx.content.parcel(state.defId) : undefined;
    return def ? [{ state, def }] : [];
  });
  return {
    acres: rows.reduce((sum, row) => sum + row.def.acres, 0),
    holdings: rows.length,
    newestHoldingSince: Math.max(0, ...rows.map((row) => row.state.heldSince)),
    latestChange,
    names: rows.map((row) => row.def.name).sort(),
  };
}

function runLand(source: Source, seed: number, years: number): LandRun {
  const ctx = bootstrap(indexContent(source), seed, 1042);
  const w = ctx.world;
  const routes = new Set<string>();
  let acreageLost = false;
  let latestChange = w.year;
  let early: HoldingPortrait | undefined;
  let late: HoldingPortrait | undefined;

  for (let turn = 0; turn < years && w.year < 2042; turn++) {
    const beforeAcres = acreage(ctx);
    const logAt = w.decisionLog.length;
    const chronicleAt = w.chronicle.length;
    stepYear(ctx, false);

    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      const pending = w.pendingDecisions.find((d): d is PendingChoice => d.kind === 'choice');
      if (pending && answerLandChoice(ctx, pending, seed, turn)) continue;
      autoResolveAll(ctx, makeRng(hashSeed(seed, 'land-chronicler', w.year, guard)));
    }
    clearNamingQueue(ctx);

    for (const entry of w.decisionLog.slice(logAt)) {
      if (entry.kind !== 'outcome') continue;
      const event = ctx.content.event(entry.event);
      if (!event) continue;
      for (const effect of landEffects(event, entry.outcomeId)) {
        routes.add(`${effect.op}:${event.id}`);
        latestChange = w.year;
      }
    }
    if (w.chronicle.slice(chronicleAt).some((c) => c.text?.includes('black water off Sarrow'))) {
      routes.add('sarrow_sink');
      latestChange = w.year;
    }

    // One shared treasury: take what is genuinely affordable under the same
    // debt floor as the table, never a separate land budget.
    for (const lot of landView(ctx).market) {
      if (buyParcel(ctx, lot.parcel).ok) {
        routes.add('purchase');
        latestChange = w.year;
      }
    }

    // A voluntary loss is part of the ecology too. Sparse and predictable,
    // this exercises liquidation without turning the policy into a churner.
    if ((w.year - 1042) % 200 === 0) {
      const sale = landView(ctx).held.find((p) => p.sellable && p.kind === 'tenant_farm');
      if (sale && sellParcel(ctx, sale.parcel).ok) {
        routes.add('sale');
        latestChange = w.year;
      }
    }

    const afterAcres = acreage(ctx);
    if (afterAcres < beforeAcres) acreageLost = true;
    if (w.year === 1342) early = portrait(ctx, latestChange);
    if (w.year === 1842) late = portrait(ctx, latestChange);
  }

  const fallback = portrait(ctx, latestChange);
  return {
    seed,
    early: early ?? fallback,
    late: late ?? fallback,
    terminalTreasury: w.treasury,
    routes,
    acreageLost,
    eventFires: { ...w.frequency.templateFires },
  };
}

function declaredRoutes(source: Source): { acquisition: string[]; loss: string[] } {
  const content = indexContent(source);
  const acquisition = new Set<string>(['purchase']);
  const loss = new Set<string>(['sale', 'sarrow_sink']);
  for (const event of content.events) {
    const outcomes = event.interaction.kind === 'narration'
      ? event.interaction.outcomes
      : event.interaction.choices.flatMap((c) => c.outcomes);
    for (const outcome of outcomes) for (const effect of outcome.effects) {
      if (effect.kind !== 'land') continue;
      if (effect.op === 'grant') acquisition.add(`${effect.op}:${event.id}`);
      if (effect.op === 'seize' || effect.op === 'damage') loss.add(`${effect.op}:${event.id}`);
    }
  }
  return { acquisition: [...acquisition], loss: [...loss] };
}

export function gateLand(
  source: Source = loadContent(),
  opts: { seeds?: number[]; years?: number } = {},
): LandGateResult {
  const content = indexContent(source);
  const lines: string[] = [];
  const requiredKinds = ['tenant_farm', 'mill', 'slate_work', 'sarrow_bottom', 'town_house', 'wetland'];
  const missing = requiredKinds.filter((kind) => !content.parcels.some((p) => p.kind === kind));
  if (missing.length) return { ok: false, lines: [`LAND SHAPES missing: ${missing.join(', ')}`] };

  const seeds = opts.seeds ?? Array.from({ length: 12 }, (_, i) => 61_000 + i * 101);
  const years = opts.years ?? 1000;
  if (seeds.length < 8) return { ok: false, lines: [`LAND BATCH needs at least 8 seeds; got ${seeds.length}`] };
  const runs = seeds.map((seed) => runLand(content, seed, years));
  const routes = declaredRoutes(content);
  let ok = true;
  const judge = (f: () => number, label: string) => {
    try {
      const margin = f();
      lines.push(`PASS ${label} (${margin.toFixed(1)} SE)`);
    } catch (error) {
      ok = false;
      lines.push(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const centuryChange = runs.map((r) => r.early.acres - r.late.acres);
  judge(
    () => expectMean({ values: centuryChange, floor: 5, what: 'acreage contraction from century three to century eight' }),
    'acreage has a measurable century-scale trend',
  );
  judge(
    () => expectRate({ hits: runs.filter((r) => r.acreageLost).length, n: runs.length, floor: 0.6, what: 'runs that lose acreage' }),
    'land is lost in more than 60% of runs',
  );
  for (const route of [...routes.acquisition, ...routes.loss]) {
    judge(
      () => expectRate({ hits: runs.filter((r) => r.routes.has(route)).length, n: runs.length, floor: 0.25, what: `runs reaching land route ${route}` }),
      `route ${route} reaches one run in four`,
    );
    if (route.includes(':')) {
      const event = route.slice(route.indexOf(':') + 1);
      const firingRuns = runs.filter((r) => (r.eventFires[event] ?? 0) > 0).length;
      lines.push(`  ${event} itself fired in ${firingRuns}/${runs.length} runs`);
    }
  }
  judge(
    () => expectMean({ values: runs.map((r) => r.terminalTreasury), ceiling: 10_000, what: 'terminal treasury' }),
    'the treasury remains below five figures',
  );

  const readable = runs.filter((run) => distinguishHoldingPortraits(run.early, run.late).later === 1).length;
  judge(
    () => expectRate({ hits: readable, n: runs.length, floor: 0.6, what: 'century-three/eight holdings a reader orders correctly' }),
    'the later holding record explains itself',
  );

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  lines.push(`ACREAGE century 3 ${mean(runs.map((r) => r.early.acres)).toFixed(1)} → century 8 ${mean(runs.map((r) => r.late.acres)).toFixed(1)}`);
  lines.push(`TREASURY 2042 mean ${mean(runs.map((r) => r.terminalTreasury)).toFixed(0)} crowns`);
  return { ok, lines };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('land-gate.ts');
if (isMain) {
  const runs = Number(process.argv[2] ?? 12);
  const years = Number(process.argv[3] ?? 1000);
  const seeds = Array.from({ length: runs }, (_, i) => 61_000 + i * 101);
  const result = gateLand(loadContent(), { seeds, years });
  for (const line of result.lines) console.log(line);
  process.exit(result.ok ? 0 : 1);
}
