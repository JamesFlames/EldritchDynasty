import type {
  Content, ContentBundle, EndingId, FrameEntry, Person, PersonStatus, Register, RespectTier,
  SavedGame, TaleForm,
} from '@ed/schema';
import { MAIN_BRANCH } from '@ed/schema';
import type { SimCtx, ChronicleEntry } from './world.js';
import { bootstrap, clearNamingQueue, renameChild } from './sim.js';
import { stepYear } from './year/step.js';
import type { YearReport } from './year/report.js';
import { passageOf, type Passage } from './year/passage.js';
import {
  autoResolveAll, declineMatch, resolveChoice, resolveMatch, resolveRecord,
  type ChoiceResolution, type MatchResolution, type PendingDecision, type RecordOption,
} from './events/decisions.js';
import type { SlotFill } from './events/slots.js';
import { branchOf, halls } from './people/branches.js';
import { phenotypeOf } from './people/factory.js';
import { visibleRecordView } from './record.js';
import { loadGame, saveGame } from './save.js';
import { assizeFavour } from './assize.js';
import { order, tableView, type OrderResult, type TableOrder, type TableView } from './table.js';
import { measureAscension, rungTitle } from './ascension.js';
import { castOf, type CastMember } from './cast.js';
import { foundHouse, prologueView, type FoundingChoice, type FoundingResult, type PrologueView } from './prologue.js';
import { epilogueOf, type EpilogueView } from './ending.js';
import { streamFor } from './rng.js';

/**
 * THE SESSION: everything a client is supposed to need, and nothing else.
 *
 * `SimCtx` is the whole simulation — a person store, a content index, a locus
 * table, and forty exported functions that expect to be called in a particular
 * order. That is the right shape for the engine and the wrong shape for anything
 * outside it. The editor reached straight into `ctx.world`, kept its own
 * reactivity counter to notice mutations, and picked its own RNG seed for
 * resolving a choice; the game client does not exist yet, and whoever writes it
 * would have had to learn all of that first.
 *
 * A session is the seam. Six verbs, one read model, and a save:
 *
 *   advance      turn years, stopping the moment something needs an answer
 *   choose       answer a choice, casting anyone the event asked the player for
 *   send         name the party for a decision the party itself decides
 *   match        take one of the cards a marriage was dealt, or decline the hand
 *   record       Record / Omit / Embellish
 *   letHimDecide hand the pen back to the chronicler
 *   order        a standing order at the table: study, tutor, career, bid, withhold
 *   table        what the house can be told to do, and what it would cost
 *   name         name a newborn of the house
 *   found        answer the prologue: the house's name, and its two choices
 *   prologue     the signing, as plain values
 *   epilogue     the last night, once there has been one
 *   view         a plain, serialisable picture of the run right now
 *
 * The engine underneath is reachable as `.ctx` on purpose — the editor needs it
 * for previews, and a sealed façade would only get bypassed. But nothing in a
 * client should need it, and if something does, that is a missing verb here.
 */

export interface SessionOptions {
  seed?: number;
  startYear?: number;
  /**
   * `ask` parks choices on the docket and stops the clock — the game.
   * `chronicler` answers them in the same code path — the harness, and what a
   * player pressing "to 2042" is asking for.
   */
  decider?: 'ask' | 'chronicler';
}

export interface AdvanceResult {
  years: YearReport[];
  /**
   * THE SAME YEARS, AS VALUES (issue #49).
   *
   * `years` carries live `Person` objects out of the world — fine for `core`,
   * which owns them, and unusable by a client, which must hold nothing that
   * changes under the render. So the account is folded down here as well, and
   * a client reads this and never `years`.
   *
   * Quiet years are absent rather than empty. See `passageOf`.
   */
  passages: Passage[];
  /** Why it stopped short, if it did. */
  stoppedBy?: 'decision';
  pending: PendingDecision[];
}

export class GameSession {
  decider: 'ask' | 'chronicler';

  constructor(readonly ctx: SimCtx, decider: 'ask' | 'chronicler' = 'ask') {
    this.decider = decider;
  }

  get year(): number {
    return this.ctx.world.year;
  }

  /**
   * Turn up to `years` years. Stops early — and says so — the moment the docket
   * is not empty, because the clock is already stopped at that point and
   * spinning the loop would only produce blocked reports.
   */
  advance(years = 1): AdvanceResult {
    const out: YearReport[] = [];
    const said: Passage[] = [];
    for (let i = 0; i < years; i++) {
      if (this.ctx.world.pendingDecisions.length) {
        return { years: out, passages: said, stoppedBy: 'decision', pending: this.pending };
      }
      const report = stepYear(this.ctx, this.decider === 'chronicler');
      out.push(report);
      // Folded HERE, while the report's people are the people it means. A
      // caller that kept the report and mapped it later would be reading a
      // person who has since aged, married and in one case stopped being one.
      const passage = passageOf(this.ctx, report);
      if (passage) said.push(passage);
    }
    return { years: out, passages: said, pending: this.pending };
  }

  get pending(): PendingDecision[] {
    return [...this.ctx.world.pendingDecisions];
  }

  /**
   * Answer a choice. The stream is derived from the decision's own id, so the
   * outcome a player gets does not depend on how long they took to answer, how
   * many times the client re-rendered, or what the editor previewed in between.
   */
  choose(decision: string, choiceId: string, cast: SlotFill = {}): ChoiceResolution {
    return resolveChoice(
      this.ctx,
      decision,
      choiceId,
      streamFor(this.ctx.world, 'decision', decision),
      cast,
    );
  }

  /**
   * Name the party and let what they are between them decide the rest — the
   * answer to a decision whose `choicesAreOpen` is false (`schema/src/decider.ts`,
   * the `party` kind). The player's decision was who goes; the branch follows
   * from the people he sent, through a `Check` pooled over exactly them.
   *
   * Same stream, same commit path, same everything as `choose`. The only
   * difference is which half of the answer the client supplies.
   */
  send(decision: string, cast: SlotFill = {}): ChoiceResolution {
    return resolveChoice(
      this.ctx,
      decision,
      undefined,
      streamFor(this.ctx.world, 'decision', decision),
      cast,
    );
  }

  /**
   * Take a card (concept §5, step 2). No stream: which card is on the table
   * was decided when the hand was dealt, and taking one has no roll in it —
   * the suitor a card promises is the suitor who arrives.
   */
  match(decision: string, cardId: string): MatchResolution {
    return resolveMatch(this.ctx, decision, cardId);
  }

  /** Take none of them. A real answer — the house waits for a better year. */
  declineHand(decision: string): boolean {
    return declineMatch(this.ctx, decision);
  }

  record(decision: string, option: RecordOption): boolean {
    return resolveRecord(this.ctx, decision, option);
  }

  /** Hand the pen back. Answers everything standing, through the same commit path. */
  letHimDecide(): void {
    autoResolveAll(this.ctx, streamFor(this.ctx.world, 'chronicler'));
  }

  /**
   * THE TABLE (`table.ts`) — the first verbs on this surface the player uses on
   * a turn of their own choosing rather than in answer to a prompt.
   *
   * Everything else here answers the docket. The auction, the careers and the
   * library ticked without ever asking, which deleted §13's headline tension
   * ("tutor the child you have, or buy the book his grandchildren might read;
   * you can afford one") by having the simulation quietly decide both.
   */
  order(o: TableOrder): OrderResult {
    return order(this.ctx, o);
  }

  /** What the house can currently be told to do, and what it would cost. */
  table(): TableView {
    return tableView(this.ctx);
  }

  name(personId: string, name: string): boolean {
    return renameChild(this.ctx, personId, name);
  }

  /** Accept the chronicler's names for everyone waiting. Ignoring the offer is a valid way to play. */
  keepSuggestedNames(): void {
    clearNamingQueue(this.ctx);
  }

  view(): SessionView {
    return viewOf(this.ctx);
  }

  /**
   * THE SIGNING (concept §3, issue #38), as plain values. Undefined for a
   * bundle with no prologue in it.
   *
   * A client shows this once, before the first year, and never again;
   * `founded` on the view says which of those two it is.
   */
  prologue(): PrologueView | undefined {
    return prologueView(this.ctx);
  }

  /**
   * Answer it: name the house, choose the thing the man asked for, and choose
   * who the house stepped on to be where it is. Refused, with a reason, for a
   * choice the prologue never offered — the ending names what was chosen, and
   * an ending naming something the prologue never said is a ring with a hole
   * in it.
   */
  found(choice: FoundingChoice): FoundingResult {
    return foundHouse(this.ctx, choice);
  }

  /**
   * THE LAST NIGHT (concept §23, issue #39). Undefined until the run has
   * reached the term — an epilogue for a house still living in 1400 is a
   * spoiler with a bug in it.
   */
  epilogue(): EpilogueView | undefined {
    return epilogueOf(this.ctx);
  }

  save(): SavedGame {
    return saveGame(this.ctx);
  }
}

export function newGame(source: ContentBundle | Content, opts: SessionOptions = {}): GameSession {
  const ctx = bootstrap(source, opts.seed ?? 1042, opts.startYear ?? 1042);
  return new GameSession(ctx, opts.decider ?? 'ask');
}

export function resumeGame(
  save: unknown,
  source: ContentBundle | Content,
  opts: SessionOptions = {},
): GameSession {
  return new GameSession(loadGame(save, source), opts.decider ?? 'ask');
}

// ── The read model ────────────────────────────────────────────────────────

/**
 * A picture of the run, in plain data.
 *
 * Everything here is a number, a string, or an array of them — no `Map`, no
 * `Set`, no live reference into the world. That is what makes it safe to hand
 * to a template, diff between years, send over IPC, or snapshot in a test. A UI
 * built on live references has to be told when to re-read; a UI built on values
 * only has to be given a new one.
 */
export interface SessionView {
  year: number;
  generation: number;
  /** The house's id — what content and saves refer to it by. */
  house: string;
  /** What it is CALLED. A client drawing `house` puts `house_gearithy` on the screen. */
  houseName: string;
  /**
   * WHAT THE CONTENT CALLS THINGS. Attributes and traits arrive everywhere
   * else on this view as ids — `max_age`, `the_tutors_aphorisms` — because
   * that is what saves and claims refer to them by, and a client that printed
   * an id would be showing the player the inside of the database.
   *
   * They are here rather than in a client's own table because both lists are
   * open: an attribute is six loci and a row in `attributes.yaml` (invariant
   * 10), and a client holding a copy of either would keep working, correctly,
   * and quietly stop mentioning the twentieth.
   */
  attributes: { attr: string; name: string }[];
  traits: { trait: string; name: string }[];
  treasury: number;
  respect: RespectTier;
  discontent: number;
  clausesRecovered: number;
  clausesTotal: number;
  /**
   * WHAT IS HAPPENING TO THE WORLD (concept §20). One entry per Age currently
   * running.
   *
   * `name` is WITHHELD until the chronicle names it — `schema/src/age.ts`,
   * rule one: the family lives through the years first and gets a word for
   * them afterwards, and a client handed the name on the first day would
   * print "The Plague" over a year the house only knows as a bad one. It is
   * withheld HERE rather than asked of the client, for the same reason a
   * tale's `accuracy` is: a value on the view is a value somebody draws.
   *
   * `register` is not withheld. It is the mood of the years, which the family
   * can feel from inside them, and it is what the editor's drone reads.
   */
  ages: { age: string; began: number; register: Register; name?: string }[];
  halls: HallView[];
  chronicle: ChronicleEntry[];
  /** The frame (concept §2, issue #13) — separate from `chronicle` on purpose. See `world.frame`. */
  frame: FrameEntry[];
  docket: PendingDecision[];
  namesWanted: { person: string; suggested: string; sex: string; born: number }[];
  /**
   * What the house no longer holds alone (`people/secrets.ts`). A client needs
   * this: a secret that is out is the one piece of the record the player can
   * neither write nor omit, and the year it is `told` it becomes something a
   * named house can prove.
   */
  looseSecrets: {
    secret: string;
    carrier: string;
    house: string;
    houseName: string;
    since: number;
    told?: number;
  }[];
  /**
   * WHAT ELSE IS BEING SAID (issue #14). The tales in circulation this year —
   * a rival house's chronicle, a ballad, a Church doctrine, a rhyme children
   * have. `world.tales` has been born, circulated, mutated and SAVED since
   * issue #14 shipped, and no client could see a word of it: `chronicle`,
   * `frame` and `looseSecrets` all surfaced and this did not, so `teller` and
   * `bias` — "required, not optional colour" per `schema/tale.ts` — reached
   * nobody.
   *
   * Only tales that have actually started circulating appear. A tale whose
   * event has fired but whose `circulatesFrom` year has not arrived is not yet
   * something anyone has heard.
   *
   * `accuracy` is DELIBERATELY not here. It is the authored answer to "how
   * much of this is true", and the game does not adjudicate between two
   * contradicting accounts in its own voice (AGENTS.md, "Do not") — there is
   * no narrator who knows, only Daveed, and he is not neutral. A client handed
   * `accuracy` could sort the accounts by truth, which is the one reading this
   * layer exists to refuse. The player gets the teller and the bias and weighs
   * them, exactly as they would a person.
   *
   * `claims` is not here either, for a duller reason: a `TaleDef`'s claims are
   * authored against a slot `Target` and are only meaningful once resolved
   * against the cast the tale's event fired with, which circulation state does
   * not carry. Resolving them is a real piece of work, not a field to copy.
   */
  tales: CirculatingTale[];
  /**
   * WHAT THE HOUSE HAS PLEDGED THAT IT DOES NOT YET HAVE (issue #17, #40).
   *
   * An unborn granddaughter promised at auction to acquire a book for an
   * affinity nobody in the family has, on the theory that the blood will come.
   * It has circulated and saved since the auction shipped and reached no
   * client at all — which is this repository's most-repeated failure, recorded
   * four separate times in `docs/BALANCE-LOG.md`.
   *
   * `lot` is what she was promised FOR, named rather than referenced: a
   * promise a client cannot explain is a line of bookkeeping.
   */
  marriagePromises: {
    house: string;
    houseName: string;
    year: number;
    lot: string;
    lotName: string;
  }[];
  guardian?: { id: string; name: string; since?: number };
  /**
   * HOW THE WORLD READS THE HOUSE (`assize.ts`). `pressure` runs from -1 (the
   * world can see you are failing, and is steadying you) to 1 (the world can
   * see you are ahead, and is charging you for it). `standing` is the arm
   * currently in force, and the three flags are whatever temporary mercy or
   * exaction is running this year.
   *
   * A client draws this. The whole design of the Assize is that it is EXPLICIT
   * — a hidden rubber band is a lie the player can feel and cannot name — so a
   * reading the client cannot show is the same system with its point removed.
   */
  /**
   * WHERE THE HOUSE STANDS ON THE LADDER (`ascension.ts`, concept §22).
   * `rung` falls when the man holding it dies; `best` never does. `blocked` is
   * the one thing most obviously in the way of the next rung, in words — a
   * client puts it under the rung, and it is the whole answer to "am I
   * winning?", which the player had no way to ask.
   */
  ascension: {
    rung: string;
    best: string;
    title: string;
    foremost?: { person: string; name: string; blocked?: string; power: number; spells: number };
  };
  /**
   * WHO THIS GENERATION IS ABOUT (`cast.ts`, issue #44). Five to seven people
   * out of seventy, each with the one fact that is true of them and of nobody
   * else in the house.
   *
   * It is on the view rather than behind a verb because it is a reading and
   * not an action, and it is derived on every read because it is a reading of
   * a household that changes every spring (invariant 6).
   */
  cast: CastMember[];
  assize: {
    pressure: number;
    arm: 'resents' | 'steadies' | 'indifferent';
    favour: boolean;
    mercy: boolean;
    exaction: boolean;
  };
  /**
   * THE TERM, once it has arrived (issue #39). Present only after 2042, which
   * is also the only condition under which `epilogue()` answers — a client
   * reads this to know the run is over and that one is waiting.
   */
  ending?: { id: EndingId; year: number };
}

export interface CirculatingTale {
  id: string;
  form: TaleForm;
  /** Always named. Never neutral. See `schema/tale.ts`. */
  teller: string;
  /** What the teller wants the listener to believe. */
  bias: string;
  text: string;
  /** The event this is an account of. Two accounts sharing this contradict each other. */
  about: string;
  /** The year it began circulating. */
  since: number;
  /** How far the telling has drifted since: one per `mutatesEveryYears` window. */
  mutations: number;
}

export interface HallView {
  id: string;
  name: string;
  grievance: number;
  isSeat: boolean;
  members: MemberView[];
}

export interface MemberView {
  id: string;
  name: string;
  epithet?: string;
  sex: string;
  age: number;
  /**
   * Almost always `alive`, and the exception is the whole reason it is here:
   * §22's Vessel is CONSUMED, and *"the tree shows them greyed, with a mark
   * that is not the mark for death"*. The dead leave the halls — they are in
   * the chronicle, which is where a family keeps its dead — and this one
   * person does not, because the rite left something on the tree that the
   * house has to keep looking at.
   */
  status: PersonStatus;
  head: boolean;
  awakened: boolean;
  /** Only ever nonzero where the person can express. See invariant 1. */
  madness: number;
  contract?: string;
  /**
   * WHO THEY WERE REALLY BORN TO, and who they are married to now. A tree is a
   * tree because of these — the halls used to arrive as three flat lists of
   * people with nothing joining them, so a client could draw a roster and
   * nothing else. Ids only; every parent still living is elsewhere in this
   * view, and a spouse who married in carries their name because a wife of
   * another house is not in any hall of ours.
   *
   * Real parentage sits out here beside the real `attrs`, and the CLAIMED
   * line sits inside `record` beside the claimed ones. Same split, same
   * reason: the tree draws the record and the hover shows the person.
   */
  parents: { mother?: string; father?: string };
  spouse?: { id: string; name: string };
  /** The REAL attributes. What hovering over a drifted sigil is meant to show (issue #19). */
  attrs: Record<string, number>;
  /**
   * What the chronicle SAYS — `RecordView`, derived fresh, folded down to the
   * one shape a UI actually draws. This is the primary reading: "the tree
   * draws the recorded person; hover shows the real one" (issue #19). Falls
   * back to the real attrs/traits/death for anyone the record has never
   * spoken about, so a UI can always draw `record` and never `attrs` for the
   * headline view.
   */
  record: {
    attrs: Record<string, number>;
    claimedTraits: string[];
    claimedDeath?: { year: number; cause: string };
    /**
     * The line the documents give them. A forged dowry moves this and not
     * `parents`, and `pedigreeF` is calculated off exactly this — so a tree
     * drawn from the record is the tree the family believes it has.
     */
    parents: { mother?: string; father?: string };
    /**
     * WHICH OF `attrs` THE RECORD HAS ACTUALLY SPOKEN ABOUT. The rest of that
     * map is the real value, filled in so a UI can always draw `record.attrs`
     * and never has to fall back itself — which is convenient and, drawn
     * unfiltered, a lie the other way: it would print a woman's Fecundity on
     * her card, and "nobody in the world has a number for it"
     * (`attributes.yaml`) is the whole reason the marriage market reads a LINE
     * instead. A client showing only what the family can honestly claim reads
     * this first.
     */
    claimed: string[];
  };
  /** Non-empty divergence — sigil drift. See `Sigil.vue`'s `drift` prop. */
  drift: boolean;
}

/** How much of the chronicle a view carries. The whole book is a separate read. */
export const VIEW_CHRONICLE_LINES = 60;

/**
 * The tales the world can currently hear, as values.
 *
 * Ordered by the year each began circulating, then by id — a view is a
 * picture, and a picture that reshuffles between two reads of an unchanged
 * world is a UI that jumps for no reason. Map iteration order would have given
 * insertion order, which is the order the events happened to fire in.
 */
function circulatingTales(ctx: SimCtx): CirculatingTale[] {
  const out: CirculatingTale[] = [];
  for (const [id, state] of ctx.world.tales) {
    if (!state.circulating) continue;
    // Content edited out from under a save — the same guard `tickTales` uses.
    const def = ctx.content.tale(id);
    if (!def) continue;
    out.push({
      id,
      form: def.form,
      teller: def.teller,
      bias: def.bias,
      text: def.text,
      about: def.about,
      since: state.circulatesFrom,
      mutations: state.mutations,
    });
  }
  out.sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

export function viewOf(ctx: SimCtx, chronicleLines = VIEW_CHRONICLE_LINES): SessionView {
  const w = ctx.world;
  const guardian = w.people.guardian();

  // A sign-reader anywhere in the house helps read the whole house's record
  // (issue #19) — reveal_signs is a household presence effect, the same
  // scope every other trait of its kind uses.
  const wholeHousehold = w.people.household(w.playerHouse, w.year);

  /**
   * THE ONE PERSON WHO DOES NOT LEAVE THE HALL (§22, issue #43).
   *
   * `halls` is the SIMULATION's grouping and it is the living household —
   * crowding, casting and succession all read it, and a consumed woman must
   * not be marriageable. So the tree's copy of a hall is the living one plus
   * anybody the rite took out of it, and `status` is how a client tells them
   * apart. Nowhere else in the game does a person stay on the tree after they
   * stop being in the house, which is the point of the mark.
   */
  const consumedByHall = new Map<string, Person[]>();
  for (const p of w.people.all()) {
    if (p.status !== 'vessel_consumed') continue;
    const key = branchOf(w, p, p.died ?? w.year);
    consumedByHall.set(key, [...(consumedByHall.get(key) ?? []), p]);
  }

  const hallViews: HallView[] = [];
  for (const [id, living] of halls(w, w.year)) {
    const members = [...living, ...(consumedByHall.get(id) ?? [])];
    const branch = w.branches.get(id);
    hallViews.push({
      id,
      name: branch?.name ?? 'the main hall',
      grievance: branch?.grievance ?? 0,
      isSeat: id === MAIN_BRANCH,
      members: members.map((p) => {
        const ph = phenotypeOf(p, ctx.genetics, w.year);
        const realAttrs = Object.fromEntries(ph.attrs);
        const view = visibleRecordView(ctx, p.id, wholeHousehold);
        // The marriage still open, if there is one. A widow whose husband
        // died is not married to him any more — `PersonStore.kill` closes the
        // record on both sides — so `to === undefined` is the whole test.
        const wed = p.marriages.find((x) => x.to === undefined);
        const spouse = wed ? w.people.get(wed.spouse) : undefined;
        const m: MemberView = {
          id: p.id,
          name: p.name,
          sex: p.sex,
          age: (p.died ?? w.year) - p.born,
          status: p.status,
          head: p.castSlots.includes('head'),
          awakened: p.awakening.awakened,
          madness: p.madness,
          attrs: realAttrs,
          parents: { ...p.trueParents },
          record: {
            // The claimed value where the record has spoken; the real one
            // otherwise, so a UI can always draw `record.attrs` for the
            // headline view and never has to fall back itself.
            attrs: { ...realAttrs, ...Object.fromEntries(view.attrs) },
            claimedTraits: [...view.claimedTraits],
            claimedDeath: view.claimedDeath,
            parents: { ...p.claimedParents },
            claimed: [...view.attrs.keys()],
          },
          drift: view.divergence.size > 0,
        };
        if (p.epithet !== undefined) m.epithet = p.epithet;
        if (p.contract) m.contract = p.contract.role;
        if (spouse) m.spouse = { id: spouse.id, name: spouse.name };
        return m;
      }),
    });
  }

  const view: SessionView = {
    year: w.year,
    generation: w.generation,
    house: w.playerHouse,
    // What the PLAYER called it, where there was a player to call it anything.
    // `houses.yaml` is what the world calls the house; `founding` is what the
    // family does, and the family's name for itself is the one on the page.
    houseName: w.founding?.houseName ?? w.houses.get(w.playerHouse)?.name ?? w.playerHouse,
    attributes: ctx.content.attributes.map((a) => ({ attr: String(a.id), name: a.name })),
    traits: ctx.content.traits.map((t) => ({ trait: String(t.id), name: t.name })),
    treasury: Math.round(w.treasury),
    respect: w.respect,
    discontent: Math.round(w.discontent),
    clausesRecovered: w.clausesRecovered.size,
    clausesTotal: ctx.content.clauses.length,
    ages: w.age.active.flatMap((a) => {
      const def = ctx.content.age(a.age);
      if (!def) return [];
      return [{
        age: a.age,
        began: a.began,
        register: def.register,
        ...(a.named ? { name: def.name } : {}),
      }];
    }),
    halls: hallViews,
    chronicle: w.chronicle.slice(-chronicleLines),
    // COPIED, like every other array on this object. This one line handed the
    // caller `world.frame.entries` itself, so a view taken before the clock
    // moved grew a new interlude when it moved — `session.test.ts` calls that
    // "the old view changed when the world did", and it stayed invisible for
    // as long as a sixty-year window rarely contained an interlude. More frame
    // content made it visible; it was always wrong.
    frame: [...w.frame.entries],
    docket: [...w.pendingDecisions],
    namesWanted: w.pendingNames.map((n) => ({
      person: n.person, suggested: n.suggested, sex: n.sex, born: n.born,
    })),
    tales: circulatingTales(ctx),
    marriagePromises: w.marriagePromises.map((p) => ({
      house: p.toHouse,
      houseName: w.houses.get(p.toHouse)?.name ?? p.toHouse,
      year: p.year,
      lot: p.lot,
      // A lot is a spellbook, an heirloom, or a page of somebody's chronicle.
      // Whichever it is, the family knows what it gave a daughter for.
      lotName: ctx.content.spellbook(p.lot)?.name
        ?? ctx.content.heirloom(p.lot)?.name
        ?? p.lot,
    })),
    ascension: {
      rung: w.ascension.rung,
      best: w.ascension.best,
      title: rungTitle(w.ascension.rung),
      ...(() => {
        const f = measureAscension(ctx).foremost;
        return f
          ? {
            foremost: {
              person: f.person,
              name: f.name,
              ...(f.standing.blocked !== undefined ? { blocked: f.standing.blocked } : {}),
              power: f.standing.power,
              spells: f.standing.spells,
            },
          }
          : {};
      })(),
    },
    cast: castOf(ctx),
    assize: {
      pressure: Math.round(w.assize.pressure * 100) / 100,
      arm: w.assize.pressure > 0.35 ? 'resents' : w.assize.pressure < -0.35 ? 'steadies' : 'indifferent',
      favour: assizeFavour(ctx, 'favour'),
      mercy: assizeFavour(ctx, 'mercy'),
      exaction: assizeFavour(ctx, 'exaction'),
    },
    looseSecrets: w.looseSecrets.map((l) => ({
      secret: l.secret,
      carrier: l.carrierName,
      house: l.house,
      houseName: w.houses.get(l.house)?.name ?? l.house,
      since: l.since,
      ...(l.told !== undefined ? { told: l.told } : {}),
    })),
  };

  if (w.ending) view.ending = { ...w.ending };

  if (guardian) {
    view.guardian = {
      id: guardian.id,
      name: guardian.name,
      ...(w.guardianSince !== undefined ? { since: w.guardianSince } : {}),
    };
  }
  return view;
}

/** Which hall a person is in this year. Exposed because a client will ask. */
export function hallOf(ctx: SimCtx, personId: string): string | undefined {
  const p = ctx.world.people.get(personId);
  return p ? branchOf(ctx.world, p, ctx.world.year) : undefined;
}
