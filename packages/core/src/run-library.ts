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

interface LibraryVoiceTemplate {
  form: LibraryMemory['form'];
  teller: (rival: string) => string;
  bias: (rival: string) => string;
  render: (entry: LibraryEntry, changed: ResolvedClaim | undefined, content: Content, rival: string) => string;
}

/**
 * The interpolated FACT, not the voice around it. The prose below is authored
 * once per form; runtime code supplies only the old page and the closed claim
 * that changed. That is #70's line between inherited content and authored
 * telling.
 */
function laterReading(entry: LibraryEntry, changed: ResolvedClaim | undefined, content: Content): string {
  if (!changed) return 'the old words are kept entire';
  const subject = subjectOf(entry, changed.person);
  switch (changed.kind) {
    case 'attr':
      return `${subject}'s ${claimName(content, changed)} is entered as ${Math.round(changed.value * 10) / 10}`;
    case 'trait':
      return `${subject} is entered ${changed.has ? 'with' : 'without'} ${claimName(content, changed)}`;
    case 'death':
      return `${subject}'s death is entered in ${changed.year}`;
    case 'deed':
      return 'the old deed is copied without amendment';
    default:
      return assertNever(changed);
  }
}

/**
 * SEVEN AUTHORED VOICES, ONE FOR EACH TALE FORM (#70).
 *
 * These are deliberately fixed prose, not a sentence generator. Each voice
 * belongs to the rival house chosen for this memory; only the inherited page
 * and its closed claim are interpolated. A writer owns the voice and bias, the
 * old run owns the quoted content, and the simulation owns neither opinion.
 */
const LIBRARY_VOICES: LibraryVoiceTemplate[] = [
  {
    form: 'song',
    teller: (rival) => `the household singers of ${rival}`,
    bias: (rival) => `keeping the version ${rival} has found pleasant to remember`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” So the singers of ${rival} have it; but in their refrain, ${laterReading(entry, changed, content)}. The first singer's name is gone.`,
  },
  {
    form: 'doctrine',
    teller: (rival) => `the chaplain who keeps ${rival}'s old books`,
    bias: (rival) => `making the inherited account sit obediently inside ${rival}'s doctrine`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” The copy kept at ${rival} gives no argument, only a correction in the narrow hand of its chaplain: ${laterReading(entry, changed, content)}. No earlier hand is named.`,
  },
  {
    form: 'rival_chronicle',
    teller: (rival) => `the archivist of ${rival}`,
    bias: (rival) => `keeping ${rival}'s inherited account of the old house`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” Thus stands the older house's own page. The archivist of ${rival} copies it beneath another heading, where ${laterReading(entry, changed, content)}; and leaves the disagreement without apology.`,
  },
  {
    form: 'rhyme',
    teller: (rival) => `the children of ${rival}'s lower hall`,
    bias: (rival) => `keeping only what ${rival}'s children can carry from one winter to the next`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” The children below ${rival}'s hall make a smaller thing of it, and a harder thing to lose: ${laterReading(entry, changed, content)}. They do not know whose book taught them.`,
  },
  {
    form: 'play',
    teller: (rival) => `the players retained for ${rival}'s winter feast`,
    bias: (rival) => `turning an old house's dignity into the version ${rival} will applaud`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” At ${rival}'s winter feast the line is spoken before the candles gutter; then the second player answers that ${laterReading(entry, changed, content)}. The audience laughs at a quarrel older than the script.`,
  },
  {
    form: 'footnote',
    teller: (rival) => `an unnamed annotator in ${rival}'s library`,
    bias: (rival) => `correcting the old house from the safety of ${rival}'s margin`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” Beside it, in ${rival}'s copy, an unnamed hand has written only this: ${laterReading(entry, changed, content)}. The ink is younger than the page and older than any living witness.`,
  },
  {
    form: 'charm',
    teller: (rival) => `the nurses of ${rival}, from one nursery to the next`,
    bias: (rival) => `keeping the inherited warning useful to ${rival}'s children`,
    render: (entry, changed, content, rival) =>
      `“${entry.said}” The nurses of ${rival} say the words before a child sleeps, and finish them always the same way: ${laterReading(entry, changed, content)}. None remembers when the last line entered the charm.`,
  },
];

/** Structural guard for the seven authored forms required by #70. */
export const LIBRARY_VOICE_FORMS = LIBRARY_VOICES.map((voice) => voice.form);

function memoryVoice(
  ctx: SimCtx,
  rng: Rng,
): Pick<LibraryMemory, 'form' | 'teller' | 'bias'> & {
  render: (entry: LibraryEntry, changed: ResolvedClaim | undefined, content: Content) => string;
} {
  const rivals = ctx.content.houses.filter((h) => !h.isPlayerHouse);
  const rival = rivals.length ? rng.pick(rivals) : undefined;
  const rivalName = rival?.name ?? 'a rival house';
  const template = rng.pick(LIBRARY_VOICES);
  return {
    form: template.form,
    teller: template.teller(rivalName),
    bias: template.bias(rivalName),
    render: (entry, changed, content) => template.render(entry, changed, content, rivalName),
  };
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
      text: voice.render(entry, changed, ctx.content),
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
