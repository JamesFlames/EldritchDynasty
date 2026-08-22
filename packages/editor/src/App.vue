<script setup lang="ts">
import { computed, ref } from 'vue';
import { indexContent, validateBundle } from '@ed/schema';
import { store } from './lib/store';
import EventEditor from './components/EventEditor.vue';
import ArcEditor from './components/ArcEditor.vue';
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

type Tab = 'events' | 'arcs' | 'characters' | 'tree' | 'sim' | 'instruments';

const tabs: { id: Tab; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'arcs', label: 'Substories' },
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
    <nav class="rail" aria-label="Views">
      <h1>Eldritch Dynasty<small>editor · v0.1</small></h1>
      <button
        v-for="t in tabs" :key="t.id"
        :class="{ on: tab === t.id }"
        :aria-current="tab === t.id ? 'page' : undefined"
        @click="select(t.id)"
      >{{ t.label }}</button>
      <div class="spacer" />
      <div class="meta">
        <div class="counts">
          {{ content.events.length }} events · {{ content.arcs.length }} substories<br />
          {{ content.ages.length }} ages · {{ content.characters.length }} seed cast<br />
          {{ content.loci.length }} loci
        </div>
        <div class="state" role="status">
          <span :class="{ bad: errors }">{{ errors }} error{{ errors === 1 ? '' : 's' }}</span>
          · {{ warnings }} warning{{ warnings === 1 ? '' : 's' }}<br />
          <span v-if="store.dirty.size" class="bad">
            {{ store.dirty.size }} file{{ store.dirty.size > 1 ? 's' : '' }} unsaved
          </span>
          <span v-else>nothing unsaved</span>
        </div>
      </div>
    </nav>

    <main class="main">
      <EventEditor v-if="tab === 'events'" :content="content" :issues="issues" />
      <ArcEditor v-else-if="tab === 'arcs'" :content="content" :issues="issues" />
      <CharacterEditor v-else-if="tab === 'characters'" :content="content" />
      <FamilyTree v-else-if="tab === 'tree'" :content="content" />
      <SimRunner v-else-if="tab === 'sim'" :content="content" />
      <Instruments v-else :content="content" :issues="issues" />
    </main>
  </div>
</template>
