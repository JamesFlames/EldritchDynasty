<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ChronicleEntry } from '@ed/core';
import { useModal } from '../lib/modal';
import Entry from './Entry.vue';

const props = defineProps<{ book: ChronicleEntry[]; close: () => void }>();

/**
 * THE WHOLE BOOK, READABLE (issue #48).
 *
 * The player writes this for a thousand years and could see the last sixty
 * lines of it. The only character who ever read the finished thing was the
 * creditor, on the last night, in the epilogue.
 *
 * It draws entries and nothing else. It does not annotate, reconcile or
 * explain, because there is no narrator who knows the truth — there is only
 * Daveed, and he is not neutral.
 */
const card = ref<HTMLElement | null>(null);
useModal(card, () => props.close());

/**
 * WHAT THE PLAYER IS LOOKING FOR IN NINE HUNDRED YEARS OF IT.
 *
 * A house that left forty things out across a run should be able to look at
 * nothing but the blanks — which is a question about the player's own conduct
 * and the only way in the game to ask it.
 */
type Lens = 'all' | 'blank' | 'improved' | 'illuminated';
const lens = ref<Lens>('all');
const LENSES: { id: Lens; label: string }[] = [
  { id: 'all', label: 'The whole book' },
  { id: 'blank', label: 'Left blank' },
  { id: 'improved', label: 'Improved' },
  { id: 'illuminated', label: 'Illuminated' },
];

const from = ref<number | null>(null);

const shown = computed(() => props.book.filter((e) => {
  if (from.value !== null && e.year < from.value) return false;
  if (lens.value === 'blank') return e.text === null;
  if (lens.value === 'improved') return e.record === 'embellish';
  if (lens.value === 'illuminated') return e.weight === 'illuminated';
  return true;
}));

/** The centuries the book actually covers, as somewhere to jump to. */
const centuries = computed(() => {
  const out = new Set<number>();
  for (const e of props.book) out.add(Math.floor(e.year / 100) * 100);
  return [...out].sort((a, b) => a - b);
});

const counts = computed(() => ({
  all: props.book.length,
  blank: props.book.filter((e) => e.text === null).length,
  improved: props.book.filter((e) => e.record === 'embellish').length,
  illuminated: props.book.filter((e) => e.weight === 'illuminated').length,
}));
</script>

<template>
  <div class="scrim" @click="close()">
    <!-- `.volume`, not `.book`: the chronicle TAB in the pane switcher is
         already `.book` (issue #57), and two different things under one class
         name in one app is a rule that lands on the wrong element the first
         time somebody writes an unscoped selector. The panel is a window on
         the last sixty lines; this is the volume. -->
    <article ref="card" class="volume" role="dialog" aria-modal="true" aria-label="the chronicle, whole" @click.stop>
      <header>
        <div class="row top">
          <h3 class="label">The book</h3>
          <button class="quiet small" @click="close()">Close it</button>
        </div>
        <p class="dim small">
          {{ counts.all }} entries · {{ counts.blank }} left blank ·
          {{ counts.improved }} improved · {{ counts.illuminated }} illuminated
        </p>

        <div class="wrap lenses">
          <button
            v-for="l in LENSES"
            :key="l.id"
            class="quiet small"
            :class="{ on: lens === l.id }"
            :aria-pressed="lens === l.id"
            @click="lens = l.id"
          >{{ l.label }}</button>
        </div>

        <div v-if="centuries.length > 1" class="wrap jump">
          <span class="dim small">from</span>
          <button
            class="quiet small"
            :class="{ on: from === null }"
            :aria-pressed="from === null"
            @click="from = null"
          >the beginning</button>
          <button
            v-for="c in centuries"
            :key="c"
            class="quiet small"
            :class="{ on: from === c }"
            :aria-pressed="from === c"
            @click="from = c"
          >{{ c }}</button>
        </div>
      </header>

      <!-- Oldest first, which is the order a book is read in and the reverse of
           the panel's. The panel answers "what just happened"; this is the
           volume. -->
      <div class="pages">
        <Entry v-for="(entry, i) in shown" :key="entry.id ?? entry.year + ':' + i" :entry="entry" />
        <p v-if="!shown.length" class="dim small">
          Nothing in the book answers to that.
        </p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed; inset: 0; z-index: 20;
  background: color-mix(in srgb, var(--vellum-deep) 88%, transparent);
  display: grid; place-items: center; padding: 30px;
}
.volume {
  background: var(--vellum); border: 1px solid var(--rule);
  width: min(64ch, 100%); max-height: 100%;
  display: flex; flex-direction: column;
}
header { padding: 16px 22px 12px; border-bottom: 1px solid var(--rule); }
.top { justify-content: space-between; align-items: baseline; }
.lenses, .jump { margin-top: 8px; }
.jump { align-items: baseline; }
.pages { overflow-y: auto; padding: 18px 22px 26px; }
button.on { color: var(--ink); background: var(--vellum-deep); border-color: var(--rule); }
</style>
