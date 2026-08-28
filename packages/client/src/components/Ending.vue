<script setup lang="ts">
import type { SessionView } from '@ed/core';
import type { GameActions } from '../lib/game';

defineProps<{ view: SessionView; actions: GameActions }>();
</script>

<template>
  <main class="ending">
    <h1>2042</h1>

    <p class="frame">
      A thousand years is a great deal of time in a house and none at all in whatever the
      house was pledged to. Nothing announces itself. There is only the year, arriving as
      years do, and the book the family kept — which was kept the whole time by somebody
      with a stake in what it said.
    </p>

    <dl class="tally">
      <div><dt>The house</dt><dd>{{ view.houseName }}</dd></div>
      <div><dt>Generations</dt><dd>{{ view.generation }}</dd></div>
      <div><dt>Still at table</dt><dd>{{ view.halls.reduce((n, h) => n + h.members.length, 0) }}</dd></div>
      <div><dt>The ladder</dt><dd>{{ view.ascension.title }}</dd></div>
      <div><dt>Clauses recovered</dt><dd>{{ view.clausesRecovered }} of {{ view.clausesTotal }}</dd></div>
      <div><dt>Standing</dt><dd>{{ view.respect }}</dd></div>
      <div v-if="view.guardian"><dt>Watching</dt><dd>{{ view.guardian.name }}</dd></div>
    </dl>

    <!-- The stub says it is a stub. The collection, the five endings and the
         epilogue are issue #39; what this screen proves is that the clock
         stops somewhere and the run has a shape at the end of it. -->
    <p class="dim small note">
      The collection itself is not built. There is no ending selection and no epilogue yet —
      this is where the run stops, and what is above is what it came to.
    </p>

    <button class="primary" @click="actions.restart()">Another house</button>
  </main>
</template>

<style scoped>
.ending { max-width: 60ch; margin: 0 auto; padding: 90px 26px; text-align: center; }
h1 { font-size: 58px; font-weight: 400; margin: 0 0 20px; letter-spacing: .06em; }
.frame { font-size: 17px; line-height: 1.75; font-style: italic; color: var(--ink-soft); }
.tally { margin: 34px 0; display: grid; gap: 6px; text-align: left; }
.tally div { display: flex; gap: 12px; border-bottom: 1px solid var(--rule); padding-bottom: 5px; }
.tally dt { flex: 1; color: var(--ink-faint); font-size: 13px; }
.tally dd { margin: 0; }
.note { margin-bottom: 26px; }
</style>
