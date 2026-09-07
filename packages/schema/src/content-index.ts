import type { ContentBundle } from './content.js';
import type { SeedPerson } from './content.js';
import type { AttributeDef, TraitDef } from './attributes.js';
import type { LocusDef } from './genome.js';
import type { EventTemplate } from './event.js';
import type { AgeDef } from './age.js';
import type { ArcDef } from './arc.js';
import type { HouseDef } from './house.js';
import type { CharacterTemplate } from './character.js';
import type { HeirloomDef } from './heirloom.js';
import type { SpellbookDef } from './spellbook.js';
import type { CareerDef } from './career.js';
import type { ClauseDef } from './clause.js';
import type { TaleDef } from './tale.js';
import type { PrologueDef } from './prologue.js';
import type { EndingDef } from './ending.js';
import type { ParcelDef } from './parcel.js';
import { desugarInline } from './desugar.js';

/**
 * THE COMPILED CONTENT.
 *
 * A `ContentBundle` is the wire format: eleven arrays, exactly as the YAML is
 * written. `Content` is that bundle with its indexes built, and it is what the
 * simulation is handed.
 *
 * Two reasons, and the second is the important one.
 *
 *   SPEED       `bundle.events.find((e) => e.id === x)` ran at every arc step,
 *               every scheduled follow-up, every Age tick and every clause
 *               reveal — a linear scan of every template in the game, several
 *               times a simulated year, times a thousand years, times a
 *               thousand-run harness.
 *
 *   ONE FAILURE  those lookups were followed by `!`. A content id that no
 *               longer resolves produced `undefined is not an object` three
 *               frames away from the file with the typo in it, or — worse, and
 *               this is the failure mode this codebase actually has — was
 *               swallowed by an `?.` and did nothing at all. `mustEvent` names
 *               the id, the kind, and what wanted it.
 *
 * Lookup returns `undefined` where absence is a real answer ("does this age
 * define a register?"). `mustX` throws where absence is a content bug, which is
 * every case where the id came from other content rather than from the player.
 */
export interface Content {
  /** The raw arrays, for saving, validating, and handing back to the editor. */
  readonly bundle: ContentBundle;

  readonly attributes: AttributeDef[];
  readonly loci: LocusDef[];
  readonly traits: TraitDef[];
  readonly houses: HouseDef[];
  readonly ages: AgeDef[];
  readonly events: EventTemplate[];
  readonly arcs: ArcDef[];
  readonly characters: SeedPerson[];
  readonly characterTemplates: CharacterTemplate[];
  readonly heirlooms: HeirloomDef[];
  readonly spellbooks: SpellbookDef[];
  readonly careers: CareerDef[];
  readonly clauses: ClauseDef[];
  readonly tales: TaleDef[];
  /** The signing (concept §3). One, or none in a bundle a test built by hand. */
  readonly prologue: PrologueDef | undefined;
  readonly endings: EndingDef[];
  readonly parcels: ParcelDef[];

  event(id: string): EventTemplate | undefined;
  age(id: string): AgeDef | undefined;
  arc(id: string): ArcDef | undefined;
  house(id: string): HouseDef | undefined;
  trait(id: string): TraitDef | undefined;
  attribute(id: string): AttributeDef | undefined;
  heirloom(id: string): HeirloomDef | undefined;
  spellbook(id: string): SpellbookDef | undefined;
  career(id: string): CareerDef | undefined;
  clause(id: string): ClauseDef | undefined;
  ending(id: string): EndingDef | undefined;
  characterTemplate(id: string): CharacterTemplate | undefined;
  tale(id: string): TaleDef | undefined;
  /** Tales `about` this event id — the ones whose circulation clock it starts. */
  talesAbout(eventId: string): TaleDef[];
  parcel(id: string): ParcelDef | undefined;

  mustEvent(id: string, wantedBy?: string): EventTemplate;
  mustAge(id: string, wantedBy?: string): AgeDef;
  mustArc(id: string, wantedBy?: string): ArcDef;
  mustHeirloom(id: string, wantedBy?: string): HeirloomDef;
  mustSpellbook(id: string, wantedBy?: string): SpellbookDef;
  mustCareer(id: string, wantedBy?: string): CareerDef;
  mustParcel(id: string, wantedBy?: string): ParcelDef;
}

export class MissingContentError extends Error {
  constructor(readonly kind: string, readonly id: string, wantedBy?: string) {
    super(`no ${kind} '${id}'${wantedBy ? ` (wanted by ${wantedBy})` : ''}`);
    this.name = 'MissingContentError';
  }
}

function index<T>(xs: T[], key: (x: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of xs) m.set(key(x), x);
  return m;
}

const byId = <T extends { id: unknown }>(xs: T[]) => index(xs, (x) => String(x.id));

/**
 * Idempotent on purpose: everything downstream takes `ContentBundle | Content`
 * and normalises here, so a test can pass the raw bundle and the harness can
 * index once and reuse it across a thousand runs.
 */
export function indexContent(source: ContentBundle | Content): Content {
  if (isContent(source)) return source;
  const b = source;

  // Inline follow-ups (`Outcome.next`) become real arcs before anything is
  // indexed — see `desugar.ts`. The compiled arcs and the `arc` blocks they
  // graft onto follow-up events land in the INDEX and never in `b`, so the
  // authored bundle the editor writes back stays exactly as authored.
  const { events: allEvents, arcs: allArcs } = desugarInline(b.events, b.arcs);

  const events = byId(allEvents);
  const ages = byId(b.ages);
  const arcs = byId(allArcs);
  const houses = byId(b.houses);
  const traits = byId(b.traits);
  const attributes = byId(b.attributes);
  const heirlooms = byId(b.heirlooms);
  const spellbooks = byId(b.spellbooks);
  const careers = byId(b.careers);
  const clauses = byId(b.clauses);
  const endings = byId(b.endings);
  const templates = byId(b.characterTemplates);
  const tales = byId(b.tales);
  const parcels = byId(b.parcels);

  const talesAboutIndex = new Map<string, TaleDef[]>();
  for (const t of b.tales) {
    const list = talesAboutIndex.get(t.about);
    if (list) list.push(t);
    else talesAboutIndex.set(t.about, [t]);
  }

  const must = <T>(m: Map<string, T>, kind: string) => (id: string, wantedBy?: string): T => {
    const found = m.get(id);
    if (!found) throw new MissingContentError(kind, id, wantedBy);
    return found;
  };

  return {
    bundle: b,

    attributes: b.attributes,
    loci: b.loci,
    traits: b.traits,
    houses: b.houses,
    ages: b.ages,
    events: allEvents,
    arcs: allArcs,
    characters: b.characters,
    characterTemplates: b.characterTemplates,
    heirlooms: b.heirlooms,
    spellbooks: b.spellbooks,
    careers: b.careers,
    clauses: b.clauses,
    tales: b.tales,
    prologue: b.prologue[0],
    endings: b.endings,
    parcels: b.parcels,

    event: (id) => events.get(id),
    age: (id) => ages.get(id),
    arc: (id) => arcs.get(id),
    house: (id) => houses.get(id),
    trait: (id) => traits.get(id),
    attribute: (id) => attributes.get(id),
    heirloom: (id) => heirlooms.get(id),
    spellbook: (id) => spellbooks.get(id),
    career: (id) => careers.get(id),
    clause: (id) => clauses.get(id),
    ending: (id) => endings.get(id),
    characterTemplate: (id) => templates.get(id),
    tale: (id) => tales.get(id),
    talesAbout: (eventId) => talesAboutIndex.get(eventId) ?? [],
    parcel: (id) => parcels.get(id),

    mustEvent: must(events, 'event'),
    mustAge: must(ages, 'age'),
    mustArc: must(arcs, 'arc'),
    mustHeirloom: must(heirlooms, 'heirloom'),
    mustSpellbook: must(spellbooks, 'spellbook'),
    mustCareer: must(careers, 'career'),
    mustParcel: must(parcels, 'parcel'),
  };
}

function isContent(x: ContentBundle | Content): x is Content {
  return 'mustEvent' in x;
}
