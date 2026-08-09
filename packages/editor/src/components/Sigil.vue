<script setup lang="ts">
import { computed } from 'vue';

/**
 * Procedurally mutating heraldic sigils. No portraits, no faces — one artist,
 * infinite characters, and sigil drift across a thousand years becomes its own
 * quiet art piece (concept §8).
 *
 * Legibility encodes state:
 *   line weight        Strength
 *   flourish, symmetry Charm
 *   spidery asymmetry  Madness
 *
 * The seed is inherited from both parents, so a family resemblance emerges
 * down a line without anyone drawing one.
 */
const props = withDefaults(defineProps<{
  seed: number;
  size?: number;
  strength?: number;
  charm?: number;
  madness?: number;
  sex?: 'male' | 'female';
  status?: string;
  expressing?: boolean;
}>(), {
  size: 34, strength: 40, charm: 40, madness: 0, sex: 'male', status: 'alive', expressing: false,
});

function prng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6c078965) >>> 0;
    return ((s >>> 8) & 0xffff) / 0xffff;
  };
}

const art = computed(() => {
  const r = prng(props.seed);
  const charges = 2 + Math.floor(r() * 3);
  const skew = Math.min(1, props.madness / 45);
  const weight = 0.9 + (props.strength / 100) * 2.1;
  const flourish = props.charm / 100;

  const marks: string[] = [];
  for (let i = 0; i < charges; i++) {
    const a = (i / charges) * Math.PI * 2 + r() * 0.6;
    const rad = 8 + r() * 9;
    // Madness pulls the charges off their axis — spidery, asymmetric.
    const jitter = skew * (r() - 0.5) * 16;
    const x = 24 + Math.cos(a) * rad + jitter;
    const y = 24 + Math.sin(a) * rad * (1 - flourish * 0.25) + jitter * 0.6;
    const kind = r();
    if (kind < 0.34) marks.push(`M${x - 4} ${y} L${x} ${y - 5} L${x + 4} ${y} L${x} ${y + 5} Z`);
    else if (kind < 0.67) marks.push(`M${x - 4.5} ${y - 4.5} L${x + 4.5} ${y + 4.5} M${x + 4.5} ${y - 4.5} L${x - 4.5} ${y + 4.5}`);
    else marks.push(`M${x} ${y - 5} L${x + 4.6} ${y + 3} L${x - 4.6} ${y + 3} Z`);
  }
  return { marks, weight, flourish, skew };
});

/** The Vessel gets a mark that is not the mark for death. */
const tone = computed(() => {
  switch (props.status) {
    case 'dead': return 'var(--ink-faint)';
    case 'guardian': return 'var(--mythic)';
    case 'vessel_consumed': return 'var(--rare)';
    case 'given_to_church': return 'var(--uncommon)';
    default: return props.expressing ? 'var(--rubric)' : 'var(--ink)';
  }
});
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" :aria-label="`sigil ${seed}`">
    <path
      :d="sex === 'female'
        ? 'M24 3 L43 12 v17 c0 10 -9 15 -19 19 c-10 -4 -19 -9 -19 -19 V12 Z'
        : 'M6 5 h36 v22 c0 10 -12 15 -18 19 c-6 -4 -18 -9 -18 -19 Z'"
      fill="none" :stroke="tone" :stroke-width="art.weight" stroke-linejoin="round"
      :opacity="status === 'dead' ? 0.4 : 1"
    />
    <path
      v-for="(m, i) in art.marks" :key="i" :d="m"
      fill="none" :stroke="tone" :stroke-width="art.weight * 0.62"
      stroke-linecap="round" stroke-linejoin="round"
      :opacity="status === 'dead' ? 0.35 : 0.92"
    />
    <!-- The guardian is not dead. He is ringed, not struck through. -->
    <circle
      v-if="status === 'guardian'" cx="24" cy="24" r="21.5"
      fill="none" stroke="var(--mythic)" stroke-width="1" stroke-dasharray="2 3" opacity="0.8"
    />
    <line
      v-else-if="status === 'vessel_consumed'" x1="7" y1="41" x2="41" y2="7"
      stroke="var(--rare)" stroke-width="1.4" opacity="0.85"
    />
  </svg>
</template>
