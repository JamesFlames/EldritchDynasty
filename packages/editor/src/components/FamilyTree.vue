<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import type { Content } from '@ed/schema';
import { bootstrap, runYears, familySnapshot, type FamilyMember } from '@ed/core';
import Sigil from './Sigil.vue';

const props = defineProps<{ content: Content }>();

const seed = ref(1042);
const years = ref(240);
const showOutsiders = ref(false);
const selected = ref<string | null>(null);
const people = shallowRef<FamilyMember[]>([]);
const built = ref(false);

/**
 * The tree is the primary UI, the save file and the scoreboard. It grows
 * sideways across a thousand years, dark where lines end and hot where blood
 * concentrates. There is no world map and no combat screen.
 */
function build() {
  const ctx = bootstrap(props.content, seed.value, 1042);
  runYears(ctx, years.value);
  people.value = familySnapshot(ctx);
  built.value = true;
  selected.value = null;
}

const COL = 62;
const ROW = 104;

const visible = computed(() =>
  people.value.filter((p) => showOutsiders.value || p.house === 'house_gearithy' || p.castSlots.length));

interface Node extends FamilyMember { x: number; y: number }

/**
 * Layout: rows by pedigree depth, then children pulled toward the mean of
 * their parents so sibling groups sit together and lines stop crossing. Two
 * relaxation passes is enough to be readable and cheap enough to redo live.
 */
const layout = computed<{ nodes: Node[]; links: { x1: number; y1: number; x2: number; y2: number; hot: boolean }[]; width: number; height: number }>(() => {
  const byId = new Map(visible.value.map((p) => [p.id, p]));
  const gens = new Map<number, FamilyMember[]>();
  for (const p of visible.value) {
    const g = p.generation;
    gens.set(g, [...(gens.get(g) ?? []), p]);
  }

  const pos = new Map<string, number>();
  const ordered = [...gens.keys()].sort((a, b) => a - b);

  for (const g of ordered) {
    const row = gens.get(g)!.sort((a, b) => a.born - b.born);
    row.forEach((p, i) => pos.set(p.id, i * COL));
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const g of ordered) {
      const row = gens.get(g)!;
      const wanted = row.map((p) => {
        const parents = [p.mother, p.father].filter((x) => !!x && byId.has(x)) as string[];
        if (!parents.length) return pos.get(p.id)!;
        return parents.reduce((a, id) => a + (pos.get(id) ?? 0), 0) / parents.length;
      });
      const order = row.map((p, i) => ({ p, want: wanted[i]! })).sort((a, b) => a.want - b.want);
      let cursor = -Infinity;
      for (const { p, want } of order) {
        const x = Math.max(want, cursor + COL);
        pos.set(p.id, x);
        cursor = x;
      }
    }
  }

  const minX = Math.min(0, ...[...pos.values()]);
  const nodes: Node[] = visible.value.map((p) => ({
    ...p,
    x: pos.get(p.id)! - minX + 34,
    y: p.generation * ROW + 40,
  }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const links: { x1: number; y1: number; x2: number; y2: number; hot: boolean }[] = [];
  for (const n of nodes) {
    for (const parentId of [n.mother, n.father]) {
      const parent = parentId ? nodeById.get(parentId) : undefined;
      if (!parent) continue;
      links.push({
        x1: parent.x, y1: parent.y + 20, x2: n.x, y2: n.y - 20,
        // Hot where blood concentrates: the maternal line is the one that carries.
        hot: parentId === n.mother && n.eldritch.carriedFont > 12,
      });
    }
  }

  return {
    nodes,
    links,
    width: Math.max(720, ...nodes.map((n) => n.x + 60)),
    height: Math.max(300, ...nodes.map((n) => n.y + 70)),
  };
});

const chosen = computed(() => layout.value.nodes.find((n) => n.id === selected.value));
const counts = computed(() => {
  const p = people.value;
  return {
    total: p.length,
    living: p.filter((x) => x.status === 'alive').length,
    expressing: p.filter((x) => x.eldritch.canExpress).length,
    carriers: p.filter((x) => x.sex === 'female' && x.eldritch.carriedFont > 0).length,
    generations: p.length ? Math.max(...p.map((x) => x.generation)) + 1 : 0,
  };
});
</script>

<template>
  <header>
    <h2>The family tree</h2>
    <p>
      The tree is the primary UI, the save file and the scoreboard. Dark where lines end,
      hot where blood concentrates. Sigils are procedural and inherited — line weight is
      Strength, flourish is Charm, spidery asymmetry is Madness.
    </p>
  </header>

  <div class="bar">
    <label style="margin:0">Seed</label>
    <input type="number" v-model.number="seed" style="width:90px" />
    <label style="margin:0">Years</label>
    <input type="number" v-model.number="years" step="20" style="width:80px" />
    <button class="btn primary" @click="build">{{ built ? 'Re-run' : 'Grow the tree' }}</button>
    <label style="margin:0;display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0">
      <input type="checkbox" v-model="showOutsiders" style="width:auto" /> show outsiders
    </label>
  </div>

  <div v-if="!built" class="panel">
    <p class="note">Run the simulation to grow a pedigree. Everything below is drawn from real genomes — nothing here is decorative.</p>
  </div>

  <template v-else>
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><div class="k">People</div><div class="v">{{ counts.total }}</div></div>
      <div class="stat"><div class="k">Living</div><div class="v">{{ counts.living }}</div></div>
      <div class="stat"><div class="k">Generations</div><div class="v">{{ counts.generations }}</div></div>
      <div class="stat"><div class="k">Expressing</div><div class="v">{{ counts.expressing }}</div></div>
      <div class="stat"><div class="k">Carriers</div><div class="v">{{ counts.carriers }}<small> ♀</small></div></div>
    </div>

    <div class="cols wide" style="align-items:start">
      <div class="panel" style="order:2">
        <h3>{{ chosen ? 'The record' : 'Select a sigil' }}</h3>
        <template v-if="chosen">
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
            <Sigil
              :seed="chosen.sigilSeed" :size="54" :sex="chosen.sex" :status="chosen.status"
              :strength="chosen.attrs.strength" :charm="chosen.attrs.charm"
              :madness="chosen.madness" :expressing="chosen.eldritch.canExpress"
            />
            <div>
              <div style="font-size:17px">{{ chosen.name }}</div>
              <div class="sub" style="color:var(--ink-faint);font-size:12px">
                {{ chosen.sex === 'female' ? 'daughter' : 'son' }} ·
                {{ chosen.born }}–{{ chosen.died ?? '' }} ·
                {{ chosen.status }}
              </div>
            </div>
          </div>

          <div class="note" v-if="chosen.status === 'guardian'">
            He did not die. Death was redirected — he is the guardian spirit of the house
            and has been making its decisions ever since.
          </div>

          <table class="attrs">
            <tr><td class="k">Carried font</td><td class="v">{{ chosen.eldritch.carriedFont.toFixed(1) }} <small style="color:var(--ink-faint)">hidden from the player</small></td></tr>
            <tr><td class="k">Expresses</td><td class="v">{{ chosen.eldritch.canExpress ? 'yes' : 'no' }}</td></tr>
            <tr><td class="k">Eldritch Power</td><td class="v">{{ chosen.eldritch.expressedPower.toFixed(1) }}</td></tr>
            <tr><td class="k">Madness</td><td class="v">{{ chosen.madness.toFixed(1) }}</td></tr>
            <tr><td class="k">Awakened</td><td class="v">{{ chosen.awakened ? 'yes' : 'no' }}</td></tr>
            <tr v-for="(v, k) in chosen.attrs" :key="k">
              <td class="k">{{ k }}</td>
              <td class="v">
                {{ Math.round(v) }}
                <div class="meter"><i :class="{ hot: v > 60 }" :style="{ width: Math.min(100, v) + '%' }" /></div>
              </td>
            </tr>
          </table>
        </template>
        <p v-else class="note">Click any sigil in the tree.</p>
      </div>

      <div class="tree" style="order:1">
        <svg :width="layout.width" :height="layout.height">
          <g>
            <line
              v-for="(l, i) in layout.links" :key="i"
              :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2"
              :stroke="l.hot ? 'var(--rubric)' : 'var(--rule)'"
              :stroke-width="l.hot ? 1.6 : 1"
              :opacity="l.hot ? 0.85 : 0.6"
            />
          </g>
          <g v-for="n in layout.nodes" :key="n.id"
             :transform="`translate(${n.x - 17}, ${n.y - 17})`"
             style="cursor:pointer" @click="selected = n.id">
            <rect
              v-if="selected === n.id" x="-5" y="-5" width="44" height="44"
              rx="4" fill="none" stroke="var(--rubric)" stroke-width="1.5"
            />
            <Sigil
              :seed="n.sigilSeed" :size="34" :sex="n.sex" :status="n.status"
              :strength="n.attrs.strength" :charm="n.attrs.charm"
              :madness="n.madness" :expressing="n.eldritch.canExpress"
            />
            <text x="17" y="48" text-anchor="middle" font-size="9"
                  :fill="n.status === 'alive' ? 'var(--ink-soft)' : 'var(--ink-faint)'">
              {{ n.name.split(' ')[0] }}
            </text>
          </g>
        </svg>
      </div>
    </div>
  </template>
</template>
