import type { EventTier, Purpose } from '@ed/schema';

/**
 * MARGINALIA — the icon set.
 *
 * These are icons, and they are deliberately not an icon set. A scribe working
 * on vellum had no glyph for "settings"; he had a pointing hand for *attend to
 * this*, a pilcrow for *a new thing begins here*, an obelus for *strike this*,
 * and an asteriskos for *this line is not warranted*. Three of those are still
 * in Unicode nine hundred years later because they were good.
 *
 * So the rule for adding one: draw the mark the house would actually have put
 * in the margin, not the mark a toolbar would. If the thing you want a mark
 * for has no counterpart in a room with a candle in it, it probably wants a
 * word instead — this codebase has a lot of words and they are good ones.
 *
 * Geometry only. `Mark.vue` renders it; nothing here knows about Vue, which is
 * what lets `marks.test.ts` hold the whole set to one standard without a DOM.
 * Everything is drawn on a 24×24 box in `currentColor`, so a mark takes the
 * colour of whatever it sits in and inherits the three-colour palette for free.
 *
 * ── Where the marks on an EVENT come from ────────────────────────────────
 * An event does not get a hand-picked icon. It gets the marks its own declared
 * metadata already earns: one per `purpose` (there are always exactly three —
 * the three-purpose rule) and one for its `tier`. So a template that declares
 * itself as relationship + rumour + patience is drawn with a knot, a ripple
 * and a cup, and it is drawn that way in every view, forever, without anybody
 * choosing it. `PURPOSE_MARK` and `TIER_MARK` at the foot of this file are the
 * whole mapping, and they are `Record`s over closed unions, so a purpose added
 * to the schema fails the build here until it is drawn.
 */

/**
 * A closed union, like every other verb list in this codebase (invariant 5).
 * `MARKS` below is a `Record` over it, so a name added here without geometry
 * is a compile error rather than an empty square somebody notices in a
 * screenshot eight months later — and `marks.test.ts` walks the whole set,
 * including a check that every mark is rendered SOMEWHERE. An icon nothing
 * draws is invariant 11's dead field with a nicer coat on.
 */
export type MarkName =
  // The rail — one per view.
  | 'quill'      // events: the pen that writes a scene
  | 'thread'     // substories: beats strung on one cord
  | 'escutcheon' // characters: the blank shield every sigil is drawn on
  | 'bough'      // the family tree
  | 'hourglass'  // simulate: the clock
  | 'dividers'   // instruments: the things that measure
  // The docket — one per kind of question.
  | 'manicule'   // a choice. The pointing hand: attend to this
  | 'ring'       // the Match
  | 'seal'       // the record, and a clause recovered
  | 'cradle'     // children waiting to be named
  // The chronicle's margin.
  | 'pilcrow'    // a paragraph the chronicle thought worth the room
  | 'obelus'     // struck: known to have existed, and gone
  | 'asterisk'   // not warranted: this line claims more than happened
  // What an outcome does to the house.
  | 'boon'
  | 'blow'
  // The purposes. Nine of them, and `advance_clause` is drawn with the seal.
  | 'bond'       // change_relationship: two shields, overlapping
  | 'gate'       // worldbuild_through_action
  | 'candle'     // establish_magic_rule
  | 'crucible'   // test_magic_rule
  | 'coronet'    // change_standing
  | 'ripple'     // plant_rumour
  | 'inkwell'    // force_record_choice
  | 'cup'        // buy_patience
  // The tiers. `individual` is drawn with the escutcheon — one shield, one man.
  | 'signet'     // head: the seal that never leaves the main house
  | 'hall'       // family
  | 'book'       // record
  | 'moth'       // frame: the thing at the window in 2042
  // The sound.
  | 'bell'
  | 'bell-still';

export interface Mark {
  /** Paths stroked in `currentColor`. Most marks are only this. */
  strokes: string[];
  /** Paths filled in `currentColor`. Used where a stroke would read as hollow. */
  fills?: string[];
  /**
   * This mark's line weight relative to the caller's. A pilcrow wants more
   * body than a pair of dividers at the same size, and the alternative to
   * saying so here is every call site passing a magic number.
   */
  weight?: number;
  /** Said aloud when the mark carries the meaning on its own. */
  label: string;
}

export const MARKS: Record<MarkName, Mark> = {
  // ── The rail ──────────────────────────────────────────────────────────
  quill: {
    label: 'events',
    strokes: [
      // The vane, then the spine through it, then the shaft down to the nib.
      'M20.2 3.8 C14 4.6 9.4 7.6 7.4 12.4 C6.4 14.8 6.6 16.6 7 17'
        + ' C7.4 17.4 9.2 17.6 11.6 16.6 C16.4 14.6 19.4 10 20.2 3.8 Z',
      'M20.2 3.8 L7 17',
      'M7 17 L3.6 20.4',
    ],
  },

  thread: {
    label: 'substories',
    strokes: [
      // Three beats, and what joins them. Drawn with the cord BETWEEN the
      // beats rather than through them: run through, it reads as a wrench.
      'M3.4 18.4 A2.8 2.8 0 1 0 9 18.4 A2.8 2.8 0 1 0 3.4 18.4 Z',
      'M9.2 12 A2.8 2.8 0 1 0 14.8 12 A2.8 2.8 0 1 0 9.2 12 Z',
      'M15 5.6 A2.8 2.8 0 1 0 20.6 5.6 A2.8 2.8 0 1 0 15 5.6 Z',
      'M8.2 16.2 L10.2 14',
      'M14 10 L16 7.8',
    ],
  },

  escutcheon: {
    label: 'characters',
    strokes: [
      // The same silhouette the sigils are drawn on. That is the point of it.
      'M4.6 4 L19.4 4 V13 C19.4 17.4 14.4 19.4 12 21 C9.6 19.4 4.6 17.4 4.6 13 Z',
      'M12 8.4 L14 11.4 L12 14.4 L10 11.4 Z',
    ],
  },

  bough: {
    label: 'family tree',
    strokes: [
      'M12 21 L12 12.4',
      'M12 14.4 L7.2 9.8',
      'M12 14.4 L16.8 9.8',
      'M7.2 9.8 L4.8 6.6',
      'M7.2 9.8 L9.4 6.4',
      'M16.8 9.8 L19.2 6.6',
      'M16.8 9.8 L14.6 6.4',
    ],
    fills: [
      'M4.8 6.6 a1.8 1.8 0 1 0 0.01 0 Z',
      'M9.4 6.4 a1.8 1.8 0 1 0 0.01 0 Z',
      'M19.2 6.6 a1.8 1.8 0 1 0 0.01 0 Z',
      'M14.6 6.4 a1.8 1.8 0 1 0 0.01 0 Z',
    ],
  },

  hourglass: {
    label: 'simulate',
    strokes: [
      'M6 3.5 L18 3.5',
      'M6 20.5 L18 20.5',
      'M7.6 3.5 C7.6 8.4 12 10 12 12 C12 14 7.6 15.6 7.6 20.5',
      'M16.4 3.5 C16.4 8.4 12 10 12 12 C12 14 16.4 15.6 16.4 20.5',
    ],
    fills: [
      // The sand that has already run. The glass is past half.
      'M8.7 20.5 C8.7 17 12 15.4 12 13.8 C12 15.4 15.3 17 15.3 20.5 Z',
    ],
  },

  dividers: {
    label: 'instruments',
    strokes: [
      'M12 3 L12 5.4',
      'M11 6.6 L4.4 19.2',
      'M13 6.6 L19.6 19.2',
      // The points, set down on the thing being measured.
      'M3 20.6 L5.8 20.6',
      'M18.2 20.6 L21 20.6',
      'M8.4 6 A4 4 0 0 0 15.6 6',
    ],
    fills: ['M12 5.9 a2.1 2.1 0 1 0 0.01 0 Z'],
  },

  // ── The docket ────────────────────────────────────────────────────────
  manicule: {
    label: 'a question for you',
    weight: 1.1,
    strokes: [
      // The cuff, then the hand: one finger out, the rest closed under it.
      'M3.6 6.8 L3.6 17.2',
      'M3.6 7.4 L8.4 7.4 C9.8 7.4 10.7 8.3 10.7 9.5 L10.7 10.4 L17.4 10.4'
        + ' C18.6 10.4 19.4 11.1 19.4 12 C19.4 12.9 18.6 13.6 17.4 13.6'
        + ' L10.7 13.6 L10.7 14.5 C10.7 15.7 9.8 16.6 8.4 16.6 L3.6 16.6 Z',
      'M8.6 11.4 C9.9 11.4 10.6 11.9 10.7 12.6',
      'M8.8 14.6 C9.9 14.6 10.5 14.2 10.7 13.6',
    ],
  },

  ring: {
    label: 'the match',
    strokes: [
      // Two bands, one over the other. Nothing else in the set overlaps.
      'M9.4 17.4 A5.4 5.4 0 1 1 9.4 6.6 A5.4 5.4 0 1 1 9.4 17.4 Z',
      'M14.6 6.6 A5.4 5.4 0 1 1 14.6 17.4',
    ],
  },

  seal: {
    label: 'the record',
    strokes: [
      // Wax, pressed once and not quite round, with a ribbon under it.
      'M12 3.4 C16.6 3.2 20.6 6.6 20.6 11.2 C20.6 15.6 16.8 18.9 12.2 18.8'
        + ' C7.6 18.7 3.6 15.4 3.7 10.9 C3.8 6.6 7.4 3.6 12 3.4 Z',
      'M9.2 20.6 L10.6 17.6',
      'M14.8 20.6 L13.4 17.6',
      // The impression. Not a letter — this house does not sign with letters.
      'M7.7 11.2 A4.3 4.3 0 1 0 16.3 11.2 A4.3 4.3 0 1 0 7.7 11.2 Z',
      'M9.8 12.4 L12 9.9 L14.2 12.4',
    ],
  },

  cradle: {
    label: 'children to name',
    strokes: [
      'M4.5 9.2 L19.5 9.2 L17.6 15.6 L6.4 15.6 Z',
      'M7 9.2 C7 4.8 10 2.6 13.6 3.8',
      'M8.2 15.6 L7.2 17.6',
      'M15.8 15.6 L16.8 17.6',
      'M3.2 17.4 C6.8 21 17.2 21 20.8 17.4',
    ],
  },

  // ── The chronicle's margin ────────────────────────────────────────────
  pilcrow: {
    label: 'an entry',
    weight: 1.15,
    strokes: [
      'M13.2 4.5 L13.2 20',
      'M17.2 4.5 L17.2 20',
      'M13.2 4.5 L10.2 4.5 A4.6 4.6 0 0 0 10.2 13.7 L13.2 13.7',
      'M17.2 4.5 L10.2 4.5',
    ],
  },

  obelus: {
    label: 'struck from the record',
    weight: 1.15,
    strokes: ['M4.5 12 L19.5 12'],
    fills: [
      'M12 6.6 a1.7 1.7 0 1 0 0.01 0 Z',
      'M12 15.7 a1.7 1.7 0 1 0 0.01 0 Z',
    ],
  },

  asterisk: {
    label: 'not warranted',
    weight: 1.15,
    strokes: [
      'M12 4.4 L12 19.6',
      'M5.4 8.2 L18.6 15.8',
      'M18.6 8.2 L5.4 15.8',
    ],
  },

  // ── What an outcome does to the house ─────────────────────────────────
  boon: {
    label: 'the house gains',
    strokes: [
      'M12 20.4 L12 8',
      'M12 12.6 C9.4 12.6 7.2 10.9 6.5 8.3 C9.3 8.1 11.3 9.6 12 11.8',
      'M12 10 C14.6 10 16.8 8.3 17.5 5.7 C14.7 5.5 12.7 7 12 9.2',
    ],
  },

  blow: {
    label: 'the house loses',
    strokes: [
      // `boon`, turned over. Drawn as the same sprig so the pair reads as one
      // thing and its opposite rather than as two unrelated marks.
      'M12 3.6 L12 16',
      'M12 11.4 C9.4 11.4 7.2 13.1 6.5 15.7 C9.3 15.9 11.3 14.4 12 12.2',
      'M12 14 C14.6 14 16.8 15.7 17.5 18.3 C14.7 18.5 12.7 17 12 14.8',
    ],
  },

  // ── The purposes ──────────────────────────────────────────────────────
  bond: {
    label: 'a relationship changes',
    strokes: [
      // One escutcheon is a person (see the tiers). Two of them, overlapping,
      // is two people who have something to do with each other — which is the
      // whole of what this purpose means, in the set's own vocabulary.
      'M2.6 5 H11.4 V11.4 C11.4 14.6 8.4 16 7 17.2 C5.6 16 2.6 14.6 2.6 11.4 Z',
      'M12.6 6.8 H21.4 V13.2 C21.4 16.4 18.4 17.8 17 19 C15.6 17.8 12.6 16.4 12.6 13.2 Z',
    ],
  },

  gate: {
    label: 'the world, through action',
    strokes: [
      'M5.4 20 V11.2 A6.6 6.6 0 0 1 18.6 11.2 V20',
      'M9.5 20 V13.6 A2.5 2.5 0 0 1 14.5 13.6 V20',
      'M2.8 20 H21.2',
    ],
  },

  candle: {
    label: 'a rule of magic, established',
    strokes: [
      'M12 9.4 V11.6',
      'M8.8 11.6 H15.2 V19.4 H8.8 Z',
      'M6.4 19.4 H17.6',
    ],
    fills: [
      'M12 2.6 C13.7 4.6 14.5 5.8 14.5 7.1 C14.5 8.5 13.4 9.5 12 9.5'
        + ' C10.6 9.5 9.5 8.5 9.5 7.1 C9.5 5.8 10.3 4.6 12 2.6 Z',
    ],
  },

  crucible: {
    label: 'a rule of magic, tested',
    strokes: [
      'M4.6 8.2 H19.4 L17 15.4 H7 Z',
      'M9.2 17.2 C8.2 18.6 8.8 20 10 20.8',
      'M12 17.4 C11 18.8 11.6 20.4 12.8 21.2',
      'M14.8 17.2 C13.8 18.6 14.4 20 15.6 20.8',
    ],
  },

  coronet: {
    label: 'standing changes',
    strokes: [
      'M4.4 18.6 L6.3 8 L9.8 13.2 L12 6.2 L14.2 13.2 L17.7 8 L19.6 18.6 Z',
      'M4.4 18.6 H19.6',
    ],
  },

  ripple: {
    label: 'a rumour is planted',
    strokes: [
      'M9.2 18.4 A3.2 3.2 0 0 0 6 15.2',
      'M13.4 18.4 A7.4 7.4 0 0 0 6 11',
      'M17.6 18.4 A11.6 11.6 0 0 0 6 6.8',
    ],
    fills: ['M6 18.4 a1.8 1.8 0 1 0 0.01 0 Z'],
  },

  inkwell: {
    label: 'a line must be written',
    strokes: [
      'M6 13 H18 V16.8 A2.6 2.6 0 0 1 15.4 19.4 H8.6 A2.6 2.6 0 0 1 6 16.8 Z',
      'M4.4 13 H19.6',
      // A nib going in. Something is about to be written down.
      'M19 2.4 L11.6 11.6',
      'M14.2 6 L17.4 8.6',
    ],
  },

  cup: {
    label: 'patience, bought',
    strokes: [
      'M5.4 7.6 H15.8 V15.8 A3.2 3.2 0 0 1 12.6 19 H8.6 A3.2 3.2 0 0 1 5.4 15.8 Z',
      'M15.8 9.6 H17.8 A2.7 2.7 0 0 1 17.8 15 H15.8',
      'M4.2 7.6 H17',
    ],
  },

  // ── The tiers ─────────────────────────────────────────────────────────
  signet: {
    label: 'the head of the house',
    strokes: [
      'M4.8 14.4 A7.2 7.2 0 1 0 19.2 14.4 A7.2 7.2 0 1 0 4.8 14.4 Z',
      'M8 14.4 A4 4 0 1 0 16 14.4 A4 4 0 1 0 8 14.4 Z',
      'M8.4 5.6 A3.6 3 0 1 0 15.6 5.6 A3.6 3 0 1 0 8.4 5.6 Z',
    ],
  },

  hall: {
    label: 'the family',
    strokes: [
      'M2.8 12 L12 4.4 L21.2 12',
      'M5.6 12 V19.8 H18.4 V12',
      'M10.2 19.8 V14.6 H13.8 V19.8',
    ],
  },

  book: {
    label: 'the record',
    strokes: [
      'M12 7.4 C10 5.6 7.4 5 4.4 5.2 V17.8 C7.4 17.6 10 18.2 12 20'
        + ' C14 18.2 16.6 17.6 19.6 17.8 V5.2 C16.6 5 14 5.6 12 7.4 Z',
      'M12 7.4 V20',
    ],
  },

  moth: {
    label: 'the frame, 2042',
    strokes: [
      'M11.2 7.8 C8.4 3.6 3.6 3.4 2.6 7 C1.7 10.6 5.6 15 9.8 15.8 Z',
      'M12.8 7.8 C15.6 3.6 20.4 3.4 21.4 7 C22.3 10.6 18.4 15 14.2 15.8 Z',
      'M11.3 6.6 L8.8 3.2',
      'M12.7 6.6 L15.2 3.2',
    ],
    fills: [
      'M12 6.2 C12.9 6.2 13.3 7.2 13.3 8.8 C13.3 13.2 12.7 17.4 12 20.4'
        + ' C11.3 17.4 10.7 13.2 10.7 8.8 C10.7 7.2 11.1 6.2 12 6.2 Z',
    ],
  },

  // ── The sound ─────────────────────────────────────────────────────────
  bell: {
    label: 'sound on',
    strokes: [
      'M12 3.2 L12 5',
      'M12 5 C15.9 5 17.9 7.6 17.9 11.4 C17.9 15.2 19 16.6 20 17.8 L4 17.8'
        + ' C5 16.6 6.1 15.2 6.1 11.4 C6.1 7.6 8.1 5 12 5 Z',
      'M10 19 C10.3 20.2 11.1 20.8 12 20.8 C12.9 20.8 13.7 20.2 14 19',
    ],
  },

  'bell-still': {
    label: 'sound off',
    strokes: [
      'M12 3.2 L12 5',
      'M12 5 C15.9 5 17.9 7.6 17.9 11.4 C17.9 15.2 19 16.6 20 17.8 L4 17.8'
        + ' C5 16.6 6.1 15.2 6.1 11.4 C6.1 7.6 8.1 5 12 5 Z',
      'M10 19 C10.3 20.2 11.1 20.8 12 20.8 C12.9 20.8 13.7 20.2 14 19',
      // Stopped. The bell is still there; it is just not going to ring.
      'M4.4 20 L19.6 4.4',
    ],
  },
};

/** Every name in the union, in declaration order. For the contact sheet. */
export const MARK_NAMES = Object.keys(MARKS) as MarkName[];

/**
 * The three marks an event wears, and where they come from.
 *
 * A `Record` over the schema's own closed union, so adding a tenth purpose to
 * `PurposeS` fails the build here until somebody draws it. That is the whole
 * reason this is a `Record` and not a lookup with a fallback: a fallback would
 * quietly give the new purpose somebody else's mark, and it would look right.
 */
export const PURPOSE_MARK: Record<Purpose, MarkName> = {
  advance_clause: 'seal',
  change_relationship: 'bond',
  worldbuild_through_action: 'gate',
  establish_magic_rule: 'candle',
  test_magic_rule: 'crucible',
  change_standing: 'coronet',
  plant_rumour: 'ripple',
  force_record_choice: 'inkwell',
  buy_patience: 'cup',
};

/** What the event is aimed at. Same rule as `PURPOSE_MARK`. */
export const TIER_MARK: Record<EventTier, MarkName> = {
  individual: 'escutcheon',
  head: 'signet',
  family: 'hall',
  record: 'book',
  frame: 'moth',
};

/** Said aloud, in the same words the schema uses, minus the underscores. */
export const PURPOSE_LABEL: Record<Purpose, string> = {
  advance_clause: 'advances a clause',
  change_relationship: 'changes a relationship',
  worldbuild_through_action: 'worldbuilds through action',
  establish_magic_rule: 'establishes a rule of magic',
  test_magic_rule: 'tests a rule of magic',
  change_standing: 'changes standing',
  plant_rumour: 'plants a rumour',
  force_record_choice: 'forces a record choice',
  buy_patience: 'buys patience',
};
