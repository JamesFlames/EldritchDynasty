<script setup lang="ts">
import { computed, ref } from 'vue';
import { indexContent, validateBundle } from '@ed/schema';
import { store } from './lib/store';
import EventEditor from './components/EventEditor.vue';
import CharacterEditor from './components/CharacterEditor.vue';
import FamilyTree from './components/FamilyTree.vue';
import SimRunner from './components/SimRunner.vue';
import Instruments from './components/Instruments.vue';

/**
 * `content` is re-indexed from `store.bundle` — the live, shared, reactive
 * model every editing surface mutates directly (issue #20). Re-indexing is
 * cheap (a handful of `Map`s over arrays already in memory) and correct: a
 * cached `Content` would drift the moment an id changed, which is precisely
 * the kind of silent staleness this file used to have with local copies.
 */
const content = computed(() => indexContent(store.bundle));
const tab = ref<Tab>('events');

const issues = computed(() => validateBundle(content.value.bundle));
const errors = computed(() => issues.value.filter((i) => i.level === 'error').length);
const warnings = computed(() => issues.value.length - errors.value);

type Tab = 'events' | 'characters' | 'tree' | 'sim' | 'instruments';

const tabs: { id: Tab; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'characters', label: 'Characters' },
  { id: 'tree', label: 'Family tree' },
  { id: 'sim', label: 'Simulate' },
  { id: 'instruments', label: 'Instruments' },
];

// A plain handler rather than an inline `as` cast: TS casts inside template
// expressions confuse the compiler's ref-assignment rewrite, and it fails
// silently — the click lands and nothing happens.
function select(id: Tab) {
  tab.value = id;
}
</script>

<template>
  <div class="shell">
    <nav class="rail">
      <h1>Eldritch Dynasty<small>editor · v0.1</small></h1>
      <button
        v-for="t in tabs" :key="t.id"
        :class="{ on: tab === t.id }"
        @click="select(t.id)"
      >{{ t.label }}</button>
      <div class="spacer" />
      <div class="meta">
        {{ content.events.length }} events · {{ content.ages.length }} ages<br />
        {{ content.loci.length }} loci · {{ content.characters.length }} seed cast<br />
        <span :style="{ color: errors ? 'var(--rubric)' : 'inherit' }">
          {{ errors }} errors</span> · {{ warnings }} warnings<br />
        <span v-if="store.dirty.size" style="color:var(--rubric)">
          {{ store.dirty.size }} file{{ store.dirty.size > 1 ? 's' : '' }} unsaved
        </span>
        <span v-else style="color:var(--ink-faint)">nothing unsaved</span>
      </div>
    </nav>

    <main class="main">
      <EventEditor v-if="tab === 'events'" :content="content" :issues="issues" />
      <CharacterEditor v-else-if="tab === 'characters'" :content="content" />
      <FamilyTree v-else-if="tab === 'tree'" :content="content" />
      <SimRunner v-else-if="tab === 'sim'" :content="content" />
      <Instruments v-else :content="content" :issues="issues" />
    </main>
  </div>
</template>
