<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
import { SHORTCUTS, isControl, isField, shortcutFor } from './lib/keys';

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
  view, table, prologue, openingSeen, epilogue, docket, passages, jump, interlude, frame, ended,
  refused, receipt, resumable, actions,
} = game;

/**
 * Which of the three the middle column is showing. The docket, the clock and
 * the chronicle never move — what changes is what the player is looking AT:
 * the family, the orders the house is under, or what the world is saying about
 * it. A panel competing with the docket for the same column would lose.
 */
const pane = ref<'house' | 'table' | 'abroad' | 'chronicle'>('house');

/**
 * WHAT THE MIDDLE COLUMN IS SHOWING, which is not quite what the switcher says.
 *
 * Below 1100px the chronicle becomes a fourth pane (issue #57) because the
 * three columns stack and the book ends up seventeen hundred pixels down, past
 * a family tree that grows for a thousand years, with no control anywhere that
 * would take you to it.
 *
 * Above the breakpoint the chronicle has its own column and the fourth tab is
 * not offered — so `chronicle` is a state only a narrow window can enter, and
 * a window widened while it is set would otherwise leave this column empty.
 * It falls back to the house, which is what that width already shows.
 */
const middle = computed(() => (pane.value === 'chronicle' ? 'house' : pane.value));

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

/**
 * THE KEYBOARD (issue #58). A text game that needed a mouse for every input.
 *
 * The clock, Escape and the list live here because this is where the panes,
 * the open card and the interlude are. The numbers live in `Docket.vue`,
 * because taking a choice needs the half-filled cast that only that component
 * holds — reaching for it from up here would mean lifting a form into the
 * store, and it is not simulation state.
 */
const helpOpen = ref(false);

function onKey(e: KeyboardEvent): void {
  const el = document.activeElement;
  const press = shortcutFor({
    key: e.key,
    shift: e.shiftKey,
    modified: e.ctrlKey || e.metaKey || e.altKey,
    inField: isField(el),
    onControl: isControl(el),
  });
  if (!press) return;

  switch (press.kind) {
    case 'help':
      e.preventDefault();
      helpOpen.value = !helpOpen.value;
      return;

    case 'dismiss':
      // In the order a player would expect to leave them: the thing on top
      // first. The interlude traps and handles its own Escape, so by the time
      // one reaches here there is not one.
      if (helpOpen.value) helpOpen.value = false;
      else if (selected.value) selected.value = null;
      return;

    case 'advance':
      // Only the states where the clock is actually offered. Pressing space
      // on the signing screen must not found a house.
      if (!view.value || ended.value || waiting.value || interlude.value) return;
      if (prologue.value && !openingSeen.value) return;
      e.preventDefault();
      actions.advance(press.years);
      return;

    // Docket.vue's business — it holds the cast these would need.
    case 'take':
      return;

    default:
      return;
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

/** The clock only turns when nothing is waiting for an answer. */
const waiting = computed(() => docket.value.length > 0 || (view.value?.namesWanted.length ?? 0) > 0);

/**
 * WHY THE CLOCK WILL NOT TURN, COUNTED (issue #53).
 *
 * The count is the useful half. A queue with no number on it is why a player
 * presses the same button six times: pressing "a generation" from 1042 and
 * arriving in 1045 is what a naming queue looks like from the outside when
 * nothing says how many are in it.
 */
const blocking = computed(() => {
  const decisions = docket.value.length;
  const children = view.value?.namesWanted.length ?? 0;
  const parts: string[] = [];
  if (decisions) parts.push(`${decisions} decision${decisions === 1 ? '' : 's'}`);
  if (children) parts.push(`${children} ${children === 1 ? 'child' : 'children'} waiting`);
  return parts.join(' · ');
});
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
    <Standing :view="view" :jump="jump" />

    <div class="board" :data-pane="pane">
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

        <!-- THE CLOCK IS FURNITURE (issue #53). Always drawn, same place, same
             size, whatever else is on the board. It used to be the third arm of
             a v-if chain with the docket and the naming panel, so the game's
             primary verb left the screen the moment anything wanted answering —
             and the line explaining why sat forty pixels below the pane
             switcher, which is not where the player is looking.

             Disabled with the reason ON it, which is the courtesy `Docket.vue`
             already extends to a choice nobody can take: "an unavailable choice
             is itself information (concept §16), so it is shown greyed with the
             reason rather than filtered away." -->
        <div class="panel clock">
          <h3 class="label">The clock</h3>
          <div class="wrap">
            <button :disabled="waiting" :title="blocking" @click="actions.advance(1)">A year</button>
            <button :disabled="waiting" :title="blocking" @click="actions.advance(5)">Five</button>
            <button :disabled="waiting" :title="blocking" @click="actions.advance(25)">A generation</button>
            <button
              :disabled="waiting"
              :title="blocking"
              @click="actions.advance(COLLECTION_YEAR - view.year)"
            >On, to 2042</button>
          </div>
          <p v-if="waiting" class="dim small why">
            {{ blocking }} — the year does not turn until it is answered.
          </p>
        </div>

        <!-- Not a modal: it has no focus to trap and nothing to answer, and a
             second dialog in a client that just got its first one would be two
             traps to keep right instead of one. -->
        <section v-if="helpOpen" class="panel keys">
          <h3 class="label">Keys</h3>
          <dl>
            <template v-for="k in SHORTCUTS" :key="k.keys">
              <dt><kbd>{{ k.keys }}</kbd></dt>
              <dd class="dim small">{{ k.does }}</dd>
            </template>
          </dl>
        </section>

        <div class="wrap panes">
          <!-- `aria-pressed` mirrors `.on` exactly (issue #58). Which pane you
               are in was a colour and a box-shadow and nothing else, which is
               also a problem for anyone who cannot tell --rubric from --rule. -->
          <button
            class="quiet small"
            :class="{ on: middle === 'house' && pane !== 'chronicle' }"
            :aria-pressed="middle === 'house' && pane !== 'chronicle'"
            @click="pane = 'house'"
          >The house</button>
          <button
            class="quiet small"
            :class="{ on: pane === 'table' }"
            :aria-pressed="pane === 'table'"
            @click="pane = 'table'"
          >The table</button>
          <button
            class="quiet small"
            :class="{ on: pane === 'abroad' }"
            :aria-pressed="pane === 'abroad'"
            @click="pane = 'abroad'"
          >Abroad</button>
          <!-- Only where the columns have stacked. Above the breakpoint the
               chronicle is always on screen and a tab for it would be a
               control that does nothing. -->
          <button
            class="quiet small book"
            :class="{ on: pane === 'chronicle' }"
            :aria-pressed="pane === 'chronicle'"
            @click="pane = 'chronicle'"
          >The chronicle</button>
        </div>

        <!-- BELOW THE PANE SWITCHER, not above it, and outside the docket's
             v-if chain on purpose: what the last jump did is still the answer
             to "what just happened" while a decision is standing on top of
             it. It is also the one panel here that survives all three states
             of the column. -->
        <PassageLog :passages="passages" @select="look" />
      </div>

      <div class="middle">
        <GameTable
          v-if="middle === 'table' && table"
          :view="view"
          :table="table"
          :actions="actions"
          :refused="refused"
          :receipt="receipt"
        />
        <Abroad v-else-if="middle === 'abroad'" :view="view" />
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
/* THE FOURTH PANE (issue #57). Above the breakpoint nothing here applies and
   the board is what it always was: three columns, chronicle always on screen,
   three tabs. Below it the columns stack, and stacking is what put the book
   seventeen hundred pixels down the page behind a tree that grows for a
   thousand years — so down there the chronicle takes its turn in the column
   instead of queueing after it. */
.panes .book { display: none; }
@media (max-width: 1100px) {
  .board { grid-template-columns: 1fr; }
  .panes .book { display: inline-block; }
  .board[data-pane='chronicle'] .middle { display: none; }
  .board:not([data-pane='chronicle']) .right { display: none; }
}
.clock button { flex: 1; }
/* Four buttons across 390px is 64px each, which is not a label. Two rows.
   After the rule it overrides, not before it — same specificity, later wins,
   and this sat above it for one measurement and did exactly nothing. */
@media (max-width: 1100px) {
  .clock button { flex: 1 1 44%; }
}
/* Sits with the buttons it is about, not forty pixels below a pane switcher. */
.clock .why { margin: 8px 0 0; }
.panes button.on { color: var(--ink); background: var(--vellum-deep); border-color: var(--rule); }
.keys dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; }
.keys dt, .keys dd { margin: 0; }
.keys kbd {
  font: inherit; font-size: 11px; border: 1px solid var(--rule);
  border-radius: 3px; padding: 1px 5px; white-space: nowrap;
}
</style>
