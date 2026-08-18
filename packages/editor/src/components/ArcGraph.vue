<script setup lang="ts">
import { computed } from 'vue';
import type { ArcDef } from '@ed/schema';

/**
 * THE SHAPE OF A SUBSTORY, drawn.
 *
 * Hand-rolled SVG, matching the house style `FamilyTree.vue` and `Sigil.vue`
 * already set — no graph library is installed and none is wanted for this.
 *
 * Nodes are laid out in RANKS by distance from the entry, following
 * successors, so the picture reads left to right the way the story runs. A
 * node nothing reaches sits in the last rank and is drawn in rubric: an
 * unreachable beat is the failure this view exists to make visible, and it is
 * invisible in the YAML.
 */
const props = defineProps<{ arc: ArcDef; selected?: string }>();
const emit = defineEmits<{ select: [string] }>();

// The gap between columns has to hold a guard label — "took buy_it_back" is
// eleven characters wider than the arrow it sits on — or the label overprints
// the node it points at, which is what the first draft of this did.
const COL = 268;
const ROW = 74;
const W = 152;
const H = 40;

interface Placed { id: string; event: string; x: number; y: number; reachable: boolean }

const layout = computed(() => {
  const nodes = props.arc.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Rank by shortest distance from the entry. Breadth-first, so a node reached
  // by two paths sits at the earlier of the two — which is how it reads.
  const rank = new Map<string, number>();
  let frontier = [props.arc.entry].filter((id) => byId.has(id));
  for (const id of frontier) rank.set(id, 0);

  for (let depth = 1; frontier.length && depth < 32; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const s of byId.get(id)?.successors ?? []) {
        if (s.to === 'end' || rank.has(s.to) || !byId.has(s.to)) continue;
        rank.set(s.to, depth);
        next.push(s.to);
      }
    }
    frontier = next;
  }

  const maxRank = Math.max(0, ...rank.values());
  const perRank = new Map<number, number>();
  const placed: Placed[] = nodes.map((n) => {
    // Unreachable nodes are parked past the end, where they are conspicuous.
    const r = rank.get(n.id) ?? maxRank + 1;
    const row = perRank.get(r) ?? 0;
    perRank.set(r, row + 1);
    return { id: n.id, event: n.event, x: 8 + r * COL, y: 10 + row * ROW, reachable: rank.has(n.id) };
  });

  const at = new Map(placed.map((p) => [p.id, p]));
  const edges: { x1: number; y1: number; x2: number; y2: number; label: string; end: boolean }[] = [];

  for (const n of nodes) {
    const from = at.get(n.id)!;
    // Two successors leaving one beat at the same height draw one on top of
    // the other, and the guard label of the hidden one reads as the label of
    // the visible one. Fan them out at the source.
    const fan = (i: number) => (i - (n.successors.length - 1) / 2) * 11;
    for (const [si, s] of n.successors.entries()) {
      const guards = [
        s.fromChoice ? `took ${s.fromChoice}` : '',
        s.fromOutcome ? `ended ${s.fromOutcome}` : '',
        s.fromTag ? `#${s.fromTag}` : '',
        s.when ? 'if…' : '',
      ].filter(Boolean).join(' · ');
      // A long guard on a short arrow overprints the node it points at. The
      // full text is in the panel below; this is the picture.
      const label = guards.length > 22 ? `${guards.slice(0, 21)}…` : guards;

      // An `end` stub is long enough to carry its own guard label — "took
      // buy_it_back" on a 46-pixel arrow printed straight over the node it
      // left — and short enough to stop before the next column begins.
      const to = s.to === 'end' ? undefined : at.get(s.to);
      const y1 = from.y + H / 2 + fan(si);
      edges.push({
        x1: from.x + W,
        y1,
        x2: to ? to.x : from.x + W + 88,
        y2: to ? to.y + H / 2 : y1,
        label,
        end: !to,
      });
    }
  }

  const width = Math.max(...placed.map((p) => p.x + W), 300) + 150;
  const height = Math.max(...placed.map((p) => p.y + H), 60) + 18;
  return { placed, edges, width, height };
});
</script>

<template>
  <div class="tree arcgraph">
    <svg :width="layout.width" :height="layout.height">
      <g v-for="(e, i) in layout.edges" :key="i">
        <path
          :d="`M ${e.x1} ${e.y1} C ${e.x1 + 34} ${e.y1}, ${e.x2 - 34} ${e.y2}, ${e.x2} ${e.y2}`"
          fill="none" :stroke="e.end ? 'var(--ink-faint)' : 'var(--rule)'" stroke-width="1.4"
        />
        <text
          v-if="e.label" :x="e.end ? e.x1 + 6 : (e.x1 + e.x2) / 2" :y="(e.y1 + e.y2) / 2 - 6"
          font-size="10" fill="var(--ink-soft)" :text-anchor="e.end ? 'start' : 'middle'"
        >{{ e.label }}</text>
        <text v-if="e.end" :x="e.x2 + 4" :y="e.y2 + 3" font-size="9.5" fill="var(--ink-faint)">end</text>
      </g>

      <g v-for="n in layout.placed" :key="n.id" style="cursor:pointer" @click="emit('select', n.id)">
        <rect
          :x="n.x" :y="n.y" :width="W" :height="H" rx="3"
          :fill="n.id === selected ? 'var(--vellum-deep)' : 'var(--panel)'"
          :stroke="n.reachable ? (n.id === selected ? 'var(--rubric)' : 'var(--rule)') : 'var(--rubric)'"
          :stroke-width="n.id === selected ? 2 : 1"
        />
        <text :x="n.x + 8" :y="n.y + 15" font-size="11.5" fill="var(--ink)" font-weight="600">{{ n.id }}</text>
        <text :x="n.x + 8" :y="n.y + 28" font-size="9.5" :fill="n.reachable ? 'var(--ink-faint)' : 'var(--rubric)'">
          {{ n.reachable ? n.event : 'nothing reaches this' }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
/* The graph is as wide as the story is long, and the panel is not. Scroll the
   picture rather than stretching the column it sits in — a grid child with no
   `min-width: 0` is sized by its widest content and drags the layout with it. */
.arcgraph { padding: 10px; overflow-x: auto; max-width: 100%; }
</style>
