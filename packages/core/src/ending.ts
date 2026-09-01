import type { EndingDef, EndingId, Rung } from '@ed/schema';
import { assertNever } from '@ed/schema';
import type { ChronicleEntry, SimCtx } from './world.js';
import { rungIndex, rungTitle, measureAscension } from './ascension.js';
import { prologueDef } from './prologue.js';

/**
 * THE LAST NIGHT (concept §23, issue #39).
 *
 * The run had no terminus. `stepYear` was a clock and nothing stopped it, and
 * grepping `core` for 2042 returned comments about balance. The five endings
 * — where the whole thousand years lands — were prose in a brief and zero
 * lines of code.
 *
 * ─── The creditor reads the chronicle, not the world ────────────────────────
 *
 * §6 is explicit and it is the entire thesis of the game: *"a house that
 * recorded everything faithfully arrives poor in Respect and rich in
 * knowledge; a house that embellished everything arrives exalted, revered, and
 * unable to prove a single thing it needs to prove."*
 *
 * So selection runs off `world.chronicle`. `readTheChronicle` is the only
 * thing that decides, and the one fact it takes from outside the book is
 * whether anybody is sitting at the table to be read to — which is not a fact
 * about the house's achievements, it is a fact about the room.
 *
 * That distinction is testable, and `ending.test.ts` tests it: strip the page
 * that attests a rung and the ending changes, with `world.ascension` untouched.
 * A selector reading `world.ascension.best` would have built the systems game
 * and deleted the story one, and nothing would have said so.
 *
 * ─── Three of the five cannot fire yet ──────────────────────────────────────
 *
 * The rites are not built (#43) and no measured run reaches God (#41). They
 * are written anyway: an ending that cannot fire yet is a target for those
 * issues, and an ending nobody wrote is not. #42 grades the distribution once
 * they exist.
 */

/** The term. A thousand years, to the day (concept §3). */
export const END_YEAR = 2042;

/**
 * The flag the God rite sets when it fails at the last step, and the seam
 * #43's rites write to. It is a world flag rather than a field because the
 * rites are authored content: the effect vocabulary can already set one, and
 * an ending that content can reach is an ending content can be written toward.
 */
export const GOD_RITE_FAILED = 'god_rite_failed';

/**
 * WHAT THE CREDITOR HAS IN FRONT OF IT.
 *
 * Everything here except `atTheTable` comes off the chronicle. `attested` in
 * particular is the highest rung the BOOK names — not the highest the house
 * reached — and the two are the same only for a house that wrote everything
 * down and kept it.
 */
export interface Reckoning {
  /** Pages with something written on them. */
  pages: number;
  /** Dated blank lines. The blank is the artefact, and it is read too. */
  blanks: number;
  recorded: number;
  embellished: number;
  /** Embellishments somebody proved. A proven lie costs a tier and a reputation. */
  provenLies: number;
  /** Embellishments still standing on the last night. */
  standingLies: number;
  clauses: number;
  clausesTotal: number;
  /** The highest rung any surviving page attests. */
  attested: Rung;
  /** The same, in the words §22 uses for it — a client keeps no rung table of its own. */
  attestedTitle: string;
  /** The year the book first attested it, where it does. */
  attestedYear?: number;
  /**
   * HOW MANY OF THE BLOOD ARE STILL LIVING. Not a claim — a fact about the
   * family, and the one thing the book cannot say, because the house is not
   * there to have written it.
   *
   * This counted the HOUSEHOLD, and the household is not the line: it holds
   * retainers, wives married in, wards and servants, and the recurring cast is
   * re-minted for a thousand years whatever happens to the family. Measured
   * over sixty runs, the household's low-water mark was 9 in the worst run and
   * 10 at the median — a floor, not a distribution — so `broken_line` was
   * gated on an empty BUILDING and the ending named for a line ending could
   * not fire while anybody's cook was alive.
   *
   * The guardian is deliberately not counted. Daveed does not die (invariant
   * 3) and is of the blood, so counting him makes the family immortal by
   * construction; and §23's own sentence for this ending is *"the creditor
   * read the chronicle alone"*, which is a room with a ghost in it.
   */
  atTheTable: number;
  /** Who sits at the head of it, if anybody does. */
  head?: { name: string; rung: Rung };
}

/**
 * A page counts as evidence if it is still legible on the last night: written,
 * and not greyed out as a thing known to have existed and gone.
 */
function attests(entry: ChronicleEntry): boolean {
  return entry.text !== null && !entry.greyed;
}

export function readTheChronicle(ctx: SimCtx): Reckoning {
  const w = ctx.world;

  let pages = 0;
  let blanks = 0;
  let recorded = 0;
  let embellished = 0;
  let attested: Rung = 'none';
  let attestedYear: number | undefined;

  for (const entry of w.chronicle) {
    if (entry.text === null) blanks += 1;
    else pages += 1;
    if (entry.record === 'record') recorded += 1;
    if (entry.record === 'embellish') embellished += 1;

    if (entry.rung && attests(entry) && rungIndex(entry.rung) > rungIndex(attested)) {
      attested = entry.rung;
      attestedYear = entry.year;
    }
  }

  let provenLies = 0;
  let standingLies = 0;
  for (const d of w.discrepancies.values()) {
    if (d.state === 'proven') provenLies += 1;
    else if (d.state === 'open') standingLies += 1;
  }

  const household = w.people.household(w.playerHouse, w.year);
  // Of the BLOOD, and actually alive: a guardian is not at the table.
  const livingBlood = w.people.blood(w.playerHouse).filter((p) => p.status === 'alive');
  const foremost = measureAscension(ctx).foremost;
  const head = household.find((p) => p.castSlots.includes('head'));

  const reckoning: Reckoning = {
    pages,
    blanks,
    recorded,
    embellished,
    provenLies,
    standingLies,
    clauses: w.clausesRecovered.size,
    clausesTotal: ctx.content.clauses.length,
    attested,
    attestedTitle: rungTitle(attested),
    atTheTable: livingBlood.length,
  };
  if (attestedYear !== undefined) reckoning.attestedYear = attestedYear;
  // Whoever is in the chair, described by the rung the BOOK grants the house
  // — the creditor is not appraising him, it is reading about him.
  if (head) reckoning.head = { name: head.name, rung: attested };
  else if (foremost) reckoning.head = { name: foremost.name, rung: attested };
  return reckoning;
}

/**
 * WHICH OF THE FIVE.
 *
 * A closed union and no permissive default anywhere near it. A fall-through in
 * the condition evaluator once made an event fire unconditionally for a
 * thousand years; a fall-through here would pick the same ending forever, and
 * it would look exactly like a game with one ending — which is why the render
 * side (`epilogueOf`) ends in `assertNever` and this side is total by
 * construction: every rung on the ladder lands somewhere.
 */
export function selectEnding(ctx: SimCtx): EndingId {
  const r = readTheChronicle(ctx);

  // Nobody is left to be read to. This is the one thing the book cannot say,
  // because the house is not there to have written it.
  if (r.atTheTable === 0) return 'broken_line';

  // The rite went as far as the last step and stopped. Set by content (#43).
  if (ctx.world.flags.get(GOD_RITE_FAILED)) return 'unmade';

  if (r.attested === 'god') return 'apotheosis';

  // Strong enough to be interesting to it, and not strong enough to refuse.
  // Demigod belongs here too: a house that got that far and did not close the
  // Ledger is precisely the house §23 describes.
  if (rungIndex(r.attested) >= rungIndex('hierophant')) return 'devoured';

  // Survival as anticlimax. The creditor arrives, reads, and does not collect.
  return 'forgotten';
}

/**
 * End the run. Once — 2042 happens to a house a single time, and a save taken
 * afterwards loads into a house it has already happened to.
 */
export function closeTheLedger(ctx: SimCtx): EndingId {
  const w = ctx.world;
  if (w.ending) return w.ending.id;

  const id = selectEnding(ctx);
  w.ending = { id, year: w.year };

  // The last page, written after the reading, by whoever was left to write it.
  // It is deliberately not evidence: selection has already happened, and a
  // chronicle that wrote its own ending into the record the ending was chosen
  // from would be the one circular thing in the game.
  w.chronicle.push({
    year: w.year,
    weight: 'illuminated',
    title: 'The Term',
    text: 'The book was read, from the first page to the last, and the blanks were read too.',
    named: true,
  });
  return id;
}

/**
 * THE RING (concept §23). The prologue's triad, restated, with exactly one
 * element replaced — same cadence, same three parts, one substitution. The
 * `ending/ring` rule fails the build on two.
 */
export interface RingBeat {
  given: string;
  owed: string;
  /** Which half this ending replaced, where it replaced one. */
  changed?: 'given' | 'owed';
}

export interface EpilogueView {
  id: EndingId;
  title: string;
  opening: string;
  ring: RingBeat[];
  /** The prologue's own last line, so the closing has something to reach back to. */
  thesis: string;
  /** Short, plain, and the last thing on screen. */
  closing: string;
  /** What happened, in one sentence, for the one line on the page that is not myth. */
  summary: string;
  reckoning: Reckoning;
  /**
   * What was read out. Every blank, every embellishment, and every illuminated
   * page — which is to say the holes, the lies, and the things the house
   * thought were worth a whole page. In the order they happened.
   */
  read: ChronicleEntry[];
  /** What the house was called, and what it asked for in 1042. */
  founding?: { houseName: string; heirloom: string; heirloomName: string; grudge: string; grudgeName: string };
  year: number;
}

/** How much of the book the last night quotes back. */
export const EPILOGUE_PAGES = 30;

export function endingDef(ctx: SimCtx, id: EndingId): EndingDef | undefined {
  return ctx.content.ending(id);
}

/**
 * The closing text, assembled from the chronicle the player wrote.
 *
 * Undefined until the run has ended — an epilogue for a house still living in
 * 1400 is a spoiler with a bug in it.
 */
export function epilogueOf(ctx: SimCtx): EpilogueView | undefined {
  const w = ctx.world;
  if (!w.ending) return undefined;

  const def = endingDef(ctx, w.ending.id);
  const prologue = prologueDef(ctx);
  if (!def || !prologue) return undefined;

  const ring: RingBeat[] = prologue.triad.map((beat, i) => {
    if (i + 1 !== def.ring.beat) return { given: beat.given, owed: beat.owed };
    if (def.ring.given !== undefined) return { given: def.ring.given, owed: beat.owed, changed: 'given' };
    if (def.ring.owed !== undefined) return { given: beat.given, owed: def.ring.owed, changed: 'owed' };
    return { given: beat.given, owed: beat.owed };
  });

  const read = w.chronicle
    .filter((e) => e.text === null || e.record === 'embellish' || e.weight === 'illuminated')
    .slice(-EPILOGUE_PAGES);

  const view: EpilogueView = {
    id: w.ending.id,
    title: def.title,
    opening: def.opening,
    ring,
    thesis: prologue.thesis,
    closing: def.closing,
    summary: endingSummary(w.ending.id, readTheChronicle(ctx)),
    reckoning: readTheChronicle(ctx),
    read,
    year: w.ending.year,
  };

  if (w.founding) {
    view.founding = {
      houseName: w.founding.houseName,
      heirloom: w.founding.heirloom,
      heirloomName: ctx.content.heirloom(w.founding.heirloom)?.name ?? w.founding.heirloom,
      grudge: w.founding.grudge,
      grudgeName: ctx.content.house(w.founding.grudge)?.name ?? w.founding.grudge,
    };
  }
  return view;
}

/**
 * One line naming what the ending is, for a client that wants to say it
 * plainly somewhere the elevated register would be wrong.
 *
 * INVARIANT 5: a closed union, ending in `assertNever`. This is the site the
 * compiler will point at the day a sixth ending is declared, which is the
 * whole reason it is written as a switch rather than as a lookup table.
 */
export function endingSummary(id: EndingId, r: Reckoning): string {
  switch (id) {
    case 'apotheosis':
      return `A god was made, and the book can show it: ${rungTitle(r.attested)}, on the page.`;
    case 'unmade':
      return 'The rite failed at the last step, and what was in the blood went out of it.';
    case 'broken_line':
      return 'Nobody was at the table. The creditor read the chronicle alone.';
    case 'forgotten':
      return `The house survived to the term and never passed ${rungTitle('adept')}. `
        + 'The creditor arrived, read, and did not collect.';
    case 'devoured':
      return `The book attests ${rungTitle(r.attested)}, which was enough to be worth the `
        + 'journey and not enough to argue with.';
    default:
      return assertNever(id);
  }
}
