<script setup lang="ts">
import type { FrameEntry } from '@ed/schema';
import type { SessionView } from '@ed/core';
import Entry from './Entry.vue';

defineProps<{ view: SessionView; frame: FrameEntry[] }>();
defineEmits<{ (e: 'open'): void }>();
</script>

<template>
  <section class="chronicle">
    <!-- The way in to the volume (issue #48). This panel is a rolling window
         on the last sixty entries; everything before it was unreachable from
         any client, in a game that is about what gets written down. -->
    <h3 class="label row top">
      <span>The chronicle</span>
      <button class="quiet small" @click="$emit('open')">Read it whole</button>
    </h3>

    <!-- FREQUENCY IS FELT HERE, as typography, and `Entry.vue` is where that
         lives now — one component for the panel, the reading pane and the
         creditor's account, because they draw the same artefact. -->
    <Entry
      v-for="(entry, i) in [...view.chronicle].reverse()"
      :key="entry.id ?? entry.year + ':' + i"
      :entry="entry"
    />

    <!-- THE FRAME, WHICH IS QUIETER THAN THE TALE. 2042 has been writing while
         the family wrote its own, and it is kept apart from the chronicle
         because it is not the same book. -->
    <template v-if="frame.length">
      <h3 class="label frame-label">2042</h3>
      <article v-for="entry in frame" :key="entry.eventId + entry.year" class="entry frame">
        <p>{{ entry.text }}</p>
      </article>
    </template>
  </section>
</template>

<style scoped>
.chronicle { max-width: 46ch; }
.top { justify-content: space-between; align-items: baseline; gap: 10px; }
.frame-label { margin-top: 26px; border-top: 1px solid var(--rule); padding-top: 14px; }
.entry.frame { margin: 0 0 14px; }
.entry.frame p { margin: 2px 0 0; line-height: 1.6; font-style: italic; color: var(--ink-soft); }
</style>
