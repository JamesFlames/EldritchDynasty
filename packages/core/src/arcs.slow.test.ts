import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { expectRate, bootstrap, candidatesFor, runYears } from '@ed/core';

const bundle = loadContent();

/**
 * ONE BATCH, READ SEVERAL WAYS.
 *
 * This used to be three: sixty runs for coverage, six for the seal arc's last
 * node, twelve for the seal arc's memory. The two small batches were the
 * expensive kind of wrong — measured over thirty runs, the shipped arc reaches
 * `our_letter` in **five** of them and writes `answered_in_writing` in five,
 * so "at least one hit in six trials" is a two-in-three coin and "at least one
 * in twelve" is a nine-in-ten one. Both passed for months and both went red
 * the day the event stream moved under them, on an arc that the same
 * measurement says got HEALTHIER: seal openings 21 -> 26 of 30, the regalia
 * node 10 -> 19.
 *
 * That is CLAUDE.md's own rule — *never pin a test to seeds reaching a state;
 * assert the mechanism* — and the cheapest way to keep it here is to stop
 * running small batches at all. The sixty-run batch already walks every arc
 * instance these tests want, so it is collected once and the seal tests read
 * it. The file lost eighteen thousand-year runs and every assertion in it got
 * stronger.
 *
 * Gate 8 (outcome reach, 250 runs) is still the statistically rigorous
 * version of "does this branch ever get taken"; this file's job is catching a
 * branch that is STRUCTURALLY unreachable.
 */
interface Batch {
  fires: Map<string, number>;
  /** Every arc instance every run in the batch ended up holding. */
  arcs: { seed: number; arc: string; node: string; localFlags: Record<string, unknown>; history: { node: string }[] }[];
}

function runBatch(seeds: number[], years = 1000): Batch {
  const fires = new Map<string, number>();
  const arcs: Batch['arcs'] = [];
  for (const seed of seeds) {
    const ctx = bootstrap(bundle, seed, 1042);
    runYears(ctx, years);
    for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
      fires.set(id, (fires.get(id) ?? 0) + n);
    }
    // The frame rations off its own ledger (`world.frame`), not `frequency`
    // (issue #13) — folded in here so one helper still answers "did this
    // fire at all" for every tier, frame included.
    for (const e of ctx.world.frame.entries) {
      fires.set(e.eventId, (fires.get(e.eventId) ?? 0) + 1);
    }
    for (const inst of ctx.world.arcs.values()) {
      arcs.push({
        seed, arc: String(inst.arc), node: String(inst.node),
        localFlags: { ...inst.localFlags },
        history: inst.history.map((h) => ({ node: String(h.node) })),
      });
    }
  }
  return { fires, arcs };
}

function fireCounts(seeds: number[], years = 1000): Map<string, number> {
  return runBatch(seeds, years).fires;
}

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 13);

/**
 * 60, not 12 — for "every event fired at least once" ONLY. The frame tier's
 * rarest interlude fires in ~7% of runs, and "at least one hit in 12 trials"
 * at that rate is a coin flip, not a check. Gate 2 (slot-fillability) and
 * gate 4 (fire-rate, 100 seeds) are the statistically rigorous versions of
 * this same question; this file's job is catching a template that is
 * STRUCTURALLY unreachable, and 60 seeds is the smallest batch that stops a
 * genuinely-working ~7% event from failing this file by chance alone.
 *
 * Deliberately NOT used for `SEEDS`' other consumers below — "the frame"
 * describe block asserts something PER SEED (every one of them fires at
 * least one interlude), which gets HARDER, not easier, with more seeds: a
 * bigger batch is more likely to contain the one-in-sixty run that goes
 * silent by chance, and that is not a bug the way a dead template is.
 */
/**
 * A HUNDRED AND TWENTY, NOT SIXTY (issue #61).
 *
 * "Every event fires at least once" is a zero-tolerance claim over four
 * hundred templates, and it is only as strong as the batch behind it. The
 * rarest of them are a few per cent: `frame_what_the_ledger_says_of_the_seal`
 * needs an open `seal_keeping_lie` Discrepancy and fires in about one run in
 * eighteen, so **fifty-three seeds are needed for a 95% chance of seeing it
 * once** — and at sixty it was passing on a single hit, seed 1078.
 *
 * A balance change duly re-rolled that hit away. It did not break the event:
 * measured over 180 seeds it fires as it always did, just in different ones.
 * That is the failure this repository warns about in `CLAUDE.md` —
 *
 *   > adding ANY template re-rolls which scene wins every draw for a thousand
 *   > years. A thin margin is invisible until it is spent.
 *
 * — and it is the same underpowered zero that gate 8 and gate 4 were both
 * fixed for. A zero only means "dead" at a batch size that can tell it from
 * "rare", and sixty could not.
 */
const COVERAGE_SEEDS = Array.from({ length: 120 }, (_, i) => 1000 + i * 13);

/**
 * Events that never fire are the silent failure mode of this entire genre.
 * Nothing errors; the content simply is not in the game. Two arc bugs were
 * found this way, and neither was visible any other route.
 */
/** Collected once, at collection time, and read by four tests below. */
const BATCH = runBatch(COVERAGE_SEEDS);

describe('every authored event can actually happen', () => {
  const fires = BATCH.fires;

  it('fires every event at least once across the batch', () => {
    const dead = bundle.events
      .filter((e) => (fires.get(e.id) ?? 0) === 0)
      .map((e) => e.id);
    expect(dead).toEqual([]);
  });

  it('reaches the last node of a multi-generation arc', () => {
    // seal_the_regalia_incomplete is three nodes and ~two centuries deep.
    expect(fires.get('seal_the_regalia_incomplete') ?? 0).toBeGreaterThan(0);
  });

  it('keeps the tiers in their intended proportion', () => {
    const total = (freq: string) => bundle.events
      .filter((e) => e.frequency === freq)
      .reduce((n, e) => n + (fires.get(e.id) ?? 0), 0);
    expect(total('common')).toBeGreaterThan(total('uncommon'));
    expect(total('uncommon')).toBeGreaterThan(total('rare'));
    expect(total('rare')).toBeGreaterThan(total('mythic'));
  });
});

/**
 * THE FRAME (concept §2, issue #13). Twelve to eighteen interludes across a
 * run was the design's original target — this replaces the tier exclusion
 * the coverage test above used to carry.
 *
 * A frame interlude is gated by `reads`, not drawn from a rationed pool, so
 * its per-seed count is genuinely bursty: a run whose seal storyline never
 * gets a bad roll fires it a dozen times on its own, a run where nothing
 * embellishes fires almost nothing. The batch total is the number the design
 * target is actually about — one seed landing outside the range is not a bug
 * the way a dead template is.
 *
 * RE-MEASURED after phases 6 and 7 (issues #15-17, #19): the Library, careers
 * and the auction all redirect treasury and heirloom/spellbook acquisition
 * through channels other than the events the frame's Discrepancies used to
 * depend on firing, and `the_notarised_pedigree` gained a second castable
 * slot for the forging path — all of it legitimate new content competing for
 * the same one-event-a-year ambient budget, not a regression. Batch mean
 * dropped from ~14 to ~10; the floor moves with it rather than the game being
 * detuned to hit a number set before any of that existed.
 *
 * RE-MEASURED AGAIN after the household-posts drop, for the same reason and
 * with the numbers this time. The non-frame pool went from 64 templates to 78
 * in one commit; measured over the same twelve seeds, Discrepancies per run
 * fell 5.25 to 4.83 and the batch mean fell 8.83 to 6.75. The frame is
 * super-linear in that: an interlude needs an OPEN Discrepancy some template
 * reads AND a year past the 28-year gap, so a tenth off the supply is a
 * quarter off the count. Four interludes were added over the new record
 * material and moved this batch by nothing at all, because the chronicler
 * answering a Record block for himself rarely embellishes and the frame reads
 * what embellishment leaves behind.
 *
 * So the floor is 5, at the same fraction of the measured mean the 8 was. Two
 * things worth knowing before touching it again: twelve seeds spread 2..13
 * puts the standard error near 1, so this assertion has never been able to
 * resolve less than about a two-point move; and every drop of ambient content
 * will do this again. If it needs moving a fourth time, the thing to question
 * is the one-event-a-year budget, not the number on this line.
 *
 * AND THE OTHER DIRECTION, MEASURED, because it is the one that surprises.
 * Tripling the archive substory's reach and giving the short copy at Cawdry a
 * route that is not the chronicler's one-in-five Embellish took two interludes
 * from 1-2% of runs to 10-13% — and moved this batch's mean by 7.83 to 7.17,
 * which is nothing. THE FRAME'S CADENCE CAPS THE COUNT AND THE SUPPLY DECIDES
 * THE VARIETY: a run gets about as many interludes either way, and what
 * changed is which of the eighteen it can possibly be. So this number is the
 * wrong instrument for asking whether an interlude is reachable — gate 8 is
 * the right one, and it reads every interlude's own reach.
 */
describe('the frame', () => {
  function frameCounts(seeds: number[], years = 1000): number[] {
    return seeds.map((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, years);
      return ctx.world.frame.entries.length;
    });
  }

  it('fires in every seed of the batch — never a run of total silence', () => {
    const counts = frameCounts(SEEDS);
    expect(counts.every((n) => n > 0), `counts were ${counts.join(',')}`).toBe(true);
  });

  it('averages 5-18 interludes per run across the batch', () => {
    const counts = frameCounts(SEEDS);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(mean, `per-seed counts were ${counts.join(',')}`).toBeGreaterThanOrEqual(5);
    expect(mean, `per-seed counts were ${counts.join(',')}`).toBeLessThanOrEqual(18);
  });

  it('never dispenses systems information — no effects, record or rumour, ever', () => {
    for (const e of bundle.events) {
      if (e.tier !== 'frame') continue;
      for (const o of e.interaction.kind === 'narration' ? e.interaction.outcomes : []) {
        expect(o.effects, `${e.id}/${o.id}`).toEqual([]);
      }
      expect(e.record, e.id).toBeUndefined();
      expect(e.rumour, e.id).toBeUndefined();
    }
  });

  it('narrows the two listener roles to the head and the guardian', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 200); // long enough that the Narrator has crossed over
    const guardian = ctx.world.people.guardian();
    expect(guardian, 'no guardian yet — the frame should have nothing to cast').toBeTruthy();

    const blood = candidatesFor({ role: 'listener_blood', castBy: 'engine', optional: false, filters: [], bind: 'event' }, ctx, {});
    const record = candidatesFor({ role: 'listener_record', castBy: 'engine', optional: false, filters: [], bind: 'event' }, ctx, {});
    expect(blood.every((p) => p.castSlots.includes('head'))).toBe(true);
    expect(record).toEqual([guardian]);
  });
});

describe('arc bindings', () => {
  /**
   * BUG 1: a node that does not declare the arc's bound slot was treated as
   * having an unfillable one, so the whole arc cancelled. The seal feud's
   * final scene never fired in twenty thousand simulated years.
   */
  it('does not cancel an arc for a binding the node never uses', () => {
    const arc = bundle.arcs.find((a) => a.id === 'arc_the_given_seal')!;
    const bound = arc.bindings[0]!;
    const lastNode = arc.nodes.find((n) => n.id === 'counted')!;
    const lastEvent = bundle.events.find((e) => e.id === lastNode.event)!;

    // The shape that used to break it: bound arc-wide, unused by this node.
    expect(arc.bindings).toContain(bound);
    expect(Object.keys(lastEvent.slots)).not.toContain(bound);

    // Sixty runs, not the six this used to draw: `counted` fires in about a
    // third of runs, so six trials answered "is this reachable" with a coin.
    expect(BATCH.fires.get(lastEvent.id) ?? 0).toBeGreaterThan(0);
  });

  /**
   * BUG 2: `inherit` returned the requested relation or nothing, and nothing
   * cancelled the arc — so a man dying childless ended the feud. It should
   * fall through to his closest blood and then to his house.
   */
  it('passes a grudge down past a childless death', () => {
    const fires = fireCounts(SEEDS);
    // Node two sits 45-120 years after node one, so its cast is reliably dead.
    const started = fires.get('seal_aftermath') ?? 0;
    const continued = fires.get('seal_the_grandson_presses') ?? 0;
    expect(started).toBeGreaterThan(0);
    // Before the fix this ratio was 3/27. Feuds should usually survive.
    // `expectRate` rather than a bare ratio: the denominator here is however
    // many times the arc happened to open, which nobody chose, so the margin
    // has to be checked rather than assumed.
    expectRate({
      hits: continued,
      n: started,
      floor: 0.4,
      what: 'a feud died with the man who started it',
    });
  });

  /**
   * The other half of BUG 2, stated from content: `inherit` CANCELS an arc
   * when the line it follows runs out, and `arc_what_went_with_her` follows a
   * servant's line for two hundred years. Nodes two and three are therefore
   * `continue_absent`, and this is the assertion that would fail the day
   * somebody "tidies" them to `inherit: eldest_child` to match node one — the
   * arc would still start, still validate, and quietly stop finishing.
   */
  it('carries a document past the family that made it', () => {
    // 40 seeds, not the batch's 12. This arc opens in under a tenth of runs —
    // its launcher wants an archivist in post, a third generation and either a
    // thin treasury or a cold Age — so twelve seeds is about one expected
    // opening, and a test that asserts on one expected observation is a coin
    // flip that reads as a regression whenever it lands tails.
    const fires = fireCounts(Array.from({ length: 40 }, (_, i) => 1000 + i * 13));
    const started = fires.get('archive_the_morning_after') ?? 0;
    const listed = fires.get('archive_the_bookseller_at_cawdry') ?? 0;

    expect(started, 'the archive arc never started in forty runs').toBeGreaterThan(0);
    expectRate({
      hits: listed,
      n: started,
      floor: 0.4,
      what: 'the index never came back up for sale',
    });
  });

  it('never runs two instances of a single-instance arc at once', () => {
    for (const seed of [1042, 77, 909]) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);
      for (const def of bundle.arcs) {
        const active = [...ctx.world.arcs.values()]
          .filter((a) => a.arc === def.id && a.status === 'active');
        expect(active.length, `${def.id} seed ${seed}`).toBeLessThanOrEqual(def.maxConcurrentInstances);
      }
    }
  });

  it('never leaves an arc pointing at a node that does not exist', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    runYears(ctx, 800);
    for (const inst of ctx.world.arcs.values()) {
      // `bundle` is indexed content, so this covers the arcs `desugar.ts`
      // compiled from inline follow-ups as well as the authored ones.
      const arc = bundle.arcs.find((a) => a.id === inst.arc)!;
      expect(arc.nodes.some((n) => n.id === inst.node), `${inst.arc}/${inst.node}`).toBe(true);
    }
  });
});

/**
 * WHAT THE STORY REMEMBERS, over real runs.
 *
 * `arc-memory.test.ts` tests the mechanism directly and cheaply. This tests the
 * only property that a unit test cannot: that the seal feud's fourth beat is
 * reachable at all, and that it is reachable ONLY by the houses that earned it.
 * A guard that never opens and a guard that always opens look the same in a
 * fast test and are both content bugs.
 */
describe('a substory branching on its own memory', () => {
  it('reaches the fourth beat only where the house answered in writing', () => {
    let answered = 0;
    let reachedFourth = 0;

    for (const inst of BATCH.arcs) {
      if (inst.arc !== 'arc_the_given_seal') continue;

      const wroteBack = inst.localFlags.answered_in_writing === true;
      const sawFourth = inst.node === 'our_letter'
        || inst.history.some((h) => h.node === 'our_letter');
      if (wroteBack) answered += 1;
      if (sawFourth) reachedFourth += 1;

      // THE GUARD, asserted from both sides. A run that never wrote back
      // must never see the letter come home; that is the whole content of
      // `when: { arcFlag: answered_in_writing }`.
      expect(sawFourth && !wroteBack, `seed ${inst.seed}: reached our_letter without answering`).toBe(false);
    }

    // And it must not be a guard that never opens. Sixty runs rather than the
    // twelve this drew of its own: the branch is taken in about one run in
    // six, so twelve trials failed this outright roughly one time in ten and
    // said nothing about the guard when they did.
    expect(answered, 'no run took the answer_in_writing branch').toBeGreaterThan(0);
    expect(reachedFourth, 'the fourth beat is unreachable in practice').toBeGreaterThan(0);
  });

  it('writes story memory onto one instance and not into the world', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 900);
    // `arc_flag` exists so a story can remember something WITHOUT it becoming a
    // world flag every other event in the game can see. If it leaked, the
    // namespace would fill with per-run facts and every ambient template could
    // gate on somebody else's feud.
    expect(ctx.world.flags.has('answered_in_writing')).toBe(false);
  });
});

/**
 * INLINE FOLLOW-UPS, over real runs. The unit tests prove `next` compiles to an
 * arc; this proves the compiled arc actually runs, and — the part that made it
 * worth building at all — that the follow-up is about the SAME PERSON.
 */
describe('a two-beat scene authored inline', () => {
  it('plays its second beat, with the cast it was told to keep', () => {
    let secondBeats = 0;
    let sameCast = 0;

    for (const seed of [1042, 77, 909, 5150, 8080, 31]) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 700);
      for (const inst of ctx.world.arcs.values()) {
        const arc = bundle.arcs.find((a) => a.id === inst.arc)!;
        if (!arc.inline) continue;
        const played = inst.history.filter((h) => h.node === 'what_he_did_with_the_key').length;
        secondBeats += played;
        if (played && inst.bindings.CHILD) sameCast += 1;
      }
    }

    expect(secondBeats, 'the inline follow-up never fired').toBeGreaterThan(0);
    expect(sameCast, 'the follow-up fired without the kept cast').toBeGreaterThan(0);
  });
});
