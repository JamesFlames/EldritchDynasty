<script setup lang="ts">
import { computed, ref } from 'vue';
import { COLLECTION_YEAR, createGame } from './lib/game';
import { loadBundle } from './lib/content';
import Start from './components/Start.vue';
import Standing from './components/Standing.vue';
import Docket from './components/Docket.vue';
import Naming from './components/Naming.vue';
import Tree from './components/Tree.vue';
import Chronicle from './components/Chronicle.vue';
import GameTable from './components/Table.vue';
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
const { view, table, docket, interlude, frame, ended, refused, resumable, actions } = game;

/** The table is a screen the player opens, not a panel that competes with the docket. */
const atTable = ref(false);

/** The clock only turns when nothing is waiting for an answer. */
const waiting = computed(() => docket.value.length > 0 || (view.value?.namesWanted.length ?? 0) > 0);
</script>

<template>
  <Start v-if="!view" :actions="actions" :resumable="resumable" />

  <Ending v-else-if="ended" :view="view" :actions="actions" />

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

        <button class="quiet small" @click="atTable = !atTable">
          {{ atTable ? 'Back to the house' : 'Sit at the table' }}
        </button>
        <p v-if="waiting" class="dim small">The year does not turn while something is waiting.</p>
      </div>

      <div class="middle">
        <GameTable v-if="atTable && table" :view="view" :table="table" :actions="actions" :refused="refused" />
        <Tree v-else :view="view" />
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
</style>
