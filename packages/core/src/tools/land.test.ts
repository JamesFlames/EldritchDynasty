import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * THE LANDING RUNS WHAT CI RUNS, AND THE SET IS DERIVED RATHER THAN REMEMBERED.
 *
 * AGENTS.md grants standing authorisation to fast-forward `main` with no pull
 * request as soon as `npm run check` is green. `check` is
 * `typecheck && validate && test`. CI runs three jobs, and the third is the
 * gates — nine minutes of measured runs that `check` has never touched.
 *
 * Four of the eleven red runs of `check.yml` on `main` across runs 61-100
 * failed at exactly that step. Runs 64 and 65 are the clearest: typecheck,
 * validate and the whole test suite green, forty-one minutes of it, then
 * `gates` red. Both agents did what the rulebook said and broke trunk anyway.
 *
 * `tools/land.mjs` is the command that closes it. This is the test that keeps
 * it closed, and the thing it guards is not today's four steps — it is the
 * FOURTH JOB nobody has written yet. check.yml already makes this argument
 * about its own gate list:
 *
 *   "The gates are not split by name, deliberately. `npm run gate` runs
 *    whatever is in `GATES`, so a new gate is in CI the moment it exists rather
 *    than the moment somebody remembers this file — gate 2 was written for CI
 *    and wired into nothing for its whole life under the old hand-kept list."
 *
 * A landing command that names its own steps has that failure mode one level
 * up, and it is worse there: a forgotten gate costs a red build, a forgotten
 * JOB costs a red `main` that the agent responsible has already stopped
 * watching.
 */

const REPO = join(import.meta.dirname, '../../../..');
const TOOL = join(REPO, 'tools/land.mjs');
const WORKFLOW = join(REPO, '.github/workflows/check.yml');

const land = (await import(pathToFileURL(TOOL).href)) as {
  STEPS: string[];
  ADVISORY: string[];
  ciScripts: (workflow: string) => Set<string>;
};

const workflow = readFileSync(WORKFLOW, 'utf8');

describe('the landing runs every check CI runs', () => {
  it('leaves no script CI runs out of the landing', () => {
    const covered = new Set([...land.STEPS, ...land.ADVISORY]);
    const missed = [...land.ciScripts(workflow)].filter((s) => !covered.has(s));
    expect(
      missed,
      `check.yml runs ${missed.join(', ')}, and \`npm run land\` does not.\n` +
      `Add it to STEPS in tools/land.mjs — or to ADVISORY, if it provably cannot\n` +
      `fail a build, with the reason beside it. An agent's licence to push to\n` +
      `main is that command being green.`,
    ).toEqual([]);
  });

  it('claims no step CI does not actually run', () => {
    const ci = land.ciScripts(workflow);
    const invented = land.STEPS.filter((s) => !ci.has(s));
    expect(
      invented,
      `tools/land.mjs runs ${invented.join(', ')}, which check.yml does not. Either\n` +
      `CI dropped a job and the landing is now stricter than the build, or the\n` +
      `step name is wrong and the landing has been failing on a typo.`,
    ).toEqual([]);
  });

  /**
   * THE WORKFLOW IT MUST REJECT.
   *
   * A rule nobody has watched fail is indistinguishable from a rule that cannot
   * fail, which is why every gate in this repo is a function over its input
   * rather than a script — `gates.test.ts` hands each one content it must
   * refuse. This does the same with a fourth job, because that is the shape of
   * the change that will actually happen: somebody adds a job, `land` does not
   * grow a step, and nothing anywhere says so.
   */
  it('catches a job added to CI that the landing does not run', () => {
    const fourth = `${workflow}
  smoke:
    name: smoke
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run smoke
`;
    const covered = new Set([...land.STEPS, ...land.ADVISORY]);
    const missed = [...land.ciScripts(fourth)].filter((s) => !covered.has(s));
    expect(missed, 'a fourth CI job went unnoticed by the derivation').toEqual(['smoke']);
  });

  it('reads a job the workflow does not have as no job at all', () => {
    // The other direction, so the test above is not passing on a parser that
    // simply reports everything. `npm ci` is environment and never a check.
    const bare = 'jobs:\n  lint:\n    steps:\n      - run: npm ci\n';
    expect([...land.ciScripts(bare)]).toEqual([]);
  });
});

describe('the landing is reachable and documented as the licence', () => {
  it('is an npm script', () => {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.land, 'package.json has no `land` script').toContain('tools/land.mjs');
  });

  it('is what AGENTS.md names in the standing authorisation', () => {
    // The sentence granting a push to trunk with no review is the one place in
    // this repository where naming the wrong command has already cost four red
    // runs on `main`. It is worth asserting the sentence itself.
    const agents = readFileSync(join(REPO, 'AGENTS.md'), 'utf8');
    const rule = agents
      .split('\n')
      .filter((l) => /standing authorization|standing authorisation/i.test(l))
      .join('\n');
    expect(rule, 'AGENTS.md no longer states a standing authorisation at all').not.toEqual('');
    expect(
      rule,
      'the standing authorisation still licenses a push on a command that is not the ' +
      'landing. It must name `npm run land`, which is the set CI runs.',
    ).toContain('npm run land');
  });
});
