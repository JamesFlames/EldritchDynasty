<script setup lang="ts">
import { computed } from 'vue';
import { FREQUENCY_PROFILES, FREQUENCY_ORDER, type Frequency } from '@ed/schema';

const props = defineProps<{ modelValue: Frequency }>();
const emit = defineEmits<{ 'update:modelValue': [Frequency] }>();

const p = computed(() => FREQUENCY_PROFILES[props.modelValue]);

/**
 * The picker shows what the tier OBLIGES, not just what it weighs. Frequency
 * reaches into scheduling, presentation, folklore and the Record mechanic at
 * once, and an author choosing "mythic" needs to see that they have just
 * committed to a record block, two contradicting accounts, and a scene that
 * can fire exactly once in a thousand years.
 */
const rows = computed(() => [
  ['draw weight', `${p.value.weight}${p.value.droughtGainPerCentury ? ` · +${p.value.droughtGainPerCentury}/century of drought` : ''}`],
  ['per-run cap', p.value.perRunCap === null ? 'uncapped' : `${p.value.perRunCap} in a run`],
  ['cooldown', p.value.cooldownYears ? `${p.value.cooldownYears} years between any two` : 'none'],
  ['earliest', p.value.minGeneration ? `generation ${p.value.minGeneration}` : 'from the first year'],
  ['fires', p.value.maxFiresPerTemplate === Infinity ? 'repeatable' : `${p.value.maxFiresPerTemplate}× per run, ever`],
  ['record block', p.value.record],
  ['enters folklore', p.value.rumour],
  ['chronicle', p.value.chronicle + (p.value.named ? ' · named forever' : '')],
]);
</script>

<template>
  <label>Frequency</label>
  <div class="freqpick">
    <button
      v-for="f in FREQUENCY_ORDER" :key="f"
      :class="[f, { on: modelValue === f }]"
      @click="emit('update:modelValue', f)"
    >{{ f }}</button>
  </div>

  <div class="oblig">
    <table>
      <tr v-for="[k, v] in rows" :key="k"><td>{{ k }}</td><td>{{ v }}</td></tr>
    </table>
  </div>
</template>
