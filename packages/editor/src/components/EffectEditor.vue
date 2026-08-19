<script setup lang="ts">
import { computed } from 'vue';
import type { Effect } from '@ed/schema';
import { effectFields, effectKinds } from '@ed/schema';
import FieldInput from './FieldInput.vue';

/**
 * THE VERBS, EDITABLE.
 *
 * Effects were the largest authoring gap in this tool: the one vocabulary that
 * decides what an event actually DOES, and the editor could only display it.
 *
 * There is no table of effect kinds in this file. `effectFields()` walks
 * `EffectS` itself, so the twenty-two kinds and their fields are read off the
 * schema at runtime — which means the form cannot fall behind the union, and
 * adding an `Effect` kind gives it a form here with no edit to this component.
 */
const props = defineProps<{ modelValue: Effect[]; slotNames?: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [Effect[]] }>();

const FIELDS = effectFields();
const KINDS = effectKinds();

function replace(i: number, eff: Effect) {
  emit('update:modelValue', props.modelValue.map((e, j) => (j === i ? eff : e)));
}

function setField(i: number, key: string, value: unknown) {
  const next = { ...(props.modelValue[i] as unknown as Record<string, unknown>) };
  if (value === undefined) delete next[key];
  else next[key] = value;
  replace(i, next as unknown as Effect);
}

/** A new effect of `kind`, with every non-optional field seeded so it validates. */
function blank(kind: string): Effect {
  const out: Record<string, unknown> = { kind };
  for (const f of FIELDS[kind] ?? []) {
    if (f.optional) continue;
    if (f.fallback !== undefined) { out[f.key] = f.fallback; continue; }
    const c = f.control;
    out[f.key] = c.kind === 'number' ? 0
      : c.kind === 'boolean' ? true
        : c.kind === 'enum' ? c.options[0]
          : c.kind === 'target' ? 'head'
            : c.kind === 'stringList' ? []
              : c.kind === 'object' ? {}
                : c.kind === 'scalar' ? true
                  : '';
  }
  return out as unknown as Effect;
}

function add() {
  emit('update:modelValue', [...props.modelValue, blank('flag')]);
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, j) => j !== i));
}

function changeKind(i: number, kind: string) {
  // Deliberately NOT a field-preserving merge. `kind` is the discriminant, and
  // carrying `heirloom` across to a `treasury` effect would produce an object
  // that parses as neither. Start clean.
  replace(i, blank(kind));
}

const rows = computed(() =>
  props.modelValue.map((e, i) => ({
    i,
    kind: (e as unknown as { kind: string }).kind,
    values: e as unknown as Record<string, unknown>,
  })));
</script>

<template>
  <div class="effects">
    <div v-for="row in rows" :key="row.i" class="eff">
      <div class="eff-head">
        <select :value="row.kind" @change="changeKind(row.i, ($event.target as HTMLSelectElement).value)">
          <option v-for="k in KINDS" :key="k" :value="k">{{ k }}</option>
        </select>
        <button class="btn tiny" @click="remove(row.i)">remove</button>
      </div>
      <FieldInput
        v-for="f in FIELDS[row.kind] ?? []" :key="f.key" :spec="f" :slot-names="slotNames"
        :model-value="row.values[f.key]" @update:model-value="(v) => setField(row.i, f.key, v)"
      />
    </div>
    <button class="btn" @click="add">+ add effect</button>
  </div>
</template>

<style scoped>
.effects { margin: 4px 0; }
.eff { border-left: 2px solid var(--rule); padding: 5px 0 5px 10px; margin-bottom: 7px; }
.eff:hover { background: var(--vellum-deep); }
.eff-head { display: flex; gap: 6px; align-items: center; margin-bottom: 3px; }
.eff-head select { width: auto; margin: 0; font-size: 12.5px; padding: 4px 6px; font-weight: 600; }
.btn.tiny { padding: 2px 7px; font-size: 11px; }
</style>
