import type { ParcelDef, ParcelKind, ParcelState, RentPolicy, RespectTier, Year } from '@ed/schema';
import { assertNever, RESPECT_ORDER } from '@ed/schema';
import type { SimCtx } from './world.js';
import type { Rng } from './rng.js';
import type { OrderResult } from './table.js';
import { DEBT_FLOOR } from './economy.js';
import { addGrudge, relate } from './people/relationships.js';
import { head } from './world.js';

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
    // ever moves once an `improve` order has completed. Floored at zero
    // (issue #98's `damage` can now push it negative): a flooded farm can
    // stop paying, never pay the house to hold it.
    if (def) {
      let contribution = Math.max(0, def.baseYield + (state.yieldBonus ?? 0)) * (state.yieldFactor ?? 1);
      if (def.kind === 'tenant_farm' || def.kind === 'mill') contribution *= RENT_MULTIPLIER[w.rentsPolicy];
      held += contribution;
    }
  }
  return held * (INCOME_BY_RESPECT[w.respect] / TOTAL_1042_YIELD);
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
  return def.marketPrice ?? Math.round(def.baseYield * PRICE_PER_YIELD);
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
    if (!def.marketable) continue;
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
  if (def.kind === 'wetland') {
    const standing = RESPECT_ORDER.indexOf(w.respect);
    w.respect = RESPECT_ORDER[Math.max(0, standing - 1)]!;
    w.respectChanged = w.year;
  }
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

export function setRentsPolicy(ctx: SimCtx, policy: RentPolicy): OrderResult {
  const w = ctx.world;
  if (w.rentsPolicy === policy) return { ok: true };
  w.rentsPolicy = policy;

  // The tenants are an institution as well as the named family an eviction
  // scene casts. A standing rent order therefore makes one house-wide edge
  // against the Head who set it; the relationship system deliberately lets
  // house-wide edges survive a year in which one endpoint is not a minted
  // person. Severity is duration here, so even hard terms outlive a Head and
  // rack terms last longer still.
  if (policy !== 'customary') {
    const h = head(w);
    if (h) {
      const tenants = `tenants:${w.playerHouse}`;
      relate(w, tenants, h.id, policy === 'rack' ? -18 : -10);
      addGrudge(
        ctx, tenants, h.id,
        { severity: policy === 'rack' ? 48 : 36, inheritance: 'house_wide' },
        `rents_${policy}`,
      );
    }
  }
  return { ok: true };
}

/** What each rent book pays now, and what the tenants charge the house later. */
const RENT_MULTIPLIER: Record<RentPolicy, number> = { customary: 1, hard: 1.12, rack: 1.28 };
const RENT_DISCONTENT: Record<RentPolicy, number> = { customary: 0, hard: 0.25, rack: 0.65 };

const IMPROVE_YEARS = 4;
const IMPROVE_YIELD_GAIN = 2;

/** Start a term of improvement — drainage, mostly, world §5's own word for what half these farms need. */
export function beginImprovement(ctx: SimCtx, parcel: string): OrderResult {
  const w = ctx.world;
  const def = ctx.content.parcel(parcel);
  if (!def) return { ok: false, reason: 'no such parcel' };
  if (def.kind === 'town_house') return { ok: false, reason: 'a town house is presence, not producing ground' };
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

/** Terms of improvement come due, and hard rents cost what they cost. Run once a year from the `land` phase. */
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

  w.discontent = Math.min(100, w.discontent + RENT_DISCONTENT[w.rentsPolicy]);
}

// ── Phase E: six holdings, six risk shapes (issue #100) ──────────────────

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export interface LandRiskResult {
  villageHarvest: number;
  sarrowSank: boolean;
}

/**
 * Roll the ground before economy reads it. Tenant farms share one quiet
 * harvest; the Wend mill is coupled to that same crop because empty sacks do
 * not pay a mill toll. The other four kinds own their stated risk instead of
 * inheriting a single generic variance.
 */
export function tickLandRisks(ctx: SimCtx, rng: Rng): LandRiskResult {
  const w = ctx.world;
  const villageHarvest = clamp(rng.normal(1, 0.07), 0.78, 1.22);
  let sarrowSank = false;

  for (const state of [...heldParcels(ctx)]) {
    if (!state.defId) continue;
    const def = ctx.content.parcel(state.defId);
    if (!def) continue;

    switch (def.kind) {
      case 'tenant_farm':
        state.yieldFactor = villageHarvest;
        break;
      case 'mill':
        // Three quarters of the mill's business is the village crop; the
        // remainder is its fixed wheel and crossing trade.
        state.yieldFactor = 1.8 * (0.25 + villageHarvest * 0.75);
        break;
      case 'woodland':
      case 'common':
      case 'demesne':
        state.yieldFactor = 1;
        break;
      case 'slate_work':
        state.yieldFactor = clamp(rng.normal(2.6, 1), 0.2, 5);
        break;
      case 'sarrow_bottom':
        state.yieldFactor = clamp(rng.normal(3.4, 2.1), 0, 8);
        if (rng.bool(0.018)) {
          seizeParcel(ctx, def.id);
          sarrowSank = true;
          w.chronicle.push({
            year: w.year, weight: 'line', named: false,
            text: `${def.name} went down in black water off Sarrow, with its cargo and every crown laid into it.`,
          });
        }
        break;
      case 'town_house':
        state.yieldFactor = 0;
        // The house pays no rent. What it buys is a door in Bramme, so merely
        // keeping it prevents the quiet standing decay from treating the
        // family as absent from the town this year.
        w.respectChanged = w.year;
        break;
      case 'wetland':
        state.yieldFactor = clamp(rng.normal(0.7, 0.25), 0.2, 1.2);
        break;
      default:
        assertNever(def.kind, 'parcel kind');
    }
  }

  return { villageHarvest, sarrowSank };
}

// ── Phase D: the `land` Effect (issue #91, #98) ─────────────────────────────

/** How much a bare `damage`/`restore` effect moves `yieldBonus` when content does not say. Matches `IMPROVE_YIELD_GAIN`'s own granularity — a flood costs about what one term of drainage buys. */
export const LAND_DAMAGE_DEFAULT = 2;

/** Mint a `ParcelState` for a parcel the house does not yet hold, at no cost. A no-op if it already holds one — see the `land` Effect's own doc in `event.ts` for why that is correct rather than a stub. */
export function grantParcel(ctx: SimCtx, parcel: string): void {
  const w = ctx.world;
  if (liveStateOf(ctx, parcel)) return;
  const def = ctx.content.parcel(parcel);
  if (!def) return;
  const id = `prc_${(w.counters.parcel += 1).toString(36)}`;
  w.parcels.set(id, { id, defId: def.id, heldSince: w.year });
  // Hygiene `buyParcel` also does: a parcel granted out from under the market cannot still be listed on it.
  w.landMarket.lots = w.landMarket.lots.filter((l) => l.parcel !== def.id);
}

/** Drop a held parcel with no payment — the loss-route counterpart to `sellParcel`. A no-op if the house does not hold it. */
export function seizeParcel(ctx: SimCtx, parcel: string): void {
  const w = ctx.world;
  const found = liveStateOf(ctx, parcel);
  if (!found) return;
  const [id] = found;
  w.parcels.delete(id);
  w.landImprovements = w.landImprovements.filter((imp) => imp.parcel !== id);
}

/** Knock a held parcel's yield down. Floored so its contribution to `landIncome` cannot go negative — see that function's own clamp. A no-op if the house does not hold it. */
export function damageParcel(ctx: SimCtx, parcel: string, magnitude = LAND_DAMAGE_DEFAULT): void {
  const found = liveStateOf(ctx, parcel);
  if (!found) return;
  const [, state] = found;
  state.yieldBonus = (state.yieldBonus ?? 0) - magnitude;
}

/** Repair a held parcel's yield. Not capped at the undamaged baseline — see the `land` Effect's own doc for why. A no-op if the house does not hold it. */
export function restoreParcel(ctx: SimCtx, parcel: string, magnitude = LAND_DAMAGE_DEFAULT): void {
  const found = liveStateOf(ctx, parcel);
  if (!found) return;
  const [, state] = found;
  state.yieldBonus = (state.yieldBonus ?? 0) + magnitude;
}

/** What a client draws for the land panel — held ground, the open market, and what each thing there costs today. */
export interface LandView {
  treasury: number;
  rentsPolicy: RentPolicy;
  held: {
    parcel: string; name: string; kind: ParcelKind; place: string;
    baseYield: number; yieldBonus: number; yieldFactor: number;
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
      yieldFactor: state.yieldFactor ?? 1,
      sellable: def.kind !== 'demesne',
      sellPrice: Math.round(cost * SELL_FACTOR),
      ...(completes !== undefined ? { improving: completes } : {}),
      improveCost: cost,
      canImprove: def.kind !== 'town_house' && completes === undefined && w.treasury - cost >= DEBT_FLOOR,
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
