import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  announceAuction, bidAtAuction, bootstrap, grantHeirloom, resolveDueLots, testRng, tickAuction,
} from '@ed/core';

const bundle = loadContent();

describe('announcing an auction', () => {
  it('puts lots on the calendar, years ahead of the sale', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const lots = announceAuction(ctx, testRng('auction'));
    expect(lots.length).toBeGreaterThan(0);
    for (const lot of lots) {
      expect(lot.saleYear).toBeGreaterThan(ctx.world.year);
      expect(ctx.world.auction.upcoming).toContainEqual(lot);
    }
  });

  it('never offers a spellbook already on the shelf', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const def = ctx.content.spellbooks[0]!;
    ctx.world.library.set(def.id, { id: def.id, acquiredYear: ctx.world.year, condition: 100 });

    for (let seed = 1; seed <= 20; seed++) {
      const lots = announceAuction(ctx, testRng('auction', seed));
      expect(lots.some((l) => l.kind === 'spellbook' && l.refId === def.id)).toBe(false);
    }
  });
});

describe('bidding at auction', () => {
  it('refuses a bid on a lot that does not exist', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    expect(bidAtAuction(ctx, 'nothing', 'coin', 500).ok).toBe(false);
  });

  it('refuses an heirloom bid the house does not hold', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const [lot] = announceAuction(ctx, testRng('auction'));
    expect(bidAtAuction(ctx, lot!.id, 'heirloom', 0, 'nothing_the_house_owns').ok).toBe(false);
  });

  it('a winning coin bid grants a spellbook and charges the treasury', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    ctx.world.treasury = 5000;
    let lot;
    for (let i = 0; i < 20 && !lot; i++) {
      const lots = announceAuction(ctx, testRng('auction-find', i));
      lot = lots.find((l) => l.kind === 'spellbook');
      if (!lot) ctx.world.auction.upcoming = [];
    }
    expect(lot, 'never rolled a spellbook lot to test against').toBeTruthy();

    const before = ctx.world.treasury;
    bidAtAuction(ctx, lot!.id, 'coin', lot!.reserveCoin + 500);
    ctx.world.year = lot!.saleYear;
    resolveDueLots(ctx, false);

    expect(ctx.world.library.has(lot!.refId)).toBe(true);
    expect(ctx.world.treasury).toBeLessThan(before);
    expect(ctx.world.auction.history.some((h) => h.lot.id === lot!.id && h.winner === 'player')).toBe(true);
  });

  it('an heirloom bid removes the traded heirloom rather than spending coin', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    grantHeirloom(ctx, 'portion_of_fertility');
    let lot;
    for (let i = 0; i < 20 && !lot; i++) {
      const lots = announceAuction(ctx, testRng('auction-h', i));
      lot = lots.find((l) => l.kind === 'heirloom' || l.kind === 'chronicle_page');
      if (!lot) ctx.world.auction.upcoming = [];
    }
    expect(lot, 'never rolled a lot to test the heirloom currency against').toBeTruthy();

    const treasuryBefore = ctx.world.treasury;
    bidAtAuction(ctx, lot!.id, 'heirloom', 0, 'portion_of_fertility');
    ctx.world.year = lot!.saleYear;
    resolveDueLots(ctx, false);

    expect(ctx.world.treasury).toBe(treasuryBefore);
    expect(ctx.world.heirlooms.has('portion_of_fertility')).toBe(false);
  });

  it('a lot with no bid and no interested rival sells to nobody', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    // A heirloom lot draws no rival competition at all (issue #17 scope: rival
    // bidding is modelled for spellbook affinities only).
    const lot = {
      id: 'test_lot_nobody', kind: 'heirloom' as const, refId: 'portion_of_agelessness',
      house: 'house_marrow', announcedYear: ctx.world.year, saleYear: ctx.world.year + 3,
      reserveCoin: 400,
    };
    ctx.world.auction.upcoming = [lot];
    ctx.world.year = lot.saleYear;
    resolveDueLots(ctx, false); // no player bid registered, and autoResolve is false
    expect(ctx.world.auction.history.some((h) => h.lot.id === lot.id && h.winner === 'nobody')).toBe(true);
  });
});

describe('named rival bidders (issue #17)', () => {
  it('House Marrow outbids a modest player offer for a Death spellbook', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const lot = {
      id: 'test_lot', kind: 'spellbook' as const, refId: 'the_marrow_codex',
      house: 'house_marrow', announcedYear: ctx.world.year, saleYear: ctx.world.year + 3,
      reserveCoin: ctx.content.mustSpellbook('the_marrow_codex').price.min,
    };
    ctx.world.auction.upcoming = [lot];
    ctx.world.treasury = 5000;

    bidAtAuction(ctx, lot.id, 'coin', 50); // far under House Marrow's bidsUpTo: 800
    ctx.world.year = lot.saleYear;
    resolveDueLots(ctx, false);

    const outcome = ctx.world.auction.history.find((h) => h.lot.id === lot.id)!;
    expect(outcome.winner).toBe('rival');
    expect(outcome.winningHouse).toBe('house_marrow');
    expect(ctx.world.library.has('the_marrow_codex')).toBe(false);
  });

  it('a player bid above every rival motive wins it outright', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const lot = {
      id: 'test_lot_2', kind: 'spellbook' as const, refId: 'the_marrow_codex',
      house: 'house_marrow', announcedYear: ctx.world.year, saleYear: ctx.world.year + 3,
      reserveCoin: ctx.content.mustSpellbook('the_marrow_codex').price.min,
    };
    ctx.world.auction.upcoming = [lot];
    ctx.world.treasury = 5000;

    bidAtAuction(ctx, lot.id, 'coin', 1200); // above House Marrow's bidsUpTo: 800
    ctx.world.year = lot.saleYear;
    resolveDueLots(ctx, false);

    expect(ctx.world.library.has('the_marrow_codex')).toBe(true);
  });
});

describe('the acceptance test — a purchased rival chronicle proves a Discrepancy (issue #17)', () => {
  it('end to end, in a headless run', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    ctx.world.discrepancies.set('test_discrepancy', {
      severity: 'major', provableBy: ['house_marrow'], state: 'open',
    });
    ctx.world.treasury = 5000;

    let lot;
    for (let i = 0; i < 20 && !lot; i++) {
      const lots = announceAuction(ctx, testRng('proof', i));
      lot = lots.find((l) => l.kind === 'chronicle_page' && l.refId === 'test_discrepancy');
      if (!lot) ctx.world.auction.upcoming = [];
    }
    expect(lot, 'never rolled the discrepancy-proving lot').toBeTruthy();

    bidAtAuction(ctx, lot!.id, 'coin', lot!.reserveCoin + 200);
    ctx.world.year = lot!.saleYear;
    resolveDueLots(ctx, false);

    expect(ctx.world.discrepancies.get('test_discrepancy')?.state).toBe('proven');
    expect(ctx.world.auction.history.some((h) => h.lot.id === lot!.id && h.winner === 'player')).toBe(true);
  });

  it('the chronicler alone can do it, purely auto-resolved (tickAuction)', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    ctx.world.discrepancies.set('test_discrepancy_2', {
      severity: 'minor', provableBy: ['house_marrow'], state: 'open',
    });
    ctx.world.treasury = 5000;

    let proven = false;
    for (let y = 0; y < 1000 && !proven; y++) {
      ctx.world.year += 1;
      tickAuction(ctx, testRng('auction', ctx.world.year), true);
      if (ctx.world.discrepancies.get('test_discrepancy_2')?.state === 'proven') proven = true;
    }
    expect(proven, 'the chronicler never bought the page across 1000 years of auctions').toBe(true);
  });
});
