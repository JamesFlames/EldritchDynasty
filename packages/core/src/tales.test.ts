import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { applyOutcome, phase, place, testWorld } from '@ed/core';

const content = loadContent();

/**
 * Nested tales (issue #14). `applyOutcome` births a tale's circulation state
 * the year the event it is `about` actually fires — not merely the year some
 * OTHER event cites it in `accounts` — and the `generation` phase ticks
 * whether it has started circulating and how many times it has mutated.
 */
describe('nested tale circulation', () => {
  it('is born, unstarted, the year its about-event fires — and only that event', () => {
    const ctx = testWorld(content, 1042, 1400);
    const event = ctx.content.mustEvent('the_burning_of_the_nine_libraries');
    if (event.interaction.kind !== 'narration') throw new Error('unreachable');
    const head = place(ctx, { sex: 'male', age: 40, castSlots: ['head'] });

    expect(ctx.world.tales.size).toBe(0);
    applyOutcome(event, event.interaction.outcomes[0]!, ctx, { HEAD: head.id });

    expect(ctx.content.tale('ballad_of_the_nine_days')!.about).toBe('the_burning_of_the_nine_libraries');

    for (const id of ['ballad_of_the_nine_days', 'ilm_lament_for_the_burned']) {
      const state = ctx.world.tales.get(id);
      expect(state, id).toBeDefined();
      expect(state!.bornYear).toBe(1400);
      expect(state!.circulating).toBe(false);
      expect(state!.mutations).toBe(0);
    }

    // Not born: a tale merely cited in some OTHER event's accounts.
    expect(ctx.world.tales.has('church_inquest_minute_1604')).toBe(false);
  });

  it('does not re-birth, or reset, a tale that already has a circulation record', () => {
    const ctx = testWorld(content, 1042, 1400);
    const event = ctx.content.mustEvent('the_burning_of_the_nine_libraries');
    if (event.interaction.kind !== 'narration') throw new Error('unreachable');
    const head = place(ctx, { sex: 'male', age: 40, castSlots: ['head'] });

    applyOutcome(event, event.interaction.outcomes[0]!, ctx, { HEAD: head.id });
    const before = { ...ctx.world.tales.get('ballad_of_the_nine_days')! };

    ctx.world.year = 1500;
    applyOutcome(event, event.interaction.outcomes[0]!, ctx, { HEAD: head.id });
    expect(ctx.world.tales.get('ballad_of_the_nine_days')).toEqual(before);
  });

  it('starts circulating exactly when the generation phase crosses circulatesFrom', () => {
    const ctx = testWorld(content, 1042, 1400);
    const event = ctx.content.mustEvent('the_burning_of_the_nine_libraries');
    if (event.interaction.kind !== 'narration') throw new Error('unreachable');
    const head = place(ctx, { sex: 'male', age: 40, castSlots: ['head'] });
    applyOutcome(event, event.interaction.outcomes[0]!, ctx, { HEAD: head.id });

    const def = ctx.content.tale('ballad_of_the_nine_days')!;
    const circulatesFrom = 1400 + def.circulatesFrom.yearsAfterEvent;

    ctx.world.year = circulatesFrom - 1;
    phase('generation', ctx);
    expect(ctx.world.tales.get('ballad_of_the_nine_days')!.circulating).toBe(false);

    ctx.world.year = circulatesFrom;
    phase('generation', ctx);
    expect(ctx.world.tales.get('ballad_of_the_nine_days')!.circulating).toBe(true);
  });

  it('mutates only once mutatesEveryYears has passed since circulation began', () => {
    const ctx = testWorld(content, 1042, 1400);
    const event = ctx.content.mustEvent('the_burning_of_the_nine_libraries');
    if (event.interaction.kind !== 'narration') throw new Error('unreachable');
    const head = place(ctx, { sex: 'male', age: 40, castSlots: ['head'] });
    applyOutcome(event, event.interaction.outcomes[0]!, ctx, { HEAD: head.id });

    const def = ctx.content.tale('ballad_of_the_nine_days')!;
    const circulatesFrom = 1400 + def.circulatesFrom.yearsAfterEvent;

    ctx.world.year = circulatesFrom;
    phase('generation', ctx);
    expect(ctx.world.tales.get('ballad_of_the_nine_days')!.mutations).toBe(0);

    ctx.world.year = circulatesFrom + def.mutatesEveryYears - 1;
    phase('generation', ctx);
    expect(ctx.world.tales.get('ballad_of_the_nine_days')!.mutations).toBe(0);

    ctx.world.year = circulatesFrom + def.mutatesEveryYears;
    phase('generation', ctx);
    expect(ctx.world.tales.get('ballad_of_the_nine_days')!.mutations).toBe(1);
  });
});
