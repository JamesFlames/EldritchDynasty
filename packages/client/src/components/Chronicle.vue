<script setup lang="ts">
import type { FrameEntry } from '@ed/schema';
import type { SessionView } from '@ed/core';

defineProps<{ view: SessionView; frame: FrameEntry[] }>();
</script>

<template>
  <section class="chronicle">
    <h3 class="label">The chronicle</h3>

    <!-- FREQUENCY IS FELT HERE. A tier is a rationing decision everywhere else
         in the engine; in the book it is typography, which is the only place
         the player ever meets it. An omission is a DATED BLANK LINE, not a
         missing line — the blank is the artefact. -->
    <article
      v-for="(entry, i) in [...view.chronicle].reverse()"
      :key="entry.id ?? entry.year + ':' + i"
      class="entry"
      :class="[entry.weight, { greyed: entry.greyed, omitted: entry.text === null }]"
    >
      <span class="year dim small">{{ entry.year }}</span>
      <h4 v-if="entry.title && entry.text !== null">{{ entry.title }}</h4>
      <p v-if="entry.text !== null">{{ entry.text }}</p>
      <!-- THE BLANK IS THE ARTEFACT, and it is a ruled empty line on the page.
           To a screen reader it was `&nbsp;` with a `title` on it, which is to
           say nothing whatsoever, exactly where the most interesting thing in
           the book is. The sentence is said; the page still shows the gap. -->
      <p v-else class="blank" title="somebody decided this would not be written down">
        <span class="said-not-shown">Somebody decided this year would not be written down.</span>
        <span aria-hidden="true">&nbsp;</span>
      </p>
      <span v-if="entry.record === 'embellish'" class="dim small mark">as the house tells it</span>
    </article>

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
.entry { margin: 0 0 14px; }
.entry p { margin: 2px 0 0; line-height: 1.6; }
.entry h4 { margin: 2px 0 0; font-weight: 500; font-size: 15px; }
.entry .year { display: block; letter-spacing: .08em; }
.entry.line p { font-size: 13.5px; color: var(--ink-soft); }
.entry.paragraph p { font-size: 14.5px; }
.entry.page p { font-size: 15.5px; }
.entry.illuminated { border-left: 2px solid var(--rubric); padding-left: 12px; }
.entry.illuminated h4 { color: var(--rubric); font-size: 17px; }
.entry.illuminated p { font-size: 16px; }
.entry.greyed { opacity: .55; }
.entry.omitted .blank { border-bottom: 1px solid var(--rule); }
.entry .mark { font-style: italic; }
.frame-label { margin-top: 26px; border-top: 1px solid var(--rule); padding-top: 14px; }
.entry.frame p { font-style: italic; color: var(--ink-soft); }
</style>
