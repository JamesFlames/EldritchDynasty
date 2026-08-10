import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_RULES, EffectS, SlotRoleS, vocabulary } from '@ed/schema';
import { renderVocabulary, vocabularyIsCurrent, VOCABULARY_PATH } from './tools/gen-docs.js';
import { YEAR_PHASES } from './year/phases.js';

/**
 * `docs/VOCABULARY.md` is generated the way `loci.yaml` is, and for the same
 * reason: a reference kept by hand is wrong by the second commit, and a wrong
 * reference is worse than none — it is read and believed.
 */
describe('the generated reference', () => {
  it('is up to date', () => {
    expect(
      vocabularyIsCurrent(),
      'docs/VOCABULARY.md is stale — run `npm run gen:docs`',
    ).toBe(true);
  });

  it('names every effect kind, slot role, phase and rule', () => {
    const text = renderVocabulary();
    for (const kind of EffectS.options.map((o) => o.shape.kind.value)) {
      expect(text, `effect '${kind}' is not in the reference`).toContain(`\`${kind}\``);
    }
    for (const role of SlotRoleS.options) {
      expect(text, `slot role '${role}' is not in the reference`).toContain(`\`${role}\``);
    }
    for (const phase of YEAR_PHASES) {
      expect(text, `phase '${phase.name}' is not in the reference`).toContain(`\`${phase.name}\``);
    }
    for (const rule of CONTENT_RULES) {
      expect(text, `rule '${rule.id}' is not in the reference`).toContain(`\`${rule.id}\``);
    }
  });

  it('says out loud that it is generated', () => {
    expect(readFileSync(VOCABULARY_PATH, 'utf8')).toContain('Generated');
  });

  it('does not describe a condition or filter twice', () => {
    const v = vocabulary();
    for (const group of [v.conditions, v.filters, v.effects]) {
      const names = group.map((x) => x.name);
      expect(new Set(names).size, `duplicate in ${names.join(', ')}`).toBe(names.length);
    }
  });

  it('describes every condition and filter the engine can evaluate', () => {
    const v = vocabulary();
    // `evalCondition` and `evalFilter` are exhaustive over these unions — see
    // the `assertNever` at the end of each. If the reference lists them all,
    // an author never has to open `conditions.ts` to find out what exists.
    const source = readFileSync(join(import.meta.dirname, 'events', 'conditions.ts'), 'utf8');
    for (const c of v.conditions) {
      expect(source, `condition '${c.name}' is in the schema and not in evalCondition`)
        .toContain(`'${c.name}' in c`);
    }
    for (const f of v.filters) {
      expect(source, `filter '${f.name}' is in the schema and not in evalFilter`)
        .toContain(`'${f.name}' in f`);
    }
  });
});
