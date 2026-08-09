import { z } from 'zod';

export const CompareOpS = z.enum(['lt', 'lte', 'eq', 'gte', 'gt', 'ne']);
export type CompareOp = z.infer<typeof CompareOpS>;

export function compare(a: number, op: CompareOp, b: number): boolean {
  switch (op) {
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'eq': return a === b;
    case 'gte': return a >= b;
    case 'gt': return a > b;
    case 'ne': return a !== b;
  }
}

export const RespectTierS = z.enum(['unknown', 'known', 'regarded', 'eminent', 'exalted']);
export type RespectTier = z.infer<typeof RespectTierS>;
export const RESPECT_ORDER: RespectTier[] = ['unknown', 'known', 'regarded', 'eminent', 'exalted'];

export const RegisterS = z.enum(['warm', 'cold', 'institutional']);
export type Register = z.infer<typeof RegisterS>;

/**
 * Conditions gate on world state. Slot fillability is checked separately and
 * later, because it is far more expensive (see core/events/selection.ts).
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string; is?: boolean }
  | { knowledge: string; has: boolean }
  | { respect: { op: CompareOp; tier: RespectTier } }
  | { year: { op: CompareOp; value: number } }
  | { generation: { op: CompareOp; value: number } }
  | { treasury: { op: CompareOp; value: number } }
  | { clausesRecovered: { op: CompareOp; value: number } }
  | { familyAny: { attr: string; atLeast: number } }
  | { familySize: { op: CompareOp; value: number } }
  | { inRegency: boolean }
  | { hasExpressingHead: boolean }
  // ── Cadet branches (concept §16, §22) ────────────────────────────────
  /** Living cadet branches. A house with none is a house with one household. */
  | { cadetBranches: { op: CompareOp; value: number } }
  /** The angriest branch's grievance, 0–100. */
  | { branchGrievance: { op: CompareOp; value: number } }
  | { discontent: { op: CompareOp; value: number } }
  // ── Age gating (concept §20) ─────────────────────────────────────────
  | { ageActive: string }
  | { ageRegister: Register }
  | { ageElapsed: { op: CompareOp; years: number } }
  | { ageStacked: { op: CompareOp; count: number } }
  | { ageNamed: boolean };

export const ConditionS: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionS) }),
    z.object({ any: z.array(ConditionS) }),
    z.object({ not: ConditionS }),
    z.object({ flag: z.string(), is: z.boolean().optional() }),
    z.object({ knowledge: z.string(), has: z.boolean() }),
    z.object({ respect: z.object({ op: CompareOpS, tier: RespectTierS }) }),
    z.object({ year: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ generation: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ treasury: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ clausesRecovered: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ familyAny: z.object({ attr: z.string(), atLeast: z.number() }) }),
    z.object({ familySize: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ inRegency: z.boolean() }),
    z.object({ hasExpressingHead: z.boolean() }),
    z.object({ cadetBranches: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ branchGrievance: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ discontent: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ ageActive: z.string() }),
    z.object({ ageRegister: RegisterS }),
    z.object({ ageElapsed: z.object({ op: CompareOpS, years: z.number() }) }),
    z.object({ ageStacked: z.object({ op: CompareOpS, count: z.number() }) }),
    z.object({ ageNamed: z.boolean() }),
  ]),
);

/** Filters run against a person, not against the world. */
export type Filter =
  | { attr: string; op: CompareOp; value: number }
  | { trait: string; has: boolean }
  | { tag: string; has: boolean }
  | { sex: 'male' | 'female' }
  | { age: { op: CompareOp; value: number } }
  | { status: string[] }
  | { membership: string[] }
  | { awakened: boolean }
  | { canExpress: boolean }
  | { relation: 'not' | 'child_of' | 'sibling_of' | 'spouse_of' | 'blood_of'; of: string }
  | { all: Filter[] }
  | { any: Filter[] }
  | { not: Filter };

export const FilterS: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.object({ attr: z.string(), op: CompareOpS, value: z.number() }),
    z.object({ trait: z.string(), has: z.boolean() }),
    z.object({ tag: z.string(), has: z.boolean() }),
    z.object({ sex: z.enum(['male', 'female']) }),
    z.object({ age: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ status: z.array(z.string()) }),
    z.object({ membership: z.array(z.string()) }),
    z.object({ awakened: z.boolean() }),
    z.object({ canExpress: z.boolean() }),
    z.object({ relation: z.enum(['not', 'child_of', 'sibling_of', 'spouse_of', 'blood_of']), of: z.string() }),
    z.object({ all: z.array(FilterS) }),
    z.object({ any: z.array(FilterS) }),
    z.object({ not: FilterS }),
  ]),
);
