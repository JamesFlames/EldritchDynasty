<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SessionView } from '@ed/core';
import type { GameActions } from '../lib/game';

const props = defineProps<{
  /** No separate view type: the Muster's whole read model is `SessionView.muster`, absent when dormant. */
  view: SessionView;
  actions: GameActions;
  /** The last muster order refused, and why (issue #55's rule, kept for a second verb). */
  refusal: { op: string; reason: string } | null;
}>();

/**
 * THE MUSTER (concept §6, world §10; issue #89, Stage 2 — #95).
 *
 * A panel, not a modal (#89's own words) — a docket item every year for
 * thirty-eight years would be a punishment, not a decision. Entering a war
 * and settling one are scripted moments an authored event reaches; this is
 * the standing order in between: reinforce it, or call the men home. Buying
 * up a position waits on `positions.yaml` (issue #97, Stage 3) to have a
 * price to show.
 */
const commitment = computed(() => props.view.muster);

function refusedIn(op: string): string | null {
  return props.refusal?.op === op ? props.refusal.reason : null;
}

const reinforceBy = ref(1);

const tideWord = computed(() => {
  const m = commitment.value;
  if (!m) return '';
  return m.tide >= 60 ? "in the house's favour" : m.tide <= 40 ? 'against the house' : 'holding, for now';
});
</script>

<template>
  <section v-if="commitment" class="muster panel">
    <h3 class="label">The muster</h3>
    <p class="small">
      {{ commitment.men }} {{ commitment.men === 1 ? 'man' : 'men' }} in the field since {{ commitment.began }},
      of a house that could field {{ commitment.maxMen }}.
    </p>
    <p class="small dim">The tide runs {{ tideWord }}. Credit earned so far: {{ commitment.credit.toFixed(1) }}.</p>

    <p v-if="commitment.position" class="small dim">Standing under the {{ commitment.position }}.</p>
    <p v-else class="small rubric">No banner bought. Word gets around; it is not in writing.</p>

    <p v-if="commitment.officers.length" class="small dim">
      Led by {{ commitment.officers.map((o) => o.name).join(', ') }}.
    </p>

    <div class="row">
      <input type="number" min="1" v-model.number="reinforceBy" />
      <button @click="actions.muster({ op: 'reinforce', men: reinforceBy })">
        Send more men
      </button>
    </div>
    <p v-if="refusedIn('reinforce')" class="small rubric">{{ refusedIn('reinforce') }}</p>

    <!-- THE GOOD DECISION (#89), available every year. Keep the men, forfeit
         the credit, and the world notices. -->
    <div class="row">
      <button @click="actions.muster({ op: 'withdraw' })">
        Call them home
      </button>
    </div>
    <p v-if="refusedIn('withdraw')" class="small rubric">{{ refusedIn('withdraw') }}</p>
  </section>
</template>

<style scoped>
.muster p { margin: 4px 0; }
.muster .row { margin-top: 8px; }
input[type='number'] { width: 8ch; }
</style>
