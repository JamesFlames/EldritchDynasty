import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  CARDS_DEALT, dealMatch, matchSubjects, takeCard,
  beget, bootstrap, hashSeed, loadGame, makeRng, marry, newGame, phase, place, runYears,
  saveGame, testRng, testWorld,
} from '@ed/core';
import type { SimCtx } from '@ed/core';

const bundle = loadContent();

/**
 * THE MATCH (concept §5, step 2) — the player draws one partner from three
 * cards.
 *
 * The assertions worth having here are all about the difference between a
 * card and a person. Two of three cards are declined every time this fires,
 * forty times a run, and a declined suitor who quietly became a woman living
 * in House Calder with a rolled genome and a claim on the frequency ration
 * would be invisible in every way that matters until the world was full of
 * people nobody chose.
 */

/** A world with a marriageable daughter of the seat and nobody else new. */
function withDaughter(seed = 4242) {
  const ctx = testWorld(bundle, seed, 1042);
  const her = place(ctx, { sex: 'female', age: 19, name: 'Test Daughter' });
  return { ctx, her };
}

describe('the deck', () => {
  it('deals a hand for blood of the seat', () => {
    const { ctx, her } = withDaughter();
    expect(matchSubjects(ctx).map((p) => p.id)).toContain(her.id);
  });

  it('does not deal for the married, the under-age, or a cadet hall', () => {
    const ctx = testWorld(bundle, 909, 1042);
    const child = place(ctx, { sex: 'female', age: 12, name: 'Too Young' });
    const cadet = place(ctx, { sex: 'male', age: 24, name: 'Of The Branch', branch: 'branch_test' });
    const wed = place(ctx, { sex: 'male', age: 24, name: 'Already Spoken For' });
    marry(ctx, wed, place(ctx, { sex: 'female', age: 23, name: 'His Wife' }));

    const subjects = matchSubjects(ctx).map((p) => p.id);
    expect(subjects, 'a twelve-year-old was offered a hand').not.toContain(child.id);
    expect(subjects, 'a cadet was offered a hand').not.toContain(cadet.id);
    expect(subjects, 'a married man was offered a hand').not.toContain(wed.id);
  });

  it('deals distinct recipes — never the same card three times', () => {
    const { ctx, her } = withDaughter();
    const offer = dealMatch(ctx, her, testRng('deck'));
    expect(offer.cards.length).toBeGreaterThan(1);
    expect(offer.cards.length).toBeLessThanOrEqual(CARDS_DEALT);

    const recipes = offer.cards.filter((c) => c.recipe).map((c) => c.recipe!.template);
    expect(new Set(recipes).size, 'the same recipe was dealt twice in one hand').toBe(recipes.length);
  });

  it('puts a cousin on the table when there is one', () => {
    const ctx = testWorld(bundle, 77, 1042);
    const her = place(ctx, { sex: 'female', age: 19, name: 'The Subject' });
    const cousin = place(ctx, { sex: 'male', age: 21, name: 'The Cousin' });

    const offer = dealMatch(ctx, her, testRng('cousin'));
    const household = offer.cards.filter((c) => c.kind === 'household');
    expect(household.length, 'no card from the house at all').toBe(1);
    expect(household[0]!.person).toBe(cousin.id);
    expect(household[0]!.dowry, 'nothing leaves the house for a cousin').toBe(0);
  });

  /**
   * The one that matters. `rollRecipe` reserves a name and nothing else; only
   * `takeCard` spawns anybody.
   */
  it('leaves the declined where they were — which is nowhere', () => {
    const { ctx, her } = withDaughter();
    const before = ctx.world.people.all().length;
    const offer = dealMatch(ctx, her, testRng('declined'));
    expect(ctx.world.people.all().length, 'dealing a hand created people').toBe(before);

    const taken = offer.cards.find((c) => c.kind === 'outsider' && c.available);
    expect(taken, 'no outsider card to take').toBeDefined();
    expect(takeCard(ctx, her.id, taken!).ok).toBe(true);

    const names = new Set(ctx.world.people.all().map((p) => p.name));
    expect(names, 'the taken card did not arrive').toContain(taken!.name);
    for (const c of offer.cards) {
      if (c === taken || c.kind === 'household') continue;
      expect(names, `${c.name} was declined and turned up anyway`).not.toContain(c.name);
    }
    expect(ctx.world.people.all().length, 'more than one person arrived').toBe(before + 1);
  });

  it('mints exactly the person the card promised', () => {
    const { ctx, her } = withDaughter(31);
    const offer = dealMatch(ctx, her, testRng('promise'));
    const card = offer.cards.find((c) => c.kind === 'outsider' && c.available)!;

    const res = takeCard(ctx, her.id, card);
    expect(res.ok).toBe(true);
    const spouse = res.spouse!;
    expect(spouse.name).toBe(card.name);
    expect(spouse.sex).toBe(card.sex);
    expect(spouse.houseOfOrigin).toBe(card.house);
    expect(ctx.world.year - spouse.born).toBe(card.age);
  });

  it('marries them through the one marriage path', () => {
    const { ctx, her } = withDaughter(5150);
    const offer = dealMatch(ctx, her, testRng('wed'));
    const card = offer.cards.find((c) => c.available)!;
    const res = takeCard(ctx, her.id, card);

    expect(res.ok).toBe(true);
    expect(her.marriages.some((m) => m.spouse === res.spouse!.id && !m.to)).toBe(true);
    expect(res.spouse!.marriages.some((m) => m.spouse === her.id && !m.to)).toBe(true);
  });
});

describe('the dowry', () => {
  it('comes out of the treasury', () => {
    const { ctx, her } = withDaughter(8080);
    const offer = dealMatch(ctx, her, testRng('paid'));
    const card = offer.cards.find((c) => c.kind === 'outsider' && c.available)!;
    const before = ctx.world.treasury;

    takeCard(ctx, her.id, card);
    expect(ctx.world.treasury).toBeCloseTo(before - card.dowry, 6);
  });

  /**
   * Dealt, priced, and out of reach. A card the house cannot afford is listed
   * with its reason rather than filtered out — visible unavailability is
   * information, and "we could not raise it" is the kind of information this
   * game is about.
   */
  it('closes a card the house cannot raise, without hiding it', () => {
    const { ctx, her } = withDaughter(6060);
    ctx.world.treasury = -119;
    const offer = dealMatch(ctx, her, testRng('broke'));

    const priced = offer.cards.filter((c) => c.dowry > 0);
    expect(priced.length, 'nothing on this hand had a price').toBeGreaterThan(0);
    for (const c of priced) {
      expect(c.available, `${c.name} was affordable on an empty treasury`).toBe(false);
      expect(c.blockedBy).toMatch(/cannot raise/);
    }
    expect(takeCard(ctx, her.id, priced[0]!).ok, 'a closed card was taken anyway').toBe(false);
  });
});

describe('the match on the docket', () => {
  it('stops the clock until it is answered, and the chronicler can answer it', () => {
    const s = newGame(bundle, { seed: 1000, decider: 'ask' });
    let match;
    for (let i = 0; i < 60 && !match; i++) {
      match = s.advance(1).pending.find((d) => d.kind === 'match');
      if (!match && s.pending.length) s.letHimDecide();
    }
    expect(match, 'sixty years and no marriage was ever put to the player').toBeDefined();

    // INVARIANT 9: the docket blocks the clock.
    const stuck = s.year;
    s.advance(3);
    expect(s.year, 'the year turned with a match standing').toBe(stuck);

    const card = match!.kind === 'match' ? match!.cards.find((c) => c.available)! : undefined!;
    expect(s.match(match!.id, card.id).ok).toBe(true);
    expect(s.pending.find((d) => d.id === match!.id), 'the answered match is still standing').toBeUndefined();
    s.advance(1);
    expect(s.year).toBe(stuck + 1);
  });

  it('records the answer in the decision log', () => {
    const s = newGame(bundle, { seed: 1000, decider: 'chronicler' });
    s.advance(60);
    const matches = s.ctx.world.decisionLog.filter((d) => d.kind === 'match');
    expect(matches.length, 'sixty years of marriages and nothing logged').toBeGreaterThan(0);
    for (const m of matches) {
      if (m.kind !== 'match') continue;
      expect(m.subject).toBeTruthy();
      if (m.card) expect(m.spouse, 'a card was taken and no spouse recorded').toBeTruthy();
    }
  });

  it('answers the same way twice for the same seed', () => {
    const spouses = [0, 1].map(() => {
      const s = newGame(bundle, { seed: 4242, decider: 'chronicler' });
      s.advance(80);
      return s.ctx.world.decisionLog.filter((d) => d.kind === 'match').map((d) => JSON.stringify(d)).join('|');
    });
    expect(spouses[0]).toBe(spouses[1]);
    expect(spouses[0]!.length, 'no matches were drafted at all').toBeGreaterThan(0);
  });

  /**
   * A hand is a promise, and a promise has to survive being written down: two
   * of these three people do not exist, so re-dealing on load would answer the
   * player's question with different cards from the ones he was reading.
   */
  it('survives a save and a load with its cards intact', () => {
    const s = newGame(bundle, { seed: 1000, decider: 'ask' });
    let match;
    for (let i = 0; i < 60 && !match; i++) {
      match = s.advance(1).pending.find((d) => d.kind === 'match');
      if (!match && s.pending.length) s.letHimDecide();
    }
    expect(match).toBeDefined();

    const reloaded = loadGame(JSON.parse(JSON.stringify(saveGame(s.ctx))), bundle);
    const back = reloaded.world.pendingDecisions.find((d) => d.id === match!.id);
    expect(back).toBeDefined();
    expect(JSON.stringify(back)).toBe(JSON.stringify(match));

    // And it is still answerable on the other side.
    const card = back!.kind === 'match' ? back!.cards.find((c) => c.available)! : undefined!;
    const before = reloaded.world.people.all().length;
    expect(takeCard(reloaded, back!.kind === 'match' ? back!.subject.id : '', card).ok).toBe(true);
    if (card.kind === 'outsider') {
      expect(reloaded.world.people.all().length).toBe(before + 1);
    }
  });

  /**
   * A save written before the line read existed still loads, as a hand nobody
   * had a word for — which is exactly what those cards were. A required field
   * here would strand every run in progress on the version that added it.
   */
  it('loads a save written before the cards carried a line', () => {
    const s = newGame(bundle, { seed: 1000, decider: 'ask' });
    let match;
    for (let i = 0; i < 60 && !match; i++) {
      match = s.advance(1).pending.find((d) => d.kind === 'match');
      if (!match && s.pending.length) s.letHimDecide();
    }
    expect(match).toBeDefined();

    const raw = JSON.parse(JSON.stringify(saveGame(s.ctx)));
    const old = raw.pendingDecisions.find((d: { id: string }) => d.id === match!.id);
    for (const c of old.cards) {
      delete c.line;
      delete c.lineSeen;
    }

    const back = loadGame(raw, bundle).world.pendingDecisions
      .find((d) => d.id === match!.id);
    expect(back?.kind).toBe('match');
    for (const c of back!.kind === 'match' ? back!.cards : []) {
      expect(c.line, 'an old card came back claiming a read it never had').toBe('unknown');
      expect(c.lineSeen).toBe(0);
    }
  });
});

describe('the phase', () => {
  it('does not pair someone whose hand is standing', () => {
    // The marriage phase runs on years divisible by three.
    const ctx = testWorld(bundle, 1000, 1044);
    expect(ctx.world.year % 3).toBe(0);
    const her = place(ctx, { sex: 'female', age: 19, name: 'Left Standing' });

    phase('marriage', ctx, false);
    const standing = ctx.world.pendingDecisions.find((d) => d.kind === 'match'
      && d.subject.id === her.id);
    expect(standing, 'no hand was dealt for her').toBeDefined();
    expect(her.marriages.length, 'she was married while her own hand was on the table').toBe(0);
  });
});


/**
 * THE LINE'S READ (issue #28) — the only honest thing a marriage market can
 * say about fertility.
 *
 * Fecundity is heritable and weighted seventy-thirty toward the mother, so a
 * hand of cards is a bet on how many children a couple will have. Until this
 * landed, that bet was one the player could only settle by burying people. The
 * card now carries a word about the line, and every assertion here is about
 * the same thing from a different side: the word is read off births the world
 * has already watched, and never off a genome.
 */

/**
 * A wife who lived through the whole childbearing window and bore `kids`.
 *
 * Her children are placed at forty and up, which puts them outside the
 * sixteen-year window `householdCandidates` deals from — so a line can be as
 * full as the test likes without quietly stuffing the deck with cousins.
 */
function wife(ctx: SimCtx, name: string, kids: number, house?: string) {
  const her = place(ctx, { sex: 'female', age: 60, name, ...(house ? { house } : {}) });
  marry(ctx, her, place(ctx, { sex: 'male', age: 62, name: `${name} Husband` }));
  for (let i = 0; i < kids; i++) {
    beget(ctx, place(ctx, { sex: 'female', age: 40 + i, name: `${name} Kid ${i}` }), her);
  }
  return her;
}

/**
 * Twelve wives of three children each, which is the mean everything else on
 * the hand is read against. A fresh 1042 world has no completed lives at all —
 * the founders are alive and none of them is fifty — so without this the
 * honest answer to every card is `unknown`.
 */
function baseline(ctx: SimCtx) {
  for (let i = 0; i < 12; i++) wife(ctx, `Baseline ${i}`, 3);
}

/** A subject, one eligible cousin, and a mother for him with `kids` children. */
function withLine(kids: number, motherAge = 60) {
  const ctx = testWorld(bundle, 77, 1042);
  baseline(ctx);
  const her = place(ctx, { sex: 'female', age: 19, name: 'The Subject' });
  const cousin = place(ctx, { sex: 'male', age: 21, name: 'The Cousin' });

  const mother = place(ctx, { sex: 'female', age: motherAge, name: 'His Mother' });
  marry(ctx, mother, place(ctx, { sex: 'male', age: motherAge + 2, name: 'His Father' }));
  for (let i = 1; i < kids; i++) {
    beget(ctx, place(ctx, { sex: 'female', age: 40 + i, name: `His Sister ${i}` }), mother);
  }
  beget(ctx, cousin, mother);

  const offer = dealMatch(ctx, her, testRng('line'));
  const card = offer.cards.find((c) => c.kind === 'household');
  expect(card, 'no cousin was dealt, so there is no line to read').toBeDefined();
  expect(card!.person, 'the cousin dealt was not the one this test built').toBe(cousin.id);
  return { ctx, her, cousin, mother, card: card! };
}

describe('the line', () => {
  it('says nothing about a line the house has never watched', () => {
    const ctx = testWorld(bundle, 4242, 1042);
    baseline(ctx);
    const her = place(ctx, { sex: 'female', age: 19, name: 'A Daughter' });

    const strangers = dealMatch(ctx, her, testRng('strangers')).cards
      .filter((c) => c.kind === 'outsider');
    expect(strangers.length, 'no stranger on the hand at all').toBeGreaterThan(0);
    for (const c of strangers) {
      expect(c.line, `${c.name} came off a farm with a reputation`).toBe('unknown');
      expect(c.lineSeen, 'a read was built on nobody').toBe(0);
    }
  });

  it('reads a full line off a mother who bore many, and a thin one off a mother who bore few', () => {
    expect(withLine(8).card.line, 'eight children read as nothing special').toBe('fertile');
    expect(withLine(3).card.line, 'the population mean read as remarkable').toBe('ordinary');
    expect(withLine(1).card.line, 'one child read as an ordinary line').toBe('thin');
  });

  /**
   * A mother of forty may yet bear four more. Counting her now would call
   * every line thin for as long as the woman it was read off is still young
   * enough to disprove it.
   */
  it('counts only the lives that finished', () => {
    const young = withLine(1, 40);
    expect(young.card.lineSeen, 'a woman still of childbearing age was counted').toBe(0);
    expect(young.card.line).toBe('unknown');
  });

  /** Said out loud on the card, because one life is a rumour and eight are evidence. */
  it('says how many lives the word rests on', () => {
    expect(withLine(8).card.lineSeen, 'her mother alone, and the card should admit it').toBe(1);

    // Give him two sisters who finished their own childbearing, and the read
    // is built on three women instead of one.
    const ctx = testWorld(bundle, 77, 1042);
    baseline(ctx);
    const her = place(ctx, { sex: 'female', age: 19, name: 'The Subject' });
    const cousin = place(ctx, { sex: 'male', age: 21, name: 'The Cousin' });
    const mother = wife(ctx, 'His Mother', 0);
    beget(ctx, cousin, mother);
    for (let i = 0; i < 2; i++) {
      const sister = wife(ctx, `His Sister ${i}`, 6);
      beget(ctx, sister, mother);
    }

    const card = dealMatch(ctx, her, testRng('line')).cards.find((c) => c.kind === 'household')!;
    expect(card.person).toBe(cousin.id);
    expect(card.lineSeen, 'his married, finished sisters were not read').toBe(3);
  });

  /**
   * The card reads the documents everywhere else — `kinship` is `matchF`, which
   * a forged pedigree moves exactly as far as the forgery says. The line is the
   * same claim about the same world, so a bought mother buys her reputation too.
   */
  it('reads the record and not the blood', () => {
    const { ctx, her, cousin, card } = withLine(1);
    expect(card.line, 'the honest read was not thin to begin with').toBe('thin');

    const bought = wife(ctx, 'A Bought Mother', 8);
    cousin.claimedParents = { mother: bought.id };

    const forged = dealMatch(ctx, her, testRng('line')).cards.find((c) => c.kind === 'household')!;
    expect(forged.person).toBe(cousin.id);
    expect(forged.line, 'the forgery moved the papers and not the market').toBe('fertile');
  });

  /** Dealing a hand reads the world. It must not write to it. */
  it('costs the world nothing to read', () => {
    const ctx = testWorld(bundle, 77, 1042);
    baseline(ctx);
    const her = place(ctx, { sex: 'female', age: 19, name: 'The Subject' });
    place(ctx, { sex: 'male', age: 21, name: 'The Cousin' });
    const before = JSON.stringify(ctx.world.people.all().map((p) => [p.id, p.claimedParents]));

    dealMatch(ctx, her, testRng('line'));
    expect(JSON.stringify(ctx.world.people.all().map((p) => [p.id, p.claimedParents])))
      .toBe(before);
  });
});

/**
 * THE DILEMMA. `match.ts` has always carried a comment saying "the treasury is
 * the reason the answer is not always take the best card". Measured across one
 * run it was not true: 362 of 480 cards were priced at 20 crowns, 108 at
 * nothing, and cousins — which §7 calls *the mechanism*, not a temptation —
 * were on 12% of cards. Every hand was a stat comparison with nothing at stake
 * on either side of it.
 */
describe('the hand is a decision, not a comparison', () => {
  const content = loadContent();

  it('offers the house its own blood before it offers a stranger', () => {
    // Built rather than simulated. A cousin who exists is a fact; how often
    // one exists across six hands of a live run is a sample, and a threshold
    // asserted on a sample reports the sample (`record.slow.test.ts`, three
    // times over).
    const ctx = testWorld(bundle, 909);
    const grandfather = place(ctx, { sex: 'male', age: 70, name: 'Old Edric' });
    const uncleA = place(ctx, { sex: 'male', age: 45, name: 'Uncle A' });
    const uncleB = place(ctx, { sex: 'male', age: 44, name: 'Uncle B' });
    beget(ctx, uncleA, undefined, grandfather);
    beget(ctx, uncleB, undefined, grandfather);

    const subject = place(ctx, { sex: 'male', age: 20, name: 'The Heir' });
    const cousin = place(ctx, { sex: 'female', age: 19, name: 'The Cousin' });
    beget(ctx, subject, undefined, uncleA);
    beget(ctx, cousin, undefined, uncleB);

    const offer = dealMatch(ctx, subject, makeRng(4));
    const names = offer.cards.map((c) => c.name);
    expect(names, `the hand was ${names.join(', ')}`).toContain('The Cousin');
    expect(offer.cards.find((c) => c.name === 'The Cousin')!.kinship).toBeGreaterThan(0);
  });

  it('leads with the closest blood when there is more than one cousin', () => {
    const ctx = testWorld(bundle, 910);
    const grandfather = place(ctx, { sex: 'male', age: 74, name: 'Old Edric' });
    const great = place(ctx, { sex: 'male', age: 76, name: 'Old Osric' });
    const father = place(ctx, { sex: 'male', age: 48, name: 'Father' });
    const uncle = place(ctx, { sex: 'male', age: 46, name: 'Uncle' });
    const distant = place(ctx, { sex: 'male', age: 47, name: 'Distant' });
    beget(ctx, father, undefined, grandfather);
    beget(ctx, uncle, undefined, grandfather);
    beget(ctx, distant, undefined, great);

    const subject = place(ctx, { sex: 'male', age: 21, name: 'The Heir' });
    const first = place(ctx, { sex: 'female', age: 20, name: 'First Cousin' });
    const far = place(ctx, { sex: 'female', age: 20, name: 'Far Cousin' });
    beget(ctx, subject, undefined, father);
    beget(ctx, first, undefined, uncle);
    beget(ctx, far, undefined, distant);

    const offer = dealMatch(ctx, subject, makeRng(5));
    const kin = offer.cards.filter((c) => c.kind === 'household');
    expect(kin.length).toBeGreaterThan(0);
    // §7: the path to godhood runs through the thing that produces Madness,
    // and the house should be able to see how far down that path a card is.
    expect(kin[0]!.name).toBe('First Cousin');
  });

  it('charges a rich house like a rich house', () => {
    const poor = bootstrap(content, 733);
    runYears(poor, 60);
    const rich = bootstrap(content, 733);
    runYears(rich, 60);
    rich.world.treasury = 40_000;

    const subject = matchSubjects(poor)[0] ?? matchSubjects(rich)[0];
    if (!subject) return;
    const cheap = dealMatch(poor, subject, makeRng(1));
    const dear = dealMatch(rich, rich.world.people.mustGet(subject.id), makeRng(1));

    const ask = (o: { cards: { dowry: number }[] }) =>
      Math.max(0, ...o.cards.map((c) => c.dowry));
    // A treasury of forty thousand crowns must not make the marriage question
    // go away, which is exactly what a flat 20-crown dowry did.
    expect(ask(dear)).toBeGreaterThan(ask(cheap));
  });

  it('says what a broker would say, on every card', () => {
    const ctx = bootstrap(content, 515);
    runYears(ctx, 90);
    const subject = matchSubjects(ctx)[0];
    if (!subject) return;
    const offer = dealMatch(ctx, subject, makeRng(7));
    for (const card of offer.cards) {
      // §7's vocabulary is "never explained in text, learned from use", which
      // requires it to be somewhere a player can read it. It was nowhere.
      expect(card.words, `${card.name} came with nothing said about her`).not.toBe('');
    }
  });

  it('never deals a hand with no way out of the family', () => {
    const ctx = bootstrap(content, 616);
    runYears(ctx, 150);
    for (const subject of matchSubjects(ctx)) {
      const offer = dealMatch(ctx, subject, makeRng(3));
      if (offer.cards.length < 2) continue;
      const kin = offer.cards.filter((c) => c.kind === 'household').length;
      expect(kin).toBeLessThan(offer.cards.length);
    }
  });
});
