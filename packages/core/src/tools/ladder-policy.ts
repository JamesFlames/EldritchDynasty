/**
 * THE LADDER POLICIES, ON THEIR OWN (issue #61, Stage D).
 *
 * Extracted from `ladder-gate.ts`, which still owns the design reasoning for
 * why these exist — `climb`/`spare` isolate whether Madness bargains are
 * taken, `scion` isolates whether the house has named somebody to build the
 * ladder on. Read that file's header before changing anything here.
 *
 * The reason this moved: `ending-gate.ts` needs the SAME "one policy answers
 * every ladder bargain, the chronicler answers everything else" machinery to
 * build its own climbing column (issue #61's Stage D2) — not a copy of it.
 * `gates.ts` already imports `firedUnderClimbing` from `ladder-gate.js` for
 * exactly this reason (gate 8's acquittal pass), so a second file reusing the
 * policy machinery under `ending-gate.ts` rather than under `ladder-gate.ts`
 * is the same move already made once, not a new one.
 */
import { isLadderRole } from '@ed/schema';
import { eldritchPower } from '../ascension.js';
import { autoResolveAll, resolveChoice, type PendingChoice } from '../events/decisions.js';
import { phenotypeOf } from '../people/factory.js';
import { hashSeed, makeRng } from '../rng.js';
import type { SimCtx } from '../world.js';

/**
 * `ascendant` is a fourth policy, added for `ending-gate.ts`'s climbing
 * column (issue #61, Stage D) rather than for `ladder-gate.ts`'s own three.
 * `climb`/`spare`/`scion` are deliberately one verb apart from each other —
 * that isolates a single lever, which is what a gate diagnosing WHICH lever
 * works needs. `ascendant` is the opposite question: is the TOP reachable
 * at all, to a house pulling every lever it has — so it takes Madness
 * bargains like `climb`, AND has `nameScion` called on it like `scion`, AND
 * (in `ending-gate.ts`, not here — this file has no marriage policy to set)
 * marries in. It behaves exactly like `climb` inside `answer()`; the two are
 * kept distinct so a caller can tell, from the policy value alone, whether
 * the other two levers were also pulled.
 */
/**
 * `pair` is a fifth policy (issue #61, Stage E4): `scion` isolates whether
 * the house has named ONE man; `pair` isolates whether it has named a
 * SECOND one alongside him — one verb apart from `scion`, the same way
 * `scion` is one verb apart from `spare`. It refuses every Madness bargain
 * exactly like `scion` does, so the gap between the two columns is the
 * heir and nothing else.
 */
/**
 * `pair_climb` is a sixth policy (issue #61, Stage E5), and the only one in
 * which the second man's rites can actually be taken.
 *
 * `pair` names a heir and REFUSES every ladder bargain, which was right for
 * what Stage E4 was asking — it isolated the heir's standing orders from the
 * Madness axis, so the gap between `scion` and `pair` was the heir and
 * nothing else. It is exactly wrong for what Stage E5 built. The second
 * man's Vessel and Great Rite are ladder bargains by construction
 * (`costsTheClimber` sees them, correctly), so under `pair` the house is
 * offered `the_second_name` and turns it down every single time, and the
 * column measures a scene nobody ever takes.
 *
 * So: `pair` plus `climb`, one verb apart from each, and the comparison that
 * answers this stage's question is `pair_climb` against `climb` — both take
 * every bargain, and only one of them has a second man to offer them to.
 */
export type LadderPolicy =
  'climb' | 'spare' | 'chronicler' | 'scion' | 'ascendant' | 'pair' | 'pair_climb';

/**
 * Does taking this branch cost THE MAN WHO IS CLIMBING his mind?
 *
 * Narrowed to Madness landing on a `foremost` slot on purpose. "Any branch
 * that deals Madness to anybody" also catches `the_drowning`, which charges an
 * unwoken boy of seven — and a climbing column that drowns children too would
 * separate from a sparing one on Madness without either column saying anything
 * about the ladder. That is the confound this gate would be least able to see
 * and most likely to be congratulated for.
 */
export function costsTheClimber(pending: PendingChoice, choiceId: string): boolean {
  const e = pending.event;
  if (e.interaction.kind === 'narration') return false;
  const choice = e.interaction.choices.find((c) => c.id === choiceId);
  if (!choice) return false;
  // EVERY ladder role, from the one list (`schema`'s `LADDER_ROLES`), not
  // `foremost` alone. Hand-written here once, and it went stale the day
  // `second_foremost` arrived: the second man's Vessel — the single largest
  // charge the ladder lays on anybody — read as a free option, so no column
  // ever took it deliberately and the `pair` column measured a bargain
  // nobody was making (issue #61, Stage E5).
  const onTheLadder = new Set(
    Object.entries(e.slots).filter(([, sp]) => isLadderRole(sp.role)).map(([id]) => id),
  );
  if (!onTheLadder.size) return false;
  // A `rite` counts, and it is not an afterthought: §22's Vessel transfers the
  // consumed relative's Madness into the ascendant in full and uncapped, so it
  // is the single largest thing the ladder ever asks of the man climbing it
  // (issue #43). It carries no `madness` effect to recognise it by, because
  // how much arrives is a fact about two people rather than an authored number.
  return choice.outcomes.some((o) => o.effects.some(
    (f) => (f.kind === 'madness' && f.delta > 0
      && typeof f.target === 'object' && 'slot' in f.target && onTheLadder.has(f.target.slot))
      || (f.kind === 'rite' && onTheLadder.has(f.ascendant)),
  ));
}

/**
 * Answer one docketed choice by the policy — but only when it is a bargain
 * about the ladder. Everything else in the game, Madness bargains included,
 * is the chronicler's in every column, for the reason `gate:blood` gives: a
 * second scripted decision would put a second difference between them.
 */
export function answer(
  ctx: SimCtx,
  pending: PendingChoice,
  policy: LadderPolicy,
  rng: ReturnType<typeof makeRng>,
  tally: { asked: number; paid: number },
): boolean {
  if (policy === 'chronicler' || !pending.choicesAreOpen) return false;
  const open = pending.choices.filter((c) => c.available);
  const costly = open.filter((c) => costsTheClimber(pending, c.id));
  const free = open.filter((c) => !costsTheClimber(pending, c.id));
  if (!costly.length) return false;   // not a ladder bargain; leave it

  const takesTheBargain = policy === 'climb' || policy === 'ascendant' || policy === 'pair_climb';
  tally.asked += 1;
  const want = takesTheBargain ? costly[0] : free[0];
  if (!want) return false;
  if (takesTheBargain) tally.paid += 1;
  return resolveChoice(ctx, pending.id, want.id, rng).ok;
}

/**
 * THE SCION COLUMN'S ONE VERB. Names whoever the house is building the ladder
 * on — an attentive player's standing order, played the way `gate:blood`
 * plays `marry_in`: set once by a rule over the state rather than answered
 * choice by choice.
 *
 * Holds the role for life once given. Renaming to whoever gained a point this
 * year would spend the marriage bias on a different man every few years and
 * concentrate nothing — the same reasoning the order's own doc comment gives
 * for why the game does not do this automatically either.
 *
 * PREFERS SOMEBODY NOT YET MARRIED, and this is not a minor tie-break: the
 * first cut of this column ranked by raw power alone and measured BYTE
 * IDENTICAL to `spare` — 61.8 in both, to one decimal, across eight seeds.
 * The reason was in the trace rather than the arithmetic. Naming only
 * fires when the previous scion is gone, so by the time it fires the
 * candidate has usually spent his whole adult life already married under
 * whatever policy stood before he was ever named — the override arrives
 * having missed the one decision it exists to change. Measured over one
 * seed to 1000 years: the power-only rule produced ONE scion marriage the
 * order could still act on; preferring the unmarried produced nine, several
 * of them cousins the family would otherwise have spent on the open market.
 * An attentive house does not wait for a man to become available to be
 * remarkable; it names the boy.
 */
export function nameScion(ctx: SimCtx): void {
  const w = ctx.world;
  const current = w.scion ? w.people.get(w.scion) : undefined;
  const stillHere = current?.status === 'alive'
    && w.people.household(w.playerHouse, w.year).some((q) => q.id === current.id);
  if (stillHere) return;

  const expressers = w.people.household(w.playerHouse, w.year)
    .filter((p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress);
  const unmarried = expressers.filter((p) => !p.marriages.some((m) => !m.to));
  const pool = unmarried.length ? unmarried : expressers;
  w.scion = pool.length
    ? [...pool].sort((a, b) =>
      eldritchPower(ctx, b) - eldritchPower(ctx, a) || (a.id < b.id ? -1 : 1))[0]!.id
    : null;
}

/**
 * THE PAIR COLUMN'S SECOND VERB (issue #61, Stage E4). The same rule
 * `nameScion` plays — hold the role for life once given, prefer somebody
 * not yet married — over the pool `nameScion` does NOT touch: everybody
 * the Scion is not. Called after `nameScion` in every caller, never before,
 * so a house with no Scion yet does not name a heir before it has anyone
 * for him to stand beside.
 *
 * PREFERS THE SCION'S OWN CHILD OR SIBLING, and this is not a minor
 * tie-break. `preferred`'s whole concentrating effect on a marriage is
 * inherited by the NEXT generation, not carried backward into the man
 * whose wedding it was — a heir picked from the general expresser pool by
 * power alone might be a cousin six branches over who never received a
 * single one of the Scion's own concentrated marriages, in which case
 * naming him buys the book-and-tutor bias this stage built and none of
 * the blood-concentration bias the whole mechanism is FOR. A heir who
 * shares the Scion's own parent, or is his own child, is standing on
 * exactly the blood the pair is meant to be building.
 */
export function nameScionHeir(ctx: SimCtx): void {
  const w = ctx.world;
  const current = w.scionHeir ? w.people.get(w.scionHeir) : undefined;
  const stillHere = current?.status === 'alive'
    && current.id !== w.scion
    && w.people.household(w.playerHouse, w.year).some((q) => q.id === current.id);
  if (stillHere) return;

  const household = w.people.household(w.playerHouse, w.year);
  const kin = new Set<string>();
  if (w.scion) {
    for (const s of w.people.siblings(w.scion)) kin.add(s.id);
    for (const p of household) {
      if (p.trueParents.mother === w.scion || p.trueParents.father === w.scion) kin.add(p.id);
    }
  }

  const expressers = household
    .filter((p) => p.id !== w.scion && phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress);
  const unmarried = expressers.filter((p) => !p.marriages.some((m) => !m.to));
  const pool = unmarried.length ? unmarried : expressers;
  w.scionHeir = pool.length
    ? [...pool].sort((a, b) => {
      const ak = kin.has(a.id) ? 1 : 0;
      const bk = kin.has(b.id) ? 1 : 0;
      if (ak !== bk) return bk - ak;
      return eldritchPower(ctx, b) - eldritchPower(ctx, a) || (a.id < b.id ? -1 : 1);
    })[0]!.id
    : null;
}

/**
 * Answer every docketed decision for one year under a ladder policy: the
 * ladder's own bargains go through `answer`, everything else is the
 * chronicler's. Shared by `ladder-gate.ts`'s `playOnce`/`playForFires` and by
 * `ending-gate.ts`'s climbing column, so the two callers cannot drift on what
 * "the chronicler answers everything else" means.
 *
 * The RNG salt (`'ladder-decide'`) is shared too, on purpose — this is the
 * same decision-resolution act wherever it is called from, and a second salt
 * string would buy nothing but a reason two batches diverge on the same seed
 * for no mechanism either one changed.
 */
export function resolveYear(
  ctx: SimCtx,
  seed: number,
  policy: LadderPolicy,
  tally: { asked: number; paid: number },
): void {
  const w = ctx.world;
  let guard = 0;
  while (w.pendingDecisions.length && guard++ < 200) {
    const rng = makeRng(hashSeed(seed, 'ladder-decide', w.year, guard));
    const choice = w.pendingDecisions.find((d): d is PendingChoice => d.kind === 'choice');
    if (choice && answer(ctx, choice, policy, rng, tally)) continue;
    autoResolveAll(ctx, rng);
  }
}
