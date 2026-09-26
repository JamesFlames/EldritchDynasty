import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Person } from '@ed/schema';
import {
  ELDRITCH_GIFT,
  ELDRITCH_REACH,
  applyRecord,
  beget,
  commitOutcome,
  genomeOf,
  order,
  place,
  standingOf,
  tableView,
  testRng,
  testWorld,
  type PendingChoice,
  type SimCtx,
  type SlotFill,
  type TableOrder,
} from '@ed/core';

const bundle = loadContent();

function head(ctx: SimCtx): Person {
  const p = ctx.world.people.living().find((candidate) => candidate.castSlots.includes('head'));
  if (!p) throw new Error('the fixture has no sitting Head');
  return p;
}

/**
 * Build the state the authored rite cards ask for instead of waiting centuries
 * for it. The point of these tests is the presentation/resolution seam, not
 * whether a random run reaches Hierophant.
 */
function readyClimber(ctx: SimCtx): Person {
  const p = head(ctx);
  ctx.world.respect = 'eminent';
  ctx.world.ascension.rung = 'hierophant';
  ctx.world.ascension.best = 'hierophant';

  p.awakening.awakened = true;
  p.acquired[ELDRITCH_GIFT] = 400;
  p.acquired.mind = 200;
  p.madness = 25;
  for (const book of bundle.spellbooks.slice(0, 8)) {
    if (!p.spellsKnown.includes(book.id)) p.spellsKnown.push(book.id);
  }
  p.phenotype = undefined;

  expect(standingOf(ctx, p).rung).toBe('hierophant');
  return p;
}

function pendingRite(ctx: SimCtx, eventId: string): PendingChoice {
  const pending = ctx.world.pendingDecisions.find(
    (decision): decision is PendingChoice => decision.kind === 'choice' && decision.event.id === eventId,
  );
  if (!pending) throw new Error(`no pending rite decision for ${eventId}`);
  return pending;
}

function expectAssemblyMatchesDocket(
  ctx: SimCtx,
  key: 'vesselRite' | 'greatRite' | 'unmaking',
  command: TableOrder,
  eventId: string,
  expectedCandidate?: string,
): void {
  const before = {
    treasury: ctx.world.treasury,
    chronicle: ctx.world.chronicle.length,
    decisions: ctx.world.pendingDecisions.length,
    statuses: ctx.world.people.living().map((p) => [p.id, p.status, [...p.rites]] as const),
  };

  const offer = tableView(ctx)[key];
  expect(offer.ready, offer.reason).toBe(true);
  expect(offer.assembly).toBeDefined();
  const assembly = offer.assembly!;

  // Reading the assembly is presentation-only: no rite, death, spend or
  // decision exists until the old table order is actually confirmed.
  expect({
    treasury: ctx.world.treasury,
    chronicle: ctx.world.chronicle.length,
    decisions: ctx.world.pendingDecisions.length,
    statuses: ctx.world.people.living().map((p) => [p.id, p.status, [...p.rites]] as const),
  }).toEqual(before);

  expect(assembly.irreversible.length).toBeGreaterThan(0);
  expect(assembly.preparations.length).toBeGreaterThan(0);
  expect(
    assembly.preparations.every((line) => assembly.actors.some((actor) => line.includes(actor.name))),
    'a preparation line named somebody outside the resolved rite cast',
  ).toBe(true);

  const result = order(ctx, command);
  expect(result.ok, result.reason).toBe(true);
  const pending = pendingRite(ctx, eventId);

  // The people photographed by the pre-rite assembly are the people the
  // actual resolver put on the card. No second client-side casting model.
  for (const actor of assembly.actors) {
    expect(pending.fill[actor.slot], actor.slot).toBe(actor.person);
  }
  for (const risk of assembly.atRisk) {
    const cast = pending.cast.find((request) => request.slot === risk.slot);
    expect(cast, `no docket cast request for ${risk.slot}`).toBeDefined();
    expect(cast!.candidates.map((candidate) => ({ person: candidate.id, name: candidate.name })))
      .toEqual(risk.candidates);
  }

  if (expectedCandidate) {
    expect(assembly.atRisk.flatMap((risk) => risk.candidates.map((candidate) => candidate.person)))
      .toContain(expectedCandidate);
  }
}

describe('major rite assembly (#218)', () => {
  it('photographs the Vessel from the same slot resolution the docket uses', () => {
    const ctx = testWorld(bundle, 8218);
    const ascendant = readyClimber(ctx);
    const vessel = place(ctx, { sex: 'female', age: 20, name: 'The Named Vessel' });
    beget(ctx, vessel, undefined, ascendant);

    expectAssemblyMatchesDocket(
      ctx,
      'vesselRite',
      { kind: 'vesselRite' },
      'the_vessel_rite',
      vessel.id,
    );
  });

  it('photographs the Great Rite from the same slot resolution the docket uses', () => {
    const ctx = testWorld(bundle, 8219);
    readyClimber(ctx);
    place(ctx, { sex: 'male', age: 30, name: 'The Witness' });

    expectAssemblyMatchesDocket(
      ctx,
      'greatRite',
      { kind: 'greatRite' },
      'the_great_rite',
    );
  });

  it('photographs the Unmaking elder and exact descendant candidates the docket uses', () => {
    const ctx = testWorld(bundle, 8220);
    const elder = readyClimber(ctx);
    elder.rites.push('vessel', 'great_rite');
    elder.acquired[ELDRITCH_REACH] = 9;
    elder.phenotype = undefined;

    const younger = place(ctx, { sex: 'male', age: 25, name: 'The Younger', awakened: true });
    younger.genome = { kind: 'materialized', genome: genomeOf(elder, ctx.genetics) };
    younger.phenotype = undefined;
    beget(ctx, younger, undefined, elder);

    expectAssemblyMatchesDocket(
      ctx,
      'unmaking',
      { kind: 'unmaking' },
      'the_unmaking',
      younger.id,
    );
  });
});


function vesselFixture(seed: number) {
  const ctx = testWorld(bundle, seed);
  const ascendant = readyClimber(ctx);
  const vessel = place(ctx, { sex: 'female', age: 20, name: 'Mara the Named' });
  beget(ctx, vessel, undefined, ascendant);

  const event = bundle.events.find((candidate) => candidate.id === 'the_vessel_rite');
  if (!event || event.interaction.kind !== 'choice') throw new Error('the authored Vessel rite is missing');
  const taking = event.interaction.choices.find((candidate) => candidate.id === 'speak_the_name');
  const sparing = event.interaction.choices.find((candidate) => candidate.id === 'send_them_out_of_the_room');
  if (!taking || !sparing) throw new Error('the authored Vessel branches are missing');

  const fill: SlotFill = { ASCENDANT: ascendant.id, VESSEL: vessel.id };
  return { ctx, ascendant, vessel, event, taking, sparing, fill };
}

function greatRiteFixture(seed: number) {
  const ctx = testWorld(bundle, seed);
  const ascendant = readyClimber(ctx);
  const witness = place(ctx, { sex: 'male', age: 30, name: 'Tomas the Witness' });

  const event = bundle.events.find((candidate) => candidate.id === 'the_great_rite');
  if (!event || event.interaction.kind !== 'choice') throw new Error('the authored Great Rite is missing');
  const sanction = event.interaction.choices.find((candidate) => candidate.id === 'ask_for_sanction');
  if (!sanction) throw new Error('the authored sanction branch is missing');

  const fill: SlotFill = { ASCENDANT: ascendant.id, WITNESS: witness.id };
  return { ctx, ascendant, witness, event, sanction, fill };
}

function unmakingFixture(seed: number) {
  const ctx = testWorld(bundle, seed);
  const elder = place(ctx, { sex: 'male', age: 65, name: 'Aldren the Elder', awakened: true });
  const source = head(ctx);
  elder.genome = { kind: 'materialized', genome: genomeOf(source, ctx.genetics) };
  elder.acquired[ELDRITCH_GIFT] = 120;
  elder.acquired[ELDRITCH_REACH] = 9;
  elder.rites.push('vessel', 'great_rite');
  elder.phenotype = undefined;

  const younger = place(ctx, { sex: 'male', age: 24, name: 'Corin the Younger', awakened: true });
  younger.genome = { kind: 'materialized', genome: genomeOf(source, ctx.genetics) };
  younger.phenotype = undefined;
  beget(ctx, younger, undefined, elder);

  const event = bundle.events.find((candidate) => candidate.id === 'the_unmaking');
  if (!event || event.interaction.kind !== 'choice') throw new Error('the authored Unmaking is missing');
  const choice = event.interaction.choices.find((candidate) => candidate.id === 'go_through_with_it');
  if (!choice) throw new Error('the authored taking branch is missing');

  const fill: SlotFill = { ELDER: elder.id, ASCENDANT: younger.id };
  return { ctx, elder, younger, event, choice, fill };
}


describe('major rite aftermath (#218)', () => {
  it('writes the taken Vessel with both the ascendant and the person consumed', () => {
    const { ctx, ascendant, vessel, event, taking, fill } = vesselFixture(8221);
    const outcome = taking.outcomes.find((candidate) => candidate.id === 'taken');
    if (!outcome) throw new Error('the taken Vessel outcome is missing');

    const resolved = commitOutcome(ctx, event, outcome, fill, taking.id, testRng('vessel-taken'));
    const entry = ctx.world.chronicle.find((candidate) => candidate.id === resolved.entryId);

    expect(entry?.title).toBe('The Vessel');
    expect(entry?.text).toContain(ascendant.name);
    expect(entry?.text).toContain(vessel.name);
    expect(entry?.text).toMatch(/name once|Everything .* was arrives/);
    expect(vessel.status).toBe('vessel_consumed');
    expect(ascendant.rites).toContain('vessel');
  });

  it('writes the spared Vessel branch with both named people and no irreversible spend', () => {
    const { ctx, ascendant, vessel, event, sparing, fill } = vesselFixture(8222);
    const outcome = sparing.outcomes.find((candidate) => candidate.id === 'spared');
    if (!outcome) throw new Error('the spared Vessel outcome is missing');

    const resolved = commitOutcome(ctx, event, outcome, fill, sparing.id, testRng('vessel-spared'));
    const entry = ctx.world.chronicle.find((candidate) => candidate.id === resolved.entryId);

    expect(entry?.title).toBe('The Vessel');
    expect(entry?.text).toContain(ascendant.name);
    expect(entry?.text).toContain(vessel.name);
    expect(entry?.text).toMatch(/knowing what the family weighed them against/);
    expect(vessel.status).toBe('alive');
    expect(ascendant.rites).not.toContain('vessel');
  });

  it('writes the sanctioned Great Rite with the ascendant, witness and concrete widening', () => {
    const { ctx, ascendant, witness, event, sanction, fill } = greatRiteFixture(8223);
    const outcome = sanction.outcomes.find((candidate) => candidate.id === 'sanctioned');
    if (!outcome) throw new Error('the sanctioned Great Rite outcome is missing');

    const beforeMadness = ascendant.madness;
    const resolved = commitOutcome(ctx, event, outcome, fill, sanction.id, testRng('great-rite-sanctioned'));
    const entry = ctx.world.chronicle.find((candidate) => candidate.id === resolved.entryId);

    expect(entry?.title).toBe('The Great Rite');
    expect(entry?.text).toContain(ascendant.name);
    expect(entry?.text).toContain(witness.name);
    expect(entry?.text).toMatch(/made wider|count/);
    expect(ascendant.rites).toContain('great_rite');
    expect(ascendant.madness).toBeGreaterThan(beforeMadness);
  });

  it('writes refused Great Rite permission with both participants and no false success', () => {
    const { ctx, ascendant, witness, event, sanction, fill } = greatRiteFixture(8224);
    const outcome = sanction.outcomes.find((candidate) => candidate.id === 'refused_permission');
    if (!outcome) throw new Error('the refused Great Rite outcome is missing');

    const resolved = commitOutcome(ctx, event, outcome, fill, sanction.id, testRng('great-rite-refused'));
    const entry = ctx.world.chronicle.find((candidate) => candidate.id === resolved.entryId);

    expect(entry?.title).toBe('The Great Rite');
    expect(entry?.text).toContain(ascendant.name);
    expect(entry?.text).toContain(witness.name);
    expect(entry?.text).toMatch(/count that was never used|chapel roof/);
    expect(ascendant.rites).not.toContain('great_rite');
    expect(ctx.world.knowledge.has('knows_the_church_refused')).toBe(true);
  });

  it('renders the named cast into honest rite records instead of replacing aftermath with generic copy', () => {
    const ctx = testWorld(bundle, 8225);
    const ascendant = place(ctx, { sex: 'male', age: 40, name: 'Aldren Recorded' });
    const vessel = place(ctx, { sex: 'female', age: 20, name: 'Mara Recorded' });
    const witness = place(ctx, { sex: 'male', age: 30, name: 'Tomas Recorded' });
    const elder = place(ctx, { sex: 'male', age: 65, name: 'Corin Recorded' });

    const cases = [
      {
        event: 'the_vessel_remembered',
        entry: 'rite-record-vessel',
        fill: { ASCENDANT: ascendant.id, VESSEL: vessel.id },
        names: [ascendant.name, vessel.name],
      },
      {
        event: 'the_great_rite',
        entry: 'rite-record-great',
        fill: { ASCENDANT: ascendant.id, WITNESS: witness.id },
        names: [ascendant.name, witness.name],
      },
      {
        event: 'the_unmaking',
        entry: 'rite-record-unmaking',
        fill: { ELDER: elder.id, ASCENDANT: ascendant.id },
        names: [elder.name, ascendant.name],
      },
    ] as const;

    for (const sample of cases) {
      const event = bundle.events.find((candidate) => candidate.id === sample.event);
      if (!event?.record) throw new Error('record block missing for ' + sample.event);
      const line = applyRecord(ctx, event, sample.entry, 'record', sample.fill);
      expect(line).not.toBeNull();
      for (const name of sample.names) expect(line).toContain(name);
      expect(line).not.toMatch(/\{[A-Z_]+\}/);
    }
  });

  it('writes the successful Unmaking with both participants and the thing spent', () => {
    const { ctx, elder, younger, event, choice, fill } = unmakingFixture(8221);
    const outcome = choice.outcomes.find((candidate) => candidate.id === 'taken');
    if (!outcome) throw new Error('the successful Unmaking outcome is missing');

    const resolved = commitOutcome(ctx, event, outcome, fill, choice.id, testRng('unmaking-success'));
    const entry = ctx.world.chronicle.find((candidate) => candidate.id === resolved.entryId);

    expect(entry?.title).toBe('The Unmaking');
    expect(entry?.text).toContain(elder.name);
    expect(entry?.text).toContain(younger.name);
    expect(entry?.text).toMatch(/comes out of him|arrives/);
    expect(elder.status).toBe('dead');
    expect(younger.rites).toContain('unmaking');
  });

  it('writes the failed Unmaking with both participants and the loss instead of a generic failure', () => {
    const { ctx, elder, younger, event, choice, fill } = unmakingFixture(8222);
    const outcome = choice.outcomes.find((candidate) => candidate.id === 'failed_at_the_last_step');
    if (!outcome) throw new Error('the failed Unmaking outcome is missing');

    const beforeMadness = younger.madness;
    const resolved = commitOutcome(ctx, event, outcome, fill, choice.id, testRng('unmaking-failure'));
    const entry = ctx.world.chronicle.find((candidate) => candidate.id === resolved.entryId);

    expect(entry?.title).toBe('The Unmaking');
    expect(entry?.text).toContain(elder.name);
    expect(entry?.text).toContain(younger.name);
    expect(entry?.text).toMatch(/leave it|nowhere for any of it to go/);
    expect(entry?.text).not.toMatch(/^failed$/i);
    expect(elder.status).toBe('dead');
    expect(younger.madness).toBe(beforeMadness + 40);
    expect(ctx.world.flags.get('god_rite_failed')).toBe(true);
  });
});
