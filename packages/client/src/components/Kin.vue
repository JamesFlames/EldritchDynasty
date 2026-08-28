<script setup lang="ts">
import { computed } from 'vue';
import Member from './Member.vue';
import type { SessionView } from '@ed/core';
import { children, type MemberView } from '../lib/kin';

const props = defineProps<{
  member: MemberView;
  hall: MemberView[];
  names: SessionView['attributes'];
  traitNames: SessionView['traits'];
  selected: string | null;
}>();
defineEmits<{ (e: 'select', id: string): void }>();

const kids = computed(() => children(props.member, props.hall));
</script>

<template>
  <li>
    <Member :member="member" :names="names" :trait-names="traitNames" :open="selected === member.id" @select="$emit('select', $event)" />
    <ul v-if="kids.length">
      <!-- Recursive by filename. A generation is a nesting level, and there
           are about forty of them in a run. -->
      <Kin
        v-for="kid in kids"
        :key="kid.id"
        :member="kid"
        :hall="hall"
        :names="names"
        :trait-names="traitNames"
        :selected="selected"
        @select="$emit('select', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
li { list-style: none; margin: 0 0 6px; }
ul { margin: 6px 0 0; padding-left: 18px; border-left: 1px solid var(--rule); }
</style>
