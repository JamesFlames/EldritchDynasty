<script setup lang="ts">
import { computed } from 'vue';
import type { SessionView } from '@ed/core';

const props = defineProps<{ view: SessionView }>();

/**
 * HOW THE WORLD READS THE HOUSE, in words. `assize.pressure` runs from -1 (the
 * world can see you are failing, and is steadying you) to 1 (it can see you
 * are ahead, and is charging you for it). The Assize is explicit by design — a
 * hidden rubber band is a lie the player can feel and cannot name — so this is
 * drawn, and drawn in the same register the game says it in.
 */
const world = computed(() => {
  const a = props.view.assize;
  if (a.arm === 'resents') return 'The world has noticed you.';
  if (a.arm === 'steadies') return 'The world is being gentle with you.';
  return 'The world is not thinking about you.';
});

/**
 * The Ages the house is living through, named only where the chronicle has
 * named them (concept §20, rule one). An Age nobody has a word for yet shows
 * nothing here — the family finds out what these years were afterwards, like
 * everyone else, and the view withholds the name for exactly that reason.
 */
const ages = computed(() => props.view.ages.filter((a) => a.name !== undefined));

const favours = computed(() => {
  const a = props.view.assize;
  const out: string[] = [];
  if (a.favour) out.push('a favour is owed');
  if (a.mercy) out.push('a mercy is running');
  if (a.exaction) out.push('an exaction is being collected');
  return out;
});
</script>

<template>
  <header class="standing">
    <div class="year">
      <strong>{{ view.year }}</strong>
      <span class="dim small">generation {{ view.generation }}</span>
    </div>

    <div class="house">
      <div class="name">{{ view.houseName }}</div>
      <div class="dim small">
        {{ view.treasury }} crowns · {{ view.respect }} ·
        discontent {{ view.discontent }} ·
        {{ view.clausesRecovered }}/{{ view.clausesTotal }} clauses recovered
      </div>
    </div>

    <!-- THE LADDER, AND WHAT IS IN THE WAY OF THE NEXT RUNG (concept §22).
         `blocked` is in words on purpose, and it goes under the rung because
         it is the whole answer to "am I winning?" — a question the player has
         never had any way to ask. -->
    <div class="rung">
      <div class="name">{{ view.ascension.title }}</div>
      <div v-if="view.ascension.foremost" class="dim small">
        {{ view.ascension.foremost.name }} —
        {{ view.ascension.foremost.blocked ?? 'nothing stands in the way' }}
      </div>
      <div v-else class="dim small">nobody of the house is on the ladder</div>
    </div>

    <div v-if="ages.length" class="age">
      <div v-for="age in ages" :key="age.age" class="name">
        {{ age.name }}<span class="dim small"> · since {{ age.began }}</span>
      </div>
    </div>

    <div class="world">
      <div class="soft small">{{ world }}</div>
      <div v-if="favours.length" class="rubric small">{{ favours.join(' · ') }}</div>
      <div v-if="view.guardian" class="dim small">
        {{ view.guardian.name }} watches, and has since {{ view.guardian.since }}.
      </div>
    </div>
  </header>
</template>

<style scoped>
.standing {
  display: flex; align-items: flex-start; gap: 28px; flex-wrap: wrap;
  padding: 14px 26px; border-bottom: 1px solid var(--rule);
  background: var(--vellum-deep);
}
.year strong { font-size: 26px; font-weight: 500; display: block; line-height: 1.1; }
.year { min-width: 90px; }
.house .name, .rung .name { font-size: 16px; }
.rung .name { color: var(--rubric); }
.age .name { font-size: 16px; color: var(--rubric); }
.world { margin-left: auto; text-align: right; max-width: 34ch; }
</style>
