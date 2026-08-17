<script setup lang="ts">
import { computed } from 'vue';
import type { RecordBlock } from '@ed/schema';

/**
 * THE CHRONICLE PREVIEW (issue #21) — the three Record outcomes exactly as
 * `applyRecord` would render them on the page, Omit included. `applyRecord`
 * clears `entry.title` and leaves `entry.text` null on omit, and nobody has
 * ever looked at what that renders as: a dated blank line, which is a
 * designed artefact players screenshot — so it has to be right here too.
 *
 * Markup and classes match `SimRunner.vue`'s real chronicle exactly
 * (`.entry.paragraph`, `.blank`) — this previews the actual rendering, not a
 * mockup of it.
 */
const props = defineProps<{ record: RecordBlock; year?: number }>();

const year = computed(() => props.year ?? 1200);

const rows = computed(() => [
  { option: 'record' as const, title: undefined, text: props.record.options.record.chronicle },
  { option: 'omit' as const, title: undefined, text: null },
  { option: 'embellish' as const, title: undefined, text: props.record.options.embellish.chronicle },
]);
</script>

<template>
  <div>
    <p class="note" style="margin-top: 0">
      Subject: <em>{{ record.subject }}</em>. All three as `applyRecord` would actually write them.
    </p>
    <div class="chronicle">
      <div v-for="r in rows" :key="r.option" style="margin-bottom: 10px">
        <div style="font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 2px">
          {{ r.option }}
        </div>
        <div class="entry paragraph">
          <span class="yr">{{ year }}</span>
          <div class="body">
            <template v-if="r.text">{{ r.text }}</template>
            <span v-else class="blank" />
            <span v-if="r.option === 'embellish'" class="stamp">as written</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
