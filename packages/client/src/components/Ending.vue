<script setup lang="ts">
import { computed } from 'vue';
import type { EpilogueView, SessionView } from '@ed/core';
import type { GameActions } from '../lib/game';

const props = defineProps<{ view: SessionView; epilogue: EpilogueView; actions: GameActions }>();

/**
 * THE LAST NIGHT (concept §23, issue #39).
 *
 * The closing text is assembled from the chronicle the player wrote —
 * including the omissions, which print here as dated blank lines exactly as
 * they do in the book, because they are the artefact and they are what the
 * creditor spent the night reading.
 *
 * The ring is the shape of the screen: the prologue's own three beats,
 * restated, with the one element the thousand years changed marked. Everything
 * else on the page is in the frame's register and the last line is not, and
 * the drop is the effect.
 */
const reckoning = computed(() => props.epilogue.reckoning);
</script>

<template>
  <main class="ending">
    <p class="year">{{ epilogue.year }}</p>
    <h1>{{ epilogue.title }}</h1>
    <p class="summary">{{ epilogue.summary }}</p>

    <p class="frame">{{ epilogue.opening }}</p>

    <!-- WHAT WAS READ OUT. The blanks are read too, and take as long as a page. -->
    <section v-if="epilogue.read.length" class="read">
      <h3 class="label">What the book said</h3>
      <article
        v-for="(entry, i) in epilogue.read"
        :key="entry.id ?? entry.year + ':' + i"
        class="entry"
        :class="{ omitted: entry.text === null, embellished: entry.record === 'embellish' }"
      >
        <span class="dim small">{{ entry.year }}</span>
        <p v-if="entry.text !== null">{{ entry.text }}</p>
        <p v-else class="blank" title="somebody decided this would not be written down">&nbsp;</p>
      </article>
    </section>

    <section class="tally">
      <h3 class="label">The reckoning</h3>
      <dl>
        <div><dt>The house</dt><dd>{{ view.houseName }}</dd></div>
        <div v-if="epilogue.founding">
          <dt>Asked for, in 1042</dt><dd>{{ epilogue.founding.heirloomName }}</dd>
        </div>
        <div v-if="epilogue.founding">
          <dt>And never paid back</dt><dd>{{ epilogue.founding.grudgeName }}</dd>
        </div>
        <div><dt>Pages written</dt><dd>{{ reckoning.pages }}</dd></div>
        <div><dt>Left blank</dt><dd>{{ reckoning.blanks }}</dd></div>
        <div><dt>Improved</dt><dd>{{ reckoning.embellished }}</dd></div>
        <div>
          <dt>Lies still standing</dt>
          <dd>{{ reckoning.standingLies }} <span class="dim">({{ reckoning.provenLies }} caught)</span></dd>
        </div>
        <div>
          <dt>The contract, recovered</dt>
          <dd>{{ reckoning.clauses }} of {{ reckoning.clausesTotal }} clauses</dd>
        </div>
        <div>
          <dt>What the book attests</dt>
          <dd>
            {{ reckoning.attested === 'none' ? 'nothing at all' : reckoning.attestedTitle }}
            <span v-if="reckoning.attestedYear" class="dim">since {{ reckoning.attestedYear }}</span>
          </dd>
        </div>
        <!-- WHAT THE READING TOOK, shown only where it differs from the
             claim. For a house that kept an honest book these are the same
             number and a row saying so twice is noise; for a house that did
             not, this is the whole of what the last night did to it, and
             §29.3's guard rail says the cost has to be findable. -->
        <div v-if="reckoning.rungsWithheld > 0">
          <dt>And could show</dt>
          <dd>
            {{ reckoning.substantiated === 'none' ? 'nothing at all' : reckoning.substantiatedTitle }}
            <span class="dim">
              — {{ reckoning.standingLies }} pages were asked after, and answered with themselves
            </span>
          </dd>
        </div>
        <div><dt>At the table</dt><dd>{{ reckoning.livingBlood }}</dd></div>
      </dl>
    </section>

    <!-- THE RING. Three beats, one substitution, and the substitution is what
         the thousand years cost. -->
    <section class="ring">
      <h3 class="label">A debt of three parts</h3>
      <ol>
        <li v-for="(beat, i) in epilogue.ring" :key="i" :class="{ changed: beat.changed }">
          <p class="given" :class="{ mark: beat.changed === 'given' }">{{ beat.given }}</p>
          <p class="owed" :class="{ mark: beat.changed === 'owed' }">{{ beat.owed }}</p>
        </li>
      </ol>
    </section>

    <p class="closing">{{ epilogue.closing }}</p>

    <button class="quiet" @click="actions.restart()">Another house</button>
  </main>
</template>

<style scoped>
.ending { max-width: 64ch; margin: 0 auto; padding: 80px 26px 90px; }
.year { font-size: 46px; margin: 0; letter-spacing: .08em; color: var(--ink-faint); }
h1 { font-size: 30px; font-weight: 400; margin: 0 0 8px; color: var(--rubric); }
.summary { margin: 0 0 28px; font-size: 14px; color: var(--ink-faint); }
.frame {
  font-size: 16.5px; line-height: 1.8; color: var(--ink-soft);
  white-space: pre-line; margin: 0 0 34px;
}
.read { margin-bottom: 34px; }
.entry { margin-bottom: 12px; }
.entry p { margin: 2px 0 0; line-height: 1.6; font-size: 14px; }
.entry.omitted .blank { border-bottom: 1px solid var(--rule); }
.entry.embellished p { font-style: italic; }
.tally dl { margin: 0; display: grid; gap: 5px; }
.tally div { display: flex; gap: 12px; border-bottom: 1px solid var(--rule); padding-bottom: 4px; }
.tally dt { flex: 1; color: var(--ink-faint); font-size: 13px; }
.tally dd { margin: 0; font-size: 14px; }
.ring { margin-top: 36px; }
.ring ol { list-style: none; margin: 0; padding: 0; }
.ring li { border-top: 1px solid var(--rule); padding-top: 16px; margin-bottom: 14px; }
.ring p { margin: 0 0 12px; line-height: 1.75; color: var(--ink-soft); font-size: 15.5px; }
.ring .owed { font-style: italic; }
.ring .mark { color: var(--ink); border-left: 2px solid var(--rubric); padding-left: 12px; }
.closing {
  margin: 40px 0 30px; padding-top: 22px; border-top: 1px solid var(--rule);
  font-size: 18px; color: var(--ink);
}
</style>
