import type { Content, ContentBundle, FrameEntry, RespectTier, SavedGame, TaleForm } from '@ed/schema';
import { MAIN_BRANCH } from '@ed/schema';
import type { SimCtx, ChronicleEntry } from './world.js';
import { bootstrap, clearNamingQueue, renameChild } from './sim.js';
import { stepYear } from './year/step.js';
import type { YearReport } from './year/report.js';
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
    for (let i = 0; i < years; i++) {
      if (this.ctx.world.pendingDecisions.length) {
        return { years: out, stoppedBy: 'decision', pending: this.pending };
      }
      out.push(stepYear(this.ctx, this.decider === 'chronicler'));
    }
    return { years: out, pending: this.pending };
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
  house: string;
  treasury: number;
  respect: RespectTier;
  discontent: number;
  clausesRecovered: number;
  clausesTotal: number;
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
  assize: {
    pressure: number;
    arm: 'resents' | 'steadies' | 'indifferent';
    favour: boolean;
    mercy: boolean;
    exaction: boolean;
  };
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
  head: boolean;
  awakened: boolean;
  /** Only ever nonzero where the person can express. See invariant 1. */
  madness: number;
  contract?: string;
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

  const hallViews: HallView[] = [];
  for (const [id, members] of halls(w, w.year)) {
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
        const m: MemberView = {
          id: p.id,
          name: p.name,
          sex: p.sex,
          age: w.year - p.born,
          head: p.castSlots.includes('head'),
          awakened: p.awakening.awakened,
          madness: p.madness,
          attrs: realAttrs,
          record: {
            // The claimed value where the record has spoken; the real one
            // otherwise, so a UI can always draw `record.attrs` for the
            // headline view and never has to fall back itself.
            attrs: { ...realAttrs, ...Object.fromEntries(view.attrs) },
            claimedTraits: [...view.claimedTraits],
            claimedDeath: view.claimedDeath,
          },
          drift: view.divergence.size > 0,
        };
        if (p.epithet !== undefined) m.epithet = p.epithet;
        if (p.contract) m.contract = p.contract.role;
        return m;
      }),
    });
  }

  const view: SessionView = {
    year: w.year,
    generation: w.generation,
    house: w.playerHouse,
    treasury: Math.round(w.treasury),
    respect: w.respect,
    discontent: Math.round(w.discontent),
    clausesRecovered: w.clausesRecovered.size,
    clausesTotal: ctx.content.clauses.length,
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
