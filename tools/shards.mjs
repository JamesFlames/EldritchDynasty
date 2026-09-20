/**
 * NO SHEBANG: THIS IS THE ONE FILE IN `tools/` THAT IS NOT SPAWNED.
 *
 * `vitest.config.ts` IMPORTS it, and vite inlines the config's dependencies
 * through esbuild before running it — a `#!` line halfway through the bundle
 * is a syntax error there, which is how this was found. Every other script
 * here is started with `node` and keeps its shebang.
 *
 * SHARDING BY WHAT A FILE COSTS, NOT BY WHAT ITS NAME HASHES TO.
 *
 * ── THE FACT THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * Run 185 (`main`, green, 4601428): `test 2/4` took 67m47s. The other three
 * shards took 3m02s, 10m45s and 4m03s, and every job in the build started
 * within three seconds of every other — so this was never queuing. It was one
 * shard holding the build open for three quarters of an hour while seven jobs
 * sat finished and idle. The build was 68 minutes; the work in it was not.
 *
 * Vitest's `--shard=i/n` hashes each file's PATH, sorts by the hash and slices
 * into equal COUNTS (`BaseSequencer.shard`, vitest 2.1.9). The split is
 * deterministic and duration-blind, so a shard's cost is whatever suites its
 * hash happened to draw — and adding one test file anywhere can move several
 * suites between shards. `check.yml` had that written down correctly and drew
 * the wrong conclusion from it, because the numbers underneath the conclusion
 * had rotted. See #142, #143 and #146.
 *
 * ── WHAT THIS DOES INSTEAD ────────────────────────────────────────────────
 *
 * Greedy longest-processing-time bin-packing over recorded per-file durations:
 * sort the files by cost, longest first, and give each one to the shard that
 * is cheapest so far. LPT is within 4/3 of optimal for this problem and needs
 * no search, which matters because every runner computes the packing
 * independently and they must all reach the same answer.
 *
 * DETERMINISM IS THE ONE PROPERTY THAT CANNOT BEND. Two runners that packed
 * differently would run some files twice and others NEVER, and nothing would
 * report it: the suite would be green with a hole in it, which is this
 * repository's house failure mode wearing a speed-up. So every input to the
 * packing is committed data and every tie is broken by a stated rule — cost
 * descending, then path ascending, then the lowest-numbered shard. Nothing
 * here reads the clock, the filesystem's order, or a cache.
 *
 * ── AND WHAT IT CANNOT DO ─────────────────────────────────────────────────
 *
 * Vitest parallelises per FILE. A single file that takes forty minutes is a
 * floor no packing and no shard count can cut, and the only fix for one of
 * those is the one AGENTS.md already prescribes: split it BY TEST, never by
 * seed range, because these are batch statistics and taking seeds out of a
 * batch changes what the batch claims. `lanes.test.ts` is where that stops
 * being advice — it fails the build when the packing cannot get the shards
 * inside a stated factor of each other, which is exactly the condition
 * "one file is bigger than a shard's fair share" produces.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WHERE THE DURATIONS LIVE, AND WHY THEY ARE COMMITTED DATA.
 *
 * `tools/cost.mjs --write` measures the suite and writes this file. It is read
 * by two things that must not be able to disagree: the packing below, and the
 * balance rule in `lanes.test.ts`. #146's whole argument is that a figure
 * something READS stops being prose and starts being data — a wrong comment is
 * a wrong comment, and wrong data fails a test.
 *
 * It is a cache of a measurement, not a golden file: nothing is asserted about
 * a particular number. A stale entry costs the build some balance and cannot
 * cost it a test, because every file is run either way — see `packShards`.
 */
export const DURATIONS_FILE = 'tools/test-durations.json';

/**
 * What a file nobody has measured is assumed to cost, in milliseconds.
 *
 * A NEW TEST FILE MUST NOT BE ASSUMED FREE. Assume zero and every unmeasured
 * suite piles into shard 1, which is the bug this file exists to fix, arriving
 * by a different door. Assume the mean and a new slow suite lands wherever it
 * likes — also wrong, but wrong by the width of one file rather than by the
 * width of the lane.
 *
 * So: the fast lane's per-file fixed cost is about 200ms (the Zod pass over
 * the content bundle), a typical mechanism suite is a second or two, and
 * anything that plays games is orders of magnitude above that and carries the
 * `.slow` suffix by rule. Six seconds is comfortably above a fast-lane file
 * and far below a slow one, so an unmeasured FAST file is packed about right
 * and an unmeasured SLOW one is under-weighted until the next measurement —
 * which the balance rule then reports rather than absorbing.
 */
export const UNMEASURED_MS = 6_000;

/** Read the committed durations, or an empty table if there are none yet. */
export function readDurations(repo) {
  try {
    const raw = JSON.parse(readFileSync(join(repo, DURATIONS_FILE), 'utf8'));
    return raw.files ?? {};
  } catch {
    return {};
  }
}

/**
 * Pack `files` into `count` shards, longest-processing-time first.
 *
 * `files` are repo-relative paths. Returns an array of `count` arrays, each
 * sorted longest-first — which is also the order to RUN them in, so a shard's
 * own tail is its cheapest files rather than its dearest.
 *
 * EVERY FILE LANDS IN EXACTLY ONE SHARD, whatever the durations say. That is
 * the property that makes a stale duration table harmless: it can misjudge how
 * long a file takes, and it cannot lose one. `lanes.test.ts` asserts the
 * partition as well as the balance, because the balance is a performance claim
 * and the partition is a correctness one.
 */
export function packShards(files, count, durations = {}, unmeasured = UNMEASURED_MS) {
  const cost = (f) => durations[f] ?? unmeasured;
  // Deterministic input order: dearest first, then by path. Two runners that
  // walked the filesystem in different orders must still pack identically.
  const ordered = [...files].sort((a, b) => cost(b) - cost(a) || (a < b ? -1 : a > b ? 1 : 0));

  const bins = Array.from({ length: count }, () => ({ total: 0, files: [] }));
  for (const file of ordered) {
    // The cheapest bin, ties going to the lowest-numbered shard.
    let pick = 0;
    for (let i = 1; i < bins.length; i += 1) if (bins[i].total < bins[pick].total) pick = i;
    bins[pick].files.push(file);
    bins[pick].total += cost(file);
  }
  return bins.map((b) => b.files);
}

/** What each shard of a given packing costs, for a report or an assertion. */
export function shardCosts(files, count, durations = {}, unmeasured = UNMEASURED_MS) {
  const cost = (f) => durations[f] ?? unmeasured;
  return packShards(files, count, durations, unmeasured)
    .map((shard) => shard.reduce((n, f) => n + cost(f), 0));
}

/**
 * The vitest sequencer. Named in `vitest.config.ts` under
 * `test.sequence.sequencer`.
 *
 * `shard` is the whole point; `sort` is a free improvement that comes with it.
 * Vitest's default `sort` reads a local cache of previous runs, which is empty
 * on a CI runner — so within a shard the file order was effectively arbitrary
 * and a forty-minute file could start last, after the pool had nothing left to
 * overlap it with. Longest-first is the standard answer and costs nothing.
 */
export class DurationSequencer {
  constructor(ctx) {
    this.ctx = ctx;
    this.durations = readDurations(ctx.config.root);
  }

  /** Repo-relative, POSIX-separated — the key the durations file uses. */
  key(spec) {
    const root = this.ctx.config.root.replace(/\\/g, '/');
    const id = spec.moduleId.replace(/\\/g, '/');
    return id.startsWith(root) ? id.slice(root.length).replace(/^\//, '') : id;
  }

  async shard(files) {
    const { index, count } = this.ctx.config.shard;
    const byKey = new Map(files.map((spec) => [this.key(spec), spec]));
    const mine = packShards([...byKey.keys()], count, this.durations)[index - 1] ?? [];
    return mine.map((k) => byKey.get(k));
  }

  async sort(files) {
    const cost = (spec) => this.durations[this.key(spec)] ?? UNMEASURED_MS;
    return [...files].sort((a, b) => {
      const d = cost(b) - cost(a);
      if (d !== 0) return d;
      const ka = this.key(a);
      const kb = this.key(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }
}
