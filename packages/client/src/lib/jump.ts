import type { StandingDelta } from '@ed/core';

/**
 * ONE JUMP, OUT OF THE YEARS IT WAS MADE OF (issue #54).
 *
 * `session.advance(1)` is called in a loop — the store turns one year at a
 * time so it can stop on a decision or a naming queue — so the engine's
 * account arrives a year at a time and the press of "a generation" is the sum
 * of up to twenty-five of them.
 *
 * The summing is arithmetic over what the engine already said, not a second
 * set of books: nothing here reads the world, remembers a year, or decides
 * when one happened. That distinction is the whole reason `StandingDelta` is
 * computed in `core` rather than by a client diffing snapshots it took itself.
 */
export function foldStanding(soFar: StandingDelta | null, next: StandingDelta): StandingDelta {
  if (!soFar) return { ...next };
  const out: StandingDelta = {
    treasury: soFar.treasury + next.treasury,
    discontent: soFar.discontent + next.discontent,
    clauses: soFar.clauses + next.clauses,
  };
  const respect = joinTier(soFar.respect, next.respect);
  if (respect) out.respect = respect;
  const arm = joinTier(soFar.arm, next.arm);
  if (arm) out.arm = arm;
  return out;
}

/**
 * Two tier moves become the move from where it started to where it ended —
 * and where those are the same place, they become nothing at all.
 *
 * A house that slid from `known` to `unknown` in 1104 and clawed back by 1119
 * did not change tier over that generation, and a header reporting
 * "known → known" would be announcing an event that, at the resolution the
 * player is looking at, did not happen. The chronicle is where the years
 * inside the jump are kept.
 */
function joinTier<T extends string>(
  a: { from: T; to: T } | undefined,
  b: { from: T; to: T } | undefined,
): { from: T; to: T } | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.from === b.to ? undefined : { from: a.from, to: b.to };
}

/** How a signed number reads beside a level. A true minus sign, not a hyphen. */
export function signed(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}
