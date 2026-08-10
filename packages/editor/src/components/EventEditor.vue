<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Content, EventTemplate, Issue } from '@ed/schema';
import { FREQUENCY_PROFILES, splitSentences, PROSE_SENTENCE_THRESHOLD, proseIssues } from '@ed/schema';
import FrequencyPicker from './FrequencyPicker.vue';

const props = defineProps<{ content: Content; issues: Issue[] }>();

const events = ref<EventTemplate[]>(props.content.events.map((e) => ({ ...e })));
const selectedId = ref(events.value[0]?.id ?? '');
const search = ref('');
const freqFilter = ref<string>('all');

const current = computed(() => events.value.find((e) => e.id === selectedId.value));

const shown = computed(() =>
  events.value.filter((e) => {
    if (freqFilter.value !== 'all' && e.frequency !== freqFilter.value) return false;
    const q = search.value.toLowerCase();
    return !q || e.id.includes(q) || e.title.toLowerCase().includes(q) || e.tags.some((t) => t.includes(q));
  }));

const myIssues = computed(() =>
  props.issues.filter((i) => i.where.startsWith(`event:${selectedId.value}`)));

/** Live voice-contract read on the body being edited. */
const prose = computed(() => {
  const e = current.value;
  if (!e) return { sentences: 0, long: false, issues: [] as Issue[] };
  const sentences = splitSentences(e.body).length;
  return {
    sentences,
    long: sentences > PROSE_SENTENCE_THRESHOLD,
    issues: proseIssues('body', e.body),
  };
});

const slotNames = computed(() => Object.keys(current.value?.slots ?? {}));
const undefinedTokens = computed(() => {
  const e = current.value;
  if (!e) return [];
  const used = [...e.body.matchAll(/\{([A-Z_][A-Z0-9_]*)\}/g)].map((m) => m[1]!);
  return [...new Set(used)].filter((t) => !slotNames.value.includes(t));
});

/** Built here rather than in the template: `{...}` collides with Vue's delimiters. */
const undefinedTokenList = computed(() =>
  undefinedTokens.value.map((t) => '{' + t + '}').join(', '));

const perAge = computed(() => {
  const map = new Map<string, number>();
  for (const a of props.content.ages) map.set(a.id, 0);
  for (const e of events.value) {
    for (const a of e.ages?.only ?? []) map.set(a, (map.get(a) ?? 0) + 1);
  }
  return [...map].sort((a, b) => a[1] - b[1]);
});

const byFrequency = computed(() => {
  const out: Record<string, number> = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
  for (const e of events.value) out[e.frequency] = (out[e.frequency] ?? 0) + 1;
  return out;
});
</script>

<template>
  <header>
    <h2>Events</h2>
    <p>
      Every template declares exactly three purposes and one frequency. Frequency is a
      rationing tier, not a weight synonym: it decides caps, cooldowns, whether a Record
      choice is required, whether the world remembers, and how the chronicle renders it.
    </p>
  </header>

  <div class="bar">
    <input type="text" v-model="search" placeholder="search id, title, tag" style="max-width:240px" />
    <button
      v-for="f in ['all', 'common', 'uncommon', 'rare', 'mythic']" :key="f" class="btn"
      :style="freqFilter === f ? 'border-color:var(--rubric);color:var(--rubric)' : ''"
      @click="freqFilter = f"
    >{{ f }}<template v-if="f !== 'all'"> {{ byFrequency[f] }}</template></button>
  </div>

  <div class="cols wide">
    <div>
      <div class="panel" style="margin-bottom:12px">
        <h3>{{ shown.length }} events</h3>
        <div class="list">
          <button
            v-for="e in shown" :key="e.id" class="row"
            :class="{ on: e.id === selectedId }" @click="selectedId = e.id"
          >
            <span class="badge" :class="e.frequency">{{ e.frequency.slice(0, 4) }}</span>
            <span class="t">{{ e.title }}<br /><span class="sub">{{ e.tier }} · {{ e.id }}</span></span>
          </button>
        </div>
      </div>

      <div class="panel">
        <h3>Per-Age coverage</h3>
        <p class="note" style="margin-top:0">
          An Age with no content of its own is a modifier wearing a name.
        </p>
        <table class="attrs">
          <tr v-for="[age, n] in perAge" :key="age">
            <td class="k">{{ age.replace(/_/g, ' ') }}</td>
            <td class="v" :style="n < 4 ? 'color:var(--rubric)' : ''">{{ n }} exclusive</td>
          </tr>
        </table>
      </div>
    </div>

    <div v-if="current" class="panel">
      <h3>{{ current.id }}</h3>

      <label>Title</label>
      <input type="text" v-model="current.title" />

      <FrequencyPicker v-model="current.frequency" />

      <div class="note" style="margin-top:10px">
        <template v-if="FREQUENCY_PROFILES[current.frequency].record === 'required' && !current.record">
          <strong style="color:var(--rubric)">This tier requires a Record block</strong> and this
          template has none. Record / Omit / Embellish is the mechanical form of the thesis.
        </template>
        <template v-else-if="FREQUENCY_PROFILES[current.frequency].record === 'forbidden' && current.record">
          <strong style="color:var(--rubric)">Common events must not carry a Record block.</strong>
          The choice loses meaning if it is routine.
        </template>
        <template v-else>
          Record block: {{ current.record ? 'present' : 'none' }} ·
          rumour: {{ current.rumour ? current.rumour.id : 'none' }} ·
          accounts: {{ current.accounts.length }}
        </template>
      </div>

      <label>Purposes (exactly three)</label>
      <div>
        <span v-for="p in current.purposes" :key="p" class="chip">{{ p }}</span>
      </div>

      <label>
        Body
        <span style="text-transform:none;letter-spacing:0;color:var(--ink-faint);font-weight:400">
          — {{ prose.sentences }} sentences{{ prose.long ? ', held to the voice contract' : '' }}
        </span>
      </label>
      <textarea v-model="current.body" style="min-height:190px" />

      <div v-if="undefinedTokens.length" class="issue error">
        undefined slot{{ undefinedTokens.length > 1 ? 's' : '' }}: {{ undefinedTokenList }}
      </div>

      <div v-if="prose.long" style="margin-top:10px">
        <h3>Voice contract</h3>
        <p v-if="!prose.issues.length" class="note" style="margin-top:0">
          Clean. Past five sentences a body is prose, not a note — this one holds.
        </p>
        <div v-for="(i, n) in prose.issues" :key="n" class="issue warning">{{ i.message }}</div>
      </div>

      <label>Slots</label>
      <div>
        <span v-for="s in slotNames" :key="s" class="chip">
          {{ s }} · {{ current.slots[s]?.role }}
          <template v-if="current.slots[s]?.castBy === 'player'"> · player-cast</template>
        </span>
        <span v-if="!slotNames.length" style="color:var(--ink-faint);font-size:12px">none</span>
      </div>

      <label>Interaction</label>
      <div class="note" style="margin-top:0">
        <strong>{{ current.interaction.kind }}</strong> —
        <template v-if="current.interaction.kind === 'narration'">
          fires, tells, resolves. No player input, which is not the same as no consequence.
        </template>
        <template v-else-if="current.interaction.kind === 'choice'">
          {{ current.interaction.choices.length }} options.
        </template>
        <template v-else>
          a mission: the player casts the slots himself.
        </template>
      </div>

      <label>Age scope</label>
      <div>
        <span v-for="a in current.ages?.only ?? []" :key="a" class="chip">only in {{ a }}</span>
        <span v-for="a in current.ages?.never ?? []" :key="a" class="chip">never in {{ a }}</span>
        <span v-if="!current.ages" style="color:var(--ink-faint);font-size:12px">any Age</span>
      </div>

      <div style="margin-top:16px">
        <h3>Validation</h3>
        <p v-if="!myIssues.length" class="note" style="margin-top:0">No issues.</p>
        <div v-for="(i, n) in myIssues" :key="n" class="issue" :class="i.level">
          <code>{{ i.rule }}</code> {{ i.message }}
        </div>
      </div>
    </div>
  </div>
</template>
