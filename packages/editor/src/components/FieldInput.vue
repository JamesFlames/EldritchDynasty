<script setup lang="ts">
import { computed } from 'vue';
import type { FieldSpec, Target } from '@ed/schema';

/**
 * ONE CONTROL, DRAWN FROM A `FieldSpec`.
 *
 * The descriptors come off the Zod schemas themselves (`schema/src/reference.ts`
 * → `fieldsOfSchema`), so this file and the schema cannot disagree about what
 * an effect carries. That is the whole design: a new `Effect` kind gets a form
 * here without anybody editing this file, the same way a new condition kind
 * needs one row in `ConditionBuilder`'s table and no new form.
 *
 * `opaque` is drawn honestly — a note saying to edit that field in YAML —
 * rather than as a text box that would silently write the wrong shape.
 */
const props = defineProps<{ spec: FieldSpec; modelValue: unknown; slotNames?: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [unknown] }>();

const TARGET_KEYWORDS = ['head', 'household', 'all_blood', 'children_of_head'];

function set(v: unknown) {
  emit('update:modelValue', v);
}

const asString = computed(() => (props.modelValue === undefined ? '' : String(props.modelValue)));
const asNumber = computed(() => (typeof props.modelValue === 'number' ? props.modelValue : 0));
const asList = computed(() => (Array.isArray(props.modelValue) ? (props.modelValue as string[]).join(', ') : ''));

// ── Target: a keyword, or a slot ────────────────────────────────────────
const target = computed<Target | undefined>(() => props.modelValue as Target | undefined);

const targetMode = computed(() => {
  const t = target.value;
  if (typeof t === 'string') return t;
  if (t && 'slot' in t) return '@slot';
  if (t && 'all' in t) return '@all';
  return 'head';
});

const targetSlot = computed(() => {
  const t = target.value;
  if (t && typeof t === 'object') return 'slot' in t ? t.slot : t.all;
  return '';
});

function setTargetMode(mode: string) {
  if (mode === '@slot') set({ slot: targetSlot.value || props.slotNames?.[0] || '' });
  else if (mode === '@all') set({ all: targetSlot.value || props.slotNames?.[0] || '' });
  else set(mode);
}

function setTargetSlot(slot: string) {
  set(targetMode.value === '@all' ? { all: slot } : { slot });
}

// ── scalar: boolean | number | string, and which of the three it is ─────
const scalarType = computed(() => {
  const v = props.modelValue;
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  return 'string';
});

function setScalarType(t: string) {
  if (t === 'boolean') set(props.modelValue !== false && props.modelValue !== '' && props.modelValue !== 0);
  else if (t === 'number') set(Number(props.modelValue) || 0);
  else set(String(props.modelValue ?? ''));
}

function setScalarValue(raw: string) {
  if (scalarType.value === 'boolean') set(raw === 'true');
  else if (scalarType.value === 'number') set(Number(raw));
  else set(raw);
}

// ── object: a nested set of fields ──────────────────────────────────────
const nested = computed<Record<string, unknown>>(() => (props.modelValue as Record<string, unknown>) ?? {});

function setNested(key: string, v: unknown) {
  set({ ...nested.value, [key]: v });
}

/** An optional field the author has not filled in yet. Present-or-absent is itself data. */
const isUnset = computed(() => props.modelValue === undefined);

function seed() {
  const c = props.spec.control;
  if (props.spec.fallback !== undefined) return set(props.spec.fallback);
  if (c.kind === 'number') return set(0);
  if (c.kind === 'boolean') return set(true);
  if (c.kind === 'enum') return set(c.options[0]);
  if (c.kind === 'target') return set('head');
  if (c.kind === 'stringList') return set([]);
  if (c.kind === 'object') return set({});
  if (c.kind === 'scalar') return set(true);
  return set('');
}
</script>

<template>
  <div class="field">
    <span class="fk">{{ spec.key }}<template v-if="spec.optional">?</template></span>

    <button v-if="spec.optional && isUnset" class="btn tiny" @click="seed">+ set</button>

    <template v-else>
      <template v-if="spec.control.kind === 'number'">
        <input type="number" :value="asNumber" @input="set(Number(($event.target as HTMLInputElement).value))" />
      </template>

      <template v-else-if="spec.control.kind === 'string'">
        <input type="text" :value="asString" @input="set(($event.target as HTMLInputElement).value)" />
      </template>

      <template v-else-if="spec.control.kind === 'boolean'">
        <select :value="String(modelValue)" @change="set(($event.target as HTMLSelectElement).value === 'true')">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </template>

      <template v-else-if="spec.control.kind === 'enum'">
        <select :value="asString" @change="set(($event.target as HTMLSelectElement).value)">
          <option v-for="o in spec.control.options" :key="o" :value="o">{{ o }}</option>
        </select>
      </template>

      <template v-else-if="spec.control.kind === 'scalar'">
        <select :value="scalarType" @change="setScalarType(($event.target as HTMLSelectElement).value)">
          <option value="boolean">boolean</option>
          <option value="number">number</option>
          <option value="string">string</option>
        </select>
        <select v-if="scalarType === 'boolean'" :value="asString" @change="setScalarValue(($event.target as HTMLSelectElement).value)">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <input v-else :type="scalarType === 'number' ? 'number' : 'text'" :value="asString"
               @input="setScalarValue(($event.target as HTMLInputElement).value)" />
      </template>

      <template v-else-if="spec.control.kind === 'target'">
        <select :value="targetMode" @change="setTargetMode(($event.target as HTMLSelectElement).value)">
          <option v-for="k in TARGET_KEYWORDS" :key="k" :value="k">{{ k }}</option>
          <option value="@slot">one slot…</option>
          <option value="@all">every fill of a slot…</option>
        </select>
        <select v-if="targetMode === '@slot' || targetMode === '@all'" :value="targetSlot"
                @change="setTargetSlot(($event.target as HTMLSelectElement).value)">
          <option v-for="s in slotNames ?? []" :key="s" :value="s">{{ s }}</option>
          <option v-if="!(slotNames ?? []).includes(targetSlot)" :value="targetSlot">{{ targetSlot || '—' }}</option>
        </select>
      </template>

      <template v-else-if="spec.control.kind === 'stringList'">
        <input type="text" :value="asList" placeholder="comma separated"
               @input="set(($event.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean))" />
      </template>

      <template v-else-if="spec.control.kind === 'object'">
        <div class="nested">
          <FieldInput
            v-for="f in spec.control.fields" :key="f.key" :spec="f" :slot-names="slotNames"
            :model-value="nested[f.key]" @update:model-value="(v) => setNested(f.key, v)"
          />
        </div>
      </template>

      <template v-else>
        <span class="opaque">{{ spec.control.kind === 'opaque' ? spec.control.note : '' }}</span>
      </template>

      <button v-if="spec.optional" class="btn tiny" title="unset" @click="set(undefined)">×</button>
    </template>
  </div>
</template>

<style scoped>
.field { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 3px 0; }
.field input, .field select { width: auto; margin: 0; font-size: 12.5px; padding: 4px 6px; }
.fk { font-size: 11px; letter-spacing: .06em; color: var(--ink-faint); min-width: 74px; }
.nested { display: flex; flex-direction: column; gap: 2px; padding-left: 10px; border-left: 2px solid var(--rule); }
.opaque { font-size: 11.5px; color: var(--ink-faint); font-style: italic; }
.btn.tiny { padding: 2px 7px; font-size: 11px; }
</style>
