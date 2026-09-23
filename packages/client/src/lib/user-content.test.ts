import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { parse } from 'yaml';
import { assembleBundle } from '@ed/schema';
import { readContentDocs } from '../../build/content-plugin.js';
import { bundleWithUserContent } from './user-content.js';

const CLIENT = join(import.meta.dirname, '../..');
const CONTENT = join(CLIENT, '../content');
const shipped = readContentDocs(CONTENT);

describe('user content composition', () => {
  it('leaves the shipped bundle unchanged when an added file contributes nothing', () => {
    const baseline = assembleBundle(shipped, JSON.parse);
    const combined = bundleWithUserContent(shipped, { 'events/empty-mod.yaml': 'events: []\n' }, parse);
    expect(combined).toEqual(baseline);
  });

  it('rejects a shipped-file shadow before it can replace content', () => {
    expect(() => bundleWithUserContent(
      shipped, { 'attributes.yaml': 'attributes: []\n' }, parse,
    )).toThrow(/shadows a shipped file/);
  });

  it('rejects duplicate ids through the same named rule as CI', () => {
    const baseline = assembleBundle(shipped, JSON.parse);
    const duplicate = structuredClone(baseline.events[0]!);
    expect(() => bundleWithUserContent(
      shipped,
      { 'events/duplicate.yaml': JSON.stringify({ events: [duplicate] }) },
      parse,
    )).toThrow(/ERROR  \[ids\/unique\].*event:/);
  });
});
