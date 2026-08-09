<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import type { ContentBundle } from '@ed/schema';
import { FREQUENCY_PROFILES } from '@ed/schema';
import { bootstrap, stepYear, renameChild, clearNamingQueue, frequencyReport, type SimCtx } from '@ed/core';
import Sigil from './Sigil.vue';

const props = defineProps<{ bundle: ContentBundle }>();

const seed = ref(1042);
const ctx = shallowRef<SimCtx | null>(null);
const nameDrafts = ref<Record<string, string>>({});
const filter = ref<'all' | 'named'>('all');

/**
 * The world is one long-lived mutable object, so `triggerRef` alone is not
 * enough: an intermediate computed that returns `ctx.value.world` produces the
 * SAME reference every time, and Vue short-circuits there — every computed
 * downstream of it silently stops updating while its siblings keep working.
 *
 * An explicit version counter is the honest fix. Every computed that reads
 * simulation state touches `version` first, so nothing depends on reference
 * identity that will never change.
 */
const version = ref(0);
const bump = () => { version.value += 1; };

function start() {
  ctx.value = bootstrap(props.bundle, seed.value, 1042);
  nameDrafts.value = {};
  bump();
}

/**
 * Run forward. The naming queue is drained by the player, not by the clock —
 * so the run stops advancing while children are waiting to be named. Naming is
 * one of the few things the player does to an individual rather than to the
 * bloodline, and it should be able to interrupt a thousand years.
 */
/**
 * Deliberate steps stop for the naming queue; long jumps do not.
 *
 * A fast-forward that halts every third birth never reaches 2042 — pressing it
 * twelve times got a run to 1058. When the player asks for four centuries they
 * are asking the chronicler to keep the register, which is the design's own
 * fallback: the names stand, they simply are not yours.
 */
const PAUSE_FOR_NAMING_UP_TO = 25;

function advance(n: number) {
  const c = ctx.value;
  if (!c) return;
  const pauses = n <= PAUSE_FOR_NAMING_UP_TO;

  for (let i = 0; i < n; i++) {
    stepYear(c);
    if (pauses && c.world.pendingNames.length >= 3) break;
  }
  if (!pauses) clearNamingQueue(c);
  bump();
}

function commitName(personId: string) {
  const c = ctx.value;
  if (!c) return;
  const draft = (nameDrafts.value[personId] ?? '').trim();
  if (draft) renameChild(c, personId, draft);
  else c.world.pendingNames = c.world.pendingNames.filter((p) => p.person !== personId);
  delete nameDrafts.value[personId];
  bump();
}

function keepAll() {
  if (!ctx.value) return;
  clearNamingQueue(ctx.value);
  bump();
}

const w = computed(() => { void version.value; return ctx.value?.world ?? null; });

const pending = computed(() => {
  void version.value;
  const c = ctx.value;
  if (!c) return [];
  return c.world.pendingNames.map((n) => {
    const p = c.world.people.get(n.person);
    const mother = p?.trueParents.mother ? c.world.people.get(p.trueParents.mother) : undefined;
    const father = p?.trueParents.father ? c.world.people.get(p.trueParents.father) : undefined;
    return { ...n, person: n.person, sigilSeed: p?.sigilSeed ?? 0, mother: mother?.name, father: father?.name };
  });
});

const entries = computed(() => {
  void version.value;
  const all = w.value?.chronicle ?? [];
  const shown = filter.value === 'named' ? all.filter((e) => e.named) : all;
  return shown.slice(-140);
});

const freq = computed(() => (void version.value, ctx.value ? frequencyReport(ctx.value) : null));
const activeAges = computed(() =>
  (w.value?.age.active ?? []).map((a) => {
    const def = props.bundle.ages.find((d) => d.id === a.age);
    return {
      id: a.age,
      // Ages are named late: the player feels two decades of effects first.
      label: a.named ? (def?.name ?? a.age) : 'something is happening',
      years: (w.value?.year ?? 0) - a.began,
      named: a.named,
    };
  }));

const household = computed(() => {
  void version.value;
  const c = ctx.value;
  if (!c) return [];
  return c.world.people.household(c.world.playerHouse, c.world.year)
    .sort((a, b) => a.born - b.born);
});
</script>

<template>
  <header>
    <h2>Simulate</h2>
    <p>
      A thousand years, one bloodline. Frequency is not a weight synonym here — watch how
      differently the chronicle renders a common event and a mythic one.
    </p>
  </header>

  <div class="bar">
    <label style="margin:0">Seed</label>
    <input type="number" v-model.number="seed" style="width:90px" />
    <button class="btn primary" @click="start">{{ ctx ? 'Restart' : 'Begin, 1042' }}</button>
    <template v-if="ctx">
      <button class="btn" @click="advance(1)">+1 year</button>
      <button class="btn" @click="advance(25)">+25</button>
      <button class="btn" @click="advance(100)">+100</button>
      <button class="btn" @click="advance(1000)">to 2042</button>
      <span style="color:var(--ink-faint);font-size:13px">year {{ w?.year }} · generation {{ w?.generation }}</span>
    </template>
  </div>

  <p v-if="!ctx" class="note">Nothing is running. Press begin.</p>

  <template v-else>
    <!-- ── Naming ───────────────────────────────────────────────────── -->
    <div v-if="pending.length" class="panel" style="border-color:var(--rubric);margin-bottom:16px">
      <h3 style="color:var(--rubric)">
        {{ pending.length }} child{{ pending.length > 1 ? 'ren' : '' }} born to the house
      </h3>
      <p class="note" style="margin-top:0">
        The chronicler has written a name already. You may leave it, and many houses do.
      </p>
      <div v-for="b in pending" :key="b.person"
           style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <Sigil :seed="b.sigilSeed" :size="30" :sex="b.sex as 'male' | 'female'" />
        <div style="flex:1;min-width:0">
          <input
            type="text"
            :placeholder="b.suggested"
            v-model="nameDrafts[b.person]"
            @keyup.enter="commitName(b.person)"
          />
          <div style="font-size:11px;color:var(--ink-faint);margin-top:3px">
            born {{ b.born }} · {{ b.sex === 'female' ? 'a daughter' : 'a son' }}
            <template v-if="b.mother"> of {{ b.mother }}<template v-if="b.father"> and {{ b.father }}</template></template>
          </div>
        </div>
        <button class="btn primary" @click="commitName(b.person)">Name</button>
      </div>
      <button class="btn" @click="keepAll">Keep the chronicler's names</button>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><div class="k">Household</div><div class="v">{{ household.length }}</div></div>
      <div class="stat"><div class="k">Ever lived</div><div class="v">{{ w?.people.size }}</div></div>
      <div class="stat"><div class="k">Respect</div><div class="v" style="font-size:15px">{{ w?.respect }}</div></div>
      <div class="stat"><div class="k">Treasury</div><div class="v">{{ Math.round(w?.treasury ?? 0) }}<small> cr</small></div></div>
      <div class="stat"><div class="k">Clauses</div><div class="v">{{ w?.clausesRecovered.size }}<small>/9</small></div></div>
      <div class="stat"><div class="k">Rumours</div><div class="v">{{ w?.rumours.size }}</div></div>
      <div class="stat"><div class="k">Discrepancies</div><div class="v">{{ w?.discrepancies.size }}</div></div>
    </div>

    <div class="cols wide">
      <div>
        <div class="panel" style="margin-bottom:12px">
          <h3>Frequency ledger</h3>
          <table class="attrs">
            <tr v-for="(v, k) in freq" :key="k">
              <td class="k">
                <span class="badge" :class="k">{{ k }}</span>
              </td>
              <td class="v">
                {{ v.fired }} fired
                <span style="color:var(--ink-faint);font-size:11px">
                  / {{ v.pool }} authored
                  <template v-if="FREQUENCY_PROFILES[k].perRunCap">· cap {{ FREQUENCY_PROFILES[k].perRunCap }}</template>
                  <template v-if="v.barred"> · <span style="color:var(--rubric)">cooling</span></template>
                </span>
              </td>
            </tr>
          </table>
        </div>

        <div class="panel" style="margin-bottom:12px">
          <h3>The Age</h3>
          <p v-if="!activeAges.length" class="note" style="margin:0">
            Nothing in particular. A world between things is allowed.
          </p>
          <div v-for="a in activeAges" :key="a.id" style="margin-bottom:8px">
            <div :style="{ fontSize: '14px', color: a.named ? 'var(--ink)' : 'var(--ink-soft)' }">
              {{ a.label }}
            </div>
            <div style="font-size:11px;color:var(--ink-faint)">
              {{ a.years }} years in{{ a.named ? '' : ' · unnamed' }}
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>The household</h3>
          <div class="list" style="max-height:340px">
            <div v-for="p in household" :key="String(p.id)" class="row" style="cursor:default">
              <Sigil :seed="p.sigilSeed" :size="22" :sex="p.sex" :status="p.status" :madness="p.madness" />
              <span class="t">{{ p.name }}</span>
              <span class="sub">{{ (w?.year ?? 0) - p.born }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="bar" style="margin-bottom:10px">
          <h3 style="margin:0;flex:1">The chronicle</h3>
          <button class="btn" @click="filter = filter === 'all' ? 'named' : 'all'">
            {{ filter === 'all' ? 'Named entries only' : 'Everything' }}
          </button>
        </div>

        <div class="chronicle">
          <div v-for="(e, i) in entries" :key="i" class="entry" :class="e.weight">
            <span class="yr">{{ e.year }}</span>
            <div class="body">
              <span v-if="e.title" class="ttl">{{ e.title }}</span>
              <template v-if="e.text">{{ e.text }}</template>
              <!-- An omitted entry prints as a dated blank. The blank is designed. -->
              <span v-else class="blank" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
