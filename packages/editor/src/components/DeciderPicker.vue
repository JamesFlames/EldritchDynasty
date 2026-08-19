<script setup lang="ts">
import { computed } from 'vue';
import type { Condition, Decider, EventTemplate } from '@ed/schema';
import { deciderKind } from '@ed/schema';
import ConditionBuilder from './ConditionBuilder.vue';

/**
 * WHO TAKES THE BRANCH.
 *
 * The four kinds are the four sentences under each option. They are worth
 * spelling out in the tool, because "who decides" is the field an author is
 * most likely to get wrong by defaulting: `player` is right for a real choice
 * and wrong for a scene where the family's condition has already decided, and
 * the difference does not show up until a playtest.
 */
const props = defineProps<{ event: EventTemplate }>();
const emit = defineEmits<{ change: [] }>();

const KIND_NOTES: Record<string, string> = {
  player: 'The docket stops the clock and asks. Right when this is a real decision.',
  chance: 'A weighted draw over the branches, each worth the sum of its outcomes\' weights.',
  state: 'A ladder, read top down. The first rung whose guard holds takes its branch, and a rung with no guard is the else. Nobody is asked.',
  party: 'The player names who goes; a check pooled over exactly those people takes the branch. Needs a player-cast slot and a check whose bands name branches.',
};

const choices = computed(() => (props.event.interaction.kind === 'narration' ? [] : props.event.interaction.choices));

const decider = computed<Decider>(() =>
  (props.event.interaction.kind === 'narration' ? 'chance' : props.event.interaction.decidedBy));

const kind = computed(() => deciderKind(decider.value));

const ladder = computed(() => {
  const d = decider.value;
  return typeof d === 'object' && 'state' in d ? d.state : [];
});

const partyCheck = computed(() => {
  const d = decider.value;
  return typeof d === 'object' && 'party' in d ? d.party.check : '';
});

function set(d: Decider) {
  if (props.event.interaction.kind === 'narration') return;
  props.event.interaction.decidedBy = d;
  emit('change');
}

function setKind(k: string) {
  if (k === 'player' || k === 'chance') return set(k);
  if (k === 'state') return set({ state: [{ take: choices.value[0]?.id ?? '' }] });
  return set({ party: { check: props.event.checks[0]?.id ?? '' } });
}

function setRung(i: number, patch: Partial<{ when: Condition | undefined; take: string; because: string }>) {
  const next = ladder.value.map((r, j) => {
    if (j !== i) return r;
    const merged = { ...r, ...patch };
    if ('when' in patch && patch.when === undefined) delete merged.when;
    if (patch.because === '') delete merged.because;
    return merged;
  });
  set({ state: next });
}

function addRung() {
  set({ state: [...ladder.value, { take: choices.value[0]?.id ?? '' }] });
}
function removeRung(i: number) {
  const next = ladder.value.filter((_, j) => j !== i);
  set({ state: next.length ? next : [{ take: choices.value[0]?.id ?? '' }] });
}
function moveRung(i: number, by: number) {
  const next = [...ladder.value];
  const to = i + by;
  if (to < 0 || to >= next.length) return;
  [next[i], next[to]] = [next[to]!, next[i]!];
  set({ state: next });
}

/** A ladder every rung of which is guarded falls through to weight. Usually not the intent. */
const noElse = computed(() => kind.value === 'state' && ladder.value.every((r) => r.when !== undefined));
</script>

<template>
  <div v-if="event.interaction.kind !== 'narration'">
    <div class="bar">
      <button
        v-for="k in ['player', 'chance', 'state', 'party']" :key="k" class="btn"
        :style="kind === k ? 'border-color:var(--rubric);color:var(--rubric)' : ''"
        @click="setKind(k)"
      >{{ k }}</button>
    </div>
    <p class="note" style="margin-top:6px">{{ KIND_NOTES[kind] }}</p>

    <div v-if="kind === 'state'" class="ladder">
      <div v-for="(rung, i) in ladder" :key="i" class="rung">
        <div class="rung-head">
          <span class="fk">{{ i === 0 ? 'if' : 'else if' }}</span>
          <span class="fk">take</span>
          <select :value="rung.take" @change="setRung(i, { take: ($event.target as HTMLSelectElement).value })">
            <option v-for="c in choices" :key="c.id" :value="c.id">{{ c.id }}</option>
            <option v-if="!choices.some((c) => c.id === rung.take)" :value="rung.take">{{ rung.take || '—' }}</option>
          </select>
          <input
            type="text" class="because" placeholder="because… (shown to the player)"
            :value="rung.because ?? ''" @input="setRung(i, { because: ($event.target as HTMLInputElement).value })"
          />
          <button class="btn tiny" @click="moveRung(i, -1)">↑</button>
          <button class="btn tiny" @click="moveRung(i, 1)">↓</button>
          <button class="btn tiny" @click="removeRung(i)">×</button>
        </div>
        <ConditionBuilder :model-value="rung.when" @update:model-value="(v) => setRung(i, { when: v })" />
      </div>
      <button class="btn tiny" @click="addRung">+ rung</button>
      <div v-if="noElse" class="issue warning">
        every rung is guarded — when none holds the branch is drawn by weight. A last rung with no
        condition is the else.
      </div>
    </div>

    <div v-else-if="kind === 'party'" class="ladder">
      <div class="rung-head">
        <span class="fk">check</span>
        <select :value="partyCheck" @change="set({ party: { check: ($event.target as HTMLSelectElement).value } })">
          <option v-for="c in event.checks" :key="c.id" :value="c.id">{{ c.id }}</option>
          <option v-if="!event.checks.some((c) => c.id === partyCheck)" :value="partyCheck">{{ partyCheck || '—' }}</option>
        </select>
      </div>
      <div v-if="!Object.values(event.slots).some((s) => s.castBy === 'player')" class="issue error">
        no slot is cast by the player — the party he names is the decision, and there is nobody to name
      </div>
      <div v-else-if="!event.checks.some((c) => c.id === partyCheck)" class="issue error">
        this event declares no check called '{{ partyCheck }}'
      </div>
    </div>
  </div>
</template>

<style scoped>
.ladder { margin-top: 8px; }
.rung { border-left: 2px solid var(--rule); padding: 5px 0 5px 10px; margin-bottom: 6px; }
.rung:hover { background: var(--vellum-deep); }
.rung-head { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.rung-head select, .rung-head input { width: auto; margin: 0; font-size: 12.5px; padding: 4px 6px; }
.because { min-width: 240px; }
.fk { font-size: 11px; letter-spacing: .06em; color: var(--ink-faint); }
.btn.tiny { padding: 2px 7px; font-size: 11px; }
</style>
