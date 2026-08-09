import type { Person, PersonId, Year } from '@ed/schema';

/**
 * A person is never destroyed. The chronicle can reference anyone, forever,
 * which is the point of the chronicle. What varies is the tier they sit in.
 *
 *   hot      living, in the household or actively cast. Slot queries scan
 *            ONLY this tier.
 *   archived dead, or living but narratively inert. Full record, no cache.
 *   shade    outsiders never yet interacted with. Genome unmaterialized.
 */
export class PersonStore {
  private people = new Map<string, Person>();
  private hot = new Set<string>();

  add(p: Person): Person {
    this.people.set(p.id as unknown as string, p);
    if (p.tier === 'hot') this.hot.add(p.id as unknown as string);
    return p;
  }

  get(id: PersonId | string): Person | undefined {
    return this.people.get(id as unknown as string);
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
    this.people.delete(id as unknown as string);
    this.hot.delete(id as unknown as string);
  }

  promote(id: PersonId | string): void {
    const p = this.get(id);
    if (!p) return;
    p.tier = 'hot';
    this.hot.add(id as unknown as string);
  }

  archive(id: PersonId | string): void {
    const p = this.get(id);
    if (!p) return;
    p.tier = 'archived';
    p.phenotype = undefined;
    this.hot.delete(id as unknown as string);
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
    return m?.house as unknown as string | undefined;
  }

  children(id: PersonId | string): Person[] {
    const key = id as unknown as string;
    return this.all().filter(
      (p) => (p.trueParents.mother as unknown as string) === key || (p.trueParents.father as unknown as string) === key,
    );
  }

  siblings(id: PersonId | string): Person[] {
    const p = this.get(id);
    if (!p) return [];
    const { mother, father } = p.trueParents;
    if (!mother && !father) return [];
    return this.all().filter(
      (q) => q.id !== p.id && (
        (mother && q.trueParents.mother === mother) || (father && q.trueParents.father === father)
      ),
    );
  }

  /** Depth from the founding generation. Drives family-tree layout. */
  generationOf(id: PersonId | string, memo = new Map<string, number>()): number {
    const key = id as unknown as string;
    const seen = memo.get(key);
    if (seen !== undefined) return seen;
    const p = this.get(key);
    if (!p) return 0;
    const mum = p.trueParents.mother ? this.generationOf(p.trueParents.mother, memo) : -1;
    const dad = p.trueParents.father ? this.generationOf(p.trueParents.father, memo) : -1;
    const g = Math.max(mum, dad) + 1;
    memo.set(key, g);
    return g;
  }

  get size(): number {
    return this.people.size;
  }
}
