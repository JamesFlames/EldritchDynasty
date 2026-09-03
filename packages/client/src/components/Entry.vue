<script setup lang="ts">
import type { ChronicleEntry } from '@ed/core';

/**
 * ONE LINE OF THE BOOK, wherever the book is being read (issue #48).
 *
 * Three places draw chronicle entries — the panel on the board, the reading
 * pane, and the creditor's account on the last night — and they were drawing
 * them separately. That is fine right up until one of them is edited: the
 * accessible text for a blank went into the panel and not the epilogue, so a
 * screen reader met a described gap in one place and `&nbsp;` in the other,
 * for the same artefact, in the same run.
 *
 * FREQUENCY IS FELT HERE AND NOWHERE ELSE. A tier is a rationing decision
 * everywhere in the engine; in the book it is typography, and typography is
 * the only form in which the player ever meets it. So `weight` is a class and
 * the stylesheet is the whole of the meaning.
 *
 * An omission is a DATED BLANK LINE, not a missing line. The blank is the
 * artefact — it is the most interesting thing on the page — and it is the one
 * part of this component that must never be tidied into nothing.
 */
defineProps<{
  entry: ChronicleEntry;
  /** The epilogue reads the book aloud in a plainer hand than the panel keeps. */
  read?: boolean;
}>();
</script>

<template>
  <article
    class="entry"
    :class="[entry.weight, {
      greyed: entry.greyed,
      omitted: entry.text === null,
      embellished: entry.record === 'embellish',
      read,
    }]"
  >
    <span class="year dim small">{{ entry.year }}</span>
    <h4 v-if="entry.title && entry.text !== null">{{ entry.title }}</h4>
    <p v-if="entry.text !== null">{{ entry.text }}</p>
    <!-- To a screen reader this was `&nbsp;` with a `title` on it, which is to
         say nothing whatsoever, exactly where the artefact is. The sentence is
         said; the page still shows the gap. -->
    <p v-else class="blank" title="somebody decided this would not be written down">
      <span class="said-not-shown">Somebody decided this year would not be written down.</span>
      <span aria-hidden="true">&nbsp;</span>
    </p>
    <span v-if="entry.record === 'embellish' && !read" class="dim small mark">as the house tells it</span>
  </article>
</template>

<style scoped>
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
/* The artefact. A ruled empty line where a year should have been. */
.entry.omitted .blank { border-bottom: 1px solid var(--rule); }
.entry .mark { font-style: italic; }

/* Read aloud on the last night: one hand, evenly, blanks taking as long as a
   page. The creditor does not read the family's typography back to it. */
.entry.read { margin-bottom: 12px; }
.entry.read p { font-size: 14px; }
.entry.read.illuminated { border-left: 0; padding-left: 0; }
.entry.read.illuminated p, .entry.read.page p, .entry.read.line p { font-size: 14px; }
.entry.read.embellished p { font-style: italic; }
</style>
