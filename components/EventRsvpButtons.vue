<script setup lang="ts">
const props = defineProps<{ eventAccountId: string }>()

const { data: me } = await useMe()

// Eigenen RSVP-Status laden (nur eingeloggt relevant)
const { data: rsvp, refresh } = await useFetch<{ state: 'saved' | 'going' | null }>(
  `/api/events/${props.eventAccountId}/rsvp`,
  { default: () => ({ state: null }) },
)

const busy = ref(false)

async function setState(state: 'saved' | 'going') {
  if (!me.value?.account) {
    return navigateTo('/auth/anmelden')
  }
  busy.value = true
  try {
    if (rsvp.value?.state === state) {
      await $fetch(`/api/events/${props.eventAccountId}/rsvp`, { method: 'DELETE' })
    } else {
      await $fetch(`/api/events/${props.eventAccountId}/rsvp`, { method: 'PUT', body: { state } })
    }
    await refresh()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex gap-2">
    <button
      :disabled="busy"
      class="flex-1 rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
      :class="rsvp?.state === 'going' ? 'bg-rose-600 text-white' : 'border border-stone-300 hover:bg-stone-50'"
      @click="setState('going')"
    >
      {{ rsvp?.state === 'going' ? 'Zugesagt ✓' : 'Zusagen' }}
    </button>
    <button
      :disabled="busy"
      class="flex-1 rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
      :class="rsvp?.state === 'saved' ? 'bg-stone-900 text-white' : 'border border-stone-300 hover:bg-stone-50'"
      @click="setState('saved')"
    >
      {{ rsvp?.state === 'saved' ? 'Gespeichert ✓' : 'Speichern' }}
    </button>
  </div>
</template>
