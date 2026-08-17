import type { EventTemplate } from '@ed/schema';
import type { SimCtx } from '../world.js';

/**
 * NESTED TALES — circulation (issue #14).
 *
 * A tale's clock starts the year the event it is `about` actually fires, not
 * the year it is first cited in some other event's `accounts` — the ballad of
 * the given Seal exists whether or not the Regalia rite ever comes up short.
 * `birthTales` is called from `applyOutcome`, the one place an outcome is
 * committed; `tickTales` runs once a year from the `generation` phase.
 */
export function birthTales(e: EventTemplate, ctx: SimCtx): void {
  const w = ctx.world;
  for (const t of ctx.content.talesAbout(e.id)) {
    if (w.tales.has(t.id)) continue;
    w.tales.set(t.id, {
      bornYear: w.year,
      circulatesFrom: w.year + t.circulatesFrom.yearsAfterEvent,
      circulating: false,
      mutations: 0,
    });
  }
}

export function tickTales(ctx: SimCtx): void {
  const w = ctx.world;
  for (const [id, state] of w.tales) {
    if (!state.circulating) {
      if (w.year < state.circulatesFrom) continue;
      state.circulating = true;
    }

    const t = ctx.content.tale(id);
    if (!t) continue; // content edited out from under a save; nothing to mutate against
    const since = w.year - (state.lastMutated ?? state.circulatesFrom);
    if (since >= t.mutatesEveryYears) {
      state.mutations += 1;
      state.lastMutated = w.year;
    }
  }
}
