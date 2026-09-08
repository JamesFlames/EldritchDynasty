<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { SessionView } from '@ed/core';
import Kin from './Kin.vue';
import { roots, type MemberView } from '../lib/kin';

/**
 * `selected` is the APP's, not this component's. One card is open at a time —
 * this is a tree, not a spreadsheet — and the cast list opens cards too
 * (issue #44), so the two of them have to be looking at the same person.
 */
const props = defineProps<{ view: SessionView; selected: string | null }>();
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'line'): void }>();

/**
 * A WAY IN (issue #106). Eighty-eight member cards across six halls is
 * roughly five thousand pixels of scroll with no search, no filter and no way
 * to jump to a person — true on a desk monitor as well as a phone, which is
 * the test the issue sets for whether this is the right fix. Three controls,
 * all of them optional and all of them composing: pick a hall, drill into a
 * branch, or search a name and land on it directly. None of them touch what
 * `roots`/`children` compute — they only decide which of that a given hall
 * draws this render.
 */

/** 'all' or a hall id. Narrows which halls are drawn at all. */
const hallFilter = ref<string>('all');

/**
 * A MEMBER ID TO ROOT AT, within whichever hall holds them. Set from the
 * "Only this branch" control `Kin.vue` offers wherever a member has
 * descendants, and cleared by the breadcrumb this draws in its place. Scoped
 * to one hall at a time — the hall a focused branch belongs to is set here
 * alongside it, so drilling into a branch does not leave five other halls
 * still fully unrolled underneath it.
 */
const focus = ref<string | null>(null);

function onRoot(hallId: string, id: string): void {
  hallFilter.value = hallId;
  focus.value = id;
}

function clearFocus(): void {
  focus.value = null;
}

/** Picking a hall always drops any branch focus — it belonged to the old view. */
function pickHall(id: string): void {
  hallFilter.value = id;
  clearFocus();
}

/** Which halls this render draws, given the picker. */
const shownHalls = computed(() => (hallFilter.value === 'all'
  ? props.view.halls
  : props.view.halls.filter((h) => h.id === hallFilter.value)));

/** The root(s) a given hall draws: the whole hall, or one focused branch. */
function rootsOf(hall: SessionView['halls'][number]): MemberView[] {
  if (focus.value) {
    const found = hall.members.find((m) => m.id === focus.value);
    if (found) return [found];
  }
  return roots(hall.members);
}

/**
 * FIND SOMEBODY BY NAME, rather than by scrolling past everyone who is not
 * them. Two characters minimum so half the house does not light up on the
 * first keystroke; capped at eight because this is a way to a person, not a
 * second directory.
 */
const query = ref('');

const matches = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: { id: string; name: string; hallId: string; hallName: string }[] = [];
  for (const hall of props.view.halls) {
    for (const m of hall.members) {
      if (!m.name.toLowerCase().includes(q)) continue;
      out.push({ id: m.id, name: m.name, hallId: hall.id, hallName: hall.name });
      if (out.length >= 8) return out;
    }
  }
  return out;
});

/**
 * LANDING ON THE RESULT. Opens their card the same way clicking them in the
 * tree would, clears any branch focus so the person they were found under is
 * visible around them, and scrolls the card into view — the tree is still a
 * long page even with one hall showing, and a card opened off-screen is a
 * card the player has to go looking for anyway.
 */
async function jumpTo(m: { id: string; hallId: string }): Promise<void> {
  hallFilter.value = m.hallId;
  focus.value = null;
  query.value = '';
  emit('select', m.id);
  await nextTick();
  document.getElementById('member-' + m.id)?.scrollIntoView({ block: 'center' });
}
</script>

<template>
  <section class="tree">
    <label class="row find">
      <span class="said-not-shown">Find somebody by name</span>
      <input v-model="query" type="search" placeholder="find somebody by name" />
    </label>
    <ul v-if="matches.length" class="matches">
      <li v-for="m in matches" :key="m.id">
        <button class="small" @click="jumpTo(m)">
          {{ m.name }} <span class="dim">· {{ m.hallName }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="query.trim().length >= 2" class="dim small">Nobody of the house answers to that.</p>

    <!-- THE HALL PICKER. A HALL IS NOT A HOUSE (invariant 15): cadet branches
         are households inside the player's house, and crowding is per hall —
         so "show me one of them" is a real question and not an arbitrary
         slice. -->
    <div v-if="view.halls.length > 1" class="wrap halls">
      <button
        class="small"
        :class="{ on: hallFilter === 'all' }"
        :aria-pressed="hallFilter === 'all'"
        @click="pickHall('all')"
      >All halls</button>
      <button
        v-for="hall in view.halls"
        :key="hall.id"
        class="small"
        :class="{ on: hallFilter === hall.id }"
        :aria-pressed="hallFilter === hall.id"
        @click="pickHall(hall.id)"
      >{{ hall.name }} <span class="dim">· {{ hall.members.length }}</span></button>
    </div>

    <!-- A HALL IS NOT A HOUSE (invariant 15). Cadet branches are households
         inside the player's house, and crowding and grievance are per hall —
         so they are drawn as separate halls of the same family rather than as
         one long roster. -->
    <div v-for="hall in shownHalls" :key="hall.id" class="hall">
      <h3 class="label">
        {{ hall.name }}
        <span v-if="hall.isSeat" class="rubric">· the seat</span>
        <span class="dim"> · {{ hall.members.length }} at table</span>
        <span v-if="hall.grievance > 0" class="dim"> · grievance {{ Math.round(hall.grievance) }}</span>
      </h3>

      <!-- THE BREADCRUMB OUT OF A FOCUSED BRANCH. Only where this hall is the
           one the focus belongs to — the picker may be showing several. -->
      <p v-if="focus && hall.members.some((m) => m.id === focus)" class="dim small branch">
        Showing one branch. <button class="quiet small" @click="clearFocus()">Show the whole hall</button>
      </p>

      <ul v-if="hall.members.length">
        <Kin
          v-for="member in rootsOf(hall)"
          :key="member.id"
          :member="member"
          :hall="hall.members"
          :names="view.attributes"
          :trait-names="view.traits"
          :selected="selected"
          @select="$emit('select', $event)"
          @line="$emit('line')"
          @root="onRoot(hall.id, $event)"
        />
      </ul>
      <p v-else class="dim small">Nobody. The hall stands empty.</p>
    </div>
  </section>
</template>

<style scoped>
.hall { margin-bottom: 22px; }
.hall > ul { margin: 0; padding: 0; }
.find { margin-bottom: 10px; }
.find input { flex: 1; min-width: 0; }
.matches { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.matches button { width: 100%; text-align: left; }
.halls { margin-bottom: 14px; }
.halls button.on { color: var(--ink); background: var(--vellum-deep); border-color: var(--rule); }
.branch { margin: -4px 0 10px; }
</style>
