<script setup lang="ts">
import { computed } from 'vue';
import type { Condition, CompareOp } from '@ed/schema';

/**
 * THE CONDITION BUILDER (issue #21).
 *
 * `Condition` is a 23-member closed union (three combinators — `all`/`any`/
 * `not` — plus twenty leaves), and hand-editing it is YAML today. Twenty
 * bespoke forms would be twenty places to keep in sync with `conditions.ts`;
 * instead every leaf is driven off `LEAF_SHAPES`, a small table naming each
 * kind's SHAPE rather than its exact fields. Six shapes cover all twenty
 * kinds. Add a leaf kind to the schema and — as long as it fits one of the
 * six — this file needs one new table row, not a new form.
 */
const props = defineProps<{ modelValue: Condition | undefined }>();
const emit = defineEmits<{ 'update:modelValue': [Condition | undefined] }>();

const COMPARE_OPS: CompareOp[] = ['lt', 'lte', 'eq', 'gte', 'gt', 'ne'];
const RESPECT_TIERS = ['unknown', 'known', 'regarded', 'eminent', 'exalted'];
const REGISTERS = ['warm', 'cold', 'institutional'];
const DISCREPANCY_STATES = ['open', 'proven', 'buried'];

type Shape =
  | { kind: 'compareValue' }
  | { kind: 'boolean' }
  | { kind: 'string' }
  | { kind: 'enumString'; options: string[] }
  | { kind: 'flag' }
  | { kind: 'knowledge' }
  | { kind: 'respect' }
  | { kind: 'familyAny' }
  | { kind: 'compareNamed'; inner: string }
  | { kind: 'discrepancy' };

/** kind -> shape. The whole vocabulary, read against `schema/src/conditions.ts`. */
const LEAF_SHAPES: Record<string, Shape> = {
  year: { kind: 'compareValue' },
  generation: { kind: 'compareValue' },
  treasury: { kind: 'compareValue' },
  clausesRecovered: { kind: 'compareValue' },
  familySize: { kind: 'compareValue' },
  cadetBranches: { kind: 'compareValue' },
  branchGrievance: { kind: 'compareValue' },
  discontent: { kind: 'compareValue' },
  grudgeAgainstUs: { kind: 'compareValue' },
  openDiscrepancies: { kind: 'compareValue' },
  inRegency: { kind: 'boolean' },
  hasExpressingHead: { kind: 'boolean' },
  ageNamed: { kind: 'boolean' },
  ageActive: { kind: 'string' },
  unlocked: { kind: 'string' },
  ageRegister: { kind: 'enumString', options: REGISTERS },
  flag: { kind: 'flag' },
  knowledge: { kind: 'knowledge' },
  respect: { kind: 'respect' },
  familyAny: { kind: 'familyAny' },
  ageElapsed: { kind: 'compareNamed', inner: 'years' },
  ageStacked: { kind: 'compareNamed', inner: 'count' },
  discrepancy: { kind: 'discrepancy' },
};
const LEAF_KINDS = Object.keys(LEAF_SHAPES);

function defaultOf(kind: string): Condition {
  const shape = LEAF_SHAPES[kind]!;
  switch (shape.kind) {
    case 'compareValue': return { [kind]: { op: 'gte', value: 0 } } as never;
    case 'boolean': return { [kind]: true } as never;
    case 'string': return { [kind]: '' } as never;
    case 'enumString': return { [kind]: shape.options[0] } as never;
    case 'flag': return { flag: '' } as never;
    case 'knowledge': return { knowledge: '', has: true } as never;
    case 'respect': return { respect: { op: 'gte', tier: 'known' } } as never;
    case 'familyAny': return { familyAny: { attr: '', atLeast: 0 } } as never;
    case 'compareNamed': return { [kind]: { op: 'gte', [shape.inner]: 0 } } as never;
    case 'discrepancy': return { discrepancy: '' } as never;
    default: return { [kind]: {} } as never;
  }
}

/** Which key names this node, for the kind selector — 'all' / 'any' / 'not' / one of the leaf kinds. */
function keyOf(c: Condition): string {
  if ('all' in c) return 'all';
  if ('any' in c) return 'any';
  if ('not' in c) return 'not';
  return Object.keys(c)[0]!;
}

const nodeKind = computed(() => (props.modelValue ? keyOf(props.modelValue) : 'none'));

function setKind(kind: string) {
  if (kind === 'none') { emit('update:modelValue', undefined); return; }
  if (kind === 'all' || kind === 'any') { emit('update:modelValue', { [kind]: [] } as never); return; }
  if (kind === 'not') { emit('update:modelValue', { not: defaultOf('flag') } as never); return; }
  emit('update:modelValue', defaultOf(kind));
}

// ── all/any: the group ──────────────────────────────────────────────────
const groupItems = computed<Condition[]>(() => {
  const c = props.modelValue;
  if (c && 'all' in c) return c.all;
  if (c && 'any' in c) return c.any;
  return [];
});

function setGroup(items: Condition[]) {
  const kind = nodeKind.value;
  if (kind === 'all' || kind === 'any') emit('update:modelValue', { [kind]: items } as never);
}

function addChild() {
  setGroup([...groupItems.value, defaultOf('flag')]);
}
function removeChild(i: number) {
  setGroup(groupItems.value.filter((_, j) => j !== i));
}
function updateChild(i: number, v: Condition | undefined) {
  if (!v) { removeChild(i); return; }
  setGroup(groupItems.value.map((c, j) => (j === i ? v : c)));
}

// Drag to reorder (issue #21). Native HTML5 DnD — no library, matching the
// house style FamilyTree.vue and Sigil.vue already set with hand-rolled SVG.
const dragFrom = { index: -1 };
function onDragStart(i: number) { dragFrom.index = i; }
function onDrop(i: number) {
  if (dragFrom.index < 0 || dragFrom.index === i) return;
  const items = [...groupItems.value];
  const [moved] = items.splice(dragFrom.index, 1);
  items.splice(i, 0, moved!);
  setGroup(items);
  dragFrom.index = -1;
}

// ── not: the single child ───────────────────────────────────────────────
const notChild = computed<Condition | undefined>(() => (props.modelValue && 'not' in props.modelValue ? props.modelValue.not : undefined));
function updateNotChild(v: Condition | undefined) {
  emit('update:modelValue', { not: v ?? defaultOf('flag') } as never);
}

// ── leaf field access, generic over the shape table ─────────────────────
function leafValue(): Record<string, unknown> {
  return (props.modelValue ?? {}) as Record<string, unknown>;
}
function updateLeaf(patch: Record<string, unknown>) {
  emit('update:modelValue', { ...leafValue(), ...patch } as never);
}
function updateNested(key: string, patch: Record<string, unknown>) {
  const cur = (leafValue()[key] as Record<string, unknown>) ?? {};
  updateLeaf({ [key]: { ...cur, ...patch } });
}
</script>

<template>
  <div class="cond">
    <div class="cond-row">
      <select class="cond-kind" :value="nodeKind" @change="setKind(($event.target as HTMLSelectElement).value)">
        <option value="none">— none —</option>
        <optgroup label="combinators">
          <option value="all">all (every child must hold)</option>
          <option value="any">any (one child must hold)</option>
          <option value="not">not</option>
        </optgroup>
        <optgroup label="leaves">
          <option v-for="k in LEAF_KINDS" :key="k" :value="k">{{ k }}</option>
        </optgroup>
      </select>

      <!-- ── Leaf field inputs, one per shape ───────────────────────── -->
      <template v-if="modelValue && LEAF_SHAPES[nodeKind]">
        <template v-if="LEAF_SHAPES[nodeKind]!.kind === 'compareValue'">
          <select :value="(leafValue()[nodeKind] as { op: string })?.op" @change="updateNested(nodeKind, { op: ($event.target as HTMLSelectElement).value })">
            <option v-for="op in COMPARE_OPS" :key="op" :value="op">{{ op }}</option>
          </select>
          <input type="number" :value="(leafValue()[nodeKind] as { value: number })?.value"
                 @input="updateNested(nodeKind, { value: Number(($event.target as HTMLInputElement).value) })" />
        </template>

        <template v-else-if="LEAF_SHAPES[nodeKind]!.kind === 'compareNamed'">
          <select :value="(leafValue()[nodeKind] as { op: string })?.op" @change="updateNested(nodeKind, { op: ($event.target as HTMLSelectElement).value })">
            <option v-for="op in COMPARE_OPS" :key="op" :value="op">{{ op }}</option>
          </select>
          <input type="number" :value="(leafValue()[nodeKind] as Record<string, number>)[(LEAF_SHAPES[nodeKind] as { inner: string }).inner]"
                 @input="updateNested(nodeKind, { [(LEAF_SHAPES[nodeKind] as { inner: string }).inner]: Number(($event.target as HTMLInputElement).value) })" />
        </template>

        <template v-else-if="LEAF_SHAPES[nodeKind]!.kind === 'boolean'">
          <select :value="String(leafValue()[nodeKind])" @change="updateLeaf({ [nodeKind]: ($event.target as HTMLSelectElement).value === 'true' })">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </template>

        <template v-else-if="LEAF_SHAPES[nodeKind]!.kind === 'string'">
          <input type="text" :value="leafValue()[nodeKind]" @input="updateLeaf({ [nodeKind]: ($event.target as HTMLInputElement).value })" />
        </template>

        <template v-else-if="LEAF_SHAPES[nodeKind]!.kind === 'enumString'">
          <select :value="leafValue()[nodeKind]" @change="updateLeaf({ [nodeKind]: ($event.target as HTMLSelectElement).value })">
            <option v-for="o in (LEAF_SHAPES[nodeKind] as { options: string[] }).options" :key="o" :value="o">{{ o }}</option>
          </select>
        </template>

        <template v-else-if="nodeKind === 'flag'">
          <input type="text" placeholder="flag id" :value="leafValue().flag" @input="updateLeaf({ flag: ($event.target as HTMLInputElement).value })" />
          <select :value="String(leafValue().is ?? 'true')" @change="updateLeaf({ is: ($event.target as HTMLSelectElement).value === 'true' })">
            <option value="true">is true</option>
            <option value="false">is false</option>
          </select>
        </template>

        <template v-else-if="nodeKind === 'knowledge'">
          <input type="text" placeholder="knowledge flag" :value="leafValue().knowledge" @input="updateLeaf({ knowledge: ($event.target as HTMLInputElement).value })" />
          <select :value="String(leafValue().has)" @change="updateLeaf({ has: ($event.target as HTMLSelectElement).value === 'true' })">
            <option value="true">has it</option>
            <option value="false">does not</option>
          </select>
        </template>

        <template v-else-if="nodeKind === 'respect'">
          <select :value="(leafValue().respect as { op: string })?.op" @change="updateNested('respect', { op: ($event.target as HTMLSelectElement).value })">
            <option v-for="op in COMPARE_OPS" :key="op" :value="op">{{ op }}</option>
          </select>
          <select :value="(leafValue().respect as { tier: string })?.tier" @change="updateNested('respect', { tier: ($event.target as HTMLSelectElement).value })">
            <option v-for="t in RESPECT_TIERS" :key="t" :value="t">{{ t }}</option>
          </select>
        </template>

        <template v-else-if="nodeKind === 'familyAny'">
          <input type="text" placeholder="attribute" :value="(leafValue().familyAny as { attr: string })?.attr"
                 @input="updateNested('familyAny', { attr: ($event.target as HTMLInputElement).value })" />
          <span style="font-size:12px;color:var(--ink-faint)">at least</span>
          <input type="number" :value="(leafValue().familyAny as { atLeast: number })?.atLeast"
                 @input="updateNested('familyAny', { atLeast: Number(($event.target as HTMLInputElement).value) })" />
        </template>

        <template v-else-if="nodeKind === 'discrepancy'">
          <input type="text" placeholder="discrepancy id" :value="leafValue().discrepancy" @input="updateLeaf({ discrepancy: ($event.target as HTMLInputElement).value })" />
          <select :value="leafValue().state ?? ''" @change="updateLeaf({ state: ($event.target as HTMLSelectElement).value || undefined })">
            <option value="">any state</option>
            <option v-for="s in DISCREPANCY_STATES" :key="s" :value="s">{{ s }}</option>
          </select>
        </template>
      </template>
    </div>

    <!-- ── all / any: nested group, drag to reorder ─────────────────── -->
    <div v-if="nodeKind === 'all' || nodeKind === 'any'" class="cond-group">
      <div v-for="(child, i) in groupItems" :key="i" class="cond-child"
           draggable="true" @dragstart="onDragStart(i)" @dragover.prevent @drop="onDrop(i)">
        <span class="cond-handle" title="drag to reorder">⠿</span>
        <ConditionBuilder :model-value="child" @update:model-value="(v) => updateChild(i, v)" />
        <button class="btn" @click="removeChild(i)">remove</button>
      </div>
      <button class="btn" @click="addChild">+ add condition</button>
    </div>

    <!-- ── not: one nested child ─────────────────────────────────────── -->
    <div v-else-if="nodeKind === 'not'" class="cond-group">
      <ConditionBuilder :model-value="notChild" @update:model-value="updateNotChild" />
    </div>
  </div>
</template>

<style scoped>
.cond { margin: 4px 0; }
.cond-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.cond-row select, .cond-row input { width: auto; margin: 0; font-size: 12.5px; padding: 5px 7px; }
.cond-kind { min-width: 130px; font-weight: 600; }
.cond-group { margin: 6px 0 6px 18px; padding-left: 10px; border-left: 2px solid var(--rule); }
.cond-child { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; padding: 4px; border-radius: 3px; }
.cond-child:hover { background: var(--vellum-deep); }
.cond-handle { cursor: grab; color: var(--ink-faint); padding-top: 6px; }
</style>
