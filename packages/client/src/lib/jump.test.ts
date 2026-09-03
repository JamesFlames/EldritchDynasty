import { describe, expect, it } from 'vitest';
import type { StandingDelta } from '@ed/core';
import { foldStanding, signed } from './jump.js';

const quiet: StandingDelta = { treasury: 0, discontent: 0, clauses: 0 };

/**
 * WHAT A JUMP DID, SUMMED OUT OF ITS YEARS (issue #54).
 *
 * The store turns one year at a time so it can stop on a decision, so a press
 * of "a generation" arrives as up to twenty-five separate accounts. Getting the
 * sum wrong is the quiet kind of wrong: a header that says −40 when it was −400
 * looks exactly as authoritative.
 */
describe('folding a jump out of its years', () => {
  it('sums the levels over the years turned', () => {
    let d = foldStanding(null, { treasury: -30, discontent: 1, clauses: 0 });
    d = foldStanding(d, { treasury: -10, discontent: 0, clauses: 1 });
    d = foldStanding(d, { treasury: 25, discontent: -2, clauses: 0 });
    expect(d).toEqual({ treasury: -15, discontent: -1, clauses: 1 });
  });

  it('reports a quiet jump as nothing at all, not as zeroes with tiers', () => {
    const d = foldStanding(foldStanding(null, quiet), quiet);
    expect(d).toEqual({ treasury: 0, discontent: 0, clauses: 0 });
    expect(d.respect).toBeUndefined();
    expect(d.arm).toBeUndefined();
  });

  it('carries a tier move through the years that did not move it', () => {
    let d = foldStanding(null, quiet);
    d = foldStanding(d, { ...quiet, respect: { from: 'known', to: 'eminent' } });
    d = foldStanding(d, quiet);
    expect(d.respect).toEqual({ from: 'known', to: 'eminent' });
  });

  it('joins two moves into the one journey they made', () => {
    let d = foldStanding(null, { ...quiet, respect: { from: 'unknown', to: 'known' } });
    d = foldStanding(d, { ...quiet, respect: { from: 'known', to: 'eminent' } });
    expect(d.respect).toEqual({ from: 'unknown', to: 'eminent' });
  });

  /**
   * The case the fold exists for. A house that slid a tier in 1104 and clawed
   * it back by 1119 did not change tier over that generation, and a header
   * announcing "known → known" would be reporting an event that, at the
   * resolution the player is looking at, did not happen.
   */
  it('says nothing about a tier that went out and came back', () => {
    let d = foldStanding(null, { ...quiet, respect: { from: 'known', to: 'unknown' } });
    d = foldStanding(d, { ...quiet, respect: { from: 'unknown', to: 'known' } });
    expect(d.respect).toBeUndefined();
  });

  it('folds the Assize arm by the same rule', () => {
    let d = foldStanding(null, { ...quiet, arm: { from: 'indifferent', to: 'resents' } });
    d = foldStanding(d, { ...quiet, arm: { from: 'resents', to: 'indifferent' } });
    expect(d.arm).toBeUndefined();
  });
});

describe('a signed number beside a level', () => {
  it('uses a true minus sign rather than a hyphen', () => {
    expect(signed(-40)).toBe('−40');
    expect(signed(-40).charCodeAt(0)).toBe(0x2212);
  });

  it('marks a rise, because a bare number beside a level reads as the level', () => {
    expect(signed(12)).toBe('+12');
  });
});
