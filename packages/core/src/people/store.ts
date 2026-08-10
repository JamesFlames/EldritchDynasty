import type { Person, PersonId, Year } from '@ed/schema';

/**
 * A person is never destroyed. The chronicle can reference anyone, forever,
 * which is the point of the chronicle. What varies is the tier they sit in.
 *
 *   hot      living, in the household or actively cast. Slot queries scan
 *            ONLY this tier.
 *   archived dead, or living but narratively inert. Full record, no cache.
 *   shade    outsiders never yet interacted with. Genome unmaterialized.
 *
 * KIN QUERIES GO THROUGH AN INDEX, not a scan. `children()` is called from
 * inside the birth pass — every married woman is asked how many children she
 * has already borne, every year — and each call used to walk every person who
 * had ever lived. That is quadratic in the length of the run, and the run is a
 * thousand years long.
 *
 * The index is maintained in exactly two places, `add` and `setParents`, which
 * is only safe because parentage is written in exactly two places. If a third
 * appears, it goes through `setParents` or the index is a lie that reads like a
 * working family tree.
 */
export class PersonStore {
  private people = new Map<string, Person>();
  private hot = new Set<string>();
  /** parent id -> child ids, in the order they were added. */
  private byParent = new Map<string, string[]>();
  /** Depth from the founding generation, memoised across calls. */
  private depth = new Map<string, number>();

  add(p: Person): Person {
    this.people.set(p.id, p);
    if (p.tier === 'hot') this.hot.add(p.id);
    this.link(p);
    return p;
  }

  /**
   * The one way parentage is written after birth.
   *
   * `makePerson` takes both parents, so every child conceived in the simulation
   * is linked the moment it is added. The founding cast is the exception: the
   * twelve seed people cannot refer to each other until they all exist, so
   * bootstrap joins them up in a second pass — and that pass used to assign
   * `p.trueParents` directly, which no index can see.
   */
  setParents(id: PersonId | string, parents: { mother?: PersonId; father?: PersonId }): void {
    const p = this.get(id);
    if (!p) return;
    this.unlink(p);
    p.trueParents = { ...parents };
    this.link(p);
    this.depth.clear();
  }

  private link(p: Person): void {
    for (const parent of [p.trueParents.mother, p.trueParents.father]) {
      if (!parent) continue;
      const kids = this.byParent.get(parent);
      if (!kids) this.byParent.set(parent, [p.id]);
      else if (!kids.includes(p.id)) kids.push(p.id);
    }
  }

  private unlink(p: Person): void {
    for (const parent of [p.trueParents.mother, p.trueParents.father]) {
      if (!parent) continue;
      const kids = this.byParent.get(parent);
      const at = kids?.indexOf(p.id) ?? -1;
      if (kids && at >= 0) kids.splice(at, 1);
    }
  }

  get(id: PersonId | string): Person | undefined {
    return this.people.get(id);
  }

  mustGet(id: PersonId | string): Person {
    const p = this.get(id);
    if (!p) throw new Error(`unknown person ${String(id)}`);
    return p;
  }

  all(): Person[] {
    return [...this.people.values()];
  }

  /** The only collection slot resolution is allowed to scan. */
  living(): Person[] {
    const out: Person[] = [];
    for (const id of this.hot) {
      const p = this.people.get(id);
      if (p && p.status === 'alive') out.push(p);
    }
    return out;
  }

  household(houseId: string, year: Year): Person[] {
    return this.living().filter((p) =>
      p.membership.some((m) => m.house === houseId && m.from <= year && (m.to === undefined || m.to > year)),
    );
  }

  blood(houseId: string): Person[] {
    return this.all().filter((p) => p.membership.some((m) => m.house === houseId && m.kind === 'blood'));
  }

  /** Editor previews only. The simulation never removes a person. */
  remove(id: PersonId | string): void {
    const p = this.get(id);
    if (p) this.unlink(p);
    this.people.delete(String(id));
    this.hot.delete(String(id));
    this.byParent.delete(String(id));
    this.depth.delete(String(id));
  }

  promote(id: PersonId | string): void {
    const p = this.get(id);
    if (!p) return;
    p.tier = 'hot';
    this.hot.add(id);
  }

  archive(id: PersonId | string): void {
    const p = this.get(id);
    if (!p) return;
    p.tier = 'archived';
    p.phenotype = undefined;
    this.hot.delete(id);
  }

  /**
   * The ONE death gate. Every path that ends a life routes through here —
   * plague, duel, madness overflow, an authored `status` effect — which is
   * what makes the Narrator's exemption reliable. A second place that kills
   * people would be a second place that could kill him.
   *
   * Returns true if the person actually died.
   */
  kill(id: PersonId | string, year: Year, cause: string): boolean {
    const p = this.get(id);
    if (!p || p.status !== 'alive') return false;

    // Daveed Gearithy does not die. He becomes the guardian spirit of the
    // house and makes its decisions from that day forward.
    if (p.becomesGuardian) {
      p.status = 'guardian';
      p.died = year;
      p.causeOfDeath = cause;
      if (!p.castSlots.includes('guardian')) p.castSlots.push('guardian');
      p.castSlots = p.castSlots.filter((s) => s !== 'head');
      for (const m of p.marriages) {
        if (m.to === undefined) m.to = year;
      }
      return false;
    }

    p.status = 'dead';
    p.died = year;
    p.causeOfDeath = cause;

    // Close the marriage on BOTH sides. A widow who stays married forever is a
    // widow who never remarries and never bears again, which quietly ends the
    // line — and does so without anything appearing to go wrong.
    for (const m of p.marriages) {
      if (m.to !== undefined) continue;
      m.to = year;
      const spouse = this.get(m.spouse);
      const theirs = spouse?.marriages.find((x) => x.spouse === p.id && x.to === undefined);
      if (theirs) theirs.to = year;
    }

    this.archive(id);
    return true;
  }

  /**
   * The Narrator, once he has crossed over. Never `alive`, so he is skipped by
   * succession, marriage, births and mortality — and permanently castable, so
   * a template written in 1042 can still name him in 2042.
   */
  guardian(): Person | undefined {
    for (const p of this.people.values()) {
      if (p.status === 'guardian') return p;
    }
    return undefined;
  }

  /** The house a person actually lives in right now, which is not their origin. */
  householdOf(id: PersonId | string, year: Year): string | undefined {
    const p = this.get(id);
    const m = p?.membership.find((x) => x.from <= year && (x.to === undefined || x.to > year));
    return m?.house;
  }

  children(id: PersonId | string): Person[] {
    const out: Person[] = [];
    for (const kid of this.byParent.get(String(id)) ?? []) {
      const p = this.people.get(kid);
      if (p) out.push(p);
    }
    return out;
  }

  siblings(id: PersonId | string): Person[] {
    const p = this.get(id);
    if (!p) return [];
    const seen = new Set<string>();
    const out: Person[] = [];
    for (const parent of [p.trueParents.mother, p.trueParents.father]) {
      if (!parent) continue;
      for (const sib of this.children(parent)) {
        if (sib.id === p.id || seen.has(sib.id)) continue;
        seen.add(sib.id);
        out.push(sib);
      }
    }
    return out;
  }

  /**
   * Depth from the founding generation. Drives family-tree layout.
   *
   * The memo lives on the store rather than being rebuilt per call, so the
   * family tree costs one walk of the pedigree instead of one per person. It is
   * cleared by `setParents`, which is the only thing that can invalidate it.
   */
  generationOf(id: PersonId | string, onPath = new Set<string>()): number {
    const key = String(id);
    const seen = this.depth.get(key);
    if (seen !== undefined) return seen;
    // A pedigree loop is a corruption, not a deep tree. Return rather than
    // recurse: `demography.test.ts` asserts children outrank their parents, so
    // a loop shows up as a failed assertion instead of a blown stack.
    if (onPath.has(key)) return 0;

    const p = this.get(key);
    if (!p) return 0;

    onPath.add(key);
    const mum = p.trueParents.mother ? this.generationOf(p.trueParents.mother, onPath) : -1;
    const dad = p.trueParents.father ? this.generationOf(p.trueParents.father, onPath) : -1;
    onPath.delete(key);

    const g = Math.max(mum, dad) + 1;
    this.depth.set(key, g);
    return g;
  }

  get size(): number {
    return this.people.size;
  }
}
