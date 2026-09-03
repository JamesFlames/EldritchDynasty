<script setup lang="ts">
import { computed } from 'vue';
import type { SessionView } from '@ed/core';

type MemberView = SessionView['halls'][number]['members'][number];

const props = defineProps<{
  member: MemberView;
  /** What the content calls things. See `SessionView.attributes` / `.traits`. */
  names: SessionView['attributes'];
  traitNames: SessionView['traits'];
  open: boolean;
}>();
defineEmits<{ (e: 'select', id: string): void }>();

/**
 * WHAT THE BOOK SAYS ABOUT THEM, and only that (issue #19).
 *
 * `record.claimed` is the list of attributes the chronicle has actually
 * spoken about; `record.attrs` fills in the real value for everything else so
 * a UI never has to fall back, and drawing that unfiltered would put a
 * woman's Fecundity on her card. Nobody in this world has a number for
 * Fecundity. They have a grandmother who bore seven and a cousin who bore
 * none, and the marriage market's line read is the whole of what anyone can
 * honestly say — so a card that printed the number would delete §7.
 *
 * A person the book has never described therefore shows no attributes at all,
 * which is not a gap. It is the house not having written anything down.
 */
const said = computed(() => props.member.record.claimed.map((attr) => ({
  attr,
  name: props.names.find((a) => a.attr === attr)?.name ?? attr,
  claimed: Math.round(props.member.record.attrs[attr] ?? 0),
  real: Math.round(props.member.attrs[attr] ?? 0),
})));

/** The three the record is loudest about — a card is not a stat sheet. */
const loudest = computed(() => [...said.value].sort((a, b) => b.claimed - a.claimed).slice(0, 3));

/** The traits the book credits them with, under the names the content gives. */
const claimedTraits = computed(() => props.member.record.claimedTraits.map(
  (t) => props.traitNames.find((x) => x.trait === t)?.name ?? t));

/** The record's line on their parentage differs from the truth. A forged dowry does this. */
/**
 * §22's mark that is not the mark for death. The dead are not on this tree at
 * all — they are in the chronicle, which is where a house keeps its dead — so
 * the only person here who is not living is the one the rite took, and she
 * stays where she was: greyed, named, and still somebody's daughter.
 */
const consumed = computed(() => props.member.status === 'vessel_consumed');

const foundling = computed(() => {
  const r = props.member.record.parents;
  const t = props.member.parents;
  return r.mother !== t.mother || r.father !== t.father;
});
</script>

<template>
  <div class="member" :class="{ open, head: member.head, drift: member.drift, consumed }">
    <button class="face" @click="$emit('select', member.id)">
      <span class="name">
        {{ member.name }}<span v-if="member.epithet" class="dim"> {{ member.epithet }}</span>
      </span>
      <span class="marks">
        <span class="dim">{{ member.sex === 'female' ? '♀' : '♂' }} {{ member.age }}</span>
        <!-- The seal. Nothing takes it out of the main house (invariant 12). -->
        <span v-if="member.head" class="seal" title="the seal">✦</span>
        <!-- Two marks, because they are two facts (issue #78). ◈ is the
             Power coming through him; ◇ is a daughter who woke to what she
             carries and will never express it. One glyph for both said the
             opposite of §7 on every woman in the house. -->
        <span
          v-if="member.awakened"
          class="woken"
          :class="{ carried: !member.expresses }"
          :title="member.expresses ? 'awakened — it comes through them'
            : 'awakened — they carry it and will not express it'"
        >{{ member.expresses ? '◈' : '◇' }}</span>
        <span v-if="member.madness > 0" class="mad" :title="'madness ' + Math.round(member.madness)">☾</span>
        <!-- Sigil drift: the book and the body do not agree about this person. -->
        <span v-if="member.drift" class="driftmark" title="the record and the person do not agree">✎</span>
        <!-- Not a cross and not an obelus. There is no mark for this, so it is
             a name with a line drawn round it and nothing written after. -->
        <span v-if="consumed" class="given" title="given to the rite">⊘</span>
      </span>
    </button>

    <div v-if="loudest.length" class="claimed dim small">
      <span v-for="a in loudest" :key="a.attr">{{ a.name }} {{ a.claimed }}</span>
    </div>

    <div v-if="open" class="detail">
      <div v-if="claimedTraits.length" class="small">
        <span class="dim">said to be</span> {{ claimedTraits.join(', ') }}
      </div>
      <div v-if="member.spouse" class="small dim">married to {{ member.spouse.name }}</div>
      <div v-if="member.contract" class="small dim">holds a contract as {{ member.contract }}</div>
      <div v-if="member.record.claimedDeath" class="small dim">
        the book has them dying in {{ member.record.claimedDeath.year }},
        of {{ member.record.claimedDeath.cause }}
      </div>
      <div v-if="foundling" class="small rubric">the book gives them a different mother or father than they have</div>

      <!-- CLAIMED, then REAL. In that order, always: the recorded person is
           the one the house has, and the other one is what you are checking
           them against. -->
      <table v-if="said.length" class="attrs small">
        <tr class="dim"><th>attribute</th><th>the book</th><th>the person</th></tr>
        <tr v-for="a in said" :key="a.attr" :class="{ apart: a.claimed !== a.real }">
          <td>{{ a.name }}</td><td>{{ a.claimed }}</td><td>{{ a.real }}</td>
        </tr>
      </table>
      <p v-else class="small dim">The book has never said a word about what they were like.</p>
    </div>
  </div>
</template>

<style scoped>
.member {
  border: 1px solid var(--rule); border-radius: 3px;
  background: var(--panel); padding: 6px 9px; min-width: 190px;
}
.member.head { border-color: var(--rubric); }
.member.consumed { border-style: dashed; opacity: 0.55; }
.given { color: var(--rubric); }
.member.open { background: var(--vellum-deep); }
.face {
  display: flex; align-items: baseline; gap: 10px; width: 100%;
  background: none; border: 0; padding: 0; text-align: left;
}
.name { flex: 1; font-size: 14.5px; }
.marks { display: flex; gap: 5px; font-size: 12px; }
.seal { color: var(--rubric); }
.mad { color: var(--rubric); }
/* The carried mark is the same mark, unfilled and quieter. It is the same
   event in the family's life and not the same thing in the person. */
.woken.carried { color: var(--ink-soft); }
.driftmark { color: var(--ink-faint); }
.claimed { display: flex; gap: 9px; margin-top: 3px; font-size: 11px; }
.detail { margin-top: 8px; border-top: 1px solid var(--rule); padding-top: 7px; display: grid; gap: 4px; }
.attrs { border-collapse: collapse; width: 100%; }
.attrs th { text-align: left; font-weight: 400; }
.attrs td { padding-right: 10px; }
.attrs .apart td { color: var(--rubric); }
</style>
