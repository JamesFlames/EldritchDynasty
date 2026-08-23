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
    for (let i = 0; i < 200 && !lot; i++) {
      const lots = announceAuction(ctx, testRng('auction-find', i));
      lot = lots.find((l) => l.kind === 'spellbook');
      if (!lot) ctx.world.auction.upcoming = [];
    }
    expect(lot, 'never rolled a spellbook lot to test against').toBeTruthy();

    /**
     * A WINNING bid, computed rather than assumed.
     *
     * This was `reserveCoin + 500`, which is a winning bid against some books
     * and not others: `bestRivalBid` lets any house whose `motives` name the
     * lot's affinity pay up to its `bidsUpTo`, and the Church's is 2,000. The
     * test passed for as long as this seed happened to draw a book nobody
     * wanted, and the first content drop that shifted the stream drew
     * `greater_workings_of_light` at a reserve of 429 instead — so a 929-crown
     * bid lost to the Church and "a winning coin bid grants a spellbook"
     * failed on a mechanism that was working perfectly.
     *
     * Third time this repo has learned it (CLAUDE.md, Tests): assert the
     * mechanism, not a seed reaching a state. The ceiling comes off the
     * content, so a house given a richer motive tomorrow cannot re-break it.
     */
    const rivalCeiling = Math.max(0, ...bundle.houses.flatMap((h) => h.motives.map((m) => m.bidsUpTo)));
    const before = ctx.world.treasury;
    bidAtAuction(ctx, lot!.id, 'coin', Math.max(lot!.reserveCoin + 500, rivalCeiling + 1));
    ctx.world.year = lot!.saleYear;
    resolveDueLots(ctx, false);

    expect(ctx.world.library.has(lot!.refId)).toBe(true);
    expect(ctx.world.treasury).toBeLessThan(before);
    expect(ctx.world.auction.history.some((h) => h.lot.id === lot!.id && h.winner === 'player')).toBe(true);
  });

  it('an heirloom bid removes the traded heirloom rather than spending coin', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    grantHeirloom(ctx, 'portion_of_fertility');
    // An HEIRLOOM lot by preference. This used to take a chronicle page as a
    // fallback, from when heirloom lots were scarce; a page's reserve is set by
    // the Discrepancy's severity rather than by the portion's worth, so the
    // fallback quietly turned "does an heirloom bid trade the heirloom" into
    // "is one portion worth a major Discrepancy", which it is not.
    // An heirloom lot the heirloom currency can actually win. `bidValue` puts a
    // flat 450 on any traded heirloom and an heirloom lot reserves between 250
    // and 650, so half of them are unwinnable with a portion however good it
    // is — which is a real thing about the currency and not what this test is
    // about. It is about whether winning trades the object instead of coin.
    let lot;
    for (let i = 0; i < 200 && !lot; i++) {
      const lots = announceAuction(ctx, testRng('auction-h', i));
      lot = lots.find((l) => l.kind === 'heirloom' && l.reserveCoin <= 450);
      if (!lot) ctx.world.auction.upcoming = [];
    }
    expect(lot, 'never rolled an heirloom lot a portion could win').toBeTruthy();

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

    // 200 announcements, not 20. This loop is looking for a FIXTURE — one lot
    // of the right kind to run the assertions against — and a page is a few
    // per cent of each pick, so twenty was about two expected hits and landed
    // on zero the first time the lot pool changed shape underneath it.
    let lot;
    for (let i = 0; i < 200 && !lot; i++) {
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

  /**
   * The property is "the chronicler CAN do this with nobody at the wheel", and
   * one seed cannot carry it. The great sale comes round every sixty to ninety
   * years, so a run offers about thirteen auctions; a page is a few per cent
   * of each pick; the expectation over one seed is close to one. That is a
   * coin flip, and it read as a passing test for as long as the coin kept
   * landing — it stopped the first time the lot pool changed shape under it.
   */
  it('the chronicler alone can do it, purely auto-resolved (tickAuction)', () => {
    const seeds = [4242, 1042, 77, 909, 5150, 31, 606, 1234];
    const provenIn = seeds.filter((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      ctx.world.discrepancies.set('test_discrepancy_2', {
        severity: 'minor', provableBy: ['house_marrow'], state: 'open',
      });

      for (let y = 0; y < 1000; y++) {
        // Topped up every year on purpose. `autoBid` bids on ANY lot it can
        // afford down to the debt floor, so across fifteen sales it buys
        // whatever is on the table — and the library drop took the spellbook
        // pool from eleven to twenty-one, which doubled what the chronicler
        // spends before a chronicle page ever comes up. The page lots did
        // appear in every seed; the house was broke by then. This test is
        // about whether buying the page proves the Discrepancy, so it holds
        // solvency still and lets the mechanic be the only variable.
        ctx.world.treasury = 5000;
        ctx.world.year += 1;
        // The seed goes into the auction's RNG salt, and that is the whole
        // reason this is eight samples rather than one run written out eight
        // times: `tickAuction` is driven entirely by the rng it is handed, so
        // salting on the year alone gave every "seed" here an identical
        // sequence of sales. A page is a few per cent of each pick and about
        // one expected hit per run, so a single sample was a coin flip wearing
        // the shape of a deterministic test.
        tickAuction(ctx, testRng('auction', seed, ctx.world.year), true);
        if (ctx.world.discrepancies.get('test_discrepancy_2')?.state === 'proven') return true;
      }
      return false;
    });

    expect(provenIn.length, `the chronicler never bought the page in any of ${seeds.length} runs`)
      .toBeGreaterThan(0);
  });
});
