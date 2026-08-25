<script setup lang="ts">
import { computed } from 'vue';

/**
 * A wax seal, pressed once, and never quite the same twice.
 *
 * Same bargain as `Sigil.vue` (concept §8): procedural, so a thousand years of
 * them costs nobody a thousand drawings. The wobble in the wax is the whole
 * point — wax that is perfectly round is a logo, and this is supposed to be a
 * thing somebody pressed with a hot thumb near it.
 *
 * The seed should be something STABLE about what is being sealed — a year and
 * an event id, a clause id — so that the same entry keeps the same seal across
 * a reload. A seed off `Math.random()` gives a seal that changes every time the
 * chronicle re-renders, which reads as a rendering bug even to people who
 * could not say why.
 */
const props = withDefaults(defineProps<{
  seed: number;
  size?: number;
  /**
   * The wax is broken. Used where the seal did not hold: a Discrepancy that
   * somebody proved, a clause that came due. A crack, not a cross — the
   * document was opened, it was not cancelled.
   */
  broken?: boolean;
  /** Announced where the seal is the only thing saying what this row is. */
  title?: string;
}>(), { size: 26, broken: false });

function prng(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6c078965) >>> 0;
    return ((s >>> 8) & 0xffff) / 0xffff;
  };
}

const art = computed(() => {
  const r = prng(props.seed);

  /**
   * The rim, as a closed loop of points at wobbling radii. Twelve segments is
   * enough to read as pressed wax and few enough that the curve stays soft —
   * at twenty-four it goes back to looking like a circle.
   */
  const N = 12;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rad = 9.4 + (r() - 0.5) * 1.9;
    pts.push([12 + Math.cos(a) * rad, 12 + Math.sin(a) * rad]);
  }
  // Closed cardinal spline through the points, so the wobble stays smooth.
  let rim = `M${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`;
  for (let i = 0; i < N; i++) {
    const p1 = pts[i]!, p2 = pts[(i + 1) % N]!, p3 = pts[(i + 2) % N]!;
    const cx = p2[0] + (p2[0] - p1[0]) * 0.16 + (p2[0] - p3[0]) * -0.16;
    const cy = p2[1] + (p2[1] - p1[1]) * 0.16 + (p2[1] - p3[1]) * -0.16;
    rim += ` Q${cx.toFixed(2)} ${cy.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  rim += ' Z';

  // The device the matrix cut into it. Three or four strokes, no letters —
  // this house does not sign with letters (see the `seal` mark).
  const charges: string[] = [];
  const arms = 3 + Math.floor(r() * 2);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + r() * 0.5;
    const inner = 1.6 + r() * 0.8;
    const outer = 4.4 + r() * 1.2;
    charges.push(
      `M${(12 + Math.cos(a) * inner).toFixed(2)} ${(12 + Math.sin(a) * inner).toFixed(2)}`
      + ` L${(12 + Math.cos(a) * outer).toFixed(2)} ${(12 + Math.sin(a) * outer).toFixed(2)}`,
    );
  }

  // Where the wax ran when it was pressed. One tail, always downward.
  const tail = 0.4 + r() * 0.5;
  return { rim, charges, tail };
});
</script>

<template>
  <svg
    class="seal" :width="size" :height="size" viewBox="0 0 24 24"
    :role="title ? 'img' : undefined" :aria-hidden="title ? undefined : 'true'"
  >
    <title v-if="title">{{ title }}</title>

    <!-- The wax. Filled at low opacity and rimmed, so it reads as a body of
         wax on vellum rather than as an outline of one. -->
    <path :d="art.rim" fill="var(--rubric)" fill-opacity="0.17" stroke="var(--rubric)" stroke-width="1.2" />

    <!-- The impression. Cut into the wax, so it is drawn in the page colour. -->
    <circle cx="12" cy="12" r="6.1" fill="none" stroke="var(--rubric)" stroke-width="0.9" opacity="0.75" />
    <path
      v-for="(d, i) in art.charges" :key="i" :d="d"
      fill="none" stroke="var(--rubric)" stroke-width="1.35"
      stroke-linecap="round" opacity="0.9"
    />

    <!-- The ribbon it was pressed onto. -->
    <path
      :d="`M10.4 20.4 L${(11 + art.tail).toFixed(2)} 22.8`"
      fill="none" stroke="var(--rubric)" stroke-width="1.1" stroke-linecap="round" opacity="0.55"
    />

    <!-- Broken: the wax is split and the halves have moved. Drawn in the page
         colour so it reads as an absence of wax, which is what a break is. -->
    <path
      v-if="broken"
      d="M13.4 2.4 L10.2 10.6 L13.6 12.4 L9.8 21.6"
      fill="none" stroke="var(--panel)" stroke-width="1.9"
      stroke-linejoin="round" stroke-linecap="round"
    />
  </svg>
</template>
