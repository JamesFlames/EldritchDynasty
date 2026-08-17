<script setup lang="ts">
import type { Content, Issue } from '@ed/schema';

const props = defineProps<{ content: Content; issues: Issue[] }>();
void props;
</script>

<template>
  <header>
    <h2>Instruments</h2>
    <p>The authoring instruments (issue #22) land here.</p>
  </header>
</template>
