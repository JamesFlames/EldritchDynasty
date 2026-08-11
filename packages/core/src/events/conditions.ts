import type { Condition, Filter, Person } from '@ed/schema';
import { assertNever, compare, RESPECT_ORDER } from '@ed/schema';
import { inRegency, type SimCtx } from '../world.js';
import { attr, phenotypeOf } from '../people/factory.js';
import { activeBranches } from '../people/branches.js';
import { grudgeAgainstUs } from '../people/relationships.js';
import { influencedAttr } from './influence.js';

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
    return w.age.active.some((a) => ctx.content.age(a.age)?.register === c.ageRegister);
  }
  if ('ageElapsed' in c) {
    return w.age.active.some((a) => compare(w.year - a.began, c.ageElapsed.op, c.ageElapsed.years));
  }
  if ('ageStacked' in c) return compare(w.age.active.length, c.ageStacked.op, c.ageStacked.count);
  if ('ageNamed' in c) return w.age.active.some((a) => a.named === c.ageNamed);

  // ── Discrepancies (issue #9) ───────────────────────────────────────────
  if ('discrepancy' in c) {
    const d = w.discrepancies.get(c.discrepancy);
    return c.state !== undefined ? d?.state === c.state : d !== undefined;
  }
  if ('openDiscrepancies' in c) {
    const open = [...w.discrepancies.values()].filter((d) => d.state === 'open').length;
    return compare(open, c.openDiscrepancies.op, c.openDiscrepancies.value);
  }

  // ── Unlocks (issue #11) ─────────────────────────────────────────────────
  if ('unlocked' in c) {
    return w.people.household(w.playerHouse, w.year).some((p) => [...p.traits].some((tid) => {
      const trait = ctx.content.trait(tid);
      return trait?.presence.some((pres) => pres.modifiers.some((m) => m.kind === 'unlock' && m.grants === c.unlocked)) ?? false;
    }));
  }

  // This used to be `return true`, which is the most expensive default in the
  // codebase: a condition kind added to the schema and not handled here does
  // not fail — it PASSES, so every event carrying it fires unconditionally, for
  // a thousand years, looking exactly like content that was meant to be common.
  return assertNever(c, 'condition');
}

/**
 * `role` is the slot ROLE `p` is being tested as a candidate for — supplied
 * by `candidatesFor`, which is the only caller that knows it — so an
 * `attribute` modifier's `slot` target (issue #11) can apply here exactly as
 * it would once `p` is actually cast. Omitted by callers with no slot in
 * play (e.g. heirloom eligibility), which is "not being cast anywhere."
 */
export function evalFilter(f: Filter, p: Person, ctx: SimCtx, bound: Record<string, string>, role?: string): boolean {
  const w = ctx.world;
  if ('all' in f) return f.all.every((x) => evalFilter(x, p, ctx, bound, role));
  if ('any' in f) return f.any.some((x) => evalFilter(x, p, ctx, bound, role));
  if ('not' in f) return !evalFilter(f.not, p, ctx, bound, role);

  if ('attr' in f) return compare(influencedAttr(ctx, p, f.attr, role), f.op, f.value);
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
      case 'not': return p.id !== otherId;
      case 'child_of': return p.trueParents.mother === other.id || p.trueParents.father === other.id;
      case 'sibling_of': return w.people.siblings(other.id).some((s) => s.id === p.id);
      case 'spouse_of': return p.marriages.some((m) => m.spouse === other.id && !m.to);
      case 'blood_of': return p.membership.some((m) => m.kind === 'blood' && other.membership.some((n) => n.house === m.house));
      default: return assertNever(f.relation, 'relation filter');
    }
  }
  // A filter kind nothing handles used to pass, which means a slot spec written
  // against it cast ANYONE. Same default, same cost, same fix as above.
  return assertNever(f, 'filter');
}
