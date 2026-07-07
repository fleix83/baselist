<script setup lang="ts">
useHead({ title: 'Agenda – Baselist' })

const { data: me } = await useMe()

const { data } = await useFetch<{ events: Array<Record<string, unknown> & { accountId: string; startsAt: string; state: string }> }>(
  '/api/agenda',
  {
    // Nur eingeloggt mit Konto abrufen
    immediate: !!me.value?.account,
    default: () => ({ events: [] }),
  },
)

const dayFormat = new Intl.DateTimeFormat('de-CH', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Zurich',
})

const grouped = computed(() => {
  const groups: { label: string; events: typeof data.value.events }[] = []
  for (const ev of data.value?.events ?? []) {
    const label = dayFormat.format(new Date(ev.startsAt))
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.events.push(ev)
    else groups.push({ label, events: [ev] })
  }
  return groups
})
</script>

<template>
  <div>
    <h1 class="mb-4 text-2xl font-bold">Agenda</h1>

    <div v-if="!me?.account" class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
      <p class="font-medium">Deine Agenda lebt von deinen Zusagen.</p>
      <p class="mt-1 text-sm">Melde dich an und sage Events zu oder speichere sie – hier erscheinen sie dann sortiert nach Datum.</p>
      <NuxtLink to="/auth/anmelden" class="mt-4 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">
        Anmelden
      </NuxtLink>
    </div>

    <div v-else-if="grouped.length === 0" class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
      <p class="font-medium">Noch nichts in deiner Agenda.</p>
      <p class="mt-1 text-sm">
        Speichere Events oder sage zu – stöbere dafür in
        <NuxtLink to="/" class="text-rose-600 underline">Entdecken</NuxtLink>.
      </p>
    </div>

    <div v-else class="space-y-6">
      <section v-for="group in grouped" :key="group.label">
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{{ group.label }}</h2>
        <div class="space-y-2">
          <div v-for="ev in group.events" :key="ev.accountId" class="relative">
            <EventCard :event="ev" compact class="w-full" />
            <span
              class="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="ev.state === 'going' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-600'"
            >
              {{ ev.state === 'going' ? 'Zugesagt' : 'Gespeichert' }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
