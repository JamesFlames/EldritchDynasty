<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Content, Issue, EventTemplate, ClauseDef } from '@ed/schema';
import { PurposeS } from '@ed/schema';
import { TEST_FAMILIES, bootstrap, candidatesFor, decideBranch, resolveSlots, runYears, testRng, type SimCtx } from '@ed/core';
import { deciderKind } from '@ed/schema';

const props = defineProps<{ content: Content; issues: Issue[] }>();

type Section = 'families' | 'branches' | 'coverage' | 'firerate' | 'grammar' | 'clauses' | 'tales';
const section = ref<Section>('families');
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'families', label: 'Test families' },
  { id: 'branches', label: 'Branch trace' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'firerate', label: 'Fire rate' },
  { id: 'grammar', label: 'Pronoun preview' },
  { id: 'clauses', label: 'Clause board' },
  { id: 'tales', label: 'Tale pairs' },
];

/**
 * TEST FAMILIES (issue #22) — a live inspector over the same six fixtures
 * gate 2 (slot-fillability) casts against, so an author can see exactly what
 * "the Storybook House" IS rather than trusting the name.
 */
const activeFamily = ref(TEST_FAMILIES[0]!.id);
const familyCtx = computed<SimCtx>(() => {
  const fam = TEST_FAMILIES.find((f) => f.id === activeFamily.value) ?? TEST_FAMILIES[0]!;
  return fam.build(props.content);
});
const familyRoster = computed(() => {
  const w = familyCtx.value.world;
  return w.people
    .living()
    .map((p) => ({ id: p.id, name: p.name, sex: p.sex, age: w.year - p.born, castSlots: p.castSlots }))
    .sort((a, b) => b.age - a.age);
});
const familyGuardian = computed(() => familyCtx.value.world.people.guardian()?.name);

/**
 * COVERAGE REPORT — tiers, Ages and purposes are the three axes an event
 * actually declares (issue #22's "ascension rungs" is a narrative ladder,
 * not a content field — nothing here claims to measure it). Age coverage
 * follows `AgeScopeS`'s own doc comment: "the editor can report per-Age
 * coverage" was written as this field's justification.
 */
const TIERS = ['individual', 'head', 'family', 'record', 'frame'] as const;
const tierCoverage = computed(() => {
  const counts = new Map<string, number>(TIERS.map((t) => [t, 0]));
  for (const e of props.content.events) counts.set(e.tier, (counts.get(e.tier) ?? 0) + 1);
  return TIERS.map((t) => ({ tier: t, count: counts.get(t) ?? 0 }));
});

function eventAppliesToAge(e: EventTemplate, ageId: string): boolean {
  if (!e.ages) return true;
  if (e.ages.only && !e.ages.only.includes(ageId)) return false;
  if (e.ages.never?.includes(ageId)) return false;
  return true;
}
const AGE_FLOOR = 5;
const ageCoverage = computed(() =>
  props.content.ages
    .map((a) => ({ id: a.id, name: a.name, count: props.content.events.filter((e) => eventAppliesToAge(e, a.id)).length }))
    .sort((a, b) => a.count - b.count),
);

const PURPOSE_FLOOR = 8;
const purposeCoverage = computed(() =>
  PurposeS.options
    .map((p) => ({ purpose: p, count: props.content.events.filter((e) => e.purposes.includes(p)).length }))
    .sort((a, b) => a.count - b.count),
);

/**
 * FIRE-RATE SIMULATION — `gates.ts`'s gate 4, run interactively. The harness
 * runs it headlessly at 100 seeds x 1000 years; the editor runs it on demand,
 * at whatever the author is willing to wait for, which is the whole reason
 * this instrument needs to exist (the harness cannot open in a browser tab).
 */
const runs = ref(15);
const years = ref(300);
const running = ref(false);
const fireRates = ref<{ id: string; title: string; pct: number }[] | undefined>(undefined);

async function runFireRate() {
  running.value = true;
  fireRates.value = undefined;
  await new Promise((r) => setTimeout(r, 0)); // let "running…" paint before the block below
  const seenIn = new Map<string, number>();
  for (let i = 0; i < runs.value; i++) {
    const ctx = bootstrap(props.content, 9000 + i * 7, 1042);
    runYears(ctx, years.value);
    for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
      if (n > 0) seenIn.set(id, (seenIn.get(id) ?? 0) + 1);
    }
  }
  fireRates.value = props.content.events
    .filter((e) => e.tier !== 'frame')
    .map((e) => ({ id: e.id, title: e.title, pct: (100 * (seenIn.get(e.id) ?? 0)) / runs.value }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 20);
  running.value = false;
}

/**
 * PRONOUN AND GRAMMAR PREVIEW — the game has no pronoun-substitution layer
 * (`renderBody` fills `{SLOT}` with a name and stops there), so a slot whose
 * filters do not fix a sex can be cast either way, and prose that quietly
 * assumes one ("his beard") is a bug the schema cannot catch. This renders
 * every free slot both ways, side by side, so a human can.
 */
const MALE_NAMES = ['Aldric', 'Bregan', 'Cassian', 'Dorn', 'Emeric'];
const FEMALE_NAMES = ['Rowan', 'Sable', 'Tamsin', 'Ysolt', 'Maren'];
const TOKEN = /\{([A-Z_][A-Z0-9_]*)\}/g;

function fixedSexOf(spec: EventTemplate['slots'][string]): 'male' | 'female' | undefined {
  for (const f of spec.filters) if ('sex' in f) return f.sex;
  return undefined;
}
function renderWith(body: string, names: (i: number) => string, ids: string[]): string {
  return body.replace(TOKEN, (m, sid: string) => {
    const i = ids.indexOf(sid);
    return i < 0 ? m : names(i);
  });
}

const grammarFilter = ref('');
const grammarPreview = computed(() => {
  const q = grammarFilter.value.trim().toLowerCase();
  return props.content.events
    .filter((e) => Object.keys(e.slots).length > 0)
    .filter((e) => !q || e.id.includes(q) || e.title.toLowerCase().includes(q))
    .map((e) => {
      const ids = Object.keys(e.slots).sort();
      const free = ids.filter((sid) => fixedSexOf(e.slots[sid]!) === undefined);
      const maleFill = (i: number) => {
        const sid = ids[i]!;
        const fixed = fixedSexOf(e.slots[sid]!);
        return fixed === 'female' ? FEMALE_NAMES[i % FEMALE_NAMES.length]! : MALE_NAMES[i % MALE_NAMES.length]!;
      };
      const femaleFill = (i: number) => {
        const sid = ids[i]!;
        const fixed = fixedSexOf(e.slots[sid]!);
        return fixed === 'male' ? MALE_NAMES[i % MALE_NAMES.length]! : FEMALE_NAMES[i % FEMALE_NAMES.length]!;
      };
      return {
        id: e.id,
        title: e.title,
        freeCount: free.length,
        asMale: renderWith(e.body, maleFill, ids),
        asFemale: renderWith(e.body, femaleFill, ids),
      };
    })
    .filter((x) => x.freeCount > 0);
});

/**
 * BRANCH TRACE — the payoff of making the decider declarative.
 *
 * An event whose branch the family's condition takes, or whose branch a party
 * check takes, resolves without anybody being asked — which means an author
 * cannot see what it does by reading it. Before this, the only way to find out
 * was to run a century and hope the scene came up.
 *
 * So it is asked directly, against the same six fixtures gate 2 casts against.
 * `decideBranch` is the ENGINE's function, not a copy of it: what this panel
 * prints is what the year will do, including the sentence explaining why.
 */
const traced = computed(() => {
  const ctx = familyCtx.value;
  return props.content.events
    .filter((e) => e.interaction.kind !== 'narration' && deciderKind(e.interaction.decidedBy) !== 'player')
    .map((e) => {
      // Cast it the way the year would. A `party` decider needs its player-cast
      // slots filled before it will decide anything, so they are filled here
      // with whoever is standing — which is what "the player sent these three"
      // looks like to the check.
      const rng = testRng('branch-trace', e.id);
      const res = resolveSlots(e, ctx, rng);
      const fill = { ...res.fill };
      for (const slot of res.playerCast) {
        const spec = e.slots[slot];
        const who = spec ? candidatesFor(spec, ctx, fill)[0] : undefined;
        if (who) fill[slot] = who.id;
      }

      const kind = e.interaction.kind === 'narration' ? 'chance' : deciderKind(e.interaction.decidedBy);
      const decided = decideBranch(ctx, e, fill, rng, { castReady: true });
      return {
        id: e.id,
        title: e.title,
        kind,
        castable: res.ok,
        branch: decided.choice?.label ?? '—',
        branchId: decided.choice?.id ?? '',
        why: decided.why,
        cast: Object.entries(fill).map(([slot, id]) => `${slot}: ${ctx.world.people.get(id)?.name ?? '?'}`),
      };
    });
});

/**
 * CLAUSE BOARD — the nine clauses against the Age table. `clause/ages`
 * (schema validation) already requires at least two Ages per clause; this is
 * where an author SEES the gap rather than reading a CI failure about it.
 */
const clauseCells = computed(() =>
  props.content.clauses.map((c: ClauseDef) => ({
    clause: c,
    ages: props.content.ages.map((a) => c.ages.includes(a.id)),
    sparse: c.ages.length < 2,
  })),
);

/**
 * TALE PAIRS — every event with 2+ `accounts`, and whether `tales/accounts`
 * (schema rule, CI gate 8) is satisfied. That rule already ran as part of
 * `props.issues`; this just surfaces its verdict next to the accounts it is
 * about, which is the only human-facing enforcement point issue #14's nested
 * tale layer has.
 */
const talePairs = computed(() =>
  props.content.events
    .filter((e) => e.accounts.length >= 2)
    .map((e) => ({
      event: e,
      tales: e.accounts.map((id) => props.content.tale(id)).filter((t): t is NonNullable<typeof t> => t !== undefined),
      problems: props.issues.filter((i) => i.rule === 'tales/accounts' && i.where === `event:${e.id}`),
    })),
);
</script>

<template>
  <header>
    <h2>Instruments</h2>
    <p>The authoring instruments (issue #22) — the questions a person writing content actually asks.</p>
  </header>

  <div class="bar">
    <button v-for="s in SECTIONS" :key="s.id" class="btn" :class="{ primary: section === s.id }" @click="section = s.id">
      {{ s.label }}
    </button>
  </div>

  <!-- ── Branch trace ──────────────────────────────────────────────── -->
  <div v-if="section === 'branches'">
    <div class="bar">
      <button
        v-for="f in TEST_FAMILIES" :key="f.id" class="btn"
        :class="{ primary: activeFamily === f.id }" @click="activeFamily = f.id"
      >{{ f.name }}</button>
    </div>
    <p class="note">
      Every event whose branch is not the player's, resolved against this family right now, through
      the engine's own <code>decideBranch</code>. A ladder that always takes its first rung and one
      that never reaches it look identical in the YAML.
    </p>
    <div class="panel" style="margin-top:12px">
      <p v-if="!traced.length" class="note" style="margin-top:0">
        No event delegates its branch yet. <code>decidedBy</code> is <code>player</code> everywhere.
      </p>
      <table v-else class="attrs">
        <tbody>
        <tr v-for="t in traced" :key="t.id">
          <td class="k">
            {{ t.title }}<br />
            <span class="sub">{{ t.kind }} · {{ t.id }}</span>
          </td>
          <td class="v">
            <template v-if="!t.castable">
              <span style="color:var(--ink-faint)">cannot be cast in this house</span>
            </template>
            <template v-else>
              <strong>{{ t.branch }}</strong><br />
              <span class="sub">{{ t.why }}</span>
              <template v-if="t.cast.length"><br /><span class="sub">{{ t.cast.join(' · ') }}</span></template>
            </template>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Test families ─────────────────────────────────────────────── -->
  <div v-else-if="section === 'families'" class="cols wide">
    <div class="panel">
      <h3>Fixtures</h3>
      <div class="list">
        <button
          v-for="f in TEST_FAMILIES" :key="f.id" class="row" :class="{ on: activeFamily === f.id }"
          @click="activeFamily = f.id"
        >
          <span class="t">{{ f.name }}</span>
        </button>
      </div>
    </div>
    <div class="panel">
      <h3>{{ TEST_FAMILIES.find((f) => f.id === activeFamily)?.name }}</h3>
      <p class="note">{{ TEST_FAMILIES.find((f) => f.id === activeFamily)?.description }}</p>
      <div class="stats">
        <div class="stat"><div class="k">Living</div><div class="v">{{ familyRoster.length }}</div></div>
        <div class="stat"><div class="k">Treasury</div><div class="v">{{ familyCtx.world.treasury }}</div></div>
        <div class="stat"><div class="k">Respect</div><div class="v">{{ familyCtx.world.respect }}</div></div>
        <div class="stat"><div class="k">Clauses</div><div class="v">{{ familyCtx.world.clausesRecovered.size }}<small>/9</small></div></div>
        <div class="stat"><div class="k">Guardian</div><div class="v">{{ familyGuardian ?? '—' }}</div></div>
      </div>
      <label>Living roster</label>
      <table class="attrs">
        <tbody>
        <tr v-for="p in familyRoster" :key="p.id">
          <td class="k">{{ p.name }}</td>
          <td class="v">{{ p.sex }}, {{ p.age }}</td>
          <td>{{ p.castSlots.join(', ') }}</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Coverage report ───────────────────────────────────────────── -->
  <div v-else-if="section === 'coverage'" class="cols wide">
    <div class="panel">
      <h3>By tier</h3>
      <table class="attrs">
        <tbody>
        <tr v-for="t in tierCoverage" :key="t.tier">
          <td class="k">{{ t.tier }}</td>
          <td class="v">{{ t.count }}</td>
        </tr>
        </tbody>
      </table>
    </div>
    <div class="panel">
      <h3>By Age — under {{ AGE_FLOOR }} events flagged</h3>
      <table class="attrs">
        <tbody>
        <tr v-for="a in ageCoverage" :key="a.id">
          <td class="k">{{ a.name }}</td>
          <td class="v" :style="{ color: a.count < AGE_FLOOR ? 'var(--rubric)' : 'inherit' }">{{ a.count }}</td>
        </tr>
        </tbody>
      </table>
      <p class="note">
        Ascension-rung coverage (Touched/Adept/Hierophant/Vessel/Demigod/God) is not measured
        here — no event field names a rung, so a report on it would be inventing data rather
        than reading it.
      </p>
    </div>
    <div class="panel">
      <h3>By purpose — under {{ PURPOSE_FLOOR }} events flagged</h3>
      <table class="attrs">
        <tbody>
        <tr v-for="p in purposeCoverage" :key="p.purpose">
          <td class="k">{{ p.purpose }}</td>
          <td class="v" :style="{ color: p.count < PURPOSE_FLOOR ? 'var(--rubric)' : 'inherit' }">{{ p.count }}</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Fire rate ──────────────────────────────────────────────────── -->
  <div v-else-if="section === 'firerate'">
    <div class="bar">
      <label style="margin:0">Runs<input v-model.number="runs" type="number" min="1" max="60" style="width:70px" /></label>
      <label style="margin:0">Years<input v-model.number="years" type="number" min="10" max="1000" step="10" style="width:80px" /></label>
      <button class="btn primary" :disabled="running" @click="runFireRate">{{ running ? 'Running…' : 'Run' }}</button>
    </div>
    <p class="note">
      The harness gate runs 100 seeds x 1000 years headlessly; this runs whatever you set, in
      this tab, which is why the defaults are smaller. Frame-tier events are excluded — they
      run on a different clock (`reads`, not frequency).
    </p>
    <table v-if="fireRates" class="attrs">
      <tbody>
      <tr v-for="r in fireRates" :key="r.id">
        <td class="k">{{ r.title }}</td>
        <td class="v" :style="{ color: r.pct < 0.5 ? 'var(--rubric)' : 'inherit' }">{{ r.pct.toFixed(1) }}%</td>
      </tr>
      </tbody>
    </table>
  </div>

  <!-- ── Pronoun / grammar preview ─────────────────────────────────── -->
  <div v-else-if="section === 'grammar'">
    <input v-model="grammarFilter" type="text" placeholder="filter by id or title…" style="max-width:320px" />
    <p class="note">
      Every free (non-sex-filtered) slot rendered once with a male name, once with a female
      name. Fixed-sex slots keep the sex their filter requires in both columns.
    </p>
    <div v-for="g in grammarPreview" :key="g.id" class="panel" style="margin-bottom:12px">
      <h3>{{ g.title }} <span class="chip">{{ g.freeCount }} free slot{{ g.freeCount === 1 ? '' : 's' }}</span></h3>
      <div class="cols">
        <div><label>as male</label><p class="note">{{ g.asMale }}</p></div>
        <div><label>as female</label><p class="note">{{ g.asFemale }}</p></div>
      </div>
    </div>
  </div>

  <!-- ── Clause board ───────────────────────────────────────────────── -->
  <div v-else-if="section === 'clauses'">
    <p class="note">Red rows are assigned to fewer than two Ages — unreachable by some runs entirely, or (at zero) by any run.</p>
    <div style="overflow-x:auto">
      <table class="attrs" style="min-width:600px">
        <tbody>
        <tr>
          <td class="k"></td>
          <td v-for="a in content.ages" :key="a.id" class="k" style="white-space:nowrap">{{ a.name }}</td>
        </tr>
        <tr v-for="row in clauseCells" :key="row.clause.id" :style="{ color: row.sparse ? 'var(--rubric)' : 'inherit' }">
          <td>{{ row.clause.name }} <span v-if="row.clause.known" class="chip">known at start</span></td>
          <td v-for="(on, i) in row.ages" :key="i">{{ on ? '●' : '' }}</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Tale pairs ─────────────────────────────────────────────────── -->
  <div v-else-if="section === 'tales'">
    <p class="note">Every event whose `accounts` names two or more tales, and whether they actually contradict (rule `tales/accounts`).</p>
    <div v-for="tp in talePairs" :key="tp.event.id" class="panel" style="margin-bottom:12px">
      <h3>{{ tp.event.title }}</h3>
      <div v-if="tp.problems.length" class="issue error" v-for="p in tp.problems" :key="p.message">{{ p.message }}</div>
      <div v-else class="issue" style="color:var(--common)">accounts contradict pairwise</div>
      <table class="attrs">
        <tbody>
        <tr v-for="t in tp.tales" :key="t.id">
          <td class="k">{{ t.form }} — {{ t.teller }}</td>
          <td>{{ t.bias }}</td>
          <td class="v">{{ (t.accuracy * 100).toFixed(0) }}%</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
