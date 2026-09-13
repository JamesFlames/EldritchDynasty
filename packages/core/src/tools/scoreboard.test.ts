import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * THE SCOREBOARD'S OWN COMMENT PROMISED THIS FILE AND IT DID NOT EXIST.
 *
 * `tally` in `tools/scoreboard.mjs` carries "Exported so `scoreboard.test.ts`
 * can hand it commits whose verdicts it controls", and nothing by that name
 * was ever written — the export was reachable by nobody, which is invariant
 * 11 applied to a tool rather than to the engine. It is written now because
 * the shard matrix gave it something to check.
 *
 * `npm run scoreboard` answers "red rate on `main`, and which job went red".
 * The second half of that stopped being answerable the moment `check.yml`
 * became a four-way test shard and a two-lane gates matrix, because GitHub
 * names a matrix job after its matrix value and the verdict ref records the
 * names verbatim.
 */
const REPO = join(import.meta.dirname, '../../../..');
const TOOL = join(REPO, 'tools/scoreboard.mjs');

const scoreboard = (await import(pathToFileURL(TOOL).href)) as {
  jobFamily: (name: string) => string;
  tally: (rows: { verdict: { conclusion: string; jobs: { name: string; result: string }[] } | null }[]) => {
    total: number; green: number; red: number; pending: number; unjudged: number;
    byJob: Record<string, number>;
  };
};

describe('a matrix job is counted under the job it is part of', () => {
  it('folds the test shards together', () => {
    expect(scoreboard.jobFamily('test 1/4')).toBe('test');
    expect(scoreboard.jobFamily('test 4/4')).toBe('test');
  });

  it('folds the gate lanes together', () => {
    expect(scoreboard.jobFamily('gates (batch)')).toBe('gates');
    expect(scoreboard.jobFamily('gates (war)')).toBe('gates');
  });

  it('leaves a job that is not in a matrix exactly as it is', () => {
    // The other direction, so the rule above is not passing on a function that
    // trims something off everything it is handed. This is a real job name.
    expect(scoreboard.jobFamily('typecheck + validate')).toBe('typecheck + validate');
  });

  /**
   * THE BUG THIS ACTUALLY PREVENTS, and it is not cosmetic.
   *
   * Vitest shards by a hash of the file PATH, so which shard a suite lands in
   * moves whenever a test file is added anywhere in the repository. Counted
   * raw, one suite failing twice in a fortnight reads as two different jobs
   * failing once each — a fact about a hash, reported as a fact about the
   * build.
   */
  it('counts one suite failing in two different shards as two reds in test', () => {
    const red = (job: string) => ({
      verdict: {
        conclusion: 'failure',
        jobs: [
          { name: job, result: 'failure' },
          { name: 'typecheck + validate', result: 'success' },
        ],
      },
    });
    const t = scoreboard.tally([red('test 2/4'), red('test 4/4')]);
    expect(t.red).toBe(2);
    expect(t.byJob).toEqual({ test: 2 });
  });

  it('still reports a window with no verdicts as unjudged, not as a clean sheet', () => {
    // The case the original comment named, and the reason `tally` was exported
    // in the first place. An absence is not a pass — see `tools/verdict.mjs`.
    const t = scoreboard.tally([{ verdict: null }, { verdict: null }]);
    expect(t.unjudged).toBe(2);
    expect(t.green).toBe(0);
    expect(t.red).toBe(0);
  });
});
