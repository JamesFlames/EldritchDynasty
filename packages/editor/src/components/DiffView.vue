<script setup lang="ts">
import { computed } from 'vue';
import { diffLines, collapseContext } from '../lib/diff';

const props = defineProps<{ before: string; after: string }>();

const rows = computed(() => collapseContext(diffLines(props.before, props.after)));
</script>

<template>
  <div class="diff mono">
    <div v-for="(r, i) in rows" :key="i" :class="r.kind">
      <template v-if="r.kind === 'gap'">⋯</template>
      <template v-else>
        <span class="sign">{{ r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' ' }}</span>{{ r.text }}
      </template>
    </div>
    <p v-if="rows.every((r) => r.kind === 'same')" class="note" style="margin-top: 0">
      No difference from what is on disk.
    </p>
  </div>
</template>

<style scoped>
.diff {
  font-size: 12px; line-height: 1.6; background: var(--vellum);
  border: 1px solid var(--rule); border-radius: 3px; padding: 10px 12px;
  max-height: 360px; overflow: auto; white-space: pre-wrap; word-break: break-word;
}
.diff .add { background: color-mix(in srgb, var(--common) 16%, transparent); }
.diff .del { background: color-mix(in srgb, var(--rubric) 14%, transparent); text-decoration: line-through; opacity: .8; }
.diff .same .sign { color: var(--ink-faint); }
.diff .gap { color: var(--ink-faint); padding: 2px 0; }
.sign { display: inline-block; width: 14px; }
</style>
