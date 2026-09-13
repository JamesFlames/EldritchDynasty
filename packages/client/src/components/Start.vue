<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { GameActions } from '../lib/game';
import type { SaveSummary } from '../platform';

const props = defineProps<{ actions: GameActions; resumable: boolean }>();

const seed = ref(1042);
const saves = ref<SaveSummary[]>([]);
const refused = ref<string | null>(null);

async function refreshSaves(): Promise<void> {
  saves.value = await props.actions.listSaves();
}

async function load(slot: string): Promise<void> {
  refused.value = await props.actions.load(slot) ? null : 'That saved run could not be read.';
}

async function importSave(): Promise<void> {
  refused.value = await props.actions.importSave() ? null : 'That file was not a run this version can read.';
}

async function exportSave(slot: string): Promise<void> {
  refused.value = await props.actions.exportSave(slot) ? null : 'That saved run could not be written out.';
}

onMounted(() => { void refreshSaves(); });
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
    <section v-if="saves.length" class="saved panel" aria-label="Saved runs">
      <h2>Runs written down</h2>
      <p class="dim small">They remain here when the application closes.</p>
      <ul>
        <li v-for="save in saves" :key="save.slot">
          <button class="quiet" @click="load(save.slot)">
            {{ save.slot === 'autosave' ? 'The last sitting' : save.slot }}
            <span class="dim">— {{ save.year ?? 'an unread year' }}</span>
          </button>
          <button class="quiet small" @click="exportSave(save.slot)">Copy out</button>
        </li>
      </ul>
    </section>
    <div class="row">
      <button class="quiet small" @click="importSave()">Bring a run in</button>
      <p v-if="refused" class="rubric small" role="status">{{ refused }}</p>
    </div>

  </main>
</template>

<style scoped>
.start { max-width: 58ch; margin: 0 auto; padding: 110px 26px; }
h1 { font-size: var(--t-display); font-weight: 400; margin: 0 0 26px; letter-spacing: .04em; }
.frame { font-size: var(--t-lead); line-height: 1.75; color: var(--ink-soft); margin: 0 0 18px; }
.row { margin-top: 34px; }
input { width: 9ch; }
.saved { margin-top: 26px; }
.saved h2 { margin: 0; font-size: var(--t-label); letter-spacing: .14em; text-transform: uppercase; }
.saved p { margin: 8px 0; }
.saved ul { list-style: none; padding: 0; margin: 0; }
.saved li + li { margin-top: 4px; }
</style>
