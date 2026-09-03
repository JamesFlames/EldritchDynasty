<script setup lang="ts">
import { ref } from 'vue';
import type { SessionView, TableView } from '@ed/core';
import type { GameActions } from '../lib/game';

const props = defineProps<{
  view: SessionView;
  table: TableView;
  actions: GameActions;
  refused: string | null;
  /** What the last order cost, where it cost anything (issue #59). */
  receipt: string | null;
}>();

/**
 * THE TABLE — the half of the game that is not answering a prompt.
 *
 * Everything else the player does answers the docket. These are standing
 * orders: the player says what the house is to do with its people and its
 * money, the year phases carry it out, and the order stands until it is
 * finished or withdrawn. §13's headline tension lives here — tutor the child
 * you have, or buy the book his grandchildren might read; you can afford one —
 * and it only exists if both are on the same screen with one treasury above
 * them.
 */
const ceiling = ref(props.table.bidCeiling);

const pupil = ref('');
const subject = ref('');

/** Who the player is about to put in each post, keyed by the post. */
const placing = ref<Record<string, string>>({});

/** What the player is about to advance against each servant's years. */
const advancing = ref<Record<string, number>>({});

/** The standing order on marriage, in the house's own words. */
const MARRIAGE_ORDERS = [
  { policy: 'in' as const, label: 'Keep it in the family' },
  { policy: 'out' as const, label: 'Marry outward' },
  { policy: 'as_it_falls' as const, label: 'As it falls' },
];

</script>

<template>
  <section class="table stack">
    <div class="panel">
      <h3 class="label">The purse</h3>
      <p class="small">
        {{ table.treasury }} crowns. A term of tutoring is {{ table.tutorFee }};
        the house will bid up to {{ table.bidCeiling }} at the next auction.
      </p>
      <div class="row">
        <input type="number" min="0" v-model.number="ceiling" />
        <button @click="actions.order({ kind: 'bid', ceiling })">Set the ceiling</button>
      </div>
      <p v-if="refused" class="small rubric">{{ refused }}</p>
      <!-- THE RECEIPT (issue #59). §13 means these to hurt — the money is gone
           the day it is spent and the auction is in eleven years — and a spend
           the player cannot feel landing does not hurt, it only makes the
           number smaller for reasons they reconstruct later, wrongly. It sits
           where the refusal sits, because they answer the same question. -->
      <p v-else-if="receipt" class="small spent">{{ receipt }}</p>
    </div>

    <!-- THE LIBRARY. Books are the ladder: Adept wants three, Hierophant
         eight. Nobody reads one unless somebody is put on it. -->
    <div class="panel">
      <h3 class="label">The shelf</h3>
      <p v-if="!table.shelf.length" class="small dim">The house holds no book anybody can read.</p>
      <div v-for="book in table.shelf" :key="book.book" class="line">
        <div class="small"><strong>{{ book.name }}</strong> <span class="dim">· {{ book.years }} years</span></div>
        <div class="wrap">
          <button
            v-for="reader in book.readers"
            :key="reader.person"
            class="small"
            @click="actions.order({ kind: 'study', person: reader.person, book: book.book })"
          >
            put {{ reader.name }} on it
          </button>
          <span v-if="!book.readers.length" class="small dim">nobody in the house can take it up</span>
        </div>
      </div>
      <div v-if="table.studying.length" class="small dim reading">
        reading now: {{ table.studying.map((s) => s.name + ' until ' + s.completes).join(', ') }}
      </div>
    </div>

    <!-- §13's price table. The money is gone the day it is spent, and the
         auction is in eleven years. -->
    <div class="panel">
      <h3 class="label">A term of tutoring</h3>
      <div class="row">
        <select v-model="pupil">
          <option value="">— which child —</option>
          <option v-for="p in table.pupils" :key="p.person" :value="p.person">{{ p.name }}, {{ p.age }}</option>
        </select>
        <select v-model="subject">
          <option value="">— in what —</option>
          <option v-for="t in view.attributes" :key="t.attr" :value="t.attr">{{ t.name }}</option>
        </select>
        <button
          :disabled="!pupil || !subject || !table.canTutor"
          @click="actions.order({ kind: 'tutor', person: pupil, attr: subject })"
        >
          Pay the {{ table.tutorFee }}
        </button>
      </div>
      <p v-if="!table.canTutor" class="small dim">The house cannot raise it.</p>
      <div v-if="table.tutoring.length" class="small dim">
        in a term: {{ table.tutoring.map((t) => t.name + ' until ' + t.completes).join(', ') }}
      </div>
    </div>

    <!-- Respect is bought with descendants. A commission is bought with money. -->
    <div class="panel">
      <h3 class="label">Places</h3>
      <div v-for="post in table.posts" :key="post.career" class="line">
        <div class="small">
          <strong>{{ post.name }}</strong>
          <span class="dim"> · {{ post.fee }} crowns · standing {{ post.respectYield }}</span>
        </div>
        <div v-if="post.blurb" class="small dim blurb">{{ post.blurb }}</div>
        <div v-if="post.holders.length" class="small dim">
          held by {{ post.holders.map((h) => h.name).join(', ') }}
        </div>
        <div class="row">
          <select v-model="placing[post.career]">
            <option value="">— place whom —</option>
            <option v-for="e in post.eligible" :key="e.person" :value="e.person">{{ e.name }}, {{ e.age }}</option>
          </select>
          <button
            :disabled="!post.canPay || !placing[post.career]"
            @click="actions.order({ kind: 'career', person: placing[post.career] ?? '', career: post.career })"
          >
            Buy it
          </button>
        </div>
      </div>
    </div>

    <!-- ISSUE #41. The Match is one decision a generation; the house makes
         five hundred other marriages in a run, and this is the only thing the
         player can say about them. Neither answer is the safe one. -->
    <div class="panel">
      <h3 class="label">Who the house marries</h3>
      <p class="small dim blurb">
        When nobody asks you. The blood runs out of a family that marries outward and
        thins in one that will not.
      </p>
      <div class="wrap">
        <button
          v-for="option in MARRIAGE_ORDERS"
          :key="option.policy"
          class="small"
          :class="{ held: table.marriagePolicy === option.policy }"
          :aria-pressed="table.marriagePolicy === option.policy"
          @click="actions.order({ kind: 'marriages', policy: option.policy })"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- §7: every daughter married outward is power leaving the blood forever,
         and there was no way to decline to spend her. -->
    <div class="panel">
      <h3 class="label">The market</h3>
      <p v-if="!table.market.length" class="small dim">
        Nobody of the house is of an age to be spent this year.
      </p>
      <div class="wrap">
        <button
          v-for="p in table.market"
          :key="p.person"
          class="small"
          :class="{ held: p.held }"
          :aria-pressed="p.held"
          @click="actions.order({ kind: 'withhold', person: p.person, hold: !p.held })"
        >
          {{ p.name }}, {{ p.age }} — {{ p.held ? 'kept back' : 'on the market' }}
        </button>
      </div>
    </div>

    <!-- §7: "A dowry is not money. Great houses negotiate in lineage
         documentation... Forging them is an industry." A house with a thin
         record learns it by being refused a card, and this is where it can do
         something about that before the refusal rather than after. -->
    <div class="panel">
      <h3 class="label">The papers</h3>
      <p class="small dim blurb">
        Three generations of maternal record, notarised. What a great house asks for
        before it will open the conversation, and what a young house has not got.
      </p>
      <div v-for="row in table.papers" :key="row.person" class="line">
        <div class="small">
          <strong>{{ row.name }}</strong>
          <span class="dim"> · the record shows {{ row.shows }} of 3</span>
          <span v-if="row.forged" class="dim"> · {{ row.forged }} bought</span>
          <span v-if="row.exposed" class="rubric"> · {{ row.exposed }} questioned</span>
        </div>
        <div class="row">
          <button
            v-for="g in table.pedigreePrices"
            :key="g.grade"
            class="small"
            :disabled="!g.canPay || row.shows >= g.covers"
            @click="actions.order({ kind: 'pedigree', person: row.person, grade: g.grade })"
          >
            {{ g.grade === 'caster' ? 'Caster' : 'Bramme' }} — {{ g.price }} crowns, {{ g.covers }} generations
          </button>
        </div>
      </div>
    </div>

    <!-- WORLD §12. "Nobody in this world is a slave and there is no serfdom in
         Aubren. People are held by debt, custom, contract and having nowhere
         else to go, which is sufficient." Both halves of that are decisions. -->
    <div class="panel">
      <h3 class="label">The house's people</h3>
      <p v-if="!table.servants.length" class="small dim">Nobody is in the house's service.</p>
      <div v-for="s in table.servants" :key="s.person" class="line">
        <div class="small">
          <strong>{{ s.name }}</strong>
          <span class="dim"> · {{ s.role }} · {{ s.wage }} marks</span>
          <span v-if="s.bonded" class="rubric"> · owes {{ s.debt }}</span>
          <span class="dim"> · they think of you {{ s.loyalty }}</span>
        </div>
        <div class="row">
          <input
            v-if="!s.bonded"
            type="number" min="1" :max="table.maxBond"
            v-model.number="advancing[s.person]"
            :placeholder="'marks, up to ' + table.maxBond"
          />
          <button
            v-if="!s.bonded"
            class="small"
            :disabled="!advancing[s.person]"
            @click="actions.order({ kind: 'bond', person: s.person, op: 'bind', marks: advancing[s.person] ?? 0 })"
          >
            Advance it against the years
          </button>
          <button
            v-else
            class="small"
            @click="actions.order({ kind: 'bond', person: s.person, op: 'free' })"
          >
            Tear it up
          </button>
        </div>
      </div>
      <p v-if="table.servants.some((s) => s.bonded)" class="small dim blurb">
        A bond costs nothing in wages and cannot be ended by a bad year. Nobody whose
        debt is standing is ever glad of it, and everybody still held remembers who
        was let off.
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Ink, not rubric. A spend the house chose is not an error. */
.spent { color: var(--ink); }
.line { padding: 6px 0; border-top: 1px solid var(--rule); }
.line:first-of-type { border-top: 0; }
.line .blurb { margin: 2px 0 4px; }
.reading { margin-top: 6px; }
button.held { border-color: var(--rubric); color: var(--rubric); }
input[type='number'] { width: 8ch; }
</style>
