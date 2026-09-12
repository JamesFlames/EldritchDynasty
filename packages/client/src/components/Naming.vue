<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SessionView } from '@ed/core';
import type { GameActions } from '../lib/game';

const props = defineProps<{ view: SessionView; actions: GameActions }>();

const drafts = ref<Record<string, string>>({});

/**
 * A QUEUE THAT SAYS HOW LONG IT IS (issue #53).
 *
 * It was a list with no number on it, which is a small thing until you have
 * pressed "a generation" and been handed five children at once — the panel
 * looked the same for one as for five, and the only way to find out was to
 * scroll it.
 */
const waiting = computed(() => props.view.namesWanted.length);

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

/**
 * ACCEPT HIS NAME FOR THIS ONE, and leave the rest of the queue standing.
 *
 * Not `name(person, suggested)`, which reads like the same thing and is not:
 * that path is the REFUSAL path, and it would put the friend-name back in the
 * bag while the child kept it and strip a blessing nobody declined. The verb
 * exists on the session for exactly this reason.
 */
function keep(person: string): void {
  if (props.actions.keepSuggestedName(person)) delete drafts.value[person];
}
</script>

<template>
  <section class="panel naming">
    <h3 class="label">
      {{ waiting }} {{ waiting === 1 ? 'child' : 'children' }} waiting to be named
    </h3>
    <div v-for="child in view.namesWanted" :key="child.person" class="child">
      <div class="small">
        <span class="dim">{{ child.born }} ·</span>
        {{ child.sex === 'female' ? 'a daughter' : 'a son' }},
        <span class="dim">whom he would call {{ child.suggested }}</span>
      </div>
      <!-- WHY THIS ONE (issue #62). Naming was 189 prompts a run because every
           child of the seat raised one; it is now raised only where the child
           is somebody, and this is the difference the player can see. Drawn in
           the engine's words — a client composing its own would be inventing
           facts about a person. -->
      <p class="small because">{{ child.because }}</p>
      <div class="row">
        <input
          v-model="drafts[child.person]"
          :placeholder="child.suggested"
          @keyup.enter="give(child.person)"
        />
        <button @click="give(child.person)">Name</button>
        <!-- Per child, because the daughter and the four sons are not one
             decision. This was all-or-nothing, which made the accept-everything
             button the one a player pressed to get their clock back. -->
        <button class="quiet small" @click="keep(child.person)">
          Let him name this one
        </button>
      </div>
    </div>
    <button v-if="waiting > 1" class="quiet small" @click="actions.keepSuggestedNames()">
      Keep the names he suggests
    </button>
  </section>
</template>

<style scoped>
.child { margin-bottom: 14px; }
/* The reason gets the rubric, because it is the whole point of the prompt
   still existing. */
.because { margin: 3px 0 0; color: var(--rubric); font-style: italic; }
.child .row { margin-top: 4px; }
.child input { flex: 1; min-width: 0; }
</style>
