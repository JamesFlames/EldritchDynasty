import type {
  Content, LibraryEntry, LibraryMemory, LibraryRun, PersonId, ResolvedClaim,
} from '@ed/schema';
import {
  LIBRARY_ENTRY_CAP, LIBRARY_MEMORY_CAP, assertNever, asId,
} from '@ed/schema';
import type { SimCtx } from './world.js';
import { hashSeed, makeRng, type Rng } from './rng.js';

/** A historical claim that can be contradicted mechanically rather than by literary judgement. */
function canContradict(claim: ResolvedClaim): boolean {
  switch (claim.kind) {
    case 'attr':
    case 'trait':
    case 'death':
      return true;
    case 'deed':
      return false;
    default:
      return assertNever(claim);
  }
}

/**
 * Whether two attributed historical claims disagree on the same closed fact.
 * Deeds are deliberately excluded: two different sentences about what somebody
 * did are not a contradiction the game can adjudicate without inventing truth.
 */
export function libraryClaimsContradict(a: ResolvedClaim, b: ResolvedClaim): boolean {
  if (a.kind !== b.kind || a.person !== b.person) return false;
  switch (a.kind) {
    case 'attr':
      return b.kind === 'attr' && a.attr === b.attr && a.value !== b.value;
    case 'trait':
      return b.kind === 'trait' && a.trait === b.trait && a.has !== b.has;
    case 'death':
      return b.kind === 'death' && (a.year !== b.year || a.cause !== b.cause);
    case 'deed':
      return false;
    default:
      return assertNever(a);
  }
}

function contradicted(claim: ResolvedClaim): ResolvedClaim | undefined {
  switch (claim.kind) {
    case 'attr': {
      // Narrative only: keep the number plausible and unmistakably different.
      // Recordable attributes in the shipped content are non-negative.
      const step = Math.max(2, Math.round(Math.abs(claim.value) * 0.2) || 10);
      return { ...claim, value: claim.value <= step ? claim.value + step : claim.value - step };
    }
    case 'trait':
      return { ...claim, has: !claim.has };
    case 'death':
      // A different year is a contradiction without inventing a second cause.
      return { ...claim, year: claim.year + 1 };
    case 'deed':
      return undefined;
    default:
      return assertNever(claim);
  }
}

function human(id: string): string {
  return id.replace(/_/g, ' ');
}

function subjectOf(entry: LibraryEntry, person: string): string {
  return entry.people[person] ?? 'the person named there';
}

function claimName(content: Content, claim: ResolvedClaim): string {
  switch (claim.kind) {
    case 'attr':
      return content.attribute(claim.attr)?.name ?? human(claim.attr);
    case 'trait':
      return content.trait(claim.trait)?.name ?? human(claim.trait);
    case 'death':
      return 'death';
    case 'deed':
      return 'deed';
    default:
      return assertNever(claim);
  }
}

function retelling(entry: LibraryEntry, changed: ResolvedClaim | undefined, content: Content): string {
  const quote = `“${entry.said}”`;
  if (!changed) {
    return `${quote} The same words survive in a later book under another hand, and no page says who carried them there.`;
  }

  const subject = subjectOf(entry, changed.person);
  switch (changed.kind) {
    case 'attr':
      return `${quote} The later copy keeps the page, but gives ${subject}'s ${claimName(content, changed)} as ${Math.round(changed.value * 10) / 10}; no hand in the volume says when the figure changed.`;
    case 'trait':
      return `${quote} In the later copy, one word has turned: ${subject} is marked ${changed.has ? 'with' : 'without'} ${claimName(content, changed)}. The older page says otherwise.`;
    case 'death':
      return `${quote} The later copy keeps the name and the death, but gives the year as ${changed.year}. The older page gives another year.`;
    case 'deed':
      return quote;
    default:
      return assertNever(changed);
  }
}

function memoryVoice(ctx: SimCtx, rng: Rng): Pick<LibraryMemory, 'form' | 'teller' | 'bias'> {
  const rivals = ctx.content.houses.filter((h) => !h.isPlayerHouse);
  const rival = rivals.length ? rng.pick(rivals) : undefined;
  const rivalName = rival?.name ?? 'a rival house';

  const voices: Array<Pick<LibraryMemory, 'form' | 'teller' | 'bias'>> = [
    {
      form: 'rival_chronicle',
      teller: `the archivist of ${rivalName}`,
      bias: `keeping ${rivalName}'s inherited account of the old house`,
    },
    {
      form: 'doctrine',
      teller: 'a copyist of Bramme',
      bias: 'making an old family account sit cleanly inside doctrine',
    },
    {
      form: 'rhyme',
      teller: 'children who know the house only by its name',
      bias: 'keeping the part that is easiest to repeat',
    },
  ];
  return rng.pick(voices);
}

function entryOf(ctx: SimCtx, entry: SimCtx['world']['chronicle'][number], index: number): LibraryEntry | undefined {
  if (!entry.text) return undefined;

  const people: Record<string, string> = {};
  for (const claim of entry.claims ?? []) {
    const person = ctx.world.people.get(asId<PersonId>(claim.person));
    if (person) people[claim.person] = person.name;
  }

  const discrepancy = entry.discrepancyId
    ? ctx.world.discrepancies.get(entry.discrepancyId)
    : undefined;

  return {
    id: entry.id ?? `page_${entry.year}_${index.toString(36)}`,
    said: entry.text,
    year: entry.year,
    ...(entry.record ? { record: entry.record } : {}),
    ...(entry.discrepancyId && discrepancy
      ? { discrepancy: { id: entry.discrepancyId, state: discrepancy.state } }
      : {}),
    people,
    claims: (entry.claims ?? []).map((claim) => ({ ...claim })),
  };
}

function memoryScore(entry: LibraryEntry): number {
  const discrepancy = entry.discrepancy;
  return (entry.record === 'embellish' ? 20 : entry.record === 'record' ? 5 : 0)
    + (discrepancy?.state === 'buried' ? 12 : discrepancy?.state === 'open' ? 8 : 0)
    + (entry.claims.some(canContradict) ? 4 : 0);
}

/**
 * The finished account which may outlive this run. It contains only what the
 * family's record exposed; hidden genomes, true parentage and unrecorded state
 * never cross this boundary.
 */
export function libraryRunOf(ctx: SimCtx): LibraryRun | undefined {
  const w = ctx.world;
  if (!w.ending) return undefined;

  const entries = w.chronicle
    .map((entry, index) => entryOf(ctx, entry, index))
    .filter((entry): entry is LibraryEntry => entry !== undefined)
    .sort((a, b) => memoryScore(b) - memoryScore(a) || b.year - a.year || a.id.localeCompare(b.id))
    .slice(0, LIBRARY_ENTRY_CAP)
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

  const house = w.founding?.houseName ?? w.houses.get(w.playerHouse)?.name ?? w.playerHouse;
  const ending = ctx.content.ending(w.ending.id);
  const fingerprint = JSON.stringify(entries.map((entry) => [
    entry.id, entry.year, entry.record, entry.discrepancy?.id, entry.discrepancy?.state, entry.claims,
  ]));
  const id = `lib_${hashSeed(w.seed, w.campaign, w.ending.year, w.ending.id, house, fingerprint).toString(36)}`;

  return {
    id,
    seed: w.seed,
    campaign: w.campaign,
    endedYear: w.ending.year,
    house,
    ending: { id: w.ending.id, title: ending?.title ?? human(w.ending.id) },
    entries,
  };
}

function chosenEntries(runs: readonly LibraryRun[], rng: Rng): Array<{ run: LibraryRun; entry: LibraryEntry }> {
  const all = runs.flatMap((run) => run.entries.map((entry) => ({ run, entry })));
  if (!all.length) return [];

  const picked: Array<{ run: LibraryRun; entry: LibraryEntry }> = [];
  const firstContradictable = all.filter(({ entry }) => entry.claims.some(canContradict));
  if (firstContradictable.length) picked.push(rng.pick(firstContradictable));

  const remaining = all.filter((candidate) => !picked.some(
    (held) => held.run.id === candidate.run.id && held.entry.id === candidate.entry.id,
  ));
  while (picked.length < LIBRARY_MEMORY_CAP && remaining.length) {
    const index = rng.int(remaining.length);
    picked.push(remaining.splice(index, 1)[0]!);
  }
  return picked;
}

/**
 * Seed narrative memory once. Nothing else in the simulation reads
 * `world.libraryMemories`; the whole feature is intentionally incapable of
 * changing money, genes, land, standing or event selection.
 */
export function seedLibraryMemories(ctx: SimCtx, runs: readonly LibraryRun[]): LibraryMemory[] {
  if (!runs.some((run) => run.entries.length)) {
    ctx.world.libraryMemories = [];
    return [];
  }

  // The library fingerprint belongs to this isolated stream. No existing
  // phase or bootstrap draw sees it.
  const fingerprint = JSON.stringify(runs.map((run) => [
    run.id,
    run.entries.map((entry) => [entry.id, entry.claims, entry.discrepancy?.state]),
  ]));
  const rng = makeRng(hashSeed(ctx.world.seed, 'library', fingerprint));

  const memories = chosenEntries(runs, rng).map(({ run, entry }, index): LibraryMemory => {
    const voice = memoryVoice(ctx, rng);
    const candidates = entry.claims
      .map((claim, claimIndex) => ({ claim, claimIndex }))
      .filter(({ claim }) => canContradict(claim));
    const target = candidates.length ? rng.pick(candidates) : undefined;
    const claims = entry.claims.map((claim) => ({ ...claim }));
    let changed: ResolvedClaim | undefined;
    if (target) {
      changed = contradicted(target.claim);
      if (changed) claims[target.claimIndex] = changed;
    }

    return {
      id: `memory_${hashSeed(ctx.world.seed, run.id, entry.id, index).toString(36)}`,
      sourceRun: run.id,
      sourceHouse: run.house,
      sourceYear: entry.year,
      sourceText: entry.said,
      form: voice.form,
      teller: voice.teller,
      bias: voice.bias,
      text: retelling(entry, changed, ctx.content),
      about: `library:${run.id}:${entry.id}`,
      since: ctx.world.year,
      mutations: 0,
      people: { ...entry.people },
      sourceClaims: entry.claims.map((claim) => ({ ...claim })),
      claims,
    };
  });

  ctx.world.libraryMemories = memories;
  return memories;
}
