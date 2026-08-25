<script setup lang="ts">
import { computed } from 'vue';
import { MARKS, type MarkName } from '../lib/marks';

/**
 * One mark from the margin. Geometry lives in `lib/marks.ts`; this only knows
 * how to put it on the page.
 *
 * A mark is DECORATIVE by default — `aria-hidden`, because almost every one of
 * them sits next to the words it stands for and a screen reader that says
 * "events events" is worse than one that says "events". Pass `titled` where
 * the mark is carrying the meaning alone, and it announces `MARKS[name].label`
 * instead.
 */
const props = withDefaults(defineProps<{
  name: MarkName;
  size?: number;
  /** Announce this mark. Use where there is no adjacent word saying the same. */
  titled?: boolean;
  /** Override the announced text. Implies `titled`. */
  title?: string;
}>(), { size: 16, titled: false });

const mark = computed(() => MARKS[props.name]);

/**
 * Line weight has to RISE as the mark gets smaller or the small ones go to
 * grey mush against text — a 13px mark at the 58px mark's weight is a smudge.
 * The curve was fitted against a contact sheet at 13, 16, 22 and 58px, which
 * is the only way to get this right; it is not a formula anybody can reason
 * their way to.
 */
const stroke = computed(() => (mark.value.weight ?? 1) * (1.42 + 8.2 / props.size));

const spoken = computed(() => props.title ?? (props.titled ? mark.value.label : null));
</script>

<template>
  <svg
    class="mark" :width="size" :height="size" viewBox="0 0 24 24"
    :role="spoken ? 'img' : undefined"
    :aria-hidden="spoken ? undefined : 'true'"
    focusable="false"
  >
    <title v-if="spoken">{{ spoken }}</title>
    <path
      v-for="(d, i) in mark.strokes" :key="`s${i}`" :d="d"
      fill="none" stroke="currentColor" :stroke-width="stroke"
      stroke-linecap="round" stroke-linejoin="round"
    />
    <path v-for="(d, i) in mark.fills ?? []" :key="`f${i}`" :d="d" fill="currentColor" />
  </svg>
</template>
