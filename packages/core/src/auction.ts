import type { AuctionBid, AuctionLot, BidCurrency, HouseDef } from '@ed/schema';
import type { SimCtx } from './world.js';
import type { Rng } from './rng.js';
import { DEBT_FLOOR } from './economy.js';
import { applyEffect } from './events/effects.js';
import { acquireLibraryCopy } from './people/library.js';
import { grantHeirloom, transferHeirloom } from './people/heirlooms.js';

/**
 * THE AUCTION (issue #17) — the largest single subsystem in the tracker, and
 * how a Discrepancy gets proven by purchase.
 *
 * Rare — every 40-90 years, announced 3-8 years ahead so the player can
 * liquidate, borrow, or start planning something regrettable. Stock is
 * generated at runtime from three sources:
 *
 *   spellbook       affinities the house does not have. `announceLots` never
 *                   offers one already on the shelf.
 *   heirloom        anything not `cannotBeSold` and not already held.
 *   chronicle_page  one per OPEN Discrepancy per house named in its
 *                   `provableBy` — buying it proves the Discrepancy outright,
 *                   through the same `discrepancy` effect content already uses.
 *
 * Rival houses bid only on spellbooks, and only when their `motives` (content,
 * `houses.yaml`) name the affinity: House Marrow always wants Death texts, the
 * Church wants Light and refuses Death. Heirlooms and chronicle pages go to
 * whoever bids the reserve; there is no third party fighting the player for a
 * page that incriminates a house not their own.
 */

const LEAD_YEARS = { min: 3, max: 8 };
const REANNOUNCE_YEARS = { min: 45, max: 90 }; // "once every two or three generations"
const LOTS_PER_AUCTION = { min: 1, max: 3 };

const SEVERITY_PRICE: Record<string, number> = { minor: 220, major: 500, total: 900 };

function sellableSpellbooks(ctx: SimCtx): string[] {
  return ctx.content.spellbooks
    .filter((s) => !ctx.world.library.has(s.id))
    .map((s) => s.id);
}

function sellableHeirlooms(ctx: SimCtx): string[] {
  return ctx.content.heirlooms
    .filter((h) => !h.cannotBeSold && !ctx.world.heirlooms.has(h.id))
    .map((h) => h.id);
}

function rivalHouses(ctx: SimCtx): HouseDef[] {
  return ctx.content.houses.filter((h) => h.id !== ctx.world.playerHouse);
}

/** One `chronicle_page` candidate per (open Discrepancy, house that can prove it). */
function chroniclePageCandidates(ctx: SimCtx): { discrepancy: string; house: string; severity: string }[] {
  const out: { discrepancy: string; house: string; severity: string }[] = [];
  for (const [id, d] of ctx.world.discrepancies) {
    if (d.state !== 'open') continue;
    for (const house of d.provableBy) out.push({ discrepancy: id, house, severity: d.severity });
  }
  return out;
}

function lotId(ctx: SimCtx): string {
  return `lot_${(ctx.world.counters.lot += 1).toString(36)}`;
}

/**
 * Build 1-3 lots and put them on the calendar. Called from `tickAuction` once
 * `nextAnnounceYear` arrives; reschedules itself.
 */
export function announceAuction(ctx: SimCtx, rng: Rng): AuctionLot[] {
  const w = ctx.world;
  const rivals = rivalHouses(ctx);
  const spellbooks = sellableSpellbooks(ctx);
  const heirlooms = sellableHeirlooms(ctx);
  const pages = chroniclePageCandidates(ctx);

  type Candidate = { kind: AuctionLot['kind']; refId: string; house: string; reserve: number };
  const pool: Candidate[] = [
    ...spellbooks.map((id) => ({
      kind: 'spellbook' as const,
      refId: id,
      house: rng.pick(rivals)?.id ?? w.playerHouse,
      reserve: Math.round(rng.range(
        ctx.content.mustSpellbook(id).price.min,
        ctx.content.mustSpellbook(id).price.max,
      )),
    })),
    ...heirlooms.map((id) => ({
      kind: 'heirloom' as const,
      refId: id,
      house: rng.pick(rivals)?.id ?? w.playerHouse,
      reserve: Math.round(rng.range(250, 650)),
    })),
    ...pages.map((p) => ({
      kind: 'chronicle_page' as const,
      refId: p.discrepancy,
      house: p.house,
      reserve: SEVERITY_PRICE[p.severity] ?? 400,
    })),
  ];
  if (!pool.length) return [];

  // Weighted, not uniform: a chronicle page is the rarest and most consequential
  // thing on the table, so it does not crowd out ordinary spellbook and
  // heirloom stock just for existing. Frame content reacts to a Discrepancy
  // while it stands OPEN (issue #13) — the auction is a second way to close
  // that window, not the primary one, and must not race ahead of it.
  //
  // 0.7, and the number is a SHARE rather than a taste: this constant was 0.35
  // when the game held eleven spellbooks, and the library drop took that to
  // twenty-one. A page's weight is fixed while the pool it competes with
  // doubles, so its share of each pick halved, and issue #17's own acceptance
  // test — a purchased rival chronicle proving a Discrepancy — stopped finding
  // a page to buy in a thousand years of auctions. Anything that adds
  // spellbooks in bulk has to come back here.
  const candidateWeight = (c: Candidate) => (c.kind === 'chronicle_page' ? 0.7 : 1);

  const n = Math.min(pool.length, Math.round(rng.range(LOTS_PER_AUCTION.min, LOTS_PER_AUCTION.max + 1)));
  const chosen: Candidate[] = [];
  const remaining = [...pool];
  for (let i = 0; i < n && remaining.length; i++) {
    const pick = rng.weighted(remaining, candidateWeight);
    if (!pick) break;
    chosen.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }

  const saleYear = w.year + Math.round(rng.range(LEAD_YEARS.min, LEAD_YEARS.max));
  const lots: AuctionLot[] = chosen.map((c) => ({
    id: lotId(ctx),
    kind: c.kind,
    refId: c.refId,
    house: c.house,
    announcedYear: w.year,
    saleYear,
    reserveCoin: c.reserve,
  }));

  w.auction.upcoming.push(...lots);
  w.chronicle.push({
    year: w.year,
    weight: 'paragraph',
    title: 'A Sale Announced',
    text: `Word came that there would be an auction in ${saleYear}, and that it was worth the family's attention.`,
    named: false,
  });

  return lots;
}

/** Register a bid ahead of the sale. Returns false for a lot that no longer exists or has already sold. */
export interface BidResult {
  ok: boolean;
  reason?: string;
}

export function bidAtAuction(ctx: SimCtx, lotId_: string, currency: BidCurrency, amount: number, heirloomOffered?: string): BidResult {
  const w = ctx.world;
  const lot = w.auction.upcoming.find((l) => l.id === lotId_);
  if (!lot) return { ok: false, reason: 'no such lot' };

  if (currency === 'heirloom') {
    if (!heirloomOffered || !w.heirlooms.has(heirloomOffered)) {
      return { ok: false, reason: 'the house does not hold that heirloom' };
    }
  }

  const bid: AuctionBid = { house: w.playerHouse, currency, amount };
  if (heirloomOffered) bid.heirloomOffered = heirloomOffered;
  lot.playerBid = bid;
  return { ok: true };
}

/** What a `bid` is worth, for comparing against a coin reserve and a rival's coin bid. */
function bidValue(bid: AuctionBid): number {
  switch (bid.currency) {
    case 'coin':
    case 'favour':
      return bid.amount;
    // Flavour currencies. Generous, flat estimates — a promised granddaughter
    // or a favour bank the seller trusts is not priced by the crown, but it
    // has to be worth SOMETHING or the currency is decorative.
    case 'heirloom': return 450;
    case 'marriage_promise': return 600;
  }
}

/** The best a rival house will pay for a spellbook whose affinity its `motives` name. */
function bestRivalBid(ctx: SimCtx, lot: AuctionLot): { house: string; amount: number } | undefined {
  if (lot.kind !== 'spellbook') return undefined;
  const def = ctx.content.spellbook(lot.refId);
  if (!def) return undefined;

  let best: { house: string; amount: number } | undefined;
  for (const house of rivalHouses(ctx)) {
    for (const m of house.motives) {
      if (m.refuses.includes(def.affinity)) continue;
      if (!m.wants.includes(def.affinity)) continue;
      if (!best || m.bidsUpTo > best.amount) best = { house: house.id, amount: m.bidsUpTo };
    }
  }
  return best;
}

/**
 * A chronicler's standing offer, used when `autoResolve` is true and nobody
 * registered a real bid — the same role `autoRecordOption` plays for Record.
 * Chronicle pages carry a premium: proving a rival wrong is worth more to the
 * house than the crowns it costs.
 */
function autoBid(ctx: SimCtx, lot: AuctionLot): AuctionBid | undefined {
  const w = ctx.world;
  const buffer = 60; // never bid the house into the debt floor outright
  const headroom = w.treasury - DEBT_FLOOR - buffer;
  if (headroom < lot.reserveCoin) return undefined;

  const willingness = lot.kind === 'chronicle_page' ? 1.25 : lot.kind === 'spellbook' ? 1.2 : 1.05;
  const amount = Math.min(headroom, Math.round(lot.reserveCoin * willingness));
  return { house: w.playerHouse, currency: 'coin', amount };
}

/** Apply what winning the lot actually gets the house. */
function grantLot(ctx: SimCtx, lot: AuctionLot): void {
  const w = ctx.world;
  if (lot.kind === 'spellbook') {
    acquireLibraryCopy(ctx, lot.refId);
    w.chronicle.push({
      year: w.year, weight: 'line',
      text: `The house bought a copy of ${ctx.content.spellbook(lot.refId)?.name ?? lot.refId} at auction.`,
      named: false,
    });
    return;
  }
  if (lot.kind === 'heirloom') {
    grantHeirloom(ctx, lot.refId);
    w.chronicle.push({
      year: w.year, weight: 'line',
      text: `The house bought ${ctx.content.heirloom(lot.refId)?.name ?? lot.refId} at auction.`,
      named: false,
    });
    return;
  }
  // chronicle_page: THIS IS HOW DISCREPANCIES GET PROVEN.
  applyEffect({ kind: 'discrepancy', op: 'prove', id: lot.refId }, ctx, {});
  w.chronicle.push({
    year: w.year, weight: 'paragraph', title: 'Bought and Read',
    text: `A page came up for sale that named the family directly, and the house bought it before anyone else could. `
      + 'What it proved could no longer be unproved.',
    named: false,
  });
}

/** Pay for it, in whichever currency won. */
function chargeBid(ctx: SimCtx, bid: AuctionBid, lot: AuctionLot): void {
  const w = ctx.world;
  if (bid.currency === 'coin') { w.treasury -= bid.amount; return; }
  if (bid.currency === 'favour') { w.auction.favours -= bid.amount; return; }
  if (bid.currency === 'heirloom' && bid.heirloomOffered) { transferHeirloom(ctx, bid.heirloomOffered); return; }
  if (bid.currency === 'marriage_promise') {
    // WHAT SHE WAS PROMISED FOR. `lot` was written empty here, which made
    // `MarriagePromise.lot` a declared field nothing ever filled — and it is
    // the whole of what makes this record legible: an unborn granddaughter
    // pledged for a book, with no way to say which book, is a line of
    // bookkeeping rather than the thing a house has to explain in 1512.
    w.marriagePromises.push({ toHouse: bid.house, year: w.year, lot: lot.refId });
  }
}

/** Resolve every lot whose sale year has arrived. */
export function resolveDueLots(ctx: SimCtx, autoResolve: boolean): void {
  const w = ctx.world;
  const due = w.auction.upcoming.filter((l) => l.saleYear <= w.year);
  if (!due.length) return;
  w.auction.upcoming = w.auction.upcoming.filter((l) => l.saleYear > w.year);

  for (const lot of due) {
    const bid = lot.playerBid ?? (autoResolve ? autoBid(ctx, lot) : undefined);
    const rival = bestRivalBid(ctx, lot);

    const playerValue = bid ? bidValue(bid) : -1;
    const playerWins = bid !== undefined
      && playerValue >= lot.reserveCoin
      && (!rival || playerValue >= rival.amount);

    if (playerWins && bid) {
      chargeBid(ctx, bid, lot);
      grantLot(ctx, lot);
      w.auction.history.push({ lot, year: w.year, winner: 'player' });
      continue;
    }

    if (rival && rival.amount >= lot.reserveCoin) {
      w.auction.history.push({ lot, year: w.year, winner: 'rival', winningHouse: rival.house });
      const seller = ctx.content.house(rival.house)?.name ?? rival.house;
      w.chronicle.push({
        year: w.year, weight: 'line',
        text: `${seller} outbid the house for the lot, and took it home instead.`,
        named: false,
      });
      continue;
    }

    w.auction.history.push({ lot, year: w.year, winner: 'nobody' });
  }
}

/** Called once a year — see `year/phases.ts`. */
export function tickAuction(ctx: SimCtx, rng: Rng, autoResolve: boolean): void {
  const w = ctx.world;
  if (w.year >= w.auction.nextAnnounceYear) {
    announceAuction(ctx, rng);
    w.auction.nextAnnounceYear = w.year + Math.round(rng.range(REANNOUNCE_YEARS.min, REANNOUNCE_YEARS.max));
  }
  resolveDueLots(ctx, autoResolve);
}

/** Diagnostics and the editor: lots on the calendar right now. */
export function upcomingLots(ctx: SimCtx): AuctionLot[] {
  return [...ctx.world.auction.upcoming];
}
