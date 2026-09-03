<script setup lang="ts">
import { computed } from 'vue';
import type { SessionView } from '@ed/core';
import { accountsOf } from '../lib/tales';

const props = defineProps<{ view: SessionView }>();

/**
 * Grouped by the event each is an account of (issue #52). See `lib/tales.ts`
 * for why nothing here decides which account goes first.
 */
const accounts = computed(() => accountsOf(props.view.tales));

/**
 * WHAT IS OUT (issue #40).
 *
 * Four layers circulated correctly, saved faithfully, passed their tests and
 * surfaced nowhere — this repository's most-repeated failure, recorded four
 * separate times in `docs/BALANCE-LOG.md`. Three of them are here; the fourth,
 * the Assize's reading, is in the header where the pressure belongs.
 *
 * They are one screen rather than three panels because they are one thing: the
 * chronicle is what the house says about itself, and this is everything else
 * that is being said, held, or owed. The player's own book is on the right of
 * the board. This is the counter-record.
 *
 * `accuracy` is deliberately absent from a tale, and not by omission here —
 * the view never carries it. A client handed it could sort two contradicting
 * accounts by truth, which is the one reading the whole layer exists to
 * refuse. The teller and the bias are given, and are weighed exactly as a
 * person would be.
 */
</script>

<template>
  <section class="abroad stack">
    <div class="panel">
      <h3 class="label">What else is being said</h3>
      <p v-if="!view.tales.length" class="small dim">
        Nothing about this family has got far enough to be repeated.
      </p>
      <!-- TWO ACCOUNTS OF ONE NIGHT, FACING (issue #52).
           `about` is the event; two accounts sharing it contradict each other,
           and CI fails a build where they agree on everything. Drawn apart in
           a flat list, that layer was built, validated and then defeated by a
           list.

           THE ACCOUNTS COME OUT OF ONE `v-for`, and that is the whole design.
           Markup written twice — a left and a right, a first and a rest — is
           two things that can drift apart, and the moment they do the layout
           has an opinion about which account is true. One loop cannot. -->
      <div v-for="group in accounts" :key="group.about" class="account">
        <p v-if="group.tales.length > 1" class="small dim contested">
          Two accounts of the same thing. Neither of them is the record.
        </p>
        <div class="facing" :class="{ pair: group.tales.length > 1 }">
          <article v-for="tale in group.tales" :key="tale.id" class="tale">
            <p class="text">{{ tale.text }}</p>
            <p class="small dim">
              {{ tale.form }} · told by {{ tale.teller }} · since {{ tale.since }}
              <span v-if="tale.mutations">· retold {{ tale.mutations }} times, and it has moved</span>
            </p>
            <p class="small bias">{{ tale.bias }}</p>
          </article>
        </div>
      </div>
    </div>

    <!-- The one part of the record the player can neither write nor omit. -->
    <div class="panel">
      <h3 class="label">What has left the house</h3>
      <p v-if="!view.looseSecrets.length" class="small dim">
        Everybody who knows anything is still being paid.
      </p>
      <article v-for="secret in view.looseSecrets" :key="secret.secret + secret.carrier" class="loose">
        <p class="text">
          <strong>{{ secret.carrier }}</strong> walked out with it in {{ secret.since }},
          and {{ secret.houseName }} have had it since.
        </p>
        <p class="small" :class="secret.told === undefined ? 'dim' : 'rubric'">
          {{ secret.told === undefined
            ? 'It is still only theirs.'
            : 'Told, in ' + secret.told + '. It is a thing that can be proved now.' }}
        </p>
      </article>
    </div>

    <div class="panel">
      <h3 class="label">Promised</h3>
      <p v-if="!view.marriagePromises.length" class="small dim">
        The house has not pledged anybody it does not have.
      </p>
      <article v-for="(promise, i) in view.marriagePromises" :key="i" class="promise">
        <p class="text">
          A daughter of this house, unborn in {{ promise.year }}, promised to
          {{ promise.houseName }} for <em>{{ promise.lotName }}</em>.
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.abroad { max-width: 62ch; }
.account, .loose, .promise { padding: 9px 0; border-top: 1px solid var(--rule); }
.account:first-of-type, .loose:first-of-type, .promise:first-of-type { border-top: 0; padding-top: 0; }
/* Side by side, at equal width, with no rule between them favouring either.
   A column would put one above the other, and above is a claim. */
.facing.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
@media (max-width: 700px) { .facing.pair { grid-template-columns: 1fr; } }
.contested { margin-bottom: 6px; font-style: italic; }
.text { margin: 0 0 4px; line-height: 1.6; font-size: 14.5px; }
.tale .text { font-style: italic; }
.bias { margin: 3px 0 0; color: var(--ink-soft); }
p { margin: 0; }
</style>
