# ELDRITCH DYNASTY — Character, Genetics & Event Data Model
## Framework & Interface Design Brief

**Version:** 0.3
**Date:** August 2026
**Status:** Pre-production. This is the `packages/schema` and `packages/core` specification.
**Aligned to:** concept brief v0.2.1, event editor brief v0.2

> **0.3.** Four decisions taken. Affinities are **eight, in four opposed pairs** (Terra added), so the twelve heritable attributes are four Core plus eight affinities with Eldritch Power counted outside them. The **X-linked model is adopted**. The affinities split into **Elemental** and **Threshold**, with women practising only the Threshold four — a **Mystic** restriction that has no bearing on Madness, since Eldritch expression stays male-only and **Madness gates on `canExpress` alone** (§5.5). And **Ages now begin and end stochastically** and may own exclusive events (§8.7).

> **What this document is.** The concept brief says *what the game does*. The editor brief says *what the tool does*. Neither says what a character **is**, in memory, on disk, or at the type level. This does. It specifies four things: one entity that represents every person in the world, a properties system that content authors can extend without touching code, a real diploid genetics model, and an event framework that supports events with no input, events with choices, and multi-generation substories.
>
> Everything here is written to be implementable as-is. Where a decision is genuinely open, it appears in §13 rather than being hedged inline.

---

## 1. Five Principles

1. **One Person type for everyone.** Family, dead, hireling, bonded servant, enemy, rival house heir, a name in a forged pedigree. Not five types with five code paths. What varies is *membership*, *fidelity*, and *storage tier* — all fields, not classes. The reason is not elegance: it's that in this game a hireling marries in, an enemy becomes a spouse, a suitor becomes the matriarch, and a dead man keeps voting through his grudges. Any boundary you draw between person-types will be crossed by generation nine.

2. **Properties are data, not fields.** No attribute, trait, or affinity is a named property on a TypeScript interface. They live in content registries, are validated by Zod at boot, and are read through keyed accessors. Adding an attribute is a YAML edit and a codegen run, never a schema migration. This is the explicit requirement that properties "could be added to."

3. **Genotype and phenotype are separate layers.** Characters do not inherit their stats. They inherit *alleles*, and stats are computed from them. Every behaviour the concept brief asks for — silent recessives, regression to the mean, throwbacks, dilution by outward marriage, madness from concentration — is an emergent consequence of this and is not implemented as a special case anywhere.

4. **Truth and record are separate layers.** The simulation holds what happened. The chronicle holds what was written. The UI reads the chronicle. Characters therefore have a true state and a recorded state, and the gap between them is the game's thesis (concept §6). This is a data-layer concern, not a UI one, and building it in later is a rewrite.

5. **Influence is declared, never hardcoded.** A person changes events in exactly two ways: **presence** (they exist, in some scope) and **dispatch** (they were assigned to a slot). Both are declarative modifier lists on traits and attributes. No event template ever names a person.

---

## 2. Entity Map

```
Person ──┬─ Genome            (heritable layer — alleles, lazily materialized)
         ├─ Phenotype         (derived layer — computed, cached, invalidated)
         ├─ Traits[]          (registry-keyed, from genes / birth / events / career)
         ├─ Lineage           (true parents + claimed parents — they differ)
         ├─ Membership[]      (blood | married | retainer | ward | hostage | clergy | none)
         ├─ Contract?         (retainers: term, wage, loyalty, succession-on-death)
         └─ RecordView        (what the chronicle says this person was)

House ───┬─ GenePool          (allele frequency profile — "deep blood" is literal)
         ├─ Roster[]          (PersonIds)
         ├─ Motives[]         (drives auction bidding, marriage terms, hostility)
         └─ Standing          (respect, wealth, holdings)

Relationship  (Person|House) → (Person|House)   sentiment, grudges, obligations
Grudge        first-class, inheritable, decays, cites an origin event

EventTemplate ─┬─ Slots[]      (engine-cast or player-cast)
               ├─ Conditions
               ├─ Interaction  (narration | choice | dispatch)
               ├─ Checks[]
               └─ Effects[]

Arc ──────────┬─ Nodes[]       (each node = one EventTemplate + successor rules)
              ├─ Bindings[]    (slots that persist across the whole substory)
              └─ ArcInstance   (runtime: current node, bound people, local flags)
```

---

## 3. Identity and the Registry Pattern

### 3.1 Branded IDs

```ts
declare const brand: unique symbol;
type Id<T extends string> = string & { readonly [brand]: T };

type PersonId     = Id<'Person'>;
type HouseId      = Id<'House'>;
type AttributeId  = Id<'Attribute'>;
type TraitId      = Id<'Trait'>;
type LocusId      = Id<'Locus'>;
type AlleleId     = Id<'Allele'>;
type EventId      = Id<'Event'>;
type ArcId        = Id<'Arc'>;
type SlotId       = Id<'Slot'>;
type OutcomeId    = Id<'Outcome'>;
type FlagId       = Id<'Flag'>;
type HeirloomId   = Id<'Heirloom'>;
type Tag          = Id<'Tag'>;
```

Branding costs nothing at runtime and stops the entire class of bug where a `PersonId` is passed where a `HouseId` is expected. In a codebase where nearly every value is a string key, this is not optional.

### 3.2 The attribute registry

```ts
type AttributeKind =
  | 'core'        // Strength, Charm, Agility, Mind
  | 'affinity'    // eight, in four opposed pairs — see below
  | 'eldritch'    // the family's own — special expression rules, see §5.5
  | 'derived'     // computed from others; never inherited directly
  | 'hidden';     // Madness diathesis, deleterious load — real, not shown

/**
 * Four opposed dyads in two groups. Opposition drives Art eligibility, Church
 * doctrine and the "missing half" logic in suitor valuation. The GROUP drives
 * who can manifest what (§5.5), so it is not cosmetic and belongs in schema.
 */
type AffinityGroup = 'elemental' | 'threshold';

const DYADS = {
  elemental: [['fluid', 'thermal'], ['aero', 'terra']],
  threshold: [['life', 'death'], ['light', 'darkness']],
} as const;

interface AttributeDef {
  id: AttributeId;
  name: string;
  kind: AttributeKind;
  heritable: boolean;
  /** Loci contributing to this attribute. Empty for derived. */
  loci: LocusId[];
  range: { min: number; max: number };
  /** Non-genetic contributions the sim is allowed to apply. */
  developmental?: {
    /** Attributes that only begin developing after Awakening (concept §10: Mind). */
    gatedBy?: 'awakening' | 'adulthood';
    growthCurve?: GrowthCurveId;
  };
  /** How this attribute is displayed when the chronicle disagrees with the truth. */
  recordable: boolean;
}
```

Code never writes `person.strength`. It writes `phenotype.get(ATTR.strength)`. The `ATTR` constant object is **generated at build time from the content registry**, so authored attributes are still statically typed and misspellings still fail compilation. This is the same codegen posture the editor brief already commits to for Zod → TS.

### 3.3 The trait registry — where "properties that influence events" live

This is the extensibility surface the design asks for. A trait is a named property a person can hold, and it declares its own influence on events.

```ts
interface TraitDef {
  id: TraitId;
  name: string;
  tags: Tag[];                       // events query tags, never trait ids
  acquisition: TraitAcquisition;
  /** Effects contributed merely by this person existing, in some scope. */
  presence?: PresenceEffect[];
  /** Effects contributed only when this person is cast into an event slot. */
  dispatch?: DispatchEffect[];
  conflictsWith?: TraitId[];
  requires?: Condition;
  /** Some traits fade; a grudge cools, a reputation does not. */
  decay?: { perYear: number; floor: number } | 'never';
  /** Traits can pass to children — socially, not genetically. */
  transmissible?: { to: 'children' | 'heir' | 'household'; chance: number };
}

type TraitAcquisition =
  | { kind: 'genetic'; locus: LocusId; expressWhen: 'homozygous' | 'any' | 'hemizygous' }
  | { kind: 'threshold'; attr: AttributeId; atLeast?: number; atMost?: number }
  | { kind: 'birth'; chance: number; conditions?: Condition }
  | { kind: 'event' }                       // granted by an effect
  | { kind: 'career'; career: CareerId; afterYears: number }
  | { kind: 'age'; from: number; to?: number }
  | { kind: 'assigned' };                   // authored onto a specific NPC
```

Adding "The family employs a competent midwife, and fewer infants die" is now a content edit: a `TraitDef` with a `presence` effect that suppresses a tag of events. No engine change. That is the whole point.

---

## 4. Person — One Type for Everyone

```ts
interface Person {
  id: PersonId;

  // ── Identity ───────────────────────────────────────────────────────
  name: PersonName;
  sex: 'male' | 'female';
  sigilSeed: number;              // procedural heraldry, concept §8
  houseOfOrigin: HouseId;

  // ── Life ───────────────────────────────────────────────────────────
  born: Year;
  died?: Year;
  status: PersonStatus;
  causeOfDeath?: DeathCauseId;

  // ── Lineage: two of them, deliberately ─────────────────────────────
  trueParents: { mother?: PersonId; father?: PersonId };
  claimedParents: { mother?: PersonId; father?: PersonId };
  lineageDocuments: LineageDocument[];      // dowry currency, forgeable

  // ── Heritable and expressed ────────────────────────────────────────
  genome: GenomeRef;              // may be unmaterialized — see §5.7
  phenotype: PhenotypeCache;      // derived, invalidated on age/event

  // ── Acquired ───────────────────────────────────────────────────────
  traits: Set<TraitId>;
  awakening: AwakeningState;
  education: EducationRecord[];
  spellsKnown: SpellbookId[];
  career?: CareerPlacement;
  injuries: Injury[];

  // ── Social ─────────────────────────────────────────────────────────
  membership: MembershipRecord[]; // year-ranged; a person's affiliation changes
  contract?: RetainerContract;    // hirelings and lifetime servants
  marriages: MarriageRecord[];
  relationships: RelationshipRef[];

  // ── Narrative ──────────────────────────────────────────────────────
  castSlots: CastSlotId[];        // Tutor, Rival, Fragile One — concept §16
  arcBindings: ArcInstanceId[];   // substories this person is bound into
  chronicleEntries: EntryId[];

  // ── Storage ────────────────────────────────────────────────────────
  tier: StorageTier;
}

type PersonStatus =
  | 'alive'
  | 'dead'
  | 'vessel_consumed'    // concept §22 — greyed, but not the mark for death
  | 'missing'
  | 'given_to_church'
  | 'ascended';

type StorageTier = 'hot' | 'archived' | 'shade';
```

### 4.1 How the seven requested categories map

| Requested category | Same `Person`? | What actually differs |
|---|---|---|
| **Living family member** | yes | `membership: blood`, `tier: hot`, genome materialized, full phenotype cache |
| **Dead family member** | yes | `status: dead`, `tier: archived`. **Never deleted.** Still needed for pedigree, grudge inheritance, chronicle, ancestor events, and heirloom provenance |
| **Hireling** | yes | `contract.term: 'seasonal' \| 'yearly'`, `membership: retainer`, genome usually unmaterialized |
| **Lifetime servant** | yes | `contract.term: 'lifetime' \| 'bonded' \| 'hereditary'`. Hereditary contracts create servant *dynasties* — their children inherit the contract, which means servants need real lineage too |
| **Enemy** | yes | Not a type. An enemy is a `Relationship` with hostile sentiment and one or more `Grudge` objects. The same person can be an enemy and a suitor's brother |
| **Other family member** | yes | `houseOfOrigin` differs; genome drawn from that house's `GenePool`; `tier: shade` until they matter |
| **Suitor on a card** | yes | A `shade` promoted to `hot` on draft. Her *displayed* attributes come from her claimed documents; her genome is real and hidden |

### 4.2 Storage tiers

Over 1,000 years with eight rival houses, the world will produce roughly 2,000–6,000 persons. All of them must remain addressable (pedigree, chronicle) but only ~40–120 need to be query-fast at any moment.

- **hot** — living, in the family's household or actively cast. In dense arrays with inverted indexes. Slot queries only ever scan this tier.
- **archived** — dead, or living but narratively inert. Full record retained, no phenotype cache, excluded from slot queries.
- **shade** — outsiders never yet interacted with. Genome unmaterialized (§5.7), phenotype generated on demand from house profile. Promotion to `hot` is deterministic and cheap.

A person is never destroyed. The chronicle can reference anyone, forever, which is the point of the chronicle.

### 4.3 Membership and contracts

```ts
interface MembershipRecord {
  house: HouseId;
  kind: 'blood' | 'married_in' | 'retainer' | 'ward' | 'hostage' | 'clergy' | 'cadet' | 'none';
  from: Year;
  to?: Year;
  branch?: BranchId;      // cadet branches, concept §16
}

interface RetainerContract {
  role: RetainerRole;     // tutor | steward | guard | midwife | archivist | singer | physician
  term: 'seasonal' | 'yearly' | 'lifetime' | 'bonded' | 'hereditary';
  wage: Coin;
  loyalty: number;                     // 0–100; low loyalty is a rival's opening
  boundTo: HouseId | PersonId;         // bonded to the house, or to one Head
  onEmployerDeath: 'released' | 'passes_to_heir' | 'freed' | 'follows_named';
  knowsSecrets: FlagId[];              // what leaves with them, and to whom
}
```

`knowsSecrets` is load-bearing. A dismissed archivist who knows a Discrepancy is a Discrepancy with legs — this is how a servant becomes a plot without a bespoke system.

---

## 5. Genetics

This is the section that has to be right, because the concept brief's entire social design (§7, the One Permutation) is downstream of it. The design goal is that **every behaviour the brief asks for falls out of ordinary diploid inheritance**, and none of it is special-cased.

### 5.1 What has to emerge, not be coded

| Concept brief requirement | Mechanism that produces it |
|---|---|
| "regression to the mean and a fat tail for throwbacks" (§9) | Mendelian segregation over many small-effect loci. Both properties are consequences of the binomial, not tuning knobs |
| "recessives carry silently across generations" (§9) | Real diploid loci with dominance coefficients |
| "cousin marriage is the mechanism… and produces Madness" (§7) | Homozygosity rises. It concentrates the wanted alleles *and* exposes deleterious recessives, from the same event. One mechanism, two consequences, opposite signs |
| "Eldritch Power dilutes when married outward and cannot be replaced from any external source" (§9) | Font loci are family-exclusive; outsider genomes carry null alleles at those loci |
| "Men express Eldritch Power. Women never do." (§7) | Font loci are X-linked. Males are hemizygous — one copy, always expressed. Females hold two and expression is sex-gated off |
| "A person can go mad if and only if they can express Eldritch Power." (§10) | Madness is overflow of expressed power. The gate is `canExpress`, which is false for every woman and for any man whose font is null. Not a clamp — a branch that is never entered |
| "Women practise only the Threshold four." (§9) | A separate, *Mystic* restriction with no bearing on Madness. Learnability is gated by `sex × affinityGroup`; the two magics stay two systems |
| "Rare upward mutation in progeny" (§9) | Nonzero mutation rate at font loci, with upward bias |
| "Sparse affinities — most characters are zero in most" (§9) | Affinity loci have a common null allele at high frequency; nonzero requires an uncommon allele |
| "A suitor with a single high affinity is the missing half of something" (§12) | Independent assortment across chromosomes; complementary genotypes |

### 5.2 Genome layout

```ts
interface LocusDef {
  id: LocusId;
  chromosome: ChromosomeId;      // autosome index, or 'X'
  position: number;              // centimorgans — drives linkage
  kind: LocusKind;
  /** Pleiotropy is allowed and encouraged: one locus, several attributes. */
  contributes: { attr: AttributeId; weight: number }[];
  /** −1 = lower allele dominant, 0 = purely additive, +1 = higher allele dominant. */
  dominance: number;
}

type LocusKind =
  | 'additive'          // ordinary polygenic contribution
  | 'major'             // large effect, rare — prodigies and cripples
  | 'deleterious'       // harmless heterozygous, costly homozygous
  | 'eldritch_font'     // X-linked, family-exclusive
  | 'eldritch_channel'; // autosomal modifier, present in the wider world

interface AlleleDef {
  id: AlleleId;
  locus: LocusId;
  effect: number;
  dominanceOverride?: number;
  tags: AlleleTag[];             // 'null' | 'deleterious' | 'lethal_homozygous' | 'eldritch'
  /** Named alleles are chronicle content: "the Ashen mark", "the fourth-son sleep". */
  name?: string;
}
```

Storage is a pair of typed arrays per chromosome set, indexed by a global locus table shared across every genome:

```ts
interface Genome {
  /** Two autosomal haplotypes. Int16 allele indices into the allele table. */
  autosomal: [Int16Array, Int16Array];
  /**
   * Sex chromosomes. Females: two X haplotypes. Males: one X, and null for Y.
   * The Y carries nothing in this design — it is a coin flip with a name.
   */
  sex: [Int16Array, Int16Array | null];
  mutations: MutationRecord[];   // surfaced to the chronicle: something new in the blood
}
```

With ~9 heritable attributes × ~10 loci, plus font, channel, and a deleterious pool, a genome is roughly **200–300 Int16 values ≈ 500 bytes**. Six thousand persons is under 3 MB. There is no performance argument for cutting corners here.

### 5.3 Meiosis

```ts
function meiosis(g: Genome, rng: Rng): Gamete;
```

Per chromosome: draw crossover count from a Poisson distribution over the chromosome's map length, place crossovers uniformly in cM space, then walk the loci emitting from alternating haplotypes.

**Linkage is not decoration.** It means nearby loci travel together, which lets content authors place a strong font allele adjacent to a deleterious recessive and produce a haplotype that is genuinely a bargain: the blessing arrives chained to the curse, and separating them requires a specific crossover that a family might wait four generations for. That is a breeding puzzle no amount of stat-averaging can produce.

Sex determination and the X:

- **Male gamete:** recombined autosomes + either his single X (→ daughter) or Y (→ son), 50/50.
- **Female gamete:** recombined autosomes + a recombined X built from her two X's.

Two consequences worth stating plainly, because they are the design:

1. **A son's X comes only from his mother.** His father contributes nothing to his font. A Head's own Eldritch Power is irrelevant to his sons' — it matters only through the daughters.
2. **A father passes his single X, intact and unrecombined, to every daughter.** Daughters are exact vaults for their father's line. This is why marrying a daughter's son back into the family recovers the grandfather's font, and it is why cousin marriage is *the* mechanism rather than *a* mechanism.

Both are real biology. Neither required inventing anything. The brief's stated law is now the genetics, not a rule sitting on top of it.

### 5.4 Expression

```ts
function expressLocus(a: AlleleDef, b: AlleleDef | null, d: number): number {
  if (b === null) return a.effect;                 // hemizygous — males at X loci
  const mid = (a.effect + b.effect) / 2;
  const hi  = Math.max(a.effect, b.effect);
  return mid + d * (hi - mid);                     // d ∈ [−1, 1]
}
```

Attribute value = weighted sum of contributing loci, scaled to the attribute's range, plus developmental terms (education, injury, age curve, Awakening gating). All of it cached in `PhenotypeCache` and invalidated on birthday, event effect, or Awakening.

### 5.5 Eldritch Power — font, channel, and overflow

Eldritch is deliberately not a plain polygenic trait.

- **Font** — 6 X-linked `eldritch_font` loci. Family alleles carry real effect; **every outsider genome carries null at these loci by default**, with rare weak exceptions (§5.6). Font is *capacity*: raw pressure.
- **Channel** — ~10 autosomal `eldritch_channel` loci, present at moderate frequency throughout the world, inherited from both parents. Channel is *throughput*: the ability to hold and use what the font supplies.

One gate governs everything, and it is capability rather than sex:

```ts
interface EldritchProfile {
  carriedFont: number;      // X-linked total. Computed for BOTH sexes. Never shown.
  canExpress: boolean;      // THE gate. Everything downstream reads this.
  expressedPower: number;
  overflowMadness: number;
}

function eldritch(g: Genome): EldritchProfile {
  const font    = sumExpressed(g, LOCI.eldritch_font);
  const ceiling = channelCeiling(sumExpressed(g, LOCI.eldritch_channel));

  // Capability, not achievement: a boy of hot blood is exposed from birth,
  // years before he wakes. But a woman never is, and neither is a son whose
  // X carries nothing — the ordinary result of marrying outward.
  const canExpress = g.sex === 'male' && font > 0;

  if (!canExpress) {
    return { carriedFont: font, canExpress: false,
             expressedPower: 0, overflowMadness: 0 };
  }
  return {
    carriedFont: font,
    canExpress: true,
    expressedPower: Math.min(font, ceiling),
    overflowMadness: Math.max(0, font - ceiling) * OVERFLOW_RATE,
  };
}
```

**`canExpress` is the single gate, and nothing else may guard Madness.** No `if (female) madness = 0` clamp anywhere — a clamp is something a later feature bypasses by accident, whereas an unentered branch stays unentered. Every Madness source in the game (concentrated blood, forced Awakening, the Vessel rite, heirloom Burdens, ascension) routes through the same check, so adding a source cannot accidentally create a mad woman. **Any effect that would add Madness to a target where `canExpress` is false is a schema error**, surfaced by the editor's validator rather than silently discarded — an author who writes one has misread the setting and should be told.

**The Mystic restriction is a separate system and must not touch this file.** Women practise only the four Threshold affinities (concept §9), which gates *learnability*:

```ts
function canLearn(sex: Sex, affinity: AffinityId): boolean {
  return sex === 'male' || groupOf(affinity) === 'threshold';
}
```

That is the whole of it. It sits in the spellbook/study system, has no Madness consequence, and shares no code with `eldritch()`. Keeping them apart is what preserves concept §12's central opposition: the taken magic is technique and can be legislated, the given magic is blood and obeys only itself. A woman may be the finest Death-worker of her century and have `canExpress: false` for her entire life.

**A note on the ladder.** Overflow Madness is *involuntary* — it happens to men because of what they were born carrying. The Madness the ascension ladder demands is *purchased*, through forced Awakenings, the Vessel rite and ascension itself. The God-candidate does not reach Madness ≥ 90 by accident; he buys it knowing the price. That split is correct but needs verifying rather than assuming: **the harness must confirm an ascendant can actually reach 90 through purchased sources alone.** If he cannot, the God rung is unreachable and nothing will reveal it, because the failure surfaces only in the last two centuries of an eleven-hour run.

The overflow term is the most important line in this document. It produces, for free:

- **The Fragile One** (concept §16) — huge font, poor channel. Enormous pressure, no vessel. The obvious sacrifice, and the reason that hurts.
- **"Madness accrues from birth. Mind only develops after Awakening."** (§10) — diathesis is genetic and present at birth; the containment stat arrives late. The unwoken hot-blooded child is structurally the most fragile person in the house, exactly as specified, with no special rule.
- **Why breeding for Mind is buying the right to more Madness** (§10) — channel and Mind are correlated by shared loci, so the optimal line is one that raises the ceiling as fast as it raises the font. Chasing font alone produces prodigies who burn.

And it supplies an in-world justification the brief was missing: **men express Eldritch because they are hemizygous, and men go mad for the same reason.** They have one copy of everything on the X, with nothing to mask it. The Permutation is not a divine law the setting asserts — it is a fact the setting has built a Church around misexplaining.

#### The information problem, and the one honest signal

No woman ever expresses, so no woman ever demonstrates what she carries. A market with zero signal is a market with no decisions in it, so the player needs reads — and they must be unequal in quality, because that inequality is the game. Three channels, in ascending order of trustworthiness and descending order of usefulness.

**Signs — unreliable, cheap, everywhere.** Carried font raises the probability of a set of `Sign` traits: omens, small wrongnesses, the register of concept §18. They correlate with font. They do not prove it. Every rival house, hedge-witch and marriage-broker has a folk theory about them and the theories disagree. A skilled midwife or physician retainer carries a `presence` modifier that reveals Signs the household would otherwise miss, which is how a servant becomes worth her wage.

**Awakening age — reliable, public, unforgeable.** Awakening timing is driven by carried font in *both* sexes, even though only one of them will ever use it:

```ts
const awakeningPressure = profile.carriedFont;   // sex-independent
```

An early-waking daughter is therefore a true reading of a hidden number, witnessed publicly, and impossible to fake. In a marriage market whose formal currency is notarised lineage documents and whose actual industry is forging them, **the one trustworthy signal is a thing that happened to a nine-year-old girl in front of witnesses.** Great houses price it accordingly without being able to say why it works.

**Her sons — total proof, arriving one generation too late.** A woman's X is finally and completely revealed by what her sons express, twenty-odd years after the marriage that would have benefited from knowing. This is the only certain reading in the game and it is worthless for the decision it would have informed, which is the correct shape for a dynasty: you learn what your grandfather should have known.

It also explains, without anyone having to say so, why a dowry is three generations of notarised *maternal* records (concept §7). The documents are a forgery-prone substitute for the one proof that actually exists, and a matriline with genuinely proven sons is the most expensive thing on the marriage market.

That ordering — cheap lies in the documents, one honest reading in the biography, and certainty that only ever arrives too late to use — is the whole marriage minigame, and it comes out of the genetics rather than being layered on top.

#### What else this changes

Five systems shift, and each needs to be built knowing it:

| System | Consequence |
|---|---|
| **The library** | Women can work only the four Threshold affinities, so half the library is closed to them outright. What they have instead is **time**: a man's forty productive years are contested between study and advancing the house, and a woman's are not, because she cannot advance it. Over centuries the archive and the chronicle drift to the people who had the years to keep them, which is the mechanical source of concept §2's shifting chronicler voice — and it means `archivist` and `chronicler` should skew female by simulation rather than by authoring fiat |
| **Regency** | A regent accrues no Madness and cools Church attention. A Regency is a *concealment window*: eighty years in which Discrepancies age toward settled legend and the heat goes out of things. Players will trigger one deliberately to launder a bad century, and that is a correct read of the system rather than an exploit to patch. The balance pass should assume it |
| **The Vessel rite** | Gendered by capability. A relative with `canExpress: false` — any woman, or a mundane son — transfers attributes and carried font with zero Madness; anyone capable transfers theirs in full and uncapped. The safe Vessel is therefore usually the family's best breeding asset, described in different words |
| **Vessel gains are somatic** | A consumed Vessel's font enters the ascendant, never his gametes. His children inherit exactly what they would have inherited otherwise. Without this rule a family ascends by consuming laterally instead of breeding and the entire genetic layer becomes ignorable. One line in the effect handler, and load-bearing |
| **Fetal loss** | Driven by source-1 pressure, so male-only; deleterious homozygosity kills either sex. A hot line loses sons and keeps daughters, drifting toward Regency precisely when closest to ascending. The sex ratio bends against the player under exactly the conditions the player worked hardest to create, and the coin flip was never touched |
| **Concealment** | Darkness is a Threshold affinity, so daughters can hold it, and Darkness is the endgame instrument (concept §17). A Darkness-affine woman is not a stat — she is a named relative who can be married away, taken hostage, or simply die. This is the strongest non-reproductive role the design gives women and it should be built as a person, not a modifier |
| **The canon** | Life+Death and Light+Darkness are both Threshold dyads, so a woman can found an opposed-pair Named Art alone. A house can end up with its greatest Arts named for women, used by men who could not have made them, recorded in a chronicle those women wrote. Nothing needs to comment on this. The name printing in the ledger is the comment |

The fetal-loss row resolves what was open decision #2. No fudge at conception is needed: differential male loss produces the daughter-heavy hot line on its own, as a consequence the player caused rather than a rule the game imposed.

### 5.6 Outsiders, house gene pools, and what "deep blood" means

A rival house is, mechanically, an allele frequency distribution.

```ts
interface GenePool {
  house: HouseId;
  /** Per-locus allele frequencies. Absent locus ⇒ world-default frequencies. */
  frequencies: Map<LocusId, { allele: AlleleId; p: number }[]>;
  /** Rare, weak font alleles. This is what the marriage market calls "deep blood". */
  fontCarrierRate: number;        // typically 0.00–0.06
  deleteriousLoad: number;        // great houses have been marrying cousins too
}
```

This makes the concept brief's marriage vocabulary (§7) literal rather than flavour. "Deep blood" is a nonzero `fontCarrierRate`. "A thin line" is a pool with high `deleteriousLoad` and no font. "A bought grandmother" is a `LineageDocument` with `forged: true`. None of these are ever explained in text; they are learned from outcomes, which is what the brief asks for.

**The balance point this protects.** If font were purely family-exclusive with zero outside carriers, every outward marriage would guarantee a mundane next generation and the game would collapse into mandatory sibling marriage. Low-but-nonzero carrier rates mean an outward marriage is a *gamble on a hidden allele* rather than a known loss — which is exactly what makes the suitor draft (concept §5) a decision instead of an arithmetic problem, and exactly what the forged-documents economy exists to exploit.

The Barren Generation (§7) is then a natural outcome of unlucky or careless marriage, not a scripted punishment.

### 5.7 Lazy genome materialization

Most persons in the world never breed into the family, but any of them might.

```ts
type GenomeRef =
  | { kind: 'materialized'; genome: Genome }
  | { kind: 'lazy'; pool: HouseId; seed: number };
```

A `lazy` genome is generated deterministically from `(runSeed, pool, seed)` the first time anything asks for it. This solves storage and possibility at once: a shade servant costs 12 bytes until the day she bears a child, at which point her genome exists, is consistent with her house's pool, and would have been the same genome had she been materialized on day one.

### 5.8 Inbreeding: expected versus realized

Two numbers, and the gap between them is content.

- **Pedigree F** — Wright's coefficient from the recorded tree. Cheap, computed from `claimedParents`, and therefore **wrong whenever the documents are forged**. This is what the matchmaker quotes and what the UI shows.
- **Realized homozygosity** — measured from the actual genomes of the actual child. This is what the simulation uses.

Showing the player the first while resolving on the second is not a cheat; it is the marriage market working as designed. A house that buys a forged pedigree gets a number it can plan against and a child it cannot.

Deleterious recessives are seeded into the **founder's genome at world generation**, so each run's family has its own specific hereditary curses. Discovering one — a stillbirth pattern, a sleep that takes fourth sons — is a knowledge flag, which means it is a Record choice, which means a family can *lose* the knowledge of its own curse by omitting it and rediscover it two centuries later at full price. The genetics feeds the chronicle mechanic directly.

### 5.9 Determinism

```ts
function conceptionSeed(runSeed: number, mother: PersonId, father: PersonId, ordinal: number): number;
```

Every conception derives its RNG stream from a stable tuple, never from a global cursor. Consequences: a child is reproducible across save/load, the sim-harness (editor brief §9) can replay any run exactly, and save-scumming a birth is impossible without changing the parents or the birth order. If a later design decision *wants* rerollable births, that is a one-line change to include a mutable counter — but it should be a decision, not an accident of implementation.

### 5.10 Worked example

A Head with strong blood marries an outsider of a house with `fontCarrierRate: 0.03`.

- **Sons** take their X from the mother. She almost certainly carries two null font haplotypes, so her sons' font ≈ 0. They are mundane. If no other living son of the house expresses — **Regency**.
- **Daughters** take the father's X *intact*. Every daughter is a perfect copy of the Head's font, carried and unexpressed.
- The Regency spends 60 years buying books it cannot use (concept §14 — the regent cannot ascend but can make her grandson inevitable).
- A granddaughter marries her cousin. Her sons draw an X recombined from her two — one hot from her father, one null from her mother. **Roughly half of those sons express**, and those that do have concentrated font from both family lines.
- Their autosomes are now measurably more homozygous. The channel loci concentrate too, so the ceiling rises with the font — but so does the deleterious load, and the founder's recessives start surfacing.
- Of those expressing sons, the ones whose channel did not keep pace with their font are carrying overflow from birth. Some of them do not survive to be born. **Their sisters, carrying identical blood, are unharmed and always were.**

Nobody wrote a rule for any of that. It is one pass of meiosis, run twice.

---

## 6. Houses, Relationships, Grudges

```ts
interface House {
  id: HouseId;
  name: string;
  genePool: GenePool;
  roster: PersonId[];
  standing: { respect: RespectTier; wealth: Coin; holdings: HoldingId[] };
  /** Drives auction bidding, marriage terms, and hostility. Concept §14. */
  motives: { wants: Tag[]; refuses: Tag[]; bidsUpTo: Coin }[];
  chronicle: ChronicleId;        // buyable at auction — this is how Discrepancies get proven
  isPlayerHouse: boolean;
}
```

Enemies are not an entity kind. Hostility is an edge:

```ts
interface Relationship {
  from: PersonId | HouseId;
  to:   PersonId | HouseId;
  sentiment: number;             // −100 hostile … +100 devoted
  kinds: RelationshipKind[];     // rival | debt | obligation | affection | fear | patronage
  grudges: Grudge[];
}

interface Grudge {
  id: GrudgeId;
  originEvent: EventId;
  originYear: Year;
  severity: number;
  /** The founding grudge of concept §3 echoes for a thousand years because of this. */
  inheritance: 'none' | 'heir_only' | 'all_blood' | 'house_wide';
  decayPerYear: number;
  satisfiedBy?: Condition;       // what would actually end it
}
```

Grudge inheritance is what makes the prologue's second choice matter for forty generations, and it costs one enum.

---

## 7. Influence: Presence and Dispatch

The core requirement — properties determine how a character influences events *either by existing, or by being chosen for a mission*.

```ts
interface PresenceEffect {
  scope: 'household' | 'house' | 'branch' | 'world';
  when?: Condition;
  modifiers: Modifier[];
}

interface DispatchEffect {
  whenCastAs?: SlotRole[] | 'any';
  modifiers: Modifier[];
}

type Modifier =
  | { kind: 'event_weight';   match: EventMatch; multiply?: number; add?: number }
  | { kind: 'suppress';       match: EventMatch }                    // presence prevents an event
  | { kind: 'unlock';         grants: FlagId }                       // presence enables one
  | { kind: 'check_bonus';    match: CheckMatch; delta: number }
  | { kind: 'outcome_weight'; match: { tags: Tag[] }; multiply: number }
  | { kind: 'attribute';      attr: AttributeId; delta: number;
                              target: 'self' | 'household' | 'children' | 'slot' }
  | { kind: 'resource';       resource: ResourceId; perYear: number };

interface EventMatch { tags?: Tag[]; ids?: EventId[]; tier?: EventTier[]; }
```

`suppress` deserves its own line: the most interesting presence effects are the ones where **nothing happens**. A competent physician does not add a bonus to the plague event; she removes a branch of it. The player learns her value when she dies.

**Aggregation.** Presence modifiers are collected into an `InfluenceField` once per scope per generation, not per event:

```ts
interface InfluenceField {
  scope: InfluenceScope;
  eventWeightMultipliers: Map<Tag, number>;
  suppressed: Set<Tag>;
  grantedFlags: Set<FlagId>;
  checkBonuses: Map<CheckId | Tag, number>;
  computedAt: Year;
  dirty: boolean;                // set by roster change, death, trait gain, career change
}
```

Dispatch modifiers are the opposite: resolved per-event, per-cast, and never cached, because the whole point is that *which person you sent* changes the roll.

---

## 8. Events

### 8.1 Three interaction shapes, one template

The three shapes the design calls for are `interaction` variants on a single `EventTemplate`, not three systems.

```ts
type Interaction =
  | { kind: 'narration'; outcomes: Outcome[] }
  // fires, tells, resolves. No player input. Outcomes may still be weighted
  // and check-modified — "no input" is not "no consequence".

  | { kind: 'choice'; choices: Choice[]; minChoices: 2 }
  // 2+ options. Choices may be gated by requirements and may be visibly
  // unavailable, which is itself information (concept §16, The Match That Never Comes).

  | { kind: 'dispatch'; party: PartySpec; choices?: Choice[] };
  // the mission form. The player casts people into slots themselves,
  // then optionally chooses an approach. Dispatch effects apply.
```

```ts
interface EventTemplate {
  id: EventId;
  title: string;
  tier: 'individual' | 'head' | 'family' | 'record' | 'frame';
  interaction: Interaction;

  weight: number;
  repeatable: boolean;
  cooldownYears?: number;
  tags: Tag[];
  purposes: [Purpose, Purpose, Purpose];    // editor brief §4.5 — exactly three

  slots: Record<SlotId, SlotSpec>;
  conditions?: Condition;
  checks?: Check[];
  body: BodyText;
  absentBody?: BodyText;                    // see §8.4

  record?: RecordBlock;                     // concept §6
  rumour?: RumourSeed;
  accounts?: TaleId[];

  arc?: { of: ArcId; node: NodeId };
}
```

### 8.2 Slots — engine-cast versus player-cast

```ts
interface SlotSpec {
  id: SlotId;
  role: SlotRole;
  /** The single most important field in the event model. */
  castBy: 'engine' | 'player';
  count?: { min: number; max: number };     // parties, not just individuals
  optional?: boolean;
  filters: Filter[];
  /** 'event' = cast fresh each time. 'arc' = the same person for the whole substory. */
  bind: 'event' | 'arc';
  onMissing?: MissingPolicy;
}

type SlotRole =
  | 'head' | 'family_member' | 'spouse' | 'child' | 'sibling' | 'cadet' | 'unwoken'
  | 'retainer' | 'rival_house' | 'outsider' | 'heirloom' | 'spellbook'
  | 'tutor' | 'rival' | 'fragile' | 'the_match'          // persistent cast slots
  | 'listener_record' | 'listener_blood';                 // frame layer
```

`castBy: 'player'` **is** the mission mechanic. A dispatch event is an event whose slots the player fills from the living roster, at which point the cast members' `dispatch` modifiers enter the check and their `presence` modifiers leave their home scope for the duration. Sending your best three on a mission genuinely weakens the household while they are gone, and that costs no additional system.

Filters compose over attributes, age, sex, status, awakening state, career, traits, tags, affinity thresholds, membership, and relations to other slots:

```ts
type Filter =
  | { attr: AttributeId; op: CompareOp; value: number }
  | { trait: TraitId; has: boolean }
  | { tag: Tag; has: boolean }
  | { relation: RelationOp; of: SlotId }
  | { status: PersonStatus[] }
  | { membership: MembershipRecord['kind'][] }
  | { awakened: boolean }
  | { any: Filter[] } | { all: Filter[] } | { not: Filter };
```

**If a required slot cannot be filled, the event does not fire.** This is the primary source of variety across playthroughs and it is already the editor brief's position (§4.2); it is restated here because the arc system in §8.4 depends on it.

### 8.3 Checks and outcomes

One check structure covers all four challenge tiers from concept §21, which means one balance surface and one set of tests.

```ts
interface Check {
  id: CheckId;
  pool: PoolSpec;
  difficulty: number | DifficultyExpr;      // may scale with Age, respect, year
  bands: { atLeast: number; outcome: OutcomeId }[];   // degrees of success, ordered
  variance: 'none' | 'narrow' | 'wide';
}

type PoolSpec =
  | { kind: 'slot';       slot: SlotId; attrs: { attr: AttributeId; weight: number }[] }
  | { kind: 'party_sum';  slots: SlotId[]; attr: AttributeId }
  | { kind: 'family_sum'; attr: AttributeId }
  | { kind: 'family_max'; attr: AttributeId }
  | { kind: 'family_any'; attr: AttributeId; atLeast: number }
  | { kind: 'record';     against: ChronicleQuery };   // Record challenges, concept §21
```

`family_any` is the anti-specialization check the brief asks for: forty generations chasing Death, and then a fire, and nobody can call water.

```ts
interface Outcome {
  id: OutcomeId;
  weight: number;
  text: BodyText;
  effects: Effect[];
  tags?: Tag[];              // outcome_weight modifiers match on these
  triggers?: ArcTrigger;     // spawn or advance a substory
}
```

### 8.4 Arcs — substories, and the problem nobody plans for

The requirement: a parent event triggers child events, and **exactly one child happens**.

```ts
interface Arc {
  id: ArcId;
  entry: NodeId;
  nodes: Record<NodeId, ArcNode>;
  /** Slots that persist across the entire substory. */
  bindings: SlotId[];
  expiresAfterYears?: number;
  onExpire?: Effect[];
  maxConcurrentInstances: number;    // usually 1
}

interface ArcNode {
  event: EventId;
  selection: 'first_match' | 'weighted';
  successors: Successor[];
  schedule: 'immediate' | 'next_generation' | { minYears: number; maxYears: number };
}

interface Successor {
  to: NodeId | 'end';
  when?: Condition;
  fromOutcome?: OutcomeId;    // branch on what actually happened
  weight?: number;            // used when selection is 'weighted'
}
```

**Exactly-one semantics.** On node completion, collect successors whose `when` passes and whose `fromOutcome` matches. Under `first_match`, take the first. Under `weighted`, draw one. If the set is empty the arc ends. There is no path on which two children fire — the engine returns a single `NodeId`, and the type says so.

Runtime state:

```ts
interface ArcInstance {
  id: ArcInstanceId;
  arc: ArcId;
  node: NodeId;
  /** The persistent cast. This is what makes it a story and not three events. */
  bindings: Map<SlotId, PersonId | HouseId | HeirloomId>;
  localFlags: Map<FlagId, number | boolean | string>;
  startedYear: Year;
  dueYear?: Year;
  history: { node: NodeId; outcome: OutcomeId; year: Year }[];
}
```

**The hard part: bindings outlive people.** A substory that spans two generations will routinely find that the person it cast is dead when the next node comes due. This is not an edge case in a game where the unit of time is a generation — it is the *normal* case, and it is the single most likely place a naive arc implementation falls over.

```ts
type MissingPolicy =
  | 'cancel_arc'
  | 'recast'                                    // re-run the filter; a new person, same role
  | { inherit: 'heir' | 'eldest_child' | 'closest_blood' | 'house_successor' }
  | 'continue_absent';                          // the arc proceeds; they are gone
```

`inherit` is the one that earns its keep. A rival dies mid-feud and his son takes it up — the grudge, the arc, and the binding all move down one generation together, and the family's history rhymes exactly as concept §16 wants, without an author wiring it.

`continue_absent` imposes an authoring obligation, and therefore a validation rule: **any arc node whose bindings may be dead by the time it fires must supply `absentBody`.** Otherwise the template renders `{CHALLENGER}` for a man forty years in the ground. This belongs in the editor brief's error list (§7, block save), alongside the existing undefined-slot check.

### 8.5 Selection pipeline

Per generation, in order:

1. **Forced** — due arc continuations, scheduled follow-ups, Ledger clause reveals owed by the current Age, and lifecycle events (birth, death, Awakening). These consume slots in the generation's event budget before anything else is considered.
2. **Pressure** — state-driven demands: discontent above threshold, madness overflow imminent, respect decaying, an open Discrepancy near proof. Drawn weighted, but from a pool that only exists because the family is in that state.
3. **Ambient** — weighted random from everything eligible.

Eligibility is two-phase for cost reasons. Condition prefilter is cheap (flags, tiers, year ranges, Age) and runs over the whole pool. **Slot resolution is expensive** and runs only on sampled candidates; a candidate whose slots cannot fill is discarded and the sample is redrawn. Presence-influence weight multipliers are applied to the sampling distribution, before the draw, from the cached `InfluenceField`.

### 8.6 Effects

Enumerated, never scripted — the editor brief's §4.4 position, formalized:

```ts
type Effect =
  | { kind: 'attribute';  target: Target; attr: AttributeId; delta: number }
  | { kind: 'trait';      target: Target; trait: TraitId; op: 'add' | 'remove' }
  | { kind: 'status';     target: Target; status: PersonStatus; cause?: DeathCauseId }
  | { kind: 'madness';    target: Target; delta: number }
  | { kind: 'heirloom';   heirloom: SlotId; transferTo: Target | HouseId }
  | { kind: 'spellbook';  op: 'gain' | 'lose' | 'degrade'; book: SlotId }
  | { kind: 'treasury';   delta: Coin }
  | { kind: 'respect';    delta: number }
  | { kind: 'flag';       flag: FlagId; set: boolean | number | string }
  | { kind: 'relationship'; from: Target; to: Target; sentiment?: number; grudge?: GrudgeSpec }
  | { kind: 'chronicle';  entry: ChronicleEntrySpec }
  | { kind: 'knowledge';  op: 'grant' | 'revoke'; flag: FlagId }
  | { kind: 'discrepancy'; op: 'create' | 'prove' | 'bury'; spec: DiscrepancySpec }
  | { kind: 'rumour';     op: 'seed' | 'feed' | 'correct'; spec: RumourSpec }
  | { kind: 'clause';     reveal: ClauseId }
  | { kind: 'recast';     slot: CastSlotId }
  | { kind: 'schedule';   event: EventId; inYears: number }
  | { kind: 'arc';        op: 'start' | 'advance' | 'cancel'; arc: ArcId };

type Target =
  | { slot: SlotId }
  | { all: SlotId }                          // every member of a party slot
  | 'head' | 'household' | 'all_blood' | 'children_of_head';
```

The union is closed, so the Zod schema validates every possible outcome, and adding an effect kind is a deliberate act with a compiler error at every switch statement that needs updating. That is the correct amount of friction.

### 8.7 Ages — stochastic onset, stochastic end, and events that belong to one

An Age is a rules patch that arrives by chance and leaves by chance (concept §20). It is not a phase with a length; it is a **hazard process**.

```ts
interface AgeDef {
  id: AgeId;
  name: string;                        // withheld until the chronicle names it
  register: 'warm' | 'cold' | 'institutional';

  onset: {
    weight: number;                    // per-year, sampled against other candidates
    earliestYear?: Year;
    conditions?: Condition;
    cooldownYears: number;             // before this Age may recur
  };

  /** Termination is a per-year roll, never a scheduled end date. */
  duration: {
    minYears: number;                  // hazard is zero below this
    medianYears: number;
    shape: 'flat' | 'rising' | 'front_loaded';
  };

  modifiers: Modifier[];               // same vocabulary as §7 — one influence system
  clauseBearing: boolean;              // short Ages may be excused, concept §20 r4
}
```

**Hazard shape is a design lever, not a tuning detail.** `rising` means an Age grows likelier to end the longer it has run — a floor with a long right tail, which is how most Ages should feel. `front_loaded` burns out fast and is right for the Plague. `flat` is memoryless: the player genuinely cannot infer anything from how long it has already lasted, and it is the most unsettling of the three. Use it sparingly and deliberately.

```ts
interface ActiveAge {
  age: AgeId;
  began: Year;
  named: boolean;                      // concept §20 r1 — named late
  namedAt?: Year;
  paid: { clause?: ClauseId; standing: boolean; rumour?: RumourId };
}

interface AgeState {
  active: ActiveAge[];                 // concept §20 r2 — Ages overlap
  ended: { age: AgeId; began: Year; ended: Year }[];
  lastEndedRegister?: Register;        // alternation rule
}
```

The yearly tick rolls terminations first, then onsets — weighted draw among eligible Ages, gated by register alternation, cooldowns, a concurrency cap, and the difficulty curve that biases the last two centuries toward the harsh table.

**The expected end date must never reach the player.** The whole value of stochastic duration is planning under uncertainty; a visible countdown converts it back into a schedule. What the player *may* have is the `ended` history, because a family archive recording that the last three Wars ran 22, 61 and 30 years is a legitimate actuarial prior — and it is exactly what a chronicle is for. The uncertainty stays; the player earns a better guess by having written things down.

#### Age-scoped events

Scoping is a **declarative field**, not a condition:

```ts
interface EventTemplate {
  // …
  ages?: {
    only?: AgeId[];        // fires in these Ages and nowhere else
    never?: AgeId[];
    register?: Register[];
  };
}
```

Three reasons it is not just another `Condition`:

1. **Indexing.** The selection pipeline (§8.5) buckets the pool by Age and skips whole buckets. Age is the cheapest possible prefilter and the pipeline should exploit it before it evaluates anything.
2. **Coverage tooling.** The editor can then answer *how many events does The Withering actually own?* — which is the question that stalls content production.
3. **Orphan detection.** An Age with three exclusive events is a rules patch wearing a name, and the tool should say so.

Finer gating stays in the condition vocabulary:

```ts
type AgeCondition =
  | { ageActive: AgeId }
  | { ageRegister: Register }
  | { ageElapsed: { op: CompareOp; years: number } }   // "late in the Wars"
  | { ageStacked: { op: CompareOp; count: number } }   // two-Age overlap
  | { ageNamed: boolean };                             // before or after it was named
```

`ageElapsed` is worth more than it looks. The twentieth year of a war is a different place from the second, and it costs one field to let authors write both.

#### Short Ages starve their own content

This is the production risk the change creates, and it is not hypothetical. Fifteen exclusive events in an Age that can end after twenty years means a typical run sees three of them, and the other twelve were written for a run nobody played. Two mitigations, both required:

- **Age-exclusive events take a priority boost while their Age is active**, sitting above ambient content in the selection pipeline. An Age's own scenes are the entire reason it has a name.
- **Fire rates for Age-scoped events must be measured conditional on the Age being active**, never globally.

That second point is a **defect in the CI spec as written**. The editor brief's §9 gate fails any event firing in under 0.5% of runs — which will condemn perfectly good content for the crime of belonging to a rare, short Age. The gate needs to become: *fires in ≥ N% of runs in which its Age occurred*, with a separate check that every Age occurs often enough to be worth authoring for. Without that split, the first Age-exclusive content anyone writes turns the build red and the obvious fix is to delete the scoping, which is the wrong lesson to learn in week three.

**Additional validation rules**, for the editor's error and warning lists:

| Rule | Level |
|---|---|
| `ages.only` names an Age that does not exist in `content/ages/` | error |
| An Age has fewer than N exclusive events (N ≈ 8) | warning |
| A `clauseBearing` Age's clause reveal is scheduled from the Age's *end* rather than its start | error — a short Age must still be able to pay |
| An Age's authored `medianYears` is below the span needed to deliver standing change plus Rumour | warning |

---

## 9. Truth and Record as Two Layers

Concept §6 and §8 require that the UI shows what the chronicle says, not what happened. That has to be a data-layer split or it becomes a rewrite.

```ts
interface RecordView {
  person: PersonId;
  /** Only attributes with `recordable: true` can diverge. */
  attrs: Map<AttributeId, number>;
  claimedTraits: Set<TraitId>;
  claimedDeath?: { year: Year; cause: DeathCauseId };
  divergence: Set<AttributeId | TraitId>;    // non-empty ⇒ sigil drift, concept §8
}
```

Rules:

- The simulation resolves against `Person`. The interface renders `RecordView`.
- `RecordView` is **derived** from chronicle entries, not stored independently — one source of truth for the lie.
- `divergence` non-empty is exactly the condition for the concept brief's sigil drift: the tree draws the recorded person; hover shows the real one.
- Pedigree F (§5.8) computes over `claimedParents`; realized homozygosity computes over genomes. The two disagreeing is not a bug to be reconciled — it is the forged-dowry economy working.

---

## 10. World State and Persistence

```ts
interface WorldState {
  seed: number;
  year: Year;
  people: PersonStore;          // tiered: hot arrays + archived map + shade generators
  houses: Map<HouseId, House>;
  family: FamilyState;          // treasury, library, heirlooms, respect, discontent
  relationships: RelationshipGraph;
  chronicle: Chronicle;         // append-only; the save file players will screenshot
  ledger: LedgerState;          // nine clauses, recovery state
  rumours: RumourState;
  arcs: Map<ArcInstanceId, ArcInstance>;
  flags: Map<FlagId, FlagValue>;
  age: AgeState;
  influence: Map<InfluenceScope, InfluenceField>;   // cache, rebuilt per generation
}
```

**Save format:** snapshot per generation, plus an append-only decision log (which choice, which slot casts, which seeds). The snapshot makes loading O(1); the decision log makes any run replayable, which the sim-harness needs for CI (editor brief §9) and which is the only practical way to reproduce a bug reported eleven hours into someone's playthrough.

**Schema versioning from commit one.** Every persisted structure carries a version and has a migration. The editor brief already flags schema churn as a top risk; the answer is migrations written from the first event, not a promise to be careful.

---

## 11. Extensibility — the Actual Test

The requirement was that properties "could be added to". These are the four things a designer should be able to do without an engineer:

| Change | Where it happens | Code touched |
|---|---|---|
| Add a new attribute (e.g. *Resolve*) | `content/attributes.yaml` + loci in `content/genome.yaml` | none — regenerate `ATTR` constants |
| Add a trait that makes plague events rarer while its holder lives | `content/traits.yaml`: one `presence` modifier with `suppress` | none |
| Add a trait that only matters on missions | `content/traits.yaml`: one `dispatch` modifier | none |
| Add a hereditary curse specific to this family | `content/alleles.yaml`: a deleterious allele with a `name` | none |
| Add a five-node substory spanning 200 years | `content/arcs/*.yaml` | none |
| Add a new **kind** of effect | `packages/schema` union | yes, deliberately |

The last row is the point. Content is open; the effect vocabulary is closed. A writer can build anything out of the existing verbs and cannot invent a verb that breaks the simulation.

---

## 12. Build Order

This slots into the editor brief's stage 1–2b, which it supersedes in detail.

| # | Deliverable | Est. | Notes |
|---|---|---|---|
| 1 | Registries + branded IDs + Zod schemas + codegen for `ATTR`/`TRAIT` | 1 wk | Everything else imports this |
| 2 | Genome: locus table, meiosis with recombination, expression, mutation | 1.5 wk | Ship with a statistical test suite, see below |
| 3 | Person store with tiers, lazy genome materialization, phenotype cache | 1 wk | |
| 4 | Houses, gene pools, relationships, grudges | 0.75 wk | |
| 5 | Slot resolution + filter engine + indexes | 1.25 wk | The perf-critical path |
| 6 | Influence fields: presence aggregation, dispatch application | 0.75 wk | |
| 7 | Event resolution: conditions, checks, outcomes, effects | 1.5 wk | |
| 8 | Arc runtime: bindings, missing-person policies, exactly-one selection | 1.25 wk | The part that will be underestimated |
| 9 | Truth/record split + chronicle derivation | 1 wk | Retrofitting this later is a rewrite |
| 10 | Headless harness: 10,000-run statistical validation | 0.75 wk | |

≈ **10.75 weeks**, most of which the editor brief already budgets as game work you would do regardless.

**Stage 2 needs statistical tests, not unit tests.** Assertions that must hold over 10,000 simulated pedigrees: mean offspring attribute regresses toward mid-parent by the expected fraction; realized F under full-sib mating converges on 0.25; deleterious expression rate scales with F as predicted; font is zero in all sons of double-null mothers; and a father's X is identical in all his daughters.

Three further assertions cover the expression gate, and they are the ones most likely to be broken by a later change:

- **No character with `canExpress: false` ever holds nonzero Madness or nonzero expressed Power**, from any source, in any run. This is the assertion that catches a new Madness effect written without the gate.
- **No female character ever learns an Elemental spellbook**, and no female character ever holds nonzero Eldritch Power.
- **An ascendant can reach Madness ≥ 90 through purchased sources alone** — the God rung is otherwise unreachable in a way that surfaces only eleven hours into a run.

If those eight hold, the genetics is correct and everything downstream is tuning.

**The Age scheduler needs its own statistical pass**, run over the same 10,000 sims:

- Each Age's realised duration distribution matches its authored `minYears` / `medianYears` / `shape`, with a fat enough tail that a 12-year Wars and a 90-year Wars both occur.
- Every Age occurs in enough runs to justify authoring exclusive content for it. An Age appearing in 4% of runs is an Age whose content will never be seen.
- Register alternation holds without deadlocking — a scheduler that has excluded every eligible Age will silently stall, and the symptom is a hundred flat years rather than a crash.

---

## 13. Open Decisions

These need answers before stage 2, and they are design calls rather than engineering ones.

1. ~~**Seven affinities or eight?**~~ **Resolved: eight, in four opposed pairs.** Terra is added — stone, foundation, burial, load. The seven in concept §9 were two clean dyads plus three orphans; the eighth completes the structure, vindicates the God gate in §22, and gives the twelve heritable attributes a clean reading as four Core plus eight affinities, with Eldritch Power counted outside them. Concept brief updated at v0.2.1.

2. ~~**Sex ratio.**~~ **Resolved, and not by tuning.** Male-only fetal overflow (§5.5) makes hot lines lose sons and keep daughters, so the ratio bends toward Regency exactly when the family is closest to ascending. The coin flip stays honest at 50/50 and the skew arrives as a consequence of the player's own breeding. **Verify this empirically before trusting it** — if the harness shows hot lines pushed past ~60% daughters at birth, the mechanism is overtuned and `OVERFLOW_RATE` comes down; the fix is one constant, not a new system.

3. **Do father's X-linked contributions to daughters feel bad?** The model gives a Head no genetic influence on his sons' Eldritch at all. This is correct, elegant, and thematically perfect — the family's power visibly runs through its women — but it is also counter-intuitive for a player raised on "strong father, strong son." Recommend keeping it and *teaching* it: it is the single most interesting thing the system knows, and the marriage-market vocabulary exists to communicate it.

3b. ~~**Does the restriction gate Mystic study or Eldritch manifestation?**~~ **Resolved: Mystic.** The Elemental/Threshold split governs which spellbooks a woman can learn. Eldritch expression is male-only and absolute, and Madness gates on `canExpress` alone. The two systems share no code, which is what keeps concept §12's two-magics opposition intact — the taken magic can be legislated, the given magic obeys only itself.

3c. **What fraction of sons should be mundane?** Now the number that matters, since null-font sons drive Regency frequency and are the only men who cannot go mad. Too few and marrying outward carries no real threat; too many and the Barren Generation stops being an event and becomes the weather. Recommend targeting a **median of one Regency per 8–12 generations** and tuning outsider `fontCarrierRate` to hit it, rather than setting the rate and hoping. Measure from the first harness run.

3d. **Does the female half of the game now carry too much?** Women hold the font, are usually the only safe people in the house, can found the canon, and own the endgame concealment instrument — barred from the one thing that wins the game. The structure is coherent (they hold the power, men spend it, the run is about whether the family keeps producing men worth spending it on) and the injustice is the point rather than an oversight. But the failure mode is a player who reads the male line as a formality and the daughters as inventory. That is a UI and event-authoring problem rather than a data one, and it is the largest remaining design risk in the genetics. Watch it from the first playtest.

4. **Are births rerollable on reload?** §5.9 defaults to no. This is the more honest game and the harder sell.

5. **Deleterious allele count in the founder genome.** Too few and inbreeding is free; too many and the first cousin marriage ends the run. Needs the harness before it can be set — do not guess it, measure it.

6. **Do rival houses simulate genetics fully, or only the player's family?** Full simulation makes the world coherent and rival ascension (concept §20, The Quickening) real. It also multiplies cost by roughly eight. Recommend full genomes for the four named houses and pool-sampled shades for the rest.

---

*Related: `DesignConcepts/eldritch-dynasty-concept-brief.md` (v0.2 systems and narrative architecture), `DesignConcepts/eldritch-dynasty-event-editor-brief.md` (authoring tooling and validation), `.claude/skills/rothfuss-prose/reference/prose-manual.md` (voice contract).*
