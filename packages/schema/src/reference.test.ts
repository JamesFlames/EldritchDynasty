import { describe, expect, it } from 'vitest';
import { EffectS, effectFields, effectKinds, fieldsOfSchema } from '@ed/schema';
import { CheckS, SlotSpecS } from '@ed/schema';

/**
 * The editor draws its effect, slot and check forms from these descriptors, so
 * a kind the walker cannot describe is a kind with no form — the same silent
 * gap `docs.test.ts` guards on the prose side.
 */
describe('field descriptors', () => {
  it('describes every effect kind the union has', () => {
    const fields = effectFields();
    const kinds = EffectS.options.map((o) => o.shape.kind.value);
    expect(effectKinds()).toEqual(kinds);
    for (const k of kinds) expect(Object.keys(fields), `effect '${String(k)}'`).toContain(k);
  });

  it('draws a real control for every field of every effect', () => {
    // `opaque` is the honest answer for a shape no generic control fits, and
    // the editor prints it. It is not, however, allowed to be the answer for
    // most of them — that would mean the form is decorative.
    const all = Object.values(effectFields()).flat();
    const opaque = all.filter((f) => f.control.kind === 'opaque');
    expect(all.length).toBeGreaterThan(30);
    expect(opaque.length / all.length, opaque.map((f) => f.key).join(', ')).toBeLessThan(0.15);
  });

  it('unwraps optional and default, and keeps the default to seed a new value', () => {
    const heirloom = effectFields().heirloom!;
    const op = heirloom.find((f) => f.key === 'op')!;
    expect(op.control).toEqual({ kind: 'enum', options: ['grant', 'use', 'transfer'] });
    expect(op.fallback).toBe('grant');
    expect(heirloom.find((f) => f.key === 'to')!.optional).toBe(true);
  });

  it('knows a Target when it sees one, and a scalar flag value', () => {
    expect(effectFields().attribute!.find((f) => f.key === 'target')!.control).toEqual({ kind: 'target' });
    expect(effectFields().flag!.find((f) => f.key === 'set')!.control).toEqual({ kind: 'scalar' });
    expect(effectFields().arc_flag!.find((f) => f.key === 'set')!.control).toEqual({ kind: 'scalar' });
  });

  it('descends into a nested object rather than giving up on it', () => {
    const grudge = effectFields().relationship!.find((f) => f.key === 'grudge')!;
    expect(grudge.control.kind).toBe('object');
    if (grudge.control.kind !== 'object') throw new Error('unreachable');
    expect(grudge.control.fields.map((f) => f.key)).toEqual(['severity', 'inheritance']);
  });

  it('works on the other two schemas the editor draws forms for', () => {
    expect(fieldsOfSchema(SlotSpecS).map((f) => f.key)).toContain('castBy');
    expect(fieldsOfSchema(CheckS).map((f) => f.key)).toContain('variance');
  });
});
