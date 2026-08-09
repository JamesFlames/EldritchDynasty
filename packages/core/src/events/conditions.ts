import type { Condition, Filter, Person } from '@ed/schema';
import { compare, RESPECT_ORDER } from '@ed/schema';
import { inRegency, type SimCtx } from '../world.js';
import { attr, phenotypeOf } from '../people/factory.js';
import { activeBranches } from '../people/branches.js';
import { grudgeAgainstUs } from '../people/relationships.js';

export function evalCondition(c: Condition | undefined, ctx: SimCtx): boolean {
  if (!c) return true;
  const w = ctx.world;

  if ('all' in c) return c.all.every((x) => evalCondition(x, ctx));
  if ('any' in c) return c.any.some((x) => evalCondition(x, ctx));
  if ('not' in c) return !evalCondition(c.not, ctx);

  if ('flag' in c) {
    const v = w.flags.get(c.flag);
    return c.is === false ? !v : Boolean(v);
  }
  if ('knowledge' in c) return w.knowledge.has(c.knowledge) === c.has;
  if ('respect' in c) {
    return compare(RESPECT_ORDER.indexOf(w.respect), c.respect.op, RESPECT_ORDER.indexOf(c.respect.tier));
  }
  if ('year' in c) return compare(w.year, c.year.op, c.year.value);
  if ('generation' in c) return compare(w.generation, c.generation.op, c.generation.value);
  if ('treasury' in c) return compare(w.treasury, c.treasury.op, c.treasury.value);
  if ('clausesRecovered' in c) return compare(w.clausesRecovered.size, c.clausesRecovered.op, c.clausesRecovered.value);
  if ('familySize' in c) return compare(w.people.household(w.playerHouse, w.year).length, c.familySize.op, c.familySize.value);

  if ('familyAny' in c) {
    return w.people
      .household(w.playerHouse, w.year)
      .some((p) => attr(p, c.familyAny.attr, ctx.genetics, w.year) >= c.familyAny.atLeast);
  }
  if ('hasExpressingHead' in c) {
    const h = w.people.living().find((p) => p.castSlots.includes('head'));
    const yes = h ? phenotypeOf(h, ctx.genetics, w.year).eldritch.canExpress : false;
    return yes === c.hasExpressingHead;
  }
  if ('inRegency' in c) return inRegency(w) === c.inRegency;

  // ── Cadet branches (concept §16, §22) ──────────────────────────────────
  if ('cadetBranches' in c) {
    return compare(activeBranches(w).length, c.cadetBranches.op, c.cadetBranches.value);
  }
  if ('branchGrievance' in c) {
    const worst = activeBranches(w).reduce((m, b) => Math.max(m, b.grievance), 0);
    return compare(worst, c.branchGrievance.op, c.branchGrievance.value);
  }
  if ('discontent' in c) return compare(w.discontent, c.discontent.op, c.discontent.value);
  if ('grudgeAgainstUs' in c) {
    return compare(grudgeAgainstUs(w), c.grudgeAgainstUs.op, c.grudgeAgainstUs.value);
  }

  // ── Age gating ─────────────────────────────────────────────────────────
  if ('ageActive' in c) return w.age.active.some((a) => a.age === c.ageActive);
  if ('ageRegister' in c) {
    return w.age.active.some((a) => ctx.bundle.ages.find((d) => d.id === a.age)?.register === c.ageRegister);
  }
  if ('ageElapsed' in c) {
    return w.age.active.some((a) => compare(w.year - a.began, c.ageElapsed.op, c.ageElapsed.years));
  }
  if ('ageStacked' in c) return compare(w.age.active.length, c.ageStacked.op, c.ageStacked.count);
  if ('ageNamed' in c) return w.age.active.some((a) => a.named === c.ageNamed);

  return true;
}

export function evalFilter(f: Filter, p: Person, ctx: SimCtx, bound: Record<string, string>): boolean {
  const w = ctx.world;
  if ('all' in f) return f.all.every((x) => evalFilter(x, p, ctx, bound));
  if ('any' in f) return f.any.some((x) => evalFilter(x, p, ctx, bound));
  if ('not' in f) return !evalFilter(f.not, p, ctx, bound);

  if ('attr' in f) return compare(attr(p, f.attr, ctx.genetics, w.year), f.op, f.value);
  if ('trait' in f) return p.traits.has(f.trait as never) === f.has;
  if ('tag' in f) return p.castSlots.includes(f.tag) === f.has;
  if ('sex' in f) return p.sex === f.sex;
  if ('age' in f) return compare(w.year - p.born, f.age.op, f.age.value);
  if ('status' in f) return f.status.includes(p.status);
  if ('membership' in f) return p.membership.some((m) => f.membership.includes(m.kind) && m.to === undefined);
  if ('awakened' in f) return p.awakening.awakened === f.awakened;
  if ('canExpress' in f) return phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress === f.canExpress;

  if ('relation' in f) {
    const otherId = bound[f.of];
    if (!otherId) return true;
    const other = w.people.get(otherId);
    if (!other) return true;
    switch (f.relation) {
      case 'not': return (p.id as unknown as string) !== otherId;
      case 'child_of': return p.trueParents.mother === other.id || p.trueParents.father === other.id;
      case 'sibling_of': return w.people.siblings(other.id).some((s) => s.id === p.id);
      case 'spouse_of': return p.marriages.some((m) => m.spouse === other.id && !m.to);
      case 'blood_of': return p.membership.some((m) => m.kind === 'blood' && other.membership.some((n) => n.house === m.house));
    }
  }
  return true;
}
