<script setup lang="ts">
import { ref } from 'vue';
import type { GameActions } from '../lib/game';

defineProps<{ actions: GameActions; resumable: boolean }>();

const seed = ref(1042);
</script>

<template>
  <main class="start">
    <h1>Eldritch Dynasty</h1>

    <p class="frame">
      In the year 1042 an ancestor signed something. In 2042 the other party comes to collect.
    </p>
    <p class="frame">
      You are not any of the people in this house. You are the thing that goes on in it while
      they are born, married and buried — the will that decides who marries whom, who is
      spent, and what the book says about it afterwards.
    </p>
    <p class="frame dim small">
      It begins on the last of the Hollow Days, at a table, with three things on it.
    </p>

    <div class="row">
      <label class="dim small" for="seed">seed</label>
      <input id="seed" type="number" v-model.number="seed" />
      <button class="primary" @click="actions.begin(seed)">Begin, in 1042</button>
      <button v-if="resumable" class="quiet" @click="actions.resume()">Take up the run in this tab</button>
    </div>


  </main>
</template>

<style scoped>
.start { max-width: 58ch; margin: 0 auto; padding: 110px 26px; }
h1 { font-size: var(--t-display); font-weight: 400; margin: 0 0 26px; letter-spacing: .04em; }
.frame { font-size: var(--t-lead); line-height: 1.75; color: var(--ink-soft); margin: 0 0 18px; }
.row { margin-top: 34px; }
input { width: 9ch; }
</style>
