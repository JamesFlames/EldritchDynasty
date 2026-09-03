<script setup lang="ts">
import { computed, ref } from 'vue';
import { COLLECTION_YEAR, createGame } from './lib/game';
import { loadBundle } from './lib/content';
import Start from './components/Start.vue';
import Prologue from './components/Prologue.vue';
import Standing from './components/Standing.vue';
import Docket from './components/Docket.vue';
import Naming from './components/Naming.vue';
import PassageLog from './components/Passage.vue';
import Tree from './components/Tree.vue';
import Cast from './components/Cast.vue';
import Chronicle from './components/Chronicle.vue';
import GameTable from './components/Table.vue';
import Abroad from './components/Abroad.vue';
import Interlude from './components/Interlude.vue';
import Ending from './components/Ending.vue';

/**
 * THE WHOLE CLIENT, above one store and one read model.
 *
 * Nothing here imports `@ed/core` for anything but a type, and nothing touches
 * `session.ctx`. Every value on screen came out of `session.view()` or
 * `session.table()`, and every button goes back in through a verb. That is the
 * seam `core/src/session.ts` was written to be, and this is the first thing on
 * the other side of it.
 */
const game = createGame(loadBundle());
const {
  view, table, prologue, openingSeen, epilogue, docket, passages, interlude, frame, ended,
  refused, resumable, actions,
} = game;

/**
 * Which of the three the middle column is showing. The docket, the clock and
 * the chronicle never move — what changes is what the player is looking AT:
 * the family, the orders the house is under, or what the world is saying about
 * it. A panel competing with the docket for the same column would lose.
 */
const pane = ref<'house' | 'table' | 'abroad'>('house');

/**
 * WHOSE CARD IS OPEN. Held here rather than in the tree because the cast list
 * (issue #44) opens cards too, and two components each keeping their own
 * answer would put two different people on the screen at once.
 */
const selected = ref<string | null>(null);

function select(id: string): void {
  selected.value = selected.value === id ? null : id;
}

/**
 * FOLLOW A LINE IN THE PASSAGE LOG BACK TO THE PERSON.
 *
 * The log sits in the left column and is visible from all three panes, but
 * the card it opens is only drawn on `house` — so a click from The table
 * would set `selected` and change nothing on the screen, which is this
 * repository's whole failure mode rendered as a button.
 *
 * It sets rather than toggles, unlike `select`. Arriving at a pane to look at
 * somebody and finding their card shut because it was already open is not a
 * thing anybody asked for.
 */
function look(id: string): void {
  pane.value = 'house';
  selected.value = id;
}

/** The clock only turns when nothing is waiting for an answer. */
const waiting = computed(() => docket.value.length > 0 || (view.value?.namesWanted.length ?? 0) > 0);
</script>

<template>
  <Start v-if="!view" :actions="actions" :resumable="resumable" />

  <!-- A DEBT OF THREE PARTS. Once, at the head of the run, before a year has
       turned — and never again: `founded` is what the world remembers of it. -->
  <Prologue
    v-else-if="prologue && !openingSeen"
    :prologue="prologue"
    :actions="actions"
    :refused="refused"
  />

  <Ending v-else-if="ended && epilogue" :view="view" :epilogue="epilogue" :actions="actions" />

  <template v-else>
    <Standing :view="view" />

    <div class="board">
      <div class="left stack">
        <!-- One decision at a time. The docket can hold several; answering the
             top one is how a player gets to the next, and a column of four
             open decisions is a form, not a game.

             KEYED ON THE DECISION, because without it Vue reuses the component
             for the next one and the half-filled cast of the answered decision
             is still sitting in it — a party sent to a thing they were never
             named for, and nothing anywhere would say so. -->
        <Docket
          v-if="docket.length"
          :key="docket[0]!.id"
          :decision="docket[0]!"
          :actions="actions"
        />

        <Naming v-else-if="view.namesWanted.length" :view="view" :actions="actions" />

        <div v-else class="panel clock">
          <h3 class="label">The clock</h3>
          <div class="wrap">
            <button @click="actions.advance(1)">A year</button>
            <button @click="actions.advance(5)">Five</button>
            <button @click="actions.advance(25)">A generation</button>
            <button @click="actions.advance(COLLECTION_YEAR - view.year)">On, to 2042</button>
          </div>
        </div>

        <div class="wrap panes">
          <button class="quiet small" :class="{ on: pane === 'house' }" @click="pane = 'house'">The house</button>
          <button class="quiet small" :class="{ on: pane === 'table' }" @click="pane = 'table'">The table</button>
          <button class="quiet small" :class="{ on: pane === 'abroad' }" @click="pane = 'abroad'">Abroad</button>
        </div>
        <p v-if="waiting" class="dim small">The year does not turn while something is waiting.</p>

        <!-- BELOW THE PANE SWITCHER, not above it, and outside the docket's
             v-if chain on purpose: what the last jump did is still the answer
             to "what just happened" while a decision is standing on top of
             it. It is also the one panel here that survives all three states
             of the column. -->
        <PassageLog :passages="passages" @select="look" />
      </div>

      <div class="middle">
        <GameTable
          v-if="pane === 'table' && table"
          :view="view"
          :table="table"
          :actions="actions"
          :refused="refused"
        />
        <Abroad v-else-if="pane === 'abroad'" :view="view" />
        <template v-else>
          <!-- Five or six people out of seventy, each with the one thing that
               is true of them and of nobody else. The tree is still under it;
               this is the way in. -->
          <Cast :cast="view.cast" :selected="selected" @select="select" />
          <Tree :view="view" :selected="selected" @select="select" />
        </template>
      </div>

      <div class="right">
        <Chronicle :view="view" :frame="frame" />
      </div>
    </div>

    <Interlude v-if="interlude" :entry="interlude" :actions="actions" />
  </template>
</template>

<style scoped>
.board {
  display: grid; grid-template-columns: minmax(0, 24rem) minmax(0, 1fr) minmax(0, 24rem);
  gap: 26px; padding: 22px 26px 70px; align-items: start;
}
@media (max-width: 1100px) {
  .board { grid-template-columns: 1fr; }
}
.clock button { flex: 1; }
.panes button.on { color: var(--ink); background: var(--vellum-deep); border-color: var(--rule); }
</style>
