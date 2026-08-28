<script setup lang="ts">
import type { FrameEntry } from '@ed/schema';
import type { GameActions } from '../lib/game';

defineProps<{ entry: FrameEntry; actions: GameActions }>();
</script>

<template>
  <!-- THE FRAME IS QUIETER THAN THE TALE (concept §24). One interlude is held
       with the family out of the way and nothing to click but the way back:
       the temperature change IS the feature. A long jump does not stop here —
       twenty of these in a row is a column of panels, not an interruption. -->
  <div class="scrim" @click="actions.dismissInterlude()">
    <article class="interlude" @click.stop>
      <p>{{ entry.text }}</p>
      <button class="quiet small" @click="actions.dismissInterlude()">Go on</button>
    </article>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed; inset: 0; z-index: 20;
  background: color-mix(in srgb, var(--vellum-deep) 88%, transparent);
  display: grid; place-items: center; padding: 40px;
}
.interlude {
  max-width: 56ch; background: var(--vellum-deep);
  border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
  padding: 40px 44px; text-align: center;
}
.interlude p {
  font-size: 17px; line-height: 1.75; font-style: italic;
  color: var(--ink-soft); margin: 0 0 26px;
}
</style>
