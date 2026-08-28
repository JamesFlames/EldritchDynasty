<script setup lang="ts">
import { ref } from 'vue';
import type { PendingDecision, RecordOption, SlotFill } from '@ed/core';
import type { GameActions } from '../lib/game';

defineProps<{ decision: PendingDecision; actions: GameActions }>();

/**
 * WHO THE PLAYER IS CASTING, per slot, for the decision on screen.
 *
 * Kept here rather than in the store because it is not simulation state: it is
 * a half-filled form, and it dies with the decision it belongs to. That is
 * what the `:key` on this component in `App.vue` is for — without it Vue
 * reuses the instance and this ref survives into the next decision.
 */
const cast = ref<SlotFill>({});

function fill(slot: string, event: Event): void {
  const person = (event.target as HTMLSelectElement).value;
  if (person) cast.value[slot] = person;
  else delete cast.value[slot];
}

/** Every slot the event insists on has somebody standing in it. */
function ready(requests: { slot: string; optional: boolean }[]): boolean {
  return requests.every((r) => r.optional || cast.value[r.slot]);
}

const RECORD_OPTIONS: { option: RecordOption; label: string }[] = [
  { option: 'record', label: 'Write it as it happened' },
  { option: 'omit', label: 'Leave it out' },
  { option: 'embellish', label: 'Improve it' },
];
</script>

<template>
  <section class="docket panel">
    <!-- ── A CHOICE, OR A PARTY ────────────────────────────────────────────
         `decidedBy` says which. `player` means take a branch; `party` means
         name who goes and let what they are between them decide the rest, and
         a client that drew the choice list regardless would be offering an
         answer the engine will not accept. -->
    <template v-if="decision.kind === 'choice'">
      <h3 class="label">{{ decision.year }} · {{ decision.event.title }}</h3>
      <p class="body">{{ decision.body }}</p>

      <div v-if="decision.arcStep" class="dim small arc">
        part of {{ decision.arcStep.instance.arc }}<span v-if="decision.arcStep.absent"> — and one of them is gone</span>
      </div>

      <div v-for="req in decision.cast" :key="req.slot" class="cast row">
        <label class="dim small">{{ req.slot }}<span v-if="req.optional"> (may stand empty)</span></label>
        <select @change="fill(req.slot, $event)">
          <option value="">— nobody —</option>
          <option v-for="c in req.candidates" :key="c.id" :value="c.id">
            {{ c.name }}, {{ c.age }}
          </option>
        </select>
        <span v-if="!req.candidates.length" class="dim small">nobody of the house can stand here</span>
      </div>

      <div v-if="decision.choicesAreOpen" class="choices stack">
        <button
          v-for="c in decision.choices"
          :key="c.id"
          :disabled="!c.available || !ready(decision.cast)"
          @click="actions.choose(decision.id, c.id, cast)"
        >
          <span>{{ c.label }}</span>
          <!-- An unavailable choice is itself information (concept §16), so it
               is shown greyed with the reason rather than filtered away. -->
          <small v-if="!c.available" class="dim"> — {{ c.blockedBy }}</small>
        </button>
      </div>

      <div v-else class="choices">
        <p class="dim small">
          The branch is not yours to take. Name who goes, and what they are between them decides it.
        </p>
        <button class="primary" :disabled="!ready(decision.cast)" @click="actions.send(decision.id, cast)">
          Send them
        </button>
      </div>
    </template>

    <!-- ── THE MATCH (concept §5) — three cards and one marriage ─────────── -->
    <template v-else-if="decision.kind === 'match'">
      <h3 class="label">{{ decision.year }} · a marriage for {{ decision.subject.name }}</h3>
      <p class="body">
        {{ decision.subject.name }} is {{ decision.subject.age }}. These are the cards the year dealt.
      </p>

      <div class="cards">
        <article v-for="card in decision.cards" :key="card.id" class="card" :class="{ shut: !card.available }">
          <div class="row">
            <strong>{{ card.name }}</strong>
            <span class="dim small">{{ card.age }} · {{ card.houseName }}</span>
          </div>
          <p class="small soft">{{ card.blurb }}</p>
          <p class="small words">{{ card.words }}</p>
          <div class="dim small">
            <span title="the inbreeding coefficient of the child this match would have, as the family's own documents would calculate it">
              kinship {{ card.kinship.toFixed(4) }}
            </span>
            ·
            <span :title="card.lineSeen + ' completed lives stand behind that word'">
              the line reads {{ card.line }}
            </span>
            · {{ card.dowry }} crowns
          </div>
          <button :disabled="!card.available" @click="actions.match(decision.id, card.id)">
            Take this one
          </button>
          <div v-if="!card.available" class="dim small">{{ card.blockedBy }}</div>
        </article>
      </div>

      <!-- Declining is a real move: the house waits for a better year. -->
      <button class="quiet" @click="actions.declineHand(decision.id)">Take none of them</button>
    </template>

    <!-- ── THE RECORD BLOCK — what gets written down ─────────────────────── -->
    <template v-else>
      <h3 class="label">{{ decision.year }} · what the book will say</h3>
      <p class="body">
        There is one line about <em>{{ decision.subject }}</em>, and this is it.
      </p>

      <div class="choices stack">
        <template v-for="o in RECORD_OPTIONS" :key="o.option">
          <button
            v-if="decision.options.some((x) => x.option === o.option)"
            @click="actions.record(decision.id, o.option)"
          >
            <span>{{ o.label }}</span>
            <small class="dim entry">
              {{ decision.options.find((x) => x.option === o.option)?.chronicle ?? 'nothing at all' }}
            </small>
          </button>
        </template>
      </div>
    </template>

    <!-- THE ESCAPE HATCH. Daveed is not neutral, and handing him the pen is a
         way of playing rather than a way of skipping. -->
    <footer>
      <button class="quiet small" @click="actions.letHimDecide()">Let him decide</button>
    </footer>
  </section>
</template>

<style scoped>
.docket { max-width: 72ch; }
.body { font-size: 15.5px; line-height: 1.62; margin: 0 0 14px; }
.arc { margin-bottom: 10px; }
.cast { margin-bottom: 8px; }
.cast label { min-width: 9ch; }
.choices { margin-top: 12px; }
.choices button { text-align: left; display: block; width: 100%; }
.choices .entry { display: block; margin-top: 3px; font-style: italic; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 12px; }
.card { border: 1px solid var(--rule); border-radius: 3px; padding: 10px 12px; background: var(--vellum); }
.card.shut { opacity: .6; }
.card p { margin: 6px 0; }
.card .words { font-style: italic; }
.card button { margin-top: 8px; width: 100%; }
footer { margin-top: 14px; border-top: 1px solid var(--rule); padding-top: 8px; }
</style>
