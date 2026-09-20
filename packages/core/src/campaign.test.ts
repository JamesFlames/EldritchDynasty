import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_YEARS, END_YEAR, LATE_PHASE_START, START_YEAR, isLateCampaignYear,
} from './campaign.js';

describe('A Long Line clock (#133)', () => {
  it('runs from 1042 through 1542 for five hundred years', () => {
    expect(START_YEAR).toBe(1042);
    expect(END_YEAR).toBe(1542);
    expect(CAMPAIGN_YEARS).toBe(500);
  });

  it('moves the old final-20% Age weighting with the campaign', () => {
    expect(LATE_PHASE_START).toBe(1442);
    expect(isLateCampaignYear(1442)).toBe(false);
    expect(isLateCampaignYear(1443)).toBe(true);
    expect(isLateCampaignYear(1542)).toBe(true);
  });
});
