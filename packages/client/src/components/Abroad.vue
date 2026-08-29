<script setup lang="ts">
import type { SessionView } from '@ed/core';

defineProps<{ view: SessionView }>();

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
      <article v-for="tale in view.tales" :key="tale.id" class="tale">
        <p class="text">{{ tale.text }}</p>
        <p class="small dim">
          {{ tale.form }} · told by {{ tale.teller }} · since {{ tale.since }}
          <span v-if="tale.mutations">· retold {{ tale.mutations }} times, and it has moved</span>
        </p>
        <p class="small bias">{{ tale.bias }}</p>
      </article>
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
.tale, .loose, .promise { padding: 9px 0; border-top: 1px solid var(--rule); }
.tale:first-of-type, .loose:first-of-type, .promise:first-of-type { border-top: 0; padding-top: 0; }
.text { margin: 0 0 4px; line-height: 1.6; font-size: 14.5px; }
.tale .text { font-style: italic; }
.bias { margin: 3px 0 0; color: var(--ink-soft); }
p { margin: 0; }
</style>
