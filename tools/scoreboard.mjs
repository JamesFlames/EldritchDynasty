#!/usr/bin/env node
/**
 * WHAT THE AGENT LOOP COSTS, MEASURED THE WAY THE GAME IS MEASURED.
 *
 * This repository measures the simulation obsessively. `docs/BALANCE-LOG.md`
 * records what every content drop did to the frequency tiers. Nine gates play
 * thousands of years to ask whether a design claim is true. `npm run digest`
 * proves a refactor changed nothing.
 *
 * None of it is pointed at the loop the agent runs. Every figure in issue #116
 * — 11 red runs in 40, seven landings with no verdict at all, four of the reds
 * at the `gates` step that `npm run check` never ran — was obtained by hand,
 * once, by reading the Actions list. Which means the rest of that epic was
 * unfalsifiable: it would be fixed, and nobody could say by how much.
 *
 * WHY THIS READS REFS AND NOT THE API. Same reason `verdict.mjs` does, and the
 * reason is measured: a session's curl to api.github.com comes back
 * `403 GitHub access is not enabled for this session`. `git fetch` works.
 * `.github/workflows/verdict.yml` records every `check` run onto
 * `refs/verdict/<sha>`, so the history of what CI decided is in the repository
 * rather than behind a credential this tool cannot hold.
 *
 * That has one honest consequence worth stating plainly: it can only see back
 * as far as the verdict refs go, and they were first written on 2026-09-07.
 * The 40-run history in #116 predates them and is not reconstructible here.
 * A scoreboard that quietly reported "0 red in 3 runs" while the epic's own
 * evidence lay outside its window would be worse than none, so it says how
 * many commits it could and could not judge.
 *
 *   npm run scoreboard              # the last 40 commits on main
 *   npm run scoreboard -- 100       # a longer window
 */
import { execFileSync } from 'node:child_process';

const NS = 'refs/verdict';
const WINDOW = Number(process.argv[2] ?? 40);

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

const tryGit = (...args) => {
  try {
    return { ok: true, out: git(...args) };
  } catch {
    return { ok: false, out: '' };
  }
};

/** The verdict recorded for a commit, or null. Same shape verdict.mjs reads. */
function verdictFor(sha) {
  const r = tryGit('log', '-1', '--format=%B', `${NS}/${sha}`);
  if (!r.ok) return null;
  const field = (name) => new RegExp(`^${name}: (.+)$`, 'm').exec(r.out)?.[1]?.trim();
  const conclusion = field('conclusion');
  if (!conclusion) return null;
  return {
    conclusion,
    jobs: [...r.out.matchAll(/^job: (.+?) = (.+)$/gm)].map(([, name, result]) => ({ name, result })),
  };
}

/**
 * THE JOB FAMILY — `test 3/4` and `gates (war)` counted as `test` and `gates`.
 *
 * `check.yml` runs the tests as a four-way shard matrix and the gates in two
 * lanes, so GitHub names the jobs `test 1/4` … `test 4/4` and `gates (batch)`
 * / `gates (war)`. Counted raw, "which job went red" fragments into six
 * buckets and stops answering the question it exists for — and worse, it
 * fragments ACROSS TIME: vitest shards by path-hash, so the same failing
 * suite moves between shard numbers whenever a test file is added anywhere in
 * the repository. Two reds in `test` would read as one red in `test 2/4` and
 * one in `test 4/4`, which is a fact about a hash and not about the build.
 *
 * Which shard it was is in the verdict ref and in the Actions UI, where
 * somebody debugging one failure is already looking. This is the aggregate.
 */
export function jobFamily(name) {
  return name.replace(/\s+\d+\/\d+$/, '').replace(/\s*\([^)]*\)$/, '').trim();
}

/**
 * The four states, and the counts that matter.
 *
 * Exported so `scoreboard.test.ts` can hand it commits whose verdicts it
 * controls — including a window with no verdicts at all, which must report as
 * unjudged rather than as a clean sheet.
 */
export function tally(rows) {
  const out = { total: rows.length, green: 0, red: 0, pending: 0, unjudged: 0, byJob: {} };
  for (const { verdict } of rows) {
    if (!verdict) { out.unjudged++; continue; }
    if (verdict.conclusion === 'pending') { out.pending++; continue; }
    if (verdict.conclusion === 'success') { out.green++; continue; }
    out.red++;
    for (const j of verdict.jobs) {
      if (j.result !== 'success') {
        const fam = jobFamily(j.name);
        out.byJob[fam] = (out.byJob[fam] ?? 0) + 1;
      }
    }
  }
  return out;
}

/** Percentage over the commits that HAVE a verdict, not over the window. */
export const redRate = (t) => {
  const judged = t.green + t.red;
  return judged === 0 ? null : (t.red / judged) * 100;
};

function main() {
  if (!tryGit('fetch', '--quiet', 'origin', `+${NS}/*:${NS}/*`).ok) {
    console.error('scoreboard: could not reach the remote.');
    process.exit(1);
  }
  tryGit('fetch', '--quiet', 'origin', 'main');

  const shas = git('rev-list', `-${WINDOW}`, 'origin/main').split('\n').filter(Boolean);
  const rows = shas.map((sha) => ({
    sha,
    subject: tryGit('log', '-1', '--format=%s', sha).out,
    verdict: verdictFor(sha),
  }));
  const t = tally(rows);
  const rate = redRate(t);

  console.log(`main, last ${t.total} commits\n`);
  console.log(`  green      ${String(t.green).padStart(4)}`);
  console.log(`  red        ${String(t.red).padStart(4)}`);
  console.log(`  pending    ${String(t.pending).padStart(4)}`);
  console.log(`  unjudged   ${String(t.unjudged).padStart(4)}   no verdict ref — see below`);
  console.log('');
  console.log(`  red rate   ${rate === null ? '   —' : `${rate.toFixed(1)}%`}   over the ${t.green + t.red} commit(s) with a verdict`);

  if (Object.keys(t.byJob).length) {
    console.log('\n  which job went red:');
    for (const [job, n] of Object.entries(t.byJob).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${job.padEnd(24)} ${n}`);
    }
  }

  if (t.red) {
    console.log('\n  red commits:');
    for (const r of rows) {
      if (r.verdict && r.verdict.conclusion !== 'success' && r.verdict.conclusion !== 'pending') {
        console.log(`    ${r.sha.slice(0, 7)}  ${r.subject.slice(0, 60)}`);
      }
    }
  }

  if (t.unjudged) {
    console.log('');
    console.log(`  ${t.unjudged} of ${t.total} commit(s) have no verdict ref. Verdicts began on`);
    console.log('  2026-09-07, so anything older is outside this window rather than unjudged');
    console.log('  in the sense #118 means. A RECENT commit with no verdict is the real');
    console.log('  thing: `npm run verdict -- <sha>` says which.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('scoreboard.mjs')) main();
