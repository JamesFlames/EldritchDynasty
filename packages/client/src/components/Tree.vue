<script setup lang="ts">
import type { SessionView } from '@ed/core';
import Kin from './Kin.vue';
import { roots } from '../lib/kin';

/**
 * `selected` is the APP's, not this component's. One card is open at a time —
 * this is a tree, not a spreadsheet — and the cast list opens cards too
 * (issue #44), so the two of them have to be looking at the same person.
 */
defineProps<{ view: SessionView; selected: string | null }>();
defineEmits<{ (e: 'select', id: string): void }>();
</script>

<template>
  <section class="tree">
    <!-- A HALL IS NOT A HOUSE (invariant 15). Cadet branches are households
         inside the player's house, and crowding and grievance are per hall —
         so they are drawn as separate halls of the same family rather than as
         one long roster. -->
    <div v-for="hall in view.halls" :key="hall.id" class="hall">
      <h3 class="label">
        {{ hall.name }}
        <span v-if="hall.isSeat" class="rubric">· the seat</span>
        <span class="dim"> · {{ hall.members.length }} at table</span>
        <span v-if="hall.grievance > 0" class="dim"> · grievance {{ Math.round(hall.grievance) }}</span>
      </h3>

      <ul v-if="hall.members.length">
        <Kin
          v-for="member in roots(hall.members)"
          :key="member.id"
          :member="member"
          :hall="hall.members"
          :names="view.attributes"
          :trait-names="view.traits"
          :selected="selected"
          @select="$emit('select', $event)"
        />
      </ul>
      <p v-else class="dim small">Nobody. The hall stands empty.</p>
    </div>
  </section>
</template>

<style scoped>
.hall { margin-bottom: 22px; }
.hall > ul { margin: 0; padding: 0; }
</style>
