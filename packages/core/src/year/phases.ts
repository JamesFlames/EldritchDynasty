import type { EventTemplate } from '@ed/schema';
import { MAIN_BRANCH } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { streamFor } from '../rng.js';
import type { YearReport } from './report.js';
import { accrueMadness, rollAwakening } from '../people/factory.js';
import { autoMarry, rollBirths, rollDeath } from '../people/demography.js';
import { settleBranches, tickBranches } from '../people/branches.js';
import { ensureHead, maintainCast, releaseContracts } from '../people/succession.js';
import { tickRelationships } from '../people/relationships.js';
import { tickAges } from '../ages/scheduler.js';
import { tickEconomy } from '../economy.js';
import { tickCareers } from '../people/careers.js';
import { tickAuction } from '../auction.js';
import { selectEvents } from '../events/selection.js';
import { presentFrame, selectFrame } from '../events/frame.js';
import { dueArcSteps, type ArcStep } from '../events/arcs.js';
import { tickTales } from '../events/tales.js';
import { pickOutcome } from '../events/effects.js';
import { resolveChoiceOutcome } from '../events/checks.js';
import { autoCast, type SlotFill } from '../events/slots.js';
import {
  applyRecord, autoRecordOption, choiceAvailability, commitOutcome, queueChoice, queueRecord,
} from '../events/decisions.js';

/**
 * A YEAR IS A LIST OF PHASES, and the list is the file.
 *
 * This was a hundred and thirty lines of straight-line code inside `stepYear`,
 * and its ordering constraints — several of which are load-bearing and were
 * discovered the hard way — existed only as comments beside the call that had
 * to come second. Adding a system meant reading the whole function to work out
 * where it went, and getting it wrong produced a working simulation with a
 * subtly wrong shape.
 *
 * Now the shape of a year is data. Three things follow:
 *
 *   ORDER IS STATED.        Each phase says what it must come after and why.
 *                           `year.test.ts` reads `after` and checks the table
 *                           against itself, so a reorder that breaks a stated
 *                           dependency fails a test rather than a playthrough.
 *
 *   PHASES RUN ALONE.       A phase takes `(ctx, rng, report)` and nothing
 *                           else, so a test can run `births` against a hand-made
 *                           world without simulating four centuries to reach the
 *                           state it wanted.
 *
 *   RANDOMNESS IS PER PHASE. Every phase draws from its own stream, derived
 *                           from (seed, year, phase name). One shared year-RNG
 *                           meant inserting a single `rng.bool()` anywhere
 *                           shifted every subsequent draw in the year, so no
 *                           refactor could preserve a run and no golden could
 *                           be trusted. Now a phase's dice depend on that
 *                           phase's name and nothing else.
 */
export interface PhaseRun {
  ctx: SimCtx;
  /** This phase's own stream. See `streamFor` in rng.ts. */
  rng: Rng;
  report: YearReport;
  /** false = park decisions on the docket for the player. */
  autoResolve: boolean;
}

export interface Phase {
  /** Stable: it seeds this phase's RNG stream, so renaming one changes runs. */
  readonly name: string;
  /** Phases this one must follow, and the note says why. */
  readonly after: readonly string[];
  readonly why: string;
  run(p: PhaseRun): void;
}

const EVENT_BUDGET_PER_YEAR = 0.35;

export const YEAR_PHASES: readonly Phase[] = [
  {
    name: 'ages',
    after: [],
    why: 'An Age is the weather every other phase happens in, so it is decided first.',
    run({ ctx, rng, report }) {
      const w = ctx.world;
      const ages = tickAges(ctx, rng);
      report.agesBegan = ages.began.map((a) => a.id);
      report.agesEnded = ages.ended.map((a) => a.id);
      report.agesNamed = ages.named.map((a) => a.id);
      for (const a of ages.named) {
        w.chronicle.push({
          year: w.year,
          weight: 'page',
          title: a.name,
          text: a.blurb ?? `They began to call it ${a.name}.`,
          named: true,
        });
      }
    },
  },

  {
    name: 'lifecycle',
    after: ['ages'],
    why: 'Awakening, Madness and mortality all read the year the Age has just set.',
    run({ ctx, rng, report }) {
      const w = ctx.world;
      for (const p of w.people.living()) {
        if (rollAwakening(p, w.year, ctx.genetics, rng)) report.awakenings.push(p);
        accrueMadness(p, ctx.genetics, w.year);
        if (rollDeath(p, ctx, rng)) report.deaths.push(p);
      }
    },
  },

  {
    name: 'guardian',
    after: ['lifecycle'],
    why: 'He can only have crossed over in the pass that tried to kill him.',
    run({ ctx, report }) {
      const w = ctx.world;
      if (w.guardianSince) return;
      const g = w.people.guardian();
      if (!g) return;

      // Not a death — a change of state, and the one moment in the run where
      // the voice of the chronicle changes hands.
      w.guardianSince = w.year;
      report.guardianCrossed = g;
      w.chronicle.push({
        year: w.year,
        weight: 'illuminated',
        title: 'The House Does Not Empty',
        text: `They buried ${g.name} in the spring and the house did not feel emptier for it, `
          + 'which everyone noticed and nobody said. The fires were laid before anyone laid them. '
          + 'The accounts stayed balanced through a year in which nobody balanced them. '
          + 'He had not gone anywhere. He had only stopped being someone they had to feed.',
        named: true,
      });
    },
  },

  {
    name: 'quarrels',
    after: ['lifecycle'],
    why: 'Grudges pass to the living and posts fall vacant, both on this year\'s deaths.',
    run({ ctx }) {
      tickRelationships(ctx);
      releaseContracts(ctx);
    },
  },

  {
    name: 'careers',
    after: ['quarrels'],
    why: 'A career\'s income and Respect are owed to whoever is still living '
      + 'after this year\'s dead are settled, and `economy` needs the treasury '
      + 'they add before it tallies the year (issue #16).',
    run({ ctx, rng }) {
      tickCareers(ctx, rng);
    },
  },

  {
    name: 'economy',
    after: ['careers'],
    why: 'Wages are owed to whoever is still in post after the contracts settle, '
      + 'and the annual tally comes last so it sees career income too.',
    run({ ctx }) {
      tickEconomy(ctx);
    },
  },

  {
    name: 'auction',
    after: ['economy'],
    why: 'Bidding spends the treasury `economy` just tallied, and a lot bought this year should '
      + 'show up in the same year\'s chronicle as everything else that happened to the house (issue #17).',
    run({ ctx, rng, autoResolve }) {
      tickAuction(ctx, rng, autoResolve);
    },
  },

  {
    name: 'succession',
    after: ['lifecycle'],
    why: 'The seat and the recurring cast refill on this year\'s vacancies. Without '
      + 'this the head, tutor and rival slots empty within a generation and the '
      + 'event pool silently collapses to nothing.',
    run({ ctx, rng }) {
      ensureHead(ctx, rng);
      if (ctx.world.year % 4 === 0) maintainCast(ctx, rng);
    },
  },

  {
    name: 'branches',
    after: ['succession'],
    why: 'A son leaves the year his brother takes the seal, and not before.',
    run({ ctx, report }) {
      report.branchesFounded = settleBranches(ctx).map((b) => b.id);
      tickBranches(ctx);
    },
  },

  {
    name: 'marriage',
    after: ['branches'],
    why: 'A bride joins the hall her husband is in, which the split has just decided.',
    run({ ctx, rng }) {
      if (ctx.world.year % 3 === 0) autoMarry(ctx, rng);
    },
  },

  {
    name: 'births',
    after: ['marriage'],
    why: 'A couple married this spring may conceive this year.',
    run({ ctx, rng, report }) {
      const w = ctx.world;
      for (const { birth: b, branch, servants } of rollBirths(ctx, rng)) {
        if (!b.child) continue;

        // Born into the hall their mother lives in, not into the seat. This is
        // what makes a branch a lineage rather than a list of exiles.
        if (branch !== MAIN_BRANCH && b.child.membership[0]) b.child.membership[0].branch = branch;

        // A servant family. Two contracted parents make a child of the household
        // and NOT of the blood — otherwise the steward's grandchildren turn up in
        // the succession list, which is a much worse bug than the one this fixes.
        // The steward's own blurb says his contract is hereditary and that servant
        // dynasties need real lineage too; this is that lineage.
        if (servants && b.child.membership[0]) b.child.membership[0].kind = 'retainer';

        w.people.add(b.child);
        report.births.push(b.child);

        // Offer the naming to the player. The child already has a name, so the
        // offer can be ignored without anything downstream breaking — and the
        // offer is about the bloodline: nobody asks the Head to name the
        // steward's daughter.
        if (!servants && b.child.houseOfOrigin === w.playerHouse) {
          w.pendingNames.push({
            person: b.child.id,
            born: w.year,
            suggested: b.child.name,
            sex: b.child.sex,
          });
        }
      }
    },
  },

  {
    name: 'arcs',
    after: ['births'],
    why: 'A substory casts from the living, and this year\'s dead and born are settled.',
    run({ ctx, rng, report, autoResolve }) {
      for (const step of dueArcSteps(ctx, rng)) {
        const event = ctx.content.mustEvent(step.node.event, `arc node ${step.node.id}`);
        const body = step.absent && event.absentBody ? event.absentBody : event.body;
        present(ctx, { ...event, body }, step.fill, [], rng, report, autoResolve, step);
      }
    },
  },

  {
    name: 'ambient',
    after: ['arcs'],
    why: 'Substories get the year\'s attention before the ambient pool spends any of it.',
    run({ ctx, rng, report, autoResolve }) {
      // Called every year, not only on years the ambient budget lands. Selection
      // returns forced candidates — arc follow-ups and scheduled events — before
      // it spends any budget, and skipping the call on the two years in three
      // where the budget is zero meant a follow-up scheduled for 1204 arrived in
      // 1207 whenever the dice said so.
      const budget = rng.next() < EVENT_BUDGET_PER_YEAR ? 1 : 0;
      for (const cand of selectEvents(ctx, rng, budget)) {
        present(ctx, cand.event, cand.fill, cand.playerCast, rng, report, autoResolve);
      }
    },
  },

  {
    name: 'frame',
    after: ['ambient'],
    why: 'The frame reacts to the record — it has to run after the year has written its lines, not before.',
    run({ ctx, rng, report }) {
      const e = selectFrame(ctx, rng);
      if (!e) return;
      const entry = presentFrame(ctx, e, rng);
      if (entry) report.frame = entry;
    },
  },

  {
    name: 'generation',
    after: ['ambient', 'frame'],
    why: 'The generation counter gates content, so it turns over once everything else has. Tale '
      + 'circulation ticks here too — it only cares that the year has advanced, not what else fired in it.',
    run({ ctx }) {
      if (ctx.world.year % 25 === 0) ctx.world.generation += 1;
      tickTales(ctx);
    },
  },
];

/** Run one phase by name, with its own stream. For tests and probes. */
export function runPhase(name: string, ctx: SimCtx, report: YearReport, autoResolve = true): void {
  const phase = YEAR_PHASES.find((p) => p.name === name);
  if (!phase) throw new Error(`no year phase '${name}'`);
  phase.run({ ctx, rng: streamFor(ctx.world, phase.name), report, autoResolve });
}

/**
 * Put an event in front of whoever is deciding.
 *
 * Narration resolves on the spot — there is nothing to ask. A choice event
 * either goes on the docket or is answered by the chronicler, and the Record
 * block that follows it works the same way. One function, so the two modes
 * cannot drift apart: everything the player can decide, auto-resolve can
 * decide, and neither path is the special case.
 */
export function present(
  ctx: SimCtx,
  e: EventTemplate,
  fill: SlotFill,
  playerCast: string[],
  rng: Rng,
  report: YearReport,
  autoResolve: boolean,
  arcStep?: ArcStep,
): void {
  if (e.interaction.kind === 'narration') {
    const outcome = pickOutcome(e.interaction.outcomes, rng, ctx);
    const cast = autoCast(e, ctx, fill, playerCast, rng);
    const resolved = commitOutcome(ctx, e, outcome, cast, undefined, rng, arcStep);
    report.resolved.push(resolved);
    afterRecord(ctx, e, resolved.entryId, rng, report, autoResolve);
    return;
  }

  if (!autoResolve) {
    report.pending.push(queueChoice(ctx, e, e.body, fill, playerCast, arcStep));
    return;
  }

  const cast = autoCast(e, ctx, fill, playerCast, rng);
  // The chronicler is bound by `requires` exactly as the player is (bug
  // fixed for issue #8): a choice whose requires fail is not offered to
  // either. Falls back to the full list only if NOTHING is open, matching
  // `autoResolveDecision` — a decision with no legal answer still has to
  // resolve rather than stall the year.
  const open = e.interaction.choices.filter((c) => choiceAvailability(c, ctx, cast, e).available);
  const choice = rng.pick(open.length ? open : e.interaction.choices);
  const outcome = resolveChoiceOutcome(ctx, e, choice, cast, rng);
  const resolved = commitOutcome(ctx, e, outcome, cast, choice.id, rng, arcStep);
  report.resolved.push(resolved);
  afterRecord(ctx, e, resolved.entryId, rng, report, autoResolve);
}

function afterRecord(
  ctx: SimCtx,
  e: EventTemplate,
  entryId: string,
  rng: Rng,
  report: YearReport,
  autoResolve: boolean,
): void {
  if (!e.record) return;
  if (autoResolve) applyRecord(ctx, e, entryId, autoRecordOption(rng));
  else {
    const q = queueRecord(ctx, e, entryId);
    if (q) report.pending.push(q);
  }
}
