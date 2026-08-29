<script setup lang="ts">
import { ref } from 'vue';
import type { PrologueView } from '@ed/core';
import type { GameActions } from '../lib/game';

const props = defineProps<{
  prologue: PrologueView;
  actions: GameActions;
  refused: string | null;
}>();

/**
 * A DEBT OF THREE PARTS (concept §3, issue #38).
 *
 * Four minutes, non-interactive except for two choices, and the reason the
 * frame has anything to refer back to: twelve to eighteen interludes a run
 * point at a signing, and until this screen the signing had happened
 * off-screen to nobody.
 *
 * It is paced rather than dumped. The triad is announced — three things given,
 * three things owed — and delivered one beat at a time in ascending weight,
 * because the third is the one that hurts and it does not hurt in a list.
 * Nothing here is skippable by accident and everything is skippable on
 * purpose: the reader who wants the whole page can have it in three clicks.
 */
const shown = ref(0);
const houseName = ref('');
const heirloom = ref('');
const grudge = ref('');

function on(): void {
  shown.value += 1;
}

function sign(): void {
  const result = props.actions.found({
    houseName: houseName.value,
    heirloom: heirloom.value,
    grudge: grudge.value,
  });
  // The thesis takes the screen on its own. Landing the reader halfway down
  // the page they were already reading would waste it.
  if (result.ok) window.scrollTo({ top: 0 });
}
</script>

<template>
  <main class="prologue">
    <p v-if="!prologue.founded" class="opening">{{ prologue.opening }}</p>

    <ol v-if="!prologue.founded" class="triad">
      <li v-for="(beat, i) in prologue.triad.slice(0, shown)" :key="i">
        <p class="given">{{ beat.given }}</p>
        <p class="owed">{{ beat.owed }}</p>
      </li>
    </ol>

    <button v-if="shown < prologue.triad.length" class="on" @click="on()">
      {{ shown === 0 ? 'The first thing' : shown === 1 ? 'The second thing' : 'The third thing' }}
    </button>

    <template v-else-if="!prologue.founded">
      <!-- THE TWO CHOICES. Both are simulation inputs: the gift goes into the
           house's hands and the grudge into the world, and in 2042 the ending
           names which of them the thousand years changed. -->
      <section class="choice">
        <h3 class="label">He asked for one thing by name</h3>
        <button
          v-for="option in prologue.heirlooms"
          :key="option.heirloom"
          class="option"
          :class="{ on: heirloom === option.heirloom }"
          @click="heirloom = option.heirloom"
        >
          <strong>{{ option.name }}</strong>
          <span class="line">{{ option.line }}</span>
          <small class="dim">{{ option.blurb }}</small>
        </button>
      </section>

      <section class="choice">
        <h3 class="label">And somebody paid for the rest of it</h3>
        <button
          v-for="option in prologue.grudges"
          :key="option.house"
          class="option"
          :class="{ on: grudge === option.house }"
          @click="grudge = option.house"
        >
          <strong>{{ option.houseName }}</strong>
          <span class="line">{{ option.line }}</span>
        </button>
      </section>

      <section class="choice">
        <h3 class="label">The house</h3>
        <p class="prompt">{{ prologue.housePrompt }}</p>
        <input
          v-model="houseName"
          maxlength="48"
          placeholder="what the family will be called"
          @keyup.enter="sign()"
        />
      </section>

      <p v-if="refused" class="rubric small">{{ refused }}</p>

      <button class="primary sign" :disabled="!houseName.trim() || !heirloom || !grudge" @click="sign()">
        Sign it
      </button>

    </template>

    <!-- THE LAST LINE, AND IT GETS THE SCREEN. It states the emotional thesis
         of the whole run, every ending reaches back to it, and it is the one
         plain sentence in a screen of elevated prose — which is an effect that
         does not survive being printed above a family tree. -->
    <template v-else>
      <p class="thesis">{{ prologue.thesis }}</p>
      <button class="primary" @click="actions.enter()">1042</button>
    </template>
  </main>
</template>

<style scoped>
.prologue { max-width: 62ch; margin: 0 auto; padding: 70px 26px 90px; }
.opening, .given, .owed {
  font-size: 16.5px; line-height: 1.8; color: var(--ink-soft);
  margin: 0 0 18px; white-space: pre-line;
}
.triad { list-style: none; margin: 26px 0 0; padding: 0; counter-reset: beat; }
.triad li {
  border-top: 1px solid var(--rule); padding-top: 18px; margin-bottom: 12px;
}
.given { color: var(--ink); }
.owed { font-style: italic; }
button.on, .on { }
.on { margin-top: 10px; }
.choice { margin-top: 30px; }
.choice .prompt { margin: 0 0 12px; line-height: 1.7; color: var(--ink-soft); font-size: 15px; }
.option {
  display: block; width: 100%; text-align: left; margin-bottom: 8px;
  padding: 10px 12px; line-height: 1.55;
}
.option.on { border-color: var(--rubric); box-shadow: inset 2px 0 0 var(--rubric); }
.option strong { display: block; }
.option .line { display: block; font-size: 13.5px; color: var(--ink-soft); margin-top: 3px; }
.option small { display: block; margin-top: 5px; }
input { width: 100%; font-size: 16px; }
.sign { margin-top: 26px; }
.thesis {
  margin: 34vh 0 46px; font-size: 21px; line-height: 1.6; color: var(--ink);
}
</style>
