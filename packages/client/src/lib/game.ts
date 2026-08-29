import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue';
import type { Content, ContentBundle, FrameEntry } from '@ed/schema';
import {
  END_YEAR, newGame, resumeGame,
  type EpilogueView, type FoundingChoice, type FoundingResult, type GameSession,
  type MatchResolution, type OrderResult, type PendingDecision, type PrologueView,
  type RecordOption, type SessionView, type SlotFill, type TableOrder, type TableView,
} from '@ed/core';

/**
 * THE CLIENT'S ONLY DOOR INTO THE SIMULATION.
 *
 * Every call to `GameSession` in this package happens in this file, and no
 * component may import from `@ed/core` for anything but a type. That is not
 * tidiness: `session.ctx` is reachable — the editor needs it for previews —
 * and a component that reaches through it would be reading live simulation
 * state that changes under the render, which is what the editor's version
 * counter exists to work around. A client has no such problem and must not
 * grow one.
 *
 * So the flow is one-way. A verb is called, the world moves, and the whole
 * read model is taken again as plain values (`view()` is values only, by
 * contract). Vue's reactivity sees a new object and re-renders; nothing here
 * has to be told what changed, and nothing holds a reference into the world.
 *
 * If something the UI needs cannot be got here, the missing thing is a verb on
 * `session.ts` — not a peek at `.ctx`.
 */

/**
 * The year the other party comes to collect (concept §3), re-exported rather
 * than restated: `core` owns the term, `stepYear` closes the ledger on it, and
 * a client with its own 2042 in it is a second opinion about the one date the
 * whole game is pointed at.
 *
 * It is only how far the clock offers to run. `view.ending` is what says the
 * run is over.
 */
export { END_YEAR as COLLECTION_YEAR } from '@ed/core';

/** Where a run is kept between page loads. Not a save menu — see `keep`. */
const AUTOSAVE = 'ed:run';

export interface GameStore {
  /** The whole read model, retaken after every verb. Null before the run begins. */
  view: Ref<SessionView | null>;
  /** What the house can be told to do, and what it would cost. Null before the run begins. */
  table: Ref<TableView | null>;
  /** What is standing on the docket, waiting to be answered. */
  docket: ComputedRef<PendingDecision[]>;
  /** The signing (concept §3). Null before a run begins. */
  prologue: Ref<PrologueView | null>;
  /**
   * Whether the player has walked out of the prologue and into the run.
   *
   * Separate from `prologue.founded` because the last thing the prologue does
   * is not a choice: it states the thesis of the whole game on one plain line
   * and holds it there. A screen that vanished the instant the house was named
   * would put that line under a family tree, which is where it does nothing.
   */
  openingSeen: Ref<boolean>;
  /** The last night (concept §23). Null until the run has reached the term. */
  epilogue: Ref<EpilogueView | null>;
  /** The interlude to hold on screen, if the last step produced one. */
  interlude: Ref<FrameEntry | null>;
  /** Every interlude the run has shown, newest first. The frame as a record. */
  frame: ComputedRef<FrameEntry[]>;
  /** True once the ledger has closed — which is the engine's word, not the calendar's. */
  ended: ComputedRef<boolean>;
  /** The last order the table refused, and its reason. Cleared by the next one. */
  refused: Ref<string | null>;
  /** A run kept from a previous page load is waiting to be resumed. */
  resumable: Ref<boolean>;
  actions: GameActions;
}

/**
 * WHAT THE UI CAN DO, ENUMERABLE AT RUNTIME.
 *
 * One entry per verb the player has, named after the verb it carries.
 * `verbs.test.ts` walks this object and the templates: an action nothing in a
 * `.vue` file calls is a verb the player cannot reach, which is exactly how
 * `send` would have sat unwired for months while every `party` decider in the
 * content quietly resolved through `letHimDecide`.
 */
export interface GameActions {
  begin(seed: number): void;
  /** Answer the prologue: the house's name, and its two choices. */
  found(choice: FoundingChoice): FoundingResult;
  /** Leave the prologue. The thesis has been read; the years start now. */
  enter(): void;
  resume(): boolean;
  restart(): void;
  advance(years: number): void;
  choose(decision: string, choiceId: string, cast?: SlotFill): void;
  send(decision: string, cast?: SlotFill): void;
  match(decision: string, cardId: string): MatchResolution | undefined;
  declineHand(decision: string): void;
  record(decision: string, option: RecordOption): void;
  letHimDecide(): void;
  order(o: TableOrder): OrderResult;
  name(person: string, name: string): boolean;
  keepSuggestedNames(): void;
  dismissInterlude(): void;
}

export function createGame(source: ContentBundle | Content): GameStore {
  // `shallowRef`, because a `GameSession` owns the whole mutable world and
  // making that deeply reactive would have Vue walk every person in the house
  // on every year. Nothing renders off this object — everything renders off
  // the values `refresh` takes from it.
  const session = shallowRef<GameSession | null>(null);
  const view = ref<SessionView | null>(null);
  const table = ref<TableView | null>(null);
  const prologue = ref<PrologueView | null>(null);
  const openingSeen = ref(false);
  const epilogue = ref<EpilogueView | null>(null);
  const interlude = ref<FrameEntry | null>(null);
  const refused = ref<string | null>(null);
  const resumable = ref(kept() !== null);

  /** How much frame the player has already been shown. */
  let seenFrame = 0;

  const docket = computed(() => view.value?.docket ?? []);
  const frame = computed(() => [...(view.value?.frame ?? [])].reverse());
  // What the ENGINE says, not what the calendar says. The run ends when the
  // ledger closes, and the ledger closing is what produces an epilogue to
  // show — a client deciding for itself that 2042 means over would be a second
  // opinion about the one thing the whole game is pointed at.
  const ended = computed(() => view.value?.ending !== undefined);

  /**
   * Take the picture again. Called after every verb, and it is the only thing
   * that writes to `view` and `table` — a component that mutated either would
   * be editing a photograph.
   */
  function refresh(): void {
    const g = session.value;
    if (!g) return;
    view.value = g.view();
    table.value = g.table();
    prologue.value = g.prologue() ?? null;
    epilogue.value = g.epilogue() ?? null;
    keep(g);
  }

  function start(g: GameSession): void {
    session.value = g;
    // A resumed run does not replay its own prologue.
    openingSeen.value = g.prologue()?.founded !== undefined;
    seenFrame = g.view().frame.length;
    interlude.value = null;
    refused.value = null;
    refresh();
  }

  const actions: GameActions = {
    begin(seed) {
      start(newGame(source, { seed, startYear: 1042 }));
    },

    enter() {
      openingSeen.value = true;
    },

    found(choice) {
      const result = session.value?.found(choice) ?? { ok: false, reason: 'no run' };
      refused.value = result.ok ? null : result.reason ?? 'he did not';
      refresh();
      return result;
    },

    /** Pick a run back up after a reload. Not a menu: one run, kept in the tab. */
    resume() {
      const save = kept();
      if (!save) return false;
      try {
        start(resumeGame(save, source));
        return true;
      } catch {
        // A save written by an older format, or a content file edited out from
        // under it. Losing the run is the honest outcome; hiding the button is
        // worse than a button that says the run could not be read.
        forget();
        resumable.value = false;
        return false;
      }
    },

    restart() {
      session.value = null;
      view.value = null;
      table.value = null;
      prologue.value = null;
      epilogue.value = null;
      openingSeen.value = false;
      interlude.value = null;
      forget();
      resumable.value = false;
    },

    /**
     * Turn the clock. Stops of its own accord at three things: a decision on
     * the docket, a child waiting to be named, and 2042.
     *
     * The naming queue stopping the clock is a choice, not a rule of the
     * engine — `stepYear` does not care. Naming is one of the few things the
     * player does to a person rather than to a bloodline, and it should be
     * able to interrupt a century.
     */
    advance(years) {
      const g = session.value;
      if (!g) return;
      for (let i = 0; i < years; i++) {
        if (g.view().ending) break;
        if (g.pending.length || g.view().namesWanted.length) break;
        g.advance(1);
      }

      // ARRIVING AT THE TERM IS NOT THE SAME AS BEING READ. `stepYear` closes
      // the ledger on the step it is asked to take AFTER 2042 has arrived, so
      // a run that lands exactly on the year — which every run does, since the
      // clock stops there — would sit unended until the player pressed a
      // button that visibly does nothing. One more turn of the handle, here,
      // where the client is already deciding what a press of "on" means.
      if (!g.view().ending && g.view().year >= END_YEAR && !g.pending.length) {
        g.advance(1);
      }

      refresh();
      showInterlude();
    },

    choose(decision, choiceId, cast = {}) {
      session.value?.choose(decision, choiceId, cast);
      refresh();
    },

    send(decision, cast = {}) {
      session.value?.send(decision, cast);
      refresh();
    },

    match(decision, cardId) {
      const result = session.value?.match(decision, cardId);
      refresh();
      return result;
    },

    declineHand(decision) {
      session.value?.declineHand(decision);
      refresh();
    },

    record(decision, option) {
      session.value?.record(decision, option);
      refresh();
    },

    letHimDecide() {
      session.value?.letHimDecide();
      refresh();
    },

    order(o) {
      const result = session.value?.order(o) ?? { ok: false, reason: 'no run' };
      refused.value = result.ok ? null : result.reason ?? 'the house will not';
      refresh();
      return result;
    },

    name(person, newName) {
      const ok = session.value?.name(person, newName) ?? false;
      refresh();
      return ok;
    },

    keepSuggestedNames() {
      session.value?.keepSuggestedNames();
      refresh();
    },

    dismissInterlude() {
      interlude.value = null;
    },
  };

  /**
   * THE FRAME IS QUIETER THAN THE TALE (concept §24).
   *
   * One interlude is held on screen with the family out of the way; the rest
   * of what a long jump produced goes to the ledger, where the frame is
   * legible as a layer rather than as a moment. A player who pressed "on" has
   * asked not to be interrupted twenty times.
   */
  function showInterlude(): void {
    const entries = view.value?.frame ?? [];
    if (entries.length > seenFrame) interlude.value = entries[entries.length - 1] ?? null;
    seenFrame = entries.length;
  }

  /**
   * Keep the run in the tab, so a reload during a long sitting is not the end
   * of it. This is NOT the save layer: the shell owns the disk, has owned it
   * since the shell shipped, and a Save/Load menu needs a client to be a menu
   * in. This is one slot, in `sessionStorage`, that nobody has to think about.
   *
   * It shrugs at a full quota. A run that cannot be kept is still a run.
   */
  function keep(g: GameSession): void {
    try {
      window.sessionStorage.setItem(AUTOSAVE, JSON.stringify(g.save()));
      resumable.value = true;
    } catch {
      resumable.value = false;
    }
  }

  return {
    view, table, prologue, openingSeen, epilogue, docket, interlude, frame, ended, refused,
    resumable, actions,
  };
}

/**
 * Every touch of storage is wrapped, and not only for a full quota: a private
 * window throws on the accessor itself, and so does a browser set to block
 * site data. A run that cannot be kept is still a run.
 */
function forget(): void {
  try {
    window.sessionStorage.removeItem(AUTOSAVE);
  } catch {
    // Nothing to do about it, and nothing worth saying.
  }
}

function kept(): unknown {
  try {
    const text = window.sessionStorage.getItem(AUTOSAVE);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
