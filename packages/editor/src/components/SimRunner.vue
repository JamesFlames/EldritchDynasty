<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import type { Content } from '@ed/schema';
import { FREQUENCY_PROFILES } from '@ed/schema';
import {
  bootstrap, stepYear, renameChild, clearNamingQueue, frequencyReport,
  resolveChoice, resolveRecord, resolveMatch, declineMatch, autoResolveAll, makeRng,
  branchReport, halls, branchOf,
  type SimCtx, type PendingChoice, type PendingRecord, type PendingMatch, type MatchCard,
  type RecordOption,
} from '@ed/core';
import { MAIN_BRANCH } from '@ed/schema';
import Sigil from './Sigil.vue';

const props = defineProps<{ content: Content }>();

const seed = ref(1042);
const ctx = shallowRef<SimCtx | null>(null);
const nameDrafts = ref<Record<string, string>>({});
const filter = ref<'all' | 'named'>('all');

/**
 * Who decides. `ask` is the game; `chronicler` is the harness, and it is also
 * what a player pressing "to 2042" is asking for. The two run the same code —
 * see core/events/decisions.ts — so this toggle changes who is holding the pen
 * and nothing else.
 */
const decider = ref<'ask' | 'chronicler'>('ask');
const castDrafts = ref<Record<string, string>>({});

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
  ctx.value = bootstrap(props.content, seed.value, 1042);
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
  const ask = decider.value === 'ask';

  for (let i = 0; i < n; i++) {
    stepYear(c, !ask);
    // The docket stops the clock. Long jumps hand the pen to the chronicler
    // instead — asking four hundred questions is not a fast-forward.
    if (c.world.pendingDecisions.length) {
      if (pauses) break;
      autoResolveAll(c, makeRng(c.world.seed + c.world.year));
    }
    if (pauses && c.world.pendingNames.length >= 3) break;
  }
  if (!pauses) clearNamingQueue(c);
  bump();
}

// ── The docket ───────────────────────────────────────────────────────────
const decision = computed(() => {
  void version.value;
  return ctx.value?.world.pendingDecisions[0] ?? null;
});

function answer(choiceId: string) {
  const c = ctx.value;
  const d = decision.value;
  if (!c || !d || d.kind !== 'choice') return;
  resolveChoice(c, d.id, choiceId, makeRng(c.world.seed + c.world.year), { ...castDrafts.value });
  castDrafts.value = {};
  bump();
}

function write(option: RecordOption) {
  const c = ctx.value;
  const d = decision.value;
  if (!c || !d || d.kind !== 'record') return;
  resolveRecord(c, d.id, option);
  bump();
}

function letHimDecide() {
  const c = ctx.value;
  if (!c) return;
  autoResolveAll(c, makeRng(c.world.seed + c.world.year));
  bump();
}

const asChoice = computed(() => (decision.value?.kind === 'choice' ? decision.value as PendingChoice : null));
const asRecord = computed(() => (decision.value?.kind === 'record' ? decision.value as PendingRecord : null));
const asMatch = computed(() => (decision.value?.kind === 'match' ? decision.value as PendingMatch : null));

/** Take a card. The suitor a card promises is the suitor who arrives. */
function takeMatch(cardId: string) {
  const c = ctx.value;
  const d = asMatch.value;
  if (!c || !d) return;
  resolveMatch(c, d.id, cardId);
  bump();
}

function declineHand() {
  const c = ctx.value;
  const d = asMatch.value;
  if (!c || !d) return;
  declineMatch(c, d.id);
  bump();
}

/**
 * What the documents claim about how close these two are. The player is
 * reading a number he is meant to be suspicious of — a bought grandmother
 * makes a first cousin read as a stranger — so it is worded, not printed.
 */
function kinshipOf(card: MatchCard): string {
  if (card.kinship >= 0.2) return 'the same blood, near enough to be a scandal';
  if (card.kinship >= 0.1) return 'close kin on paper';
  if (card.kinship >= 0.045) return 'first cousins, by the documents';
  if (card.kinship > 0) return 'kin, distantly, if the papers are honest';
  return 'no relation the papers admit to';
}

const RECORD_BLURB: Record<RecordOption, string> = {
  record: 'Write it as it happened.',
  omit: 'Leave the line blank. Everyone will notice the blank.',
  embellish: 'Write it better. Somebody, one day, may be able to prove otherwise.',
};

// ── The halls ────────────────────────────────────────────────────────────
const branchHalls = computed(() => {
  void version.value;
  const c = ctx.value;
  if (!c) return [];
  const populated = halls(c.world, c.world.year);
  const rows = [{
    id: MAIN_BRANCH,
    name: 'The main house',
    members: (populated.get(MAIN_BRANCH) ?? []).length,
    grievance: 0,
    founded: 1042,
    main: true,
  }];
  for (const b of branchReport(c)) {
    if (b.extinct !== undefined) continue;
    rows.push({ id: b.id, name: b.name, members: b.members, grievance: b.grievance, founded: b.founded, main: false });
  }
  return rows;
});

const liveGrudges = computed(() => {
  void version.value;
  const w = ctx.value?.world;
  if (!w) return 0;
  return [...w.relationships.values()].reduce((a, r) => a + r.grudges.length, 0);
});

const branchesGone = computed(() => {
  void version.value;
  return ctx.value ? branchReport(ctx.value).filter((b) => b.extinct !== undefined).length : 0;
});

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
    const def = props.content.age(a.age);
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
    .map((p) => ({ p, hall: branchOf(c.world, p, c.world.year) }))
    .sort((a, b) => a.p.born - b.p.born);
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
      <button class="btn" @click="decider = decider === 'ask' ? 'chronicler' : 'ask'">
        {{ decider === 'ask' ? 'You decide' : 'The chronicler decides' }}
      </button>
      <span style="color:var(--ink-faint);font-size:13px">year {{ w?.year }} · generation {{ w?.generation }}</span>
    </template>
  </div>

  <p v-if="!ctx" class="note">Nothing is running. Press begin.</p>

  <template v-else>
    <!-- ── The docket ───────────────────────────────────────────────── -->
    <div v-if="asChoice" class="docket">
      <span class="ask">{{ asChoice.year }} · {{ asChoice.event.title }}</span>
      <p class="scene">{{ asChoice.body }}</p>

      <div v-for="req in asChoice.cast" :key="req.slot" class="cast">
        <label>{{ req.slot }}</label>
        <select v-model="castDrafts[req.slot]">
          <option value="">nobody</option>
          <option v-for="c in req.candidates" :key="c.id" :value="c.id">{{ c.name }}, {{ c.age }}</option>
        </select>
      </div>

      <button
        v-for="c in asChoice.choices" :key="c.id"
        class="choice" :disabled="!c.available" @click="answer(c.id)"
      >
        {{ c.label }}
        <span v-if="!c.available" class="why">closed to you — {{ c.blockedBy }}</span>
      </button>
      <button class="btn" style="margin-top:6px" @click="letHimDecide">Let the chronicler decide</button>
    </div>

    <!-- ── The Match: three cards, one marriage (concept §5) ────────── -->
    <div v-else-if="asMatch" class="docket">
      <span class="ask">{{ asMatch.year }} · the match</span>
      <p class="scene">
        A marriage for <strong>{{ asMatch.subject.name }}</strong>, {{ asMatch.subject.age }}.
        {{ asMatch.subject.sex === 'female'
          ? 'These men would take the name and live under this roof.'
          : 'These women would come here, and their sons would be of this house.' }}
        What any of them carries is not on the table and cannot be — you are reading houses,
        papers and prices.
      </p>

      <div class="cards">
        <button
          v-for="card in asMatch.cards" :key="card.id"
          class="card" :disabled="!card.available" @click="takeMatch(card.id)"
        >
          <span class="who">{{ card.name }}</span>
          <span class="line">{{ card.age }} · {{ card.houseName }}</span>
          <span class="blurb">{{ card.blurb }}</span>
          <span class="terms">
            {{ card.dowry ? card.dowry + ' crowns' : 'no dowry' }} · {{ kinshipOf(card) }}
          </span>
          <span v-if="!card.available" class="why">closed to you — {{ card.blockedBy }}</span>
        </button>
      </div>

      <button class="btn" style="margin-top:10px" @click="declineHand">
        Take none of them. The house can wait three years.
      </button>
      <button class="btn" style="margin-top:6px" @click="letHimDecide">Let the chronicler decide</button>
    </div>

    <div v-else-if="asRecord" class="docket">
      <span class="ask">{{ asRecord.year }} · the record</span>
      <p class="scene">
        What the book says about <em>{{ asRecord.subject }}</em>. There is one line about it, and this is it.
      </p>
      <button v-for="o in asRecord.options" :key="o.option" class="choice" @click="write(o.option)">
        {{ o.option }} — {{ RECORD_BLURB[o.option] }}
        <span class="why">{{ o.chronicle ?? 'a dated blank line' }}</span>
      </button>
    </div>
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
      <div class="stat">
        <div class="k">Clauses</div>
        <div class="v">{{ w?.clausesRecovered.size }}<small>/{{ props.content.clauses.length }}</small></div>
      </div>
      <div class="stat"><div class="k">Grudges</div><div class="v">{{ liveGrudges }}</div></div>
      <div class="stat"><div class="k">Rumours</div><div class="v">{{ w?.rumours.size }}</div></div>
      <div class="stat"><div class="k">Discrepancies</div><div class="v">{{ w?.discrepancies.size }}</div></div>
      <div class="stat"><div class="k">Discontent</div><div class="v">{{ Math.round(w?.discontent ?? 0) }}</div></div>
    </div>

    <div class="cols wide">
      <div>
        <div class="panel" style="margin-bottom:12px">
          <h3>Frequency ledger</h3>
          <table class="attrs">
            <tbody>
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
            </tbody>
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

        <div class="panel" style="margin-bottom:12px">
          <h3>The halls</h3>
          <p v-if="branchHalls.length < 2" class="note" style="margin:0 0 8px">
            One roof, so far. Younger sons found their own the year a brother takes the seal.
          </p>
          <div class="halls">
            <div
              v-for="h in branchHalls" :key="h.id"
              class="hall" :class="{ sore: h.grievance >= 55 }"
            >
              <span class="n">{{ h.name }}</span>
              <span class="g">{{ h.members }} living</span>
              <span v-if="!h.main" class="g">· grievance {{ h.grievance }}</span>
            </div>
          </div>
          <p v-if="branchesGone" class="note" style="margin-bottom:0">
            {{ branchesGone }} branch{{ branchesGone > 1 ? 'es have' : ' has' }} ended.
          </p>
        </div>

        <div class="panel">
          <h3>The household</h3>
          <div class="list" style="max-height:340px">
            <div v-for="{ p, hall } in household" :key="String(p.id)" class="row" style="cursor:default">
              <Sigil :seed="p.sigilSeed" :size="22" :sex="p.sex" :status="p.status" :madness="p.madness" />
              <span class="t">{{ p.name }}</span>
              <span class="sub" v-if="hall !== MAIN_BRANCH">cadet</span>
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
          <div v-for="(e, i) in entries" :key="i" class="entry" :class="[e.weight, { greyed: e.greyed }]">
            <span class="yr">{{ e.year }}</span>
            <div class="body">
              <span v-if="e.title" class="ttl">{{ e.title }}</span>
              <template v-if="e.text">{{ e.text }}</template>
              <!-- An omitted entry prints as a dated blank. The blank is designed. -->
              <span v-else class="blank" />
              <span v-if="e.record === 'embellish'" class="stamp">as written</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
