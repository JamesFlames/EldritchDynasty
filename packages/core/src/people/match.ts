import type { CharacterTemplate, Person, Sex, Year } from '@ed/schema';
import { ageAt, MAIN_BRANCH } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { hashSeed, makeRng, type Rng } from '../rng.js';
import { DEBT_FLOOR } from '../economy.js';
import { matchF } from '../record.js';
import { CHILDBEARING, eligibleToMarry, wed } from './demography.js';
import { eligibleTemplates, mintRecipe, rollRecipe, type MintRecipe } from './minting.js';

/**
 * THE MATCH — draft one partner from three cards.
 *
 * Step 2 of the core loop, and one of the three things the player actually
 * does. `autoMarry` said so in its own header for a year: "PLACEHOLDER
 * PAIRING. The shipped game replaces this entirely with the suitor draft —
 * draw one of three cards, each with blood, politics, a dowry and one secret
 * revealed later." This is that draft. `autoMarry` survives underneath it and
 * still pairs everyone the player is not asked about — the cadet halls, the
 * retainers, the married-in — because a game that asked the Head to arrange
 * every wedding in four hundred people's lives would be a spreadsheet.
 *
 * WHO IS DRAFTED FOR: blood of the main hall. Those are the marriages that
 * decide what the house is — a daughter of the seat married outward costs the
 * family her font and her children both, which is exactly the decision the
 * genetics was built to make expensive. A cousin in a cadet hall marrying
 * another cousin is a fact about the world; the seat's marriages are the game.
 *
 * WHAT IS ON A CARD: what the world can see. Her house, her age, what the
 * market says about her, the kinship the DOCUMENTS claim (`matchF`, which a
 * forged pedigree moves exactly as far as the forgery says it should), and
 * what she costs. Never the genome. The card cannot tell you what she carries
 * because nobody in 1042 can tell you what she carries, and the whole
 * marriage market exists because of that. It does carry a word about her
 * LINE — see `LineRead` — which is the one thing a market can honestly say
 * about fertility without counting anybody's eggs.
 *
 * WHY A CARD IS NOT A PERSON. Two of the three are declined, and a declined
 * suitor must not become a woman living somewhere else with a lazy genome and
 * a claim on the frequency ration. So a card holds a `MintRecipe` — everyone
 * she would be — and `mintRecipe` spawns her only if she is taken. The house
 * remembers the names it heard (`rollRecipe` reserves them), and nothing else
 * of a declined card reaches the world.
 */

export interface MatchCard {
  id: string;
  /** Someone already alive, or a recipe for someone who would arrive. */
  kind: 'household' | 'outsider';
  name: string;
  sex: Sex;
  age: number;
  house: string;
  houseName: string;
  /** The market's line on her. A template blurb, or what the house is to itself. */
  blurb: string;
  /** Crowns, paid on acceptance. Nothing leaves the house for a cousin. */
  dowry: number;
  /**
   * F of the child this match would have, from the CLAIMED pedigree — the
   * number the family's own documents would compute, and therefore the number
   * a forgery can move. 0.0625 is first cousins.
   */
  kinship: number;
  /**
   * The market's word on her line's fertility, read off her mother and her
   * sisters. See `LineRead`. Never her genome.
   */
  line: LineRead;
  /**
   * How many completed lives that word rests on. Zero is `unknown`; one is her
   * mother and nothing else, which the player should be told before he bets a
   * daughter on it.
   */
  lineSeen: number;
  /** Set for `household`. */
  person?: string;
  /** Set for `outsider`. Exactly who arrives if this card is taken. */
  recipe?: MintRecipe;
  available: boolean;
  blockedBy?: string;
}

/** A hand of cards, and who they are for. */
export interface MatchOffer {
  subject: { id: string; name: string; sex: Sex; age: number };
  cards: MatchCard[];
}

export const CARDS_DEALT = 3;

/**
 * What a house pays for blood it did not have. Rationed the same way the
 * person is: a Rare suitor is not merely a better roll, she is a better roll
 * the house has to find two hundred crowns for, and the treasury is the reason
 * the answer is not always "take the best card".
 */
const DOWRY: Record<string, number> = {
  common: 20,
  uncommon: 50,
  rare: 120,
  mythic: 200,
};

/**
 * THE LINE'S READ (issue #28) — what a marriage market can honestly say
 * about fertility.
 *
 * Fecundity is a heritable Core attribute weighted seventy-thirty toward the
 * mother, which makes every match a bet on how many children a couple will
 * have as well as on what those children will be. A player who cannot observe
 * that is not making the bet; he is being charged for it. But the card must
 * not print the number the genetics knows, because nobody in 1042 can count a
 * woman's eggs and the marriage market exists precisely because they cannot.
 *
 * What a market CAN do — what every real one did — is watch her mother and her
 * sisters and say a word about the line. So the read is built only out of
 * births the world has already seen, and only out of women who lived through
 * the whole childbearing window: a completed life is the only kind anybody can
 * count. It is measured against the population's own mean rather than a
 * constant, for the reason `expectedAttribute` is: the locus table is content,
 * and a hardcoded centre stops being true the first time anyone edits it.
 *
 * It reads the RECORD, not the blood — a woman is her documents' daughter
 * here, exactly as she is for `kinship`. A forged pedigree that moves a girl
 * into a fuller line moves what the market says about her too, and the house
 * that paid for the forgery is the last house entitled to complain.
 *
 * `unknown` is the honest answer and a common one. A woman off a farm has no
 * line anyone at this table has watched, and the card says so rather than
 * guessing — which is itself the information that a stranger is a stranger.
 */
export type LineRead = 'fertile' | 'ordinary' | 'thin' | 'unknown';

/**
 * How far off the measured mean a line sits before the market has a word for
 * it. Wide on purpose: two or three completed lives is a small sample, and a
 * card that called every second line thin would be noise wearing a label.
 */
const FULL_LINE = 1.25;
const THIN_LINE = 0.75;

/** Everyone the world has ever held, counted once for the whole hand. */
interface LineCensus {
  /** Claimed mother -> the children the record credits to her. */
  borne: Map<string, Person[]>;
  /** Wives whose childbearing is over. The only lives the market may count. */
  counted: Set<string>;
  /** Those same wives, by the house they were born into. */
  byHouse: Map<string, Person[]>;
  /** Children per counted wife, across the whole world. The centre. */
  mean: number;
}

/**
 * A wife who lived through the whole window, and is therefore evidence.
 *
 * Three exclusions, each of which would otherwise poison a two-person sample.
 * A girl dead at three did not fail to bear children. A woman of thirty has
 * not finished. A woman who never married was never asked.
 */
function counts(year: Year, p: Person): boolean {
  return p.sex === 'female'
    && p.marriages.length > 0
    && ageAt(p, year) >= CHILDBEARING.to;
}

/**
 * One pass over the archive, for the whole hand.
 *
 * The dead are the point rather than an inconvenience — they are where almost
 * all of the evidence is — so this walks `all()` and not `living()`.
 */
function lineCensus(ctx: SimCtx): LineCensus {
  const w = ctx.world;
  const borne = new Map<string, Person[]>();
  const counted = new Set<string>();
  const byHouse = new Map<string, Person[]>();
  const all = w.people.all();

  for (const p of all) {
    const mother = p.claimedParents.mother;
    if (!mother) continue;
    const kids = borne.get(mother);
    if (kids) kids.push(p);
    else borne.set(mother, [p]);
  }

  let total = 0;
  for (const p of all) {
    if (!counts(w.year, p)) continue;
    counted.add(p.id);
    total += borne.get(p.id)?.length ?? 0;
    const house = byHouse.get(p.houseOfOrigin);
    if (house) house.push(p);
    else byHouse.set(p.houseOfOrigin, [p]);
  }

  return { borne, counted, byHouse, mean: counted.size ? total / counted.size : 0 };
}

/**
 * The women a card's line is read off.
 *
 * For someone already alive it is her mother and her mother's other daughters,
 * which is the whole of what #28 said was honestly readable. The candidate
 * herself is never in it — she has borne nothing yet, and counting her would
 * read every young bride in the world as barren.
 *
 * For a recipe there is no mother to read, because two of these three people
 * do not exist. What there is instead is her house: the women of it the world
 * HAS watched, most of them daughters it married out to this one. A rival
 * house's daughter is a different proposition from a woman off a farm, and
 * this is the line on the card where that stops being flavour.
 */
function lineWomen(ctx: SimCtx, card: MatchCard, cen: LineCensus): Person[] {
  const w = ctx.world;
  if (card.kind !== 'household') return cen.byHouse.get(card.house) ?? [];

  const who = w.people.get(card.person ?? '');
  const mother = who && w.people.get(who.claimedParents.mother ?? '');
  if (!who || !mother) return [];

  const sisters = (cen.borne.get(mother.id) ?? [])
    .filter((p) => p.id !== who.id && p.sex === 'female');
  return [mother, ...sisters];
}

/** Read the line onto the card. Mutates, the way `priceIn` does. */
function readLine(ctx: SimCtx, card: MatchCard, cen: LineCensus): void {
  const women = lineWomen(ctx, card, cen).filter((p) => cen.counted.has(p.id));
  card.lineSeen = women.length;
  card.line = 'unknown';
  if (!women.length || cen.mean <= 0) return;

  const borne = women.reduce((n, p) => n + (cen.borne.get(p.id)?.length ?? 0), 0);
  const avg = borne / women.length;
  if (avg >= cen.mean * FULL_LINE) card.line = 'fertile';
  else if (avg <= cen.mean * THIN_LINE) card.line = 'thin';
  else card.line = 'ordinary';
}

/**
 * The marriages the player is asked about: blood of the main hall, of age,
 * unspoken for. Everyone else is `autoMarry`'s business.
 */
export function matchSubjects(ctx: SimCtx): Person[] {
  const w = ctx.world;
  return w.people
    .household(w.playerHouse, w.year)
    .filter((p) => eligibleToMarry(ctx, p))
    .filter((p) => p.membership.some((m) =>
      m.house === w.playerHouse && m.kind === 'blood'
      && (m.branch ?? MAIN_BRANCH) === MAIN_BRANCH
      && m.from <= w.year && (m.to === undefined || m.to > w.year)));
}

/**
 * Cousins first, then anyone else already alive and near enough to be sent
 * for. The house's own people are preferred deliberately: a card that says
 * "already at this table" is the concentrating play, and it should be on the
 * table whenever there is anyone to put there. A stranger who happens to be
 * the right age is what you get when there is not.
 */
function householdCandidates(ctx: SimCtx, subject: Person): Person[] {
  const w = ctx.world;
  const eligible = w.people.living().filter((q) => {
    if (q.id === subject.id || q.sex === subject.sex) return false;
    if (!eligibleToMarry(ctx, q)) return false;
    if (Math.abs(q.born - subject.born) >= 16) return false;
    // Siblings and the direct line. `autoMarry` only ever excluded a shared
    // mother, which leaves a fifteen-year-old mother marriageable to her own
    // son inside the age window. Cousins are the mechanism; this is not.
    if (sharesAParent(q, subject)) return false;
    if (isParentOf(ctx, q, subject) || isParentOf(ctx, subject, q)) return false;
    return true;
  });

  const ours = eligible.filter((q) => w.people.householdOf(q.id, w.year) === w.playerHouse);
  return ours.length ? ours : eligible;
}

function sharesAParent(a: Person, b: Person): boolean {
  const m = a.trueParents.mother && a.trueParents.mother === b.trueParents.mother;
  const f = a.trueParents.father && a.trueParents.father === b.trueParents.father;
  return Boolean(m || f);
}

function isParentOf(ctx: SimCtx, parent: Person, child: Person): boolean {
  return child.trueParents.mother === parent.id || child.trueParents.father === parent.id;
}

/**
 * Deal a hand for one subject.
 *
 * One card from the house's own halls where there is anyone to offer, the rest
 * minted from the market. That ratio IS the design: concentrating the blood is
 * a card the player can take rather than something the pairing code did on his
 * behalf, and marrying outward is the default the way it is in the world.
 */
export function dealMatch(ctx: SimCtx, subject: Person, rng: Rng): MatchOffer {
  const w = ctx.world;
  const cards: MatchCard[] = [];

  const kin = householdCandidates(ctx, subject);
  if (kin.length) {
    const who = rng.pick(kin);
    if (who) cards.push(householdCard(ctx, subject, who, cards.length));
  }

  // A daughter of the house is offered grooms — men who take the name. A son is
  // offered suitors. `autoMarry` has always drawn this way, and the asymmetry is
  // the matrilineal marriage the design says a house of women would invent.
  const role = subject.sex === 'male' ? 'suitor' : 'groom';
  const pool = eligibleTemplates(ctx, role).filter((t) => !t.castSlots.includes('the_match'));
  while (cards.length < CARDS_DEALT && pool.length) {
    const template = rng.weighted(pool, (t) => t.weight / 100);
    if (!template) break;
    // Drawn WITHOUT replacement. A hand of three identical recipes is three
    // copies of one card wearing different names, and the player would be
    // choosing between them on nothing at all. The market offers what it has;
    // when it has only one kind, the hand is short rather than padded.
    pool.splice(pool.indexOf(template), 1);
    cards.push(outsiderCard(ctx, template, rng, cards.length));
  }

  // One census for the hand, not one per card. Both passes mutate the cards
  // in place: what a card says and what a card costs are read off the world
  // after the deck is dealt, never rolled into it.
  const cen = lineCensus(ctx);
  for (const c of cards) {
    readLine(ctx, c, cen);
    priceIn(ctx, c);
  }

  return {
    subject: {
      id: subject.id,
      name: subject.name,
      sex: subject.sex,
      age: w.year - subject.born,
    },
    cards,
  };
}

function householdCard(ctx: SimCtx, subject: Person, who: Person, index: number): MatchCard {
  const w = ctx.world;
  const house = w.houses.get(who.houseOfOrigin);
  const hall = w.people.householdOf(who.id, w.year);
  return {
    id: `card_${index + 1}`,
    kind: 'household',
    name: who.name,
    sex: who.sex,
    age: w.year - who.born,
    house: who.houseOfOrigin,
    houseName: house?.name ?? who.houseOfOrigin,
    blurb: hall === w.playerHouse
      ? 'Already at this table, already fed by this house. Nothing leaves with her, '
        + 'and nothing new comes in.'
      : 'Known to the house, and near enough to be sent for.',
    dowry: 0,
    kinship: matchF(ctx, subject.id, who.id),
    line: 'unknown',
    lineSeen: 0,
    person: who.id,
    available: true,
  };
}

function outsiderCard(ctx: SimCtx, template: CharacterTemplate, rng: Rng, index: number): MatchCard {
  const w = ctx.world;
  const recipe = rollRecipe(template, ctx, rng);
  const house = w.houses.get(recipe.house);
  return {
    id: `card_${index + 1}`,
    kind: 'outsider',
    name: recipe.name,
    sex: recipe.sex,
    age: recipe.age,
    house: recipe.house,
    houseName: house?.name ?? recipe.house,
    blurb: template.blurb ?? template.title,
    dowry: DOWRY[template.frequency] ?? DOWRY.common!,
    // An outsider's claimed pedigree may still meet the family's somewhere —
    // which is what makes a rival house's daughter a different proposition
    // from a woman off a farm, on paper at least.
    kinship: 0,
    line: 'unknown',
    lineSeen: 0,
    recipe,
    available: true,
  };
}

/** A card the house cannot pay for is still dealt. Being unable to afford it is information. */
function priceIn(ctx: SimCtx, card: MatchCard): void {
  const ceiling = ctx.world.treasury - DEBT_FLOOR;
  if (card.dowry > ceiling) {
    card.available = false;
    card.blockedBy = `the house cannot raise ${card.dowry} crowns`;
  }
}

export interface MatchResult {
  ok: boolean;
  reason?: string;
  spouse?: Person;
}

/**
 * Take the terms. The one place a card becomes a marriage.
 *
 * Everything about the pairing itself — who moves household, which hall, and
 * the Head never being the one who moves — belongs to `wed`, which `autoMarry`
 * uses too. There is one set of marriage rules in this codebase, and the draft
 * decides who marries whom rather than what marrying means.
 */
export function takeCard(ctx: SimCtx, subjectId: string, card: MatchCard): MatchResult {
  const w = ctx.world;
  const subject = w.people.get(subjectId);
  if (!subject) return { ok: false, reason: 'the subject is gone' };
  if (!eligibleToMarry(ctx, subject)) return { ok: false, reason: `${subject.name} cannot marry` };
  if (!card.available) return { ok: false, reason: card.blockedBy ?? 'that card is closed' };

  let spouse: Person | undefined;

  if (card.kind === 'household') {
    spouse = w.people.get(card.person ?? '');
    // Years can pass between a card being dealt and a card being taken only if
    // the docket is ignored, which it cannot be — but a candidate can still
    // have died in the same year's earlier phases, and a dead bride is not an
    // error, it is a card that closed.
    if (!spouse || !eligibleToMarry(ctx, spouse)) {
      return { ok: false, reason: 'that match is no longer possible' };
    }
  } else {
    if (!card.recipe) return { ok: false, reason: 'the card promises nobody' };
    const template = ctx.content.characterTemplates.find((t) => t.id === card.recipe!.template);
    if (!template) return { ok: false, reason: 'that recipe is no longer in the content' };
    const household = w.people.householdOf(subject.id, w.year) ?? w.playerHouse;
    spouse = mintRecipe(card.recipe, template, ctx, { household, membership: 'married_in' });
  }

  if (card.dowry) w.treasury -= card.dowry;
  wed(ctx, subject, spouse);
  return { ok: true, spouse };
}

/**
 * THE CHRONICLER'S HAND — and he is a steward before he is a matchmaker.
 *
 * Deterministic, derived from the decision's own id, so "let him decide"
 * answers the same way however long the player looked at the cards first.
 *
 * Cost is weighted rather than ignored, and that is not flavour. The first
 * cut picked uniformly among the open cards, which spent something on nearly
 * every marriage of the seat — one every four or five years for a thousand
 * years — and three of the harness's seeds finished pinned to the debt floor
 * with a house they could no longer staff. An auto-player who bankrupts the
 * house is not a neutral baseline; it is a worse player than any human would
 * be, and every balance number measured against it inherits that.
 *
 * So: what the house can comfortably afford is taken freely, what would hurt
 * is taken sometimes, and what it can barely reach is a long shot. A rich
 * house still buys deep blood. A poor one marries the cousin.
 */
export function autoTakeCard(
  cards: MatchCard[],
  seed: string,
  year: Year,
  treasury = 0,
): MatchCard | undefined {
  const open = cards.filter((c) => c.available);
  const rng = makeRng(hashSeed('the-match', seed, year));
  const affordable = Math.max(0, treasury);
  const weight = (c: MatchCard): number => {
    // The house's own instinct, and a deliberate continuity: the pairing this
    // replaced took someone already in the world whenever there was anyone,
    // so a chronicler who now preferred strangers would move every balance
    // number in the harness while looking like a neutral change. It is also
    // simply what this family is for.
    const kin = c.kind === 'household' ? 2 : 1;
    if (c.dowry <= 0) return kin;
    if (c.dowry <= affordable * 0.1) return kin;
    if (c.dowry <= affordable * 0.3) return kin * 0.4;
    return kin * 0.08;
  };
  return rng.weighted(open.length ? open : cards, weight);
}
