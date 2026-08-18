import type { CharacterRole, CharacterTemplate, Person, Sex } from '@ed/schema';
import { asId, canTemplateFire, frequencyWeight, recordFire } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { hashSeed, type Rng } from '../rng.js';
import { makePerson } from './factory.js';
import { uniqueName } from './names.js';
import { evalCondition } from '../events/conditions.js';

/**
 * Minting people from templates.
 *
 * Everyone the world produces after 1042 comes through here — suitors, grooms,
 * rivals, tutors, midwives, wanderers. Before this existed the spawn rules
 * were hardcoded in three different functions, which meant a designer could
 * not add a kind of person without an engineer.
 */

export function eligibleTemplates(ctx: SimCtx, role: CharacterRole): CharacterTemplate[] {
  const w = ctx.world;
  return ctx.content.characterTemplates.filter((t) => {
    if (t.role !== role) return false;
    if (frequencyWeight(t.frequency, w.characterFrequency, w.year, w.generation) <= 0) return false;
    if (!canTemplateFire(t.id, t.frequency, w.characterFrequency)) return false;
    if (t.unique && hasLiving(ctx, t)) return false;
    return evalCondition(t.conditions, ctx);
  });
}

function hasLiving(ctx: SimCtx, t: CharacterTemplate): boolean {
  return ctx.world.people.living().some((p) => p.mintedFrom === t.id);
}

export function pickTemplate(ctx: SimCtx, role: CharacterRole, rng: Rng): CharacterTemplate | undefined {
  const pool = eligibleTemplates(ctx, role);
  const w = ctx.world;
  return rng.weighted(pool, (t) =>
    frequencyWeight(t.frequency, w.characterFrequency, w.year, w.generation) * (t.weight / 100));
}

/**
 * A rolled recipe: everyone this person WOULD be, without anybody existing yet.
 *
 * The Match deals three cards and the player takes one, so two of the three
 * must never enter the world — a suitor the house declined is not a woman who
 * lived somewhere else, she is a letter that was answered no. Splitting the
 * roll from the mint is what makes that honest: `rollRecipe` decides who a
 * card is, `mintRecipe` is the only thing that spawns her, and the person the
 * player gets is the person the card promised rather than a fresh draw that
 * happens to share a title.
 */
export interface MintRecipe {
  template: string;
  house: string;
  sex: Sex;
  age: number;
  name: string;
  seed: number;
}

/**
 * Everything about a minted person that the dice decide, decided — and nothing
 * spawned. The name is reserved here rather than at mint time: two cards dealt
 * in the same year must not be able to be the same woman, and a name promised
 * on a card the house declined is a name that house heard once and will not
 * reuse.
 */
export function rollRecipe(template: CharacterTemplate, ctx: SimCtx, rng: Rng): MintRecipe {
  const w = ctx.world;
  const houseRow = rng.weighted(template.houses, (h) => h.weight) ?? template.houses[0]!;
  const house = w.houses.get(houseRow.house);

  const sex: Sex = template.sex === 'any' ? (rng.bool(0.5) ? 'male' : 'female') : template.sex;
  const age = Math.round(rng.range(template.ageAtArrival.min, template.ageAtArrival.max));
  const seed = hashSeed(w.seed, 'mint', template.id, w.year, (w.counters.mint += 1));

  let name = uniqueName(sex, ctx.takenNames, rng);
  if (template.naming === 'of_house' && house) {
    name = `${name} of ${house.name.replace(/^(House |The )/, '')}`;
  }
  ctx.takenNames.add(name);

  return { template: String(template.id), house: houseRow.house, sex, age, name, seed };
}

/**
 * Roll an actual person from a recipe. The genome comes from the drawn house's
 * pool and is LAZY: a suitor costs twelve bytes until somebody marries her, at
 * which point her genome exists and would have been the same genome had it
 * been materialized on the day she was minted.
 */
export function mint(
  template: CharacterTemplate,
  ctx: SimCtx,
  rng: Rng,
  opts: { household?: string; membership?: Person['membership'][number]['kind'] } = {},
): Person {
  return mintRecipe(rollRecipe(template, ctx, rng), template, ctx, opts);
}

// The only place people are spawned. INVARIANT 7: it spends `characterFrequency`.
export function mintRecipe(
  recipe: MintRecipe,
  template: CharacterTemplate,
  ctx: SimCtx,
  opts: { household?: string; membership?: Person['membership'][number]['kind'] } = {},
): Person {
  const w = ctx.world;
  const { sex, age, seed, name } = recipe;
  const houseRow = { house: recipe.house };

  const membership = opts.membership
    ?? (template.role === 'retainer' ? 'retainer'
      : template.role === 'ward' ? 'ward'
        : template.role === 'hostage' ? 'hostage'
          : 'blood');

  const p = makePerson({
    sex,
    born: w.year - age,
    house: houseRow.house,
    name,
    genome: {
      kind: 'lazy',
      pool: houseRow.house,
      seed,
      ...(Object.keys(template.bias).length ? { bias: template.bias } : {}),
    },
    membership,
    seed,
    seq: w,
  });

  p.mintedFrom = template.id;
  p.castSlots = [...template.castSlots];
  for (const t of template.traits) p.traits.add(asId(t));
  // Bound to the HEAD who hired them, not to the house. Binding to the house
  // made `onEmployerDeath` unreachable — the employer could never die — and so
  // no contract in the game had any way to end.
  if (template.contract) {
    const employer = w.people.living().find((q) => q.castSlots.includes('head'));
    p.contract = { ...template.contract, boundTo: (employer?.id) ?? w.playerHouse };
  }

  const household = opts.household
    ?? (template.role === 'retainer' || template.role === 'ward' || template.role === 'hostage'
      ? w.playerHouse
      : houseRow.house);
  p.membership = [{ house: asId(household), kind: membership, from: w.year }];

  w.people.add(p);
  recordFire(template.id, template.frequency, w.characterFrequency, w.year);
  return p;
}

/** Convenience: draw a template for a role and mint it, or return undefined. */
export function mintForRole(
  ctx: SimCtx,
  role: CharacterRole,
  rng: Rng,
  opts: { household?: string; membership?: Person['membership'][number]['kind'] } = {},
): Person | undefined {
  const template = pickTemplate(ctx, role, rng);
  if (!template) return undefined;
  return mint(template, ctx, rng, opts);
}

/**
 * Editor preview: what does this recipe actually produce? Rolls N people and
 * reports the distribution, which is the only honest way to review a template
 * whose most important field is invisible to the player.
 */
export function previewTemplate(
  template: CharacterTemplate,
  ctx: SimCtx,
  n: number,
  rollGenome: (person: Person) => { carriedFont: number; canExpress: boolean },
  rng: Rng,
): {
  sample: { name: string; sex: Sex; age: number; house: string; font: number; canExpress: boolean }[];
  carrierRate: number;
  meanFont: number;
} {
  const sample: { name: string; sex: Sex; age: number; house: string; font: number; canExpress: boolean }[] = [];
  const w = ctx.world;

  /**
   * The counters have to be restored too, and they were not.
   *
   * A preview removed its people and refunded the ration, so it looked clean —
   * but every rolled person had already advanced `counters.person`, and
   * conception seeds derive from parent ids. Previewing twenty-four suitors
   * therefore renamed every child born afterwards and gave them different
   * genomes: the editor's own inspection tool quietly changed the run it was
   * inspecting, and only on the worlds somebody had previewed into.
   */
  const counters = { ...w.counters };

  for (let i = 0; i < n; i++) {
    const p = mint(template, ctx, rng);
    const e = rollGenome(p);
    sample.push({
      name: p.name,
      sex: p.sex,
      age: w.year - p.born,
      house: p.houseOfOrigin,
      font: Math.round(e.carriedFont * 10) / 10,
      canExpress: e.canExpress,
    });
    // Preview must not pollute the world OR spend the ration.
    w.people.remove(p.id);
    ctx.takenNames.delete(p.name);
    w.characterFrequency.firedThisRun[template.frequency] -= 1;
    w.characterFrequency.templateFires[template.id] = (w.characterFrequency.templateFires[template.id] ?? 1) - 1;
  }

  Object.assign(w.counters, counters);

  const carriers = sample.filter((s) => s.font > 0).length;
  return {
    sample,
    carrierRate: sample.length ? carriers / sample.length : 0,
    meanFont: sample.length ? sample.reduce((a, s) => a + s.font, 0) / sample.length : 0,
  };
}
