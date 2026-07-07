<script setup lang="ts">
const props = defineProps<{
  targetKind: 'post' | 'event' | 'account'
  targetId: string
}>()

const { data: me } = await useMe()

const REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'hate', label: 'Hass / Belästigung' },
  { key: 'illegal', label: 'Illegaler Inhalt' },
  { key: 'fake_event', label: 'Fake-Event' },
  { key: 'other', label: 'Anderes' },
]

const open = ref(false)
const reason = ref('spam')
const note = ref('')
const done = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await $fetch('/api/reports', {
      method: 'POST',
      body: {
        targetKind: props.targetKind,
        targetId: props.targetId,
        reason: reason.value,
        note: note.value || null,
      },
    })
    done.value = true
    open.value = false
  } catch (err) {
    error.value = authErrorMessage(err)
  }
}
</script>

<template>
  <div v-if="me?.account" class="text-xs">
    <button v-if="!open && !done" class="text-stone-400 hover:text-stone-600" @click="open = true">
      Melden
    </button>
    <span v-else-if="done" class="text-stone-400">Gemeldet – danke.</span>
    <div v-else class="mt-1 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p class="text-sm font-medium">
        Warum meldest du das?
        <NuxtLink to="/regeln" class="ml-1 font-normal text-stone-400 underline">Regeln</NuxtLink>
      </p>
      <select v-model="reason" class="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm">
        <option v-for="r in REASONS" :key="r.key" :value="r.key">{{ r.label }}</option>
      </select>
      <input
        v-model="note" type="text" maxlength="500" placeholder="Optionale Anmerkung"
        class="w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
      >
      <p v-if="error" class="text-red-600">{{ error }}</p>
      <div class="flex gap-2">
        <button class="rounded bg-stone-900 px-3 py-1.5 font-medium text-white" @click="submit">Melden</button>
        <button class="px-2 text-stone-500" @click="open = false">Abbrechen</button>
      </div>
    </div>
  </div>
</template>
