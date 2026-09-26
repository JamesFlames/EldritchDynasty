import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { answerGenerationQuestion, chooseGenerationQuestion } from './generation.js';
import { testWorld } from './testing.js';

const bundle = loadContent();

describe('one question per generation (issue #213)', () => {
  it('selects a concrete thin-line pressure from the current family', () => {
    const ctx = testWorld(bundle, 21301, 1200);
    const head = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;
    const living = ctx.world.people.blood(ctx.world.playerHouse).filter((p) => p.status === 'alive').length;
    ctx.world.bloodHighWater = Math.max(30, living * 4);

    const q = chooseGenerationQuestion(ctx);

    expect(q?.kind).toBe('thin_line');
    expect(q?.subject).toBe(head.id);
    expect(q?.text).toContain(head.name);
    expect(q?.text).toContain(String(living));
  });

  it('suppresses the same template/person combination in consecutive generations', () => {
    const ctx = testWorld(bundle, 21302, 1200);
    const living = ctx.world.people.blood(ctx.world.playerHouse).filter((p) => p.status === 'alive').length;
    ctx.world.bloodHighWater = Math.max(30, living * 4);
    const first = chooseGenerationQuestion(ctx)!;

    const second = chooseGenerationQuestion(ctx, first);

    expect(second?.signature).not.toBe(first.signature);
  });

  it('answers from what actually happened, not what the opening predicted', () => {
    const ctx = testWorld(bundle, 21303, 1200);
    const living = ctx.world.people.blood(ctx.world.playerHouse).filter((p) => p.status === 'alive').length;
    ctx.world.bloodHighWater = Math.max(30, living * 4);
    const q = chooseGenerationQuestion(ctx)!;
    expect(q.kind).toBe('thin_line');

    const one = ctx.world.people.blood(ctx.world.playerHouse).find((p) => p.status === 'alive' && !p.castSlots.includes('head'));
    if (one) ctx.world.people.kill(one.id, ctx.world.year, 'a fever');

    const answer = answerGenerationQuestion(ctx, q);
    const now = ctx.world.people.blood(ctx.world.playerHouse).filter((p) => p.status === 'alive').length;
    expect(answer).toContain(String(q.baseline));
    expect(answer).toContain(String(now));
  });
});
