import type { ParcelDef, ParcelKind, ParcelState, RespectTier, Year } from '@ed/schema';
import type { SimCtx } from './world.js';
import type { Rng } from './rng.js';
import type { OrderResult } from './table.js';
import { DEBT_FLOOR } from './economy.js';

/**
 * LAND INCOME (concept §13, world §5/§12; issue #91, Phase A — issue #93).
 *
 * `economy.ts:219` said "Income derives from holdings, modified by the
 * Head's Charm and standing" over a five-row lookup on the Respect tier —
 * true of the comment and false of the code. This is what makes it true:
 * income is the sum of what the house currently holds (`ctx.content.parcel`
 * for the definition, `heldSince` on `WorldState.parcels` for whether it
 * counts yet), not a number read off a table.
 *
 * THE CALIBRATION (Phase A's whole acceptance bar): the 1042 endowment's
 * `baseYield` sums to exactly `TOTAL_1042_YIELD`, and this function scales
 * that sum by `INCOME_BY_RESPECT[tier] / TOTAL_1042_YIELD` — so for as long
 * as nothing is bought, sold or lost, `landIncome` returns EXACTLY what the
 * old lookup did, at every tier, every year. `npm run digest -- 8 400` is
 * the proof: the block must not move. The moment a parcel changes hands
 * (issue #91, Phase B on), the held sum diverges from 1042's and income
 * starts actually depending on what the house has, which is the entire
 * point of building this substrate now.
 */
const INCOME_BY_RESPECT: Record<RespectTier, number> = {
  unknown: 16,
  known: 32,
  regarded: 62,
  eminent: 108,
  exalted: 175,
};

/** The sum of every `baseYield` in the 1042 endowment (`parcels.yaml`). Fixed; not recomputed from content. */
const TOTAL_1042_YIELD = 140;

/**
 * The parcels the house currently holds, detached from the map — the same
 * shape `heldHeirlooms` returns for the same reason: once pulled out of
 * `WorldState.parcels`, a `ParcelState` needs its own `id` to still say which
 * parcel it is, which is exactly why that field duplicates the map key
 * rather than leaning on it.
 */
export function heldParcels(ctx: SimCtx): ParcelState[] {
  const w = ctx.world;
  return [...w.parcels.values()].filter((state) => state.heldSince <= w.year);
}

export function landIncome(ctx: SimCtx): number {
  const w = ctx.world;
  let held = 0;
  for (const state of heldParcels(ctx)) {
    if (!state.defId) continue;
    const def = ctx.content.parcel(state.defId);
    // `yieldBonus` (issue #94) is nought on every parcel a fresh world seeds,
    // so this changes nothing for the Phase A calibration above — it only
    // ever moves once an `improve` order has completed.
    if (def) held += def.baseYield + (state.yieldBonus ?? 0);
  }
  const base = held * (INCOME_BY_RESPECT[w.respect] / TOTAL_1042_YIELD);
  // PRESSED RENTS (issue #94): more now, for a discontent the house pays for
  // as long as it keeps squeezing. `rentsPolicy` starts `customary`, so a
  // fresh world's income is untouched by this line too.
  return w.rentsPolicy === 'pressed' ? base * (1 + RENTS_PRESSED_BONUS) : base;
}

// ── Phase B: buying, selling, rents and improvement (issue #91, #94) ───────

/**
 * WHAT A PARCEL IS WORTH, bought or sold. §11's price table has nothing
 * priced this way, so this is calibrated against its scale rather than
 * quoted from it: "a gift of 60 crowns and a farm is customary" puts a farm
 * in the same order of magnitude as a warhorse (60) and a minor spellbook
 * (60-200), not in the thousands, and a typical farm here (`baseYield` 6-8)
 * prices at 72-96.
 */
const PRICE_PER_YIELD = 12;
/** Selling nets less than buying costs — transaction friction, and a guard against buy-then-sell arbitrage. */
const SELL_FACTOR = 0.75;

export function parcelPrice(def: ParcelDef): number {
  return Math.round(def.baseYield * PRICE_PER_YIELD);
}

/** The live `ParcelState` behind a `ParcelDef` id, if the house currently holds one. */
function liveStateOf(ctx: SimCtx, defId: string): [string, ParcelState] | undefined {
  return [...ctx.world.parcels.entries()].find(([, s]) => s.defId === defId && s.heldSince <= ctx.world.year);
}

/** How many lots the market carries at once. Not a shop: a permanent catalogue makes land a savings account. */
const MAX_OPEN_LOTS = 2;
/** The chance, per unlisted and unheld parcel, per year, that it comes onto the market. */
const LAND_MARKET_CHANCE = 0.06;
/** How long a lot stands before it is gone. Urgent lots are gone almost at once; a fair's lot stands a season or two longer. */
const FAIR_WINDOW = 3;
const URGENT_WINDOW = 1;
/** The share of new lots that are a neighbour short before Michaelmas, rather than one at the Bramme fairs. */
const URGENT_SHARE = 0.25;
/** A motivated seller prices under the going rate. */
const URGENT_DISCOUNT = 0.85;

/**
 * OPEN AND EXPIRE THE MARKET, once a year, from the `land` phase. Draws from
 * that phase's own stream (issue #93's reservation, cashed in). Gone if the
 * house does not take it: a lot that outlives its window is removed, not
 * carried forward, so the closing window is a real one.
 */
export function tickLandMarket(ctx: SimCtx, rng: Rng): void {
  const w = ctx.world;
  w.landMarket.lots = w.landMarket.lots.filter((l) => l.closesYear > w.year);
  if (w.landMarket.lots.length >= MAX_OPEN_LOTS) return;

  const listed = new Set(w.landMarket.lots.map((l) => l.parcel));
  for (const def of ctx.content.parcels) {
    if (w.landMarket.lots.length >= MAX_OPEN_LOTS) break;
    if (listed.has(def.id) || liveStateOf(ctx, def.id)) continue;
    if (!rng.bool(LAND_MARKET_CHANCE)) continue;

    const urgent = rng.bool(URGENT_SHARE);
    w.landMarket.lots.push({
      parcel: def.id,
      price: Math.round(parcelPrice(def) * (urgent ? URGENT_DISCOUNT : 1)),
      closesYear: w.year + (urgent ? URGENT_WINDOW : FAIR_WINDOW),
      reason: urgent ? 'neighbour_short' : 'fair',
    });
  }
}

/** Buy a lot currently on the market. Mints a fresh `ParcelState` off `counters.parcel`, the way every instance id in this codebase is minted. */
export function buyParcel(ctx: SimCtx, parcel: string): OrderResult {
  const w = ctx.world;
  const lot = w.landMarket.lots.find((l) => l.parcel === parcel);
  if (!lot) return { ok: false, reason: 'nothing of that name is on the market' };
  const def = ctx.content.parcel(parcel);
  if (!def) return { ok: false, reason: 'no such parcel' };
  if (w.treasury - lot.price < DEBT_FLOOR) {
    return { ok: false, reason: `the house cannot raise ${lot.price} crowns` };
  }

  w.treasury -= lot.price;
  w.landMarket.lots = w.landMarket.lots.filter((l) => l !== lot);
  const id = `prc_${(w.counters.parcel += 1).toString(36)}`;
  w.parcels.set(id, { id, defId: def.id, heldSince: w.year });
  w.chronicle.push({
    year: w.year, weight: 'line',
    text: `${def.name} was bought outright, for ${lot.price} crowns.`,
    named: false,
  });
  return { ok: true };
}

/** Sell a held parcel. The home demesne is the one kind that is not for sale — "let to nobody" (`parcels.yaml`). */
export function sellParcel(ctx: SimCtx, parcel: string): OrderResult {
  const w = ctx.world;
  const def = ctx.content.parcel(parcel);
  if (!def) return { ok: false, reason: 'no such parcel' };
  if (def.kind === 'demesne') return { ok: false, reason: 'the home ground is not for sale' };
  const found = liveStateOf(ctx, parcel);
  if (!found) return { ok: false, reason: 'the house does not hold it' };
  const [id] = found;

  const price = Math.round(parcelPrice(def) * SELL_FACTOR);
  w.parcels.delete(id);
  w.landImprovements = w.landImprovements.filter((imp) => imp.parcel !== id);
  w.treasury += price;
  w.chronicle.push({
    year: w.year, weight: 'line',
    text: `${def.name} was sold, for ${price} crowns.`,
    named: false,
  });
  return { ok: true };
}

export function setRentsPolicy(ctx: SimCtx, policy: 'customary' | 'pressed'): OrderResult {
  ctx.world.rentsPolicy = policy;
  return { ok: true };
}

/** How much of a discontent drift pressed rents cost, capped the same way `economy.ts`'s own debt-linked drift is. */
const RENTS_PRESSED_BONUS = 0.15;
const RENTS_PRESSED_DISCONTENT = 0.3;

const IMPROVE_YEARS = 4;
const IMPROVE_YIELD_GAIN = 2;

/** Start a term of improvement — drainage, mostly, world §5's own word for what half these farms need. */
export function beginImprovement(ctx: SimCtx, parcel: string): OrderResult {
  const w = ctx.world;
  const def = ctx.content.parcel(parcel);
  if (!def) return { ok: false, reason: 'no such parcel' };
  const found = liveStateOf(ctx, parcel);
  if (!found) return { ok: false, reason: 'the house does not hold it' };
  const [id] = found;
  if (w.landImprovements.some((imp) => imp.parcel === id)) return { ok: false, reason: 'already being improved' };

  const cost = parcelPrice(def);
  if (w.treasury - cost < DEBT_FLOOR) {
    return { ok: false, reason: `the house cannot raise ${cost} crowns` };
  }
  w.treasury -= cost;
  w.landImprovements.push({ parcel: id, completes: w.year + IMPROVE_YEARS });
  return { ok: true };
}

/** Terms of improvement come due, and pressed rents cost what they cost. Run once a year from the `land` phase. */
export function tickLandImprovements(ctx: SimCtx): void {
  const w = ctx.world;
  for (const imp of [...w.landImprovements]) {
    if (w.year < imp.completes) continue;
    w.landImprovements = w.landImprovements.filter((x) => x !== imp);
    const state = w.parcels.get(imp.parcel);
    if (!state) continue; // sold mid-improvement (`sellParcel` already dropped the term); the work is simply gone
    state.yieldBonus = (state.yieldBonus ?? 0) + IMPROVE_YIELD_GAIN;
    const def = state.defId ? ctx.content.parcel(state.defId) : undefined;
    w.chronicle.push({
      year: w.year, weight: 'line',
      text: `The drainage at ${def?.name ?? 'the holding'} was finished, and it yields better for it.`,
      named: false,
    });
  }

  if (w.rentsPolicy === 'pressed') {
    w.discontent = Math.min(100, w.discontent + RENTS_PRESSED_DISCONTENT);
  }
}

/** What a client draws for the land panel — held ground, the open market, and what each thing there costs today. */
export interface LandView {
  treasury: number;
  rentsPolicy: 'customary' | 'pressed';
  held: {
    parcel: string; name: string; kind: ParcelKind; place: string;
    baseYield: number; yieldBonus: number;
    sellable: boolean; sellPrice: number;
    improving?: Year;
    improveCost: number; canImprove: boolean;
  }[];
  market: {
    parcel: string; name: string; kind: ParcelKind; place: string;
    price: number; closesYear: Year; reason: 'neighbour_short' | 'fair'; canBuy: boolean;
  }[];
}

export function landView(ctx: SimCtx): LandView {
  const w = ctx.world;
  const improving = new Map(w.landImprovements.map((imp) => [imp.parcel, imp.completes]));

  const held: LandView['held'] = [];
  for (const [id, state] of w.parcels) {
    if (state.heldSince > w.year || !state.defId) continue;
    const def = ctx.content.parcel(state.defId);
    if (!def) continue;
    const cost = parcelPrice(def);
    const completes = improving.get(id);
    held.push({
      parcel: def.id,
      name: def.name,
      kind: def.kind,
      place: def.place,
      baseYield: def.baseYield,
      yieldBonus: state.yieldBonus ?? 0,
      sellable: def.kind !== 'demesne',
      sellPrice: Math.round(cost * SELL_FACTOR),
      ...(completes !== undefined ? { improving: completes } : {}),
      improveCost: cost,
      canImprove: completes === undefined && w.treasury - cost >= DEBT_FLOOR,
    });
  }

  const market: LandView['market'] = [];
  for (const lot of w.landMarket.lots) {
    const def = ctx.content.parcel(lot.parcel);
    if (!def) continue;
    market.push({
      parcel: lot.parcel,
      name: def.name,
      kind: def.kind,
      place: def.place,
      price: lot.price,
      closesYear: lot.closesYear,
      reason: lot.reason,
      canBuy: w.treasury - lot.price >= DEBT_FLOOR,
    });
  }

  return { treasury: Math.round(w.treasury), rentsPolicy: w.rentsPolicy, held, market };
}
