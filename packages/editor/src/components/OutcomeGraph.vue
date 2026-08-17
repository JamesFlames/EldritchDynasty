<script setup lang="ts">
import { computed } from 'vue';
import type { EventTemplate } from '@ed/schema';

/**
 * THE CHOICE & OUTCOME TREE (issue #21). Hand-rolled SVG — no graph library
 * is installed, and hand-rolled SVG is the house style already
 * (`FamilyTree.vue`, `Sigil.vue`).
 *
 * A checked choice resolves by BAND, not by outcome weight (`checks.ts`;
 * `outcomes/weights`'s own validation rule) — its outcomes' weights are
 * unused, so the graph shows the check's bands instead of a percentage for
 * those, rather than drawing a number nobody reads.
 */
const props = defineProps<{ event: EventTemplate }>();

interface OutcomeNode {
  id: string;
  weight: number;
  pct: number | null;
  x: number;
  y: number;
}
interface BranchNode {
  id: string;
  label: string;
  checked: boolean;
  bandSummary?: string;
  weightSumOk: boolean;
  x: number;
  y: number;
  outcomes: OutcomeNode[];
}

const ROW = 34;
const GAP = 14;
const CHOICE_X = 6;
const OUTCOME_X = 220;

const layout = computed(() => {
  const e = props.event;
  let y = 10;
  const branches: BranchNode[] = [];

  const oneBranch = (
    id: string,
    label: string,
    outcomes: { id: string; weight: number }[],
    checked: boolean,
    bandSummary?: string,
  ) => {
    const useWeights = !checked;
    const sum = outcomes.reduce((s, o) => s + o.weight, 0);
    const startY = y;
    const outcomeNodes: OutcomeNode[] = outcomes.map((o) => {
      const node: OutcomeNode = {
        id: o.id,
        weight: o.weight,
        pct: useWeights && sum > 0 ? (100 * o.weight) / sum : null,
        x: OUTCOME_X,
        y,
      };
      y += ROW;
      return node;
    });
    const branch: BranchNode = {
      id, label, checked, bandSummary,
      weightSumOk: checked || sum === 100,
      x: CHOICE_X,
      y: startY,
      outcomes: outcomeNodes,
    };
    branches.push(branch);
    y += GAP;
  };

  if (e.interaction.kind === 'narration') {
    oneBranch('fires', 'fires', e.interaction.outcomes, false);
  } else {
    for (const c of e.interaction.choices) {
      const check = c.check ? e.checks.find((k) => k.id === c.check) : undefined;
      const bandSummary = check?.bands.map((b) => `≥${b.atLeast} → ${b.outcome}`).join('  ·  ');
      oneBranch(c.id, c.label, c.outcomes, Boolean(check), bandSummary);
    }
  }

  return { branches, width: OUTCOME_X + 230, height: y };
});
</script>

<template>
  <div class="tree" style="padding: 10px">
    <svg :width="layout.width" :height="layout.height">
      <g v-for="b in layout.branches" :key="b.id">
        <text :x="b.x" :y="b.y + 14" font-size="12.5" :fill="b.weightSumOk ? 'var(--ink)' : 'var(--rubric)'" font-weight="600">
          {{ b.label }}
        </text>
        <text v-if="b.checked" :x="b.x" :y="b.y + 28" font-size="10.5" fill="var(--uncommon)">
          resolved by check — {{ b.bandSummary }}
        </text>
        <text v-else-if="!b.weightSumOk" :x="b.x" :y="b.y + 28" font-size="10.5" fill="var(--rubric)">
          weights do not sum to 100
        </text>

        <template v-for="o in b.outcomes" :key="o.id">
          <line :x1="b.x + 190" :y1="b.y + 12" :x2="o.x" :y2="o.y + 12" stroke="var(--rule)" />
          <rect :x="o.x" :y="o.y" width="220" :height="ROW - 6" rx="3" fill="var(--panel)" stroke="var(--rule)" />
          <text :x="o.x + 8" :y="o.y + 12" font-size="11.5" fill="var(--ink)">{{ o.id }}</text>
          <text :x="o.x + 8" :y="o.y + 24" font-size="10" fill="var(--ink-faint)">
            {{ o.pct !== null ? o.pct.toFixed(0) + '%' : 'weight ' + o.weight + ' — unused, resolved by band' }}
          </text>
        </template>
      </g>
    </svg>
  </div>
</template>
