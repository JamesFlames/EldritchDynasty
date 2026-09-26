import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  activeExternalThreads, addGrudge, beget, marry, place, queueChoice, queueRecord,
  testWorld, tickRelationships,
} from '@ed/core';

const bundle = loadContent();

describe('recurring external relationship threads', () => {
  it('derives a concrete cross-system thread without storing diplomacy state', () => {
    const ctx = testWorld(bundle, 217, 1200);
    const ours = place(ctx, { sex: 'male', age: 24, name: 'Our Son' });
    const marrow = place(ctx, { sex: 'female', age: 22, name: 'Mara Marrow', house: 'house_marrow' });

    addGrudge(ctx, marrow.id, ours.id, { severity: 70, inheritance: 'house_wide' }, 'the_seal_refused');
    ctx.world.looseSecrets.push({
      secret: 'the_missing_leaf',
      carrier: marrow.id,
      carrierName: 'Mara Marrow',
      house: 'house_marrow',
      since: 1188,
      severity: 'major',
    });
    ctx.world.discrepancies.set('the_missing_leaf', {
      severity: 'major',
      provableBy: ['house_marrow'],
      state: 'open',
    });

    const [thread] = activeExternalThreads(ctx);
    expect(thread?.house).toBe('house_marrow');
    expect(thread?.origin).toMatchObject({
      kind: 'evidence',
      year: 1188,
    });
    expect(thread?.origin.text).toContain('Mara Marrow');
    expect(thread?.touches).toEqual(expect.arrayContaining(['record', 'event']));
    expect(thread?.direction).toBe('hostile');

    // Facts can reverse the practical meaning without rewriting history:
    // the same Marrow thread is now family as well as a feud.
    marry(ctx, ours, marrow);
    const changed = activeExternalThreads(ctx).find((t) => t.house === 'house_marrow');
    expect(changed?.direction).toBe('mixed');
    expect(changed?.touches).toContain('match');
    expect(changed?.origin.text).toContain('Mara Marrow');
  });


  it('keeps the same concrete origin across generations and reuses it in event and Record decisions', () => {
    const ctx = testWorld(bundle, 219, 1200);
    const ours = place(ctx, { sex: 'male', age: 50, name: 'Old Seat' });
    const theirs = place(ctx, { sex: 'male', age: 50, name: 'Old Marrow', house: 'house_marrow' });
    const ourHeir = place(ctx, { sex: 'male', age: 20, name: 'Young Seat' });
    const theirHeir = place(ctx, { sex: 'male', age: 20, name: 'Young Marrow', house: 'house_marrow' });
    beget(ctx, ourHeir, undefined, ours);
    beget(ctx, theirHeir, undefined, theirs);

    addGrudge(ctx, theirs.id, ours.id, { severity: 80, inheritance: 'house_wide' }, 'the_seal_refused');
    const first = activeExternalThreads(ctx).find((t) => t.house === 'house_marrow');
    expect(first?.origin).toMatchObject({ kind: 'grievance', year: 1200, eventId: 'the_seal_refused' });

    ctx.world.people.kill(ours.id, ctx.world.year, 'a fever');
    ctx.world.people.kill(theirs.id, ctx.world.year, 'a fever');
    ctx.world.year = 1225;
    tickRelationships(ctx);

    const inherited = activeExternalThreads(ctx).find((t) => t.house === 'house_marrow');
    expect(inherited?.origin).toEqual(first?.origin);
    expect(inherited?.origin.text).toContain('the_seal_refused');
    expect(inherited?.origin.text).toContain('1200');

    const choiceEvent = bundle.bundle.events.find((event) => event.interaction.kind === 'choice');
    if (!choiceEvent) throw new Error('content has no choice event');
    const choice = queueChoice(ctx, choiceEvent, 'Young Marrow comes again.', { VISITOR: theirHeir.id }, []);
    expect(choice.callback).toBe(inherited?.origin.text);

    const recordEvent = bundle.bundle.events.find((event) => event.record !== undefined);
    if (!recordEvent) throw new Error('content has no Record event');
    const record = queueRecord(ctx, recordEvent, 'chr_thread', { WITNESS: theirHeir.id });
    expect(record?.callback).toBe(inherited?.origin.text);
  });

  it('caps the active set at three while keeping the most salient recurring identities', () => {
    const ctx = testWorld(bundle, 218, 1300);
    const houses = ['house_marrow', 'house_calder', 'house_ilm', 'house_bracc'];
    for (const [i, house] of houses.entries()) {
      const carrier = place(ctx, { sex: 'female', age: 25, name: `Carrier ${i}`, house });
      ctx.world.looseSecrets.push({
        secret: `secret_${i}`,
        carrier: carrier.id,
        carrierName: carrier.name,
        house,
        since: 1290 + i,
        severity: 'major',
      });
    }


    const threads = activeExternalThreads(ctx);
    expect(threads).toHaveLength(3);
    expect(threads.map((t) => t.house)).toEqual(['house_bracc', 'house_ilm', 'house_calder']);
    expect(threads.every((t) => t.touches.includes('record') && t.touches.includes('event'))).toBe(true);
  });
});
