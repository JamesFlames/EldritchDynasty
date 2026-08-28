<script setup lang="ts">
import { ref } from 'vue';
import type { SessionView } from '@ed/core';
import type { GameActions } from '../lib/game';

const props = defineProps<{ view: SessionView; actions: GameActions }>();

const drafts = ref<Record<string, string>>({});

/**
 * NAMING IS THE ONE THING THE PLAYER DOES TO A PERSON rather than to a
 * bloodline, so it stops the clock the way a decision does. The chronicler has
 * a suggestion for every child and the player can take all of them at once —
 * ignoring the offer is a valid way to play, and refusing it forty times is a
 * way of playing too.
 */
function give(person: string): void {
  const chosen = (drafts.value[person] ?? '').trim();
  if (!chosen) return;
  if (props.actions.name(person, chosen)) delete drafts.value[person];
}
</script>

<template>
  <section class="panel naming">
    <h3 class="label">Children waiting to be named</h3>
    <div v-for="child in view.namesWanted" :key="child.person" class="child">
      <div class="small">
        <span class="dim">{{ child.born }} ·</span>
        {{ child.sex === 'female' ? 'a daughter' : 'a son' }},
        <span class="dim">whom he would call {{ child.suggested }}</span>
      </div>
      <div class="row">
        <input
          v-model="drafts[child.person]"
          :placeholder="child.suggested"
          @keyup.enter="give(child.person)"
        />
        <button @click="give(child.person)">Name</button>
      </div>
    </div>
    <button class="quiet small" @click="actions.keepSuggestedNames()">
      Keep the names he suggests
    </button>
  </section>
</template>

<style scoped>
.child { margin-bottom: 10px; }
.child .row { margin-top: 4px; }
.child input { flex: 1; min-width: 0; }
</style>
