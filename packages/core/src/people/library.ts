import type { LibraryBookState, Person, PersonId, SpellbookDef } from '@ed/schema';
import { asId, canLearn } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { attr } from './factory.js';

/**
 * THE LIBRARY — applying a spellbook, one mechanism for every book there will
 * ever be, on the same bargain `people/heirlooms.ts` makes: content is open,
 * the verb list is closed.
 *
 * Two layers, kept apart on purpose:
 *
 *   `WorldState.library`   the house's SHELF. A physical copy, bought once,
 *                          degrading with use, inheritable because the copy
 *                          persists. Mirrors `HeirloomState` exactly, and for
 *                          the same reason.
 *
 *   `Person.spellsKnown`   who has actually STUDIED a copy. Persists even if
 *                          the copy is later sold — knowledge already learned
 *                          is not erased by losing the book.
 *
 * Mystic magic shares NO code with the Eldritch font (invariant 4). Nothing
 * below ever reads or writes `madness` or `eldritch`, and it must not.
 */

export function spellbookDef(ctx: SimCtx, id: string): SpellbookDef | undefined {
  return ctx.content.spellbook(id);
}

export function heldBooks(ctx: SimCtx): LibraryBookState[] {
  return [...ctx.world.library.values()];
}

/** Put a copy on the shelf. Idempotent — the house owns a physical copy once. */
export function acquireLibraryCopy(ctx: SimCtx, id: string): LibraryBookState | undefined {
  const def = spellbookDef(ctx, id);
  if (!def) return undefined;
  const existing = ctx.world.library.get(id);
  if (existing) return existing;
  const state: LibraryBookState = { id, acquiredYear: ctx.world.year, condition: 100 };
  ctx.world.library.set(id, state);
  return state;
}

/** The physical copy leaves the house — burned, stolen, sold, given as tribute. */
export function loseLibraryCopy(ctx: SimCtx, id: string): boolean {
  return ctx.world.library.delete(id);
}

/** Wear. Degradation adds years to study time — content schedules the next `gain` further out for a low condition. */
export function degradeLibraryCopy(ctx: SimCtx, id: string, amount?: number): LibraryBookState | undefined {
  const def = spellbookDef(ctx, id);
  const state = acquireLibraryCopy(ctx, id);
  if (!state) return undefined;
  state.condition = Math.max(0, state.condition - (amount ?? def?.degradesBy ?? 20));
  return state;
}

/**
 * Whether `p` may take up this book at all — canLearn (invariant 4) and the
 * affinity threshold (a Named Art's floor). Separated from `gainSpellbook` on
 * the same principle as `canUseHeirloom`: an option the player cannot take is
 * shown anyway, greyed, with the reason beside it.
 */
export interface CanStudy {
  ok: boolean;
  reason?: string;
}

export function canStudySpellbook(ctx: SimCtx, p: Person, def: SpellbookDef): CanStudy {
  // INVARIANT 4: the Mystic restriction. Shares no code with eldritch expression.
  if (!canLearn(p.sex, def.affinity)) return { ok: false, reason: 'not hers to learn' };
  if (def.threshold > 0) {
    const have = attr(p, def.affinity, ctx.genetics, ctx.world.year);
    if (have < def.threshold) return { ok: false, reason: 'the affinity is not there yet' };
  }
  return { ok: true };
}

/**
 * Study concludes and the knowledge is theirs. Auto-acquires the shelf copy
 * if the house does not already hold one — "the house already had it" is a
 * simpler default than forcing every study event to separately author a
 * purchase, and matches `grantHeirloom`'s own idempotent-grant convention.
 *
 * A Named Art (tier `named`) is recorded under the name of whoever gains it
 * first, permanently, the moment that happens — the canon a house accumulates.
 */
export function gainSpellbook(ctx: SimCtx, p: Person, def: SpellbookDef): boolean {
  if (!canStudySpellbook(ctx, p, def).ok) return false;
  const state = acquireLibraryCopy(ctx, def.id) ?? { id: def.id, acquiredYear: ctx.world.year, condition: 100 };
  ctx.world.library.set(def.id, state);

  if (def.tier === 'named' && !state.namedFor) {
    state.namedFor = { person: p.id, name: p.name, year: ctx.world.year };
    ctx.world.chronicle.push({
      year: ctx.world.year,
      weight: 'paragraph',
      title: def.name,
      text: `${p.name} set it down in writing for the first time, and the family has called it `
        + `${def.name} — ${p.name}'s working — ever since.`,
      named: false,
    });
  }

  const bookId = asId<Person['spellsKnown'][number]>(def.id);
  if (!p.spellsKnown.includes(bookId)) p.spellsKnown.push(bookId);
  return true;
}

/** A person forgets, or is stripped of, one book — the shelf copy is untouched. */
export function loseSpellbookKnowledge(ctx: SimCtx, p: Person, id: string): void {
  void ctx;
  p.spellsKnown = p.spellsKnown.filter((b) => String(b) !== id);
}

/** Scholar's "faster study": a career's `studySpeed` multiplies a book's `studyYears`. Under 1 is faster. */
export function effectiveStudyYears(ctx: SimCtx, p: Person, def: SpellbookDef): number {
  const career = p.career && ctx.content.career(p.career.career);
  return Math.max(1, Math.round(def.studyYears * (career?.studySpeed ?? 1)));
}

/**
 * A reader sits down with a book. The knowledge arrives in
 * `effectiveStudyYears`, not now.
 *
 * `canStudySpellbook` is asked HERE rather than on completion, and that is the
 * design rather than an optimisation: a man who cannot learn a thing does not
 * spend six years failing to, and an author who writes the effect against an
 * ineligible reader should see nothing happen immediately rather than nothing
 * happen quietly in 1183.
 *
 * Beginning a book twice is not two studies. The second call is the same man
 * picking up the same volume he is already halfway through.
 */
export function beginStudy(ctx: SimCtx, p: Person, def: SpellbookDef): boolean {
  if (!canStudySpellbook(ctx, p, def).ok) return false;
  if (p.spellsKnown.some((b) => String(b) === def.id)) return false;
  if (ctx.world.studies.some((s) => s.person === p.id && s.book === def.id)) return false;

  ctx.world.studies.push({
    person: p.id,
    book: def.id,
    completes: ctx.world.year + effectiveStudyYears(ctx, p, def),
  });
  return true;
}

/**
 * Finish every study whose year has come. Called by the `library` year phase.
 *
 * A reader who died mid-book, or who lost the eligibility they had when they
 * started, simply drops out — `gainSpellbook` re-asks `canStudySpellbook` and
 * refuses, and the entry leaves the list either way. Six years of reading is
 * long enough that both happen.
 */
export function completeStudies(ctx: SimCtx): { person: PersonId; book: string }[] {
  const w = ctx.world;
  const due = w.studies.filter((s) => s.completes <= w.year);
  if (!due.length) return [];

  w.studies = w.studies.filter((s) => s.completes > w.year);

  const finished: { person: PersonId; book: string }[] = [];
  for (const s of due) {
    const p = w.people.get(s.person);
    const def = spellbookDef(ctx, s.book);
    if (!p || p.status !== 'alive' || !def) continue;
    if (gainSpellbook(ctx, p, def)) finished.push({ person: s.person, book: s.book });
  }
  return finished;
}
