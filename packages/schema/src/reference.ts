import { z } from 'zod';
import { EffectS, EventTierS, PurposeS, SlotRoleS } from './event.js';
import { TargetS } from './target.js';
import { ConditionS, FilterS, RegisterS, RespectTierS, CompareOpS } from './conditions.js';
import { ChronicleWeightS, FrequencyS, FREQUENCY_PROFILES } from './frequency.js';
import { MembershipKindS, PersonStatusS, RetainerRoleS } from './person.js';
import { AttributeKindS, SexS } from './attributes.js';
import { CONTENT_RULES } from './rules.js';

/**
 * THE VOCABULARY, READ OFF THE SCHEMAS.
 *
 * Authoring an event or wiring an effect used to mean reading `event.ts`,
 * `conditions.ts`, `frequency.ts`, `attributes.ts` and `person.ts` — about
 * seven hundred lines of Zod and commentary — to answer questions as small as
 * "what are the slot roles" and "what fields does a rumour effect take".
 *
 * This reads the answers off the schemas themselves and `npm run gen:docs`
 * renders them to `docs/VOCABULARY.md`. Generated, so it cannot drift; one
 * file, so it costs a fraction of the reading it replaces.
 *
 * The renderer lives in `core/src/tools/gen-docs.ts`. This file only describes.
 */

export interface Variant {
  /** The discriminating key or literal — `rumour`, `ageActive`, `head`. */
  name: string;
  /** `field: type` for everything the variant carries, minus the discriminant. */
  fields: string[];
}

export interface Vocabulary {
  effects: Variant[];
  conditions: Variant[];
  filters: Variant[];
  targets: string[];
  enums: { name: string; values: string[]; note?: string }[];
  frequencies: {
    tier: string; cap: string; cooldown: string; record: string;
    rumour: string; chronicle: string;
  }[];
  rules: { id: string; about: string }[];
}

// ── Type rendering ────────────────────────────────────────────────────────

/**
 * Zod's internals are not part of its public types, so reaching into `_def` needs
 * one cast. It is here, once, rather than at each of the eight places that walk
 * a schema — which is the same bargain every other cast in this codebase makes.
 */
type ZodDef = Record<string, unknown>;
const defOf = (s: z.ZodTypeAny): ZodDef => (s as unknown as { _def: ZodDef })._def;

/** A short, readable type for one field. Depth-limited: this is a reference, not a spec. */
export function typeOf(schema: z.ZodTypeAny, depth = 0): string {
  const def = defOf(schema);
  const kind = String(def.typeName);

  if (depth > 3) return '…';

  // Named short-circuits. `Target` expands to five alternatives and appears on
  // six effects; spelling it out each time buries the field that matters.
  if (schema === TargetS) return 'Target';
  if (schema === ConditionS) return 'Condition';
  if (schema === FilterS) return 'Filter';

  switch (kind) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodNull': return 'null';
    case 'ZodUnknown':
    case 'ZodAny': return 'any';
    case 'ZodLiteral': return JSON.stringify(def.value);
    case 'ZodEnum': return (def.values as string[]).join('|');
    case 'ZodNativeEnum': return 'enum';
    case 'ZodBranded': return typeOf(def.type as z.ZodTypeAny, depth);
    case 'ZodEffects': return typeOf(def.schema as z.ZodTypeAny, depth);
    case 'ZodOptional': return `${typeOf(def.innerType as z.ZodTypeAny, depth)}?`;
    case 'ZodNullable': return `${typeOf(def.innerType as z.ZodTypeAny, depth)}|null`;
    case 'ZodDefault': {
      const inner = typeOf(def.innerType as z.ZodTypeAny, depth);
      const value = (def.defaultValue as () => unknown)();
      return `${inner} = ${JSON.stringify(value)}`;
    }
    case 'ZodArray': return `${typeOf(def.type as z.ZodTypeAny, depth + 1)}[]`;
    case 'ZodRecord': return `record<${typeOf(def.valueType as z.ZodTypeAny, depth + 1)}>`;
    case 'ZodTuple':
      return `[${(def.items as z.ZodTypeAny[]).map((i) => typeOf(i, depth + 1)).join(', ')}]`;
    case 'ZodUnion':
      return (def.options as z.ZodTypeAny[]).map((o) => typeOf(o, depth + 1)).join(' | ');
    case 'ZodDiscriminatedUnion':
      return (def.options as z.ZodTypeAny[]).map((o) => typeOf(o, depth + 1)).join(' | ');
    case 'ZodLazy':
      // Condition and Filter are recursive. Name them rather than expanding.
      return schema === ConditionS ? 'Condition' : schema === FilterS ? 'Filter' : 'recursive';
    case 'ZodObject': {
      const shape = (schema as unknown as z.AnyZodObject).shape;
      return `{${Object.keys(shape).join(', ')}}`;
    }
    default: return kind.replace(/^Zod/, '').toLowerCase();
  }
}

function fieldsOf(obj: z.AnyZodObject, skip: string[] = []): string[] {
  return Object.entries(obj.shape)
    .filter(([k]) => !skip.includes(k))
    .map(([k, v]) => `${k}: ${typeOf(v as z.ZodTypeAny)}`);
}

// ── Union walking ─────────────────────────────────────────────────────────

function discriminated(schema: z.ZodTypeAny, key: string): Variant[] {
  const options = (defOf(schema).options as z.AnyZodObject[]) ?? [];
  return options.map((o) => ({
    name: String(defOf(o.shape[key] as z.ZodTypeAny).value),
    fields: fieldsOf(o, [key]),
  }));
}

/**
 * `Condition` and `Filter` discriminate by WHICH KEY IS PRESENT rather than by
 * a `kind` field, so the variant's name is its first key.
 */
function keyed(lazy: z.ZodTypeAny): Variant[] {
  const inner = (defOf(lazy).getter as () => z.ZodTypeAny)();
  const options = (defOf(inner).options as z.AnyZodObject[]) ?? [];
  return options.map((o) => {
    const keys = Object.keys(o.shape);
    const head = keys[0]!;
    return {
      name: head,
      fields: [
        `${head}: ${typeOf(o.shape[head] as z.ZodTypeAny)}`,
        ...fieldsOf(o, [head]),
      ],
    };
  });
}

// ── The vocabulary ────────────────────────────────────────────────────────

export function vocabulary(): Vocabulary {
  const targets = ((defOf(TargetS).options) as z.ZodTypeAny[]).flatMap((o) => {
    const def = defOf(o);
    if (String(def.typeName) === 'ZodEnum') return def.values as string[];
    return [`{ ${Object.keys((o as unknown as z.AnyZodObject).shape).join(', ')} }`];
  });

  return {
    effects: discriminated(EffectS, 'kind'),
    conditions: keyed(ConditionS),
    filters: keyed(FilterS),
    targets,
    enums: [
      { name: 'SlotRole', values: SlotRoleS.options, note: 'Who a slot may cast. `core/src/events/slots.ts` narrows the pool.' },
      { name: 'Purpose', values: PurposeS.options, note: 'Every template declares exactly three, all distinct.' },
      { name: 'EventTier', values: EventTierS.options, note: '`frame` events run in their own year phase, gated by `reads` rather than `conditions`.' },
      { name: 'Frequency', values: FrequencyS.options, note: 'A rationing tier, not a weight synonym. See the table below.' },
      { name: 'ChronicleWeight', values: ChronicleWeightS.options, note: 'How an entry renders. Decided by frequency, not authored.' },
      { name: 'RespectTier', values: RespectTierS.options, note: 'Ordered. Decay floors at `known`; `unknown` has to be done to you.' },
      { name: 'Register', values: RegisterS.options, note: 'An Age\'s texture. Two Ages of one register never run consecutively.' },
      { name: 'CompareOp', values: CompareOpS.options },
      { name: 'Sex', values: SexS.options },
      { name: 'PersonStatus', values: PersonStatusS.options, note: '`guardian` is the Narrator after he crosses over — never `alive` again.' },
      { name: 'MembershipKind', values: MembershipKindS.options, note: 'One OPEN record per person. Two puts them in two halls at once.' },
      { name: 'RetainerRole', values: RetainerRoleS.options, note: 'An `archivist` in post is what makes an Age pay its clause.' },
      { name: 'AttributeKind', values: AttributeKindS.options, note: 'The list of attributes is open; nothing in the engine counts them.' },
    ],
    frequencies: FrequencyS.options.map((tier) => {
      const p = FREQUENCY_PROFILES[tier];
      return {
        tier,
        cap: p.perRunCap === null ? 'none' : `${p.perRunCap}/run`,
        cooldown: p.cooldownYears ? `${p.cooldownYears} yr` : 'none',
        record: p.record,
        rumour: p.rumour,
        chronicle: p.named ? `${p.chronicle}, named` : p.chronicle,
      };
    }),
    rules: CONTENT_RULES.map((r) => ({ id: r.id, about: r.about })),
  };
}
