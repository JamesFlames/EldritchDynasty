import type { Person } from '@ed/schema';
import type { PendingDecision } from '../events/decisions.js';
import type { ResolvedEvent } from '../events/effects.js';

/** What a year did. The only thing `stepYear` returns, and every phase writes to it. */
export interface YearReport {
  year: number;
  births: Person[];
  deaths: Person[];
  awakenings: Person[];
  agesBegan: string[];
  agesEnded: string[];
  agesNamed: string[];
  resolved: ResolvedEvent[];
  /** Decisions raised this year: choices, missions, and Record blocks. */
  pending: PendingDecision[];
  /**
   * Set when the year did NOT turn because the docket was not empty. A silent
   * no-op is the failure mode this codebase actually has, so it is said out
   * loud rather than inferred from the year not changing.
   */
  blocked?: PendingDecision[];
  /** Cadet branches founded this year (concept §16). */
  branchesFounded: string[];
  /** Set on the single year the Narrator stops being a person. */
  guardianCrossed?: Person;
}

export function emptyReport(year: number): YearReport {
  return {
    year,
    births: [], deaths: [], awakenings: [],
    agesBegan: [], agesEnded: [], agesNamed: [],
    resolved: [], pending: [], branchesFounded: [],
  };
}
