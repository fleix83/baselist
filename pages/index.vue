<script setup lang="ts">
useHead({ title: 'Entdecken – Baselist' })

const CATEGORIES = [
  { key: 'musik', label: 'Musik' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'kunst', label: 'Kunst' },
  { key: 'sport', label: 'Sport' },
  { key: 'talk', label: 'Talks' },
  { key: 'essen', label: 'Essen' },
  { key: 'campus', label: 'Campus' },
  { key: 'sonstiges', label: 'Sonstiges' },
]

const { data: me } = await useMe()

// Interessen aus dem Onboarding filtern Entdecken vor
const selected = ref<string[]>(me.value?.user?.interests ?? [])

const { data, pending } = await useFetch('/api/discover', {
  query: computed(() => ({
    categories: selected.value.length ? selected.value.join(',') : undefined,
  })),
  watch: [selected],
})

function toggle(key: string) {
  selected.value = selected.value.includes(key)
    ? selected.value.filter((k) => k !== key)
    : [...selected.value, key]
}
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Entdecken</h1>
      <NuxtLink
        v-if="me?.account"
        to="/neu/event"
        class="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
      >
        + Event
      </NuxtLink>
    </div>
    <p class="mb-4 text-sm text-stone-500">Was läuft in Basel?</p>

    <!-- Kategorie-Filter -->
    <div class="-mx-4 mb-2 overflow-x-auto px-4 pb-2">
      <div class="flex w-max gap-2">
        <button
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="selected.length === 0
            ? 'border-stone-900 bg-stone-900 text-white'
            : 'border-stone-300 text-stone-600'"
          @click="selected = []"
        >
          Alle
        </button>
        <button
          v-for="cat in CATEGORIES" :key="cat.key"
          class="rounded-full border px-3 py-1.5 text-sm"
          :class="selected.includes(cat.key)
            ? 'border-rose-600 bg-rose-50 text-rose-700'
            : 'border-stone-300 text-stone-600'"
          @click="toggle(cat.key)"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div v-if="pending && !data" class="py-12 text-center text-stone-400">Lade Events …</div>

    <template v-else-if="data?.rails.length">
      <section v-for="rail in data.rails" :key="rail.key" class="mb-8">
        <h2 class="mb-3 text-lg font-semibold">{{ rail.title }}</h2>
        <div class="-mx-4 overflow-x-auto px-4">
          <div class="flex w-max snap-x gap-3 pb-2">
            <EventCard v-for="ev in rail.events" :key="`${rail.key}-${ev.accountId}`" :event="ev" />
          </div>
        </div>
      </section>
    </template>

    <div v-else class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
      <p class="font-medium">Gerade keine passenden Events.</p>
      <p class="mt-1 text-sm">Probier einen anderen Filter – oder schau später wieder vorbei.</p>
    </div>
  </div>
</template>
