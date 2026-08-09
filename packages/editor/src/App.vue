<script setup lang="ts">
import { computed, ref } from 'vue';
import { loadBundle } from './lib/content';
import { validateBundle } from '@ed/schema';
import EventEditor from './components/EventEditor.vue';
import CharacterEditor from './components/CharacterEditor.vue';
import FamilyTree from './components/FamilyTree.vue';
import SimRunner from './components/SimRunner.vue';

const bundle = ref(loadBundle());
const tab = ref<Tab>('events');

const issues = computed(() => validateBundle(bundle.value));
const errors = computed(() => issues.value.filter((i) => i.level === 'error').length);
const warnings = computed(() => issues.value.length - errors.value);

type Tab = 'events' | 'characters' | 'tree' | 'sim';

const tabs: { id: Tab; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'characters', label: 'Characters' },
  { id: 'tree', label: 'Family tree' },
  { id: 'sim', label: 'Simulate' },
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
        {{ bundle.events.length }} events · {{ bundle.ages.length }} ages<br />
        {{ bundle.loci.length }} loci · {{ bundle.characters.length }} seed cast<br />
        <span :style="{ color: errors ? 'var(--rubric)' : 'inherit' }">
          {{ errors }} errors</span> · {{ warnings }} warnings
      </div>
    </nav>

    <main class="main">
      <EventEditor v-if="tab === 'events'" :bundle="bundle" :issues="issues" />
      <CharacterEditor v-else-if="tab === 'characters'" :bundle="bundle" />
      <FamilyTree v-else-if="tab === 'tree'" :bundle="bundle" />
      <SimRunner v-else :bundle="bundle" />
    </main>
  </div>
</template>
