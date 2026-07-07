<script setup lang="ts">
const props = defineProps<{
  event: {
    accountId: string
    startsAt: string | Date
    endsAt: string | Date | null
    address: string | null
    category: string | null
    priceInfo: string | null
    description: string | null
    imageUrl: string | null
    imageCopyright: string | null
    status: string
    sourceUrl: string | null
    venue: { handle: string; displayName: string } | null
    createdBy?: { handle: string; displayName: string } | null
    goingCount: number
    savedCount: number
  }
}>()

const dateFormat = new Intl.DateTimeFormat('de-CH', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
})
const startLabel = computed(() => dateFormat.format(new Date(props.event.startsAt)))
const endLabel = computed(() => props.event.endsAt
  ? new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(new Date(props.event.endsAt))
  : null)

const CATEGORY_LABELS: Record<string, string> = {
  musik: 'Musik', nightlife: 'Nightlife', kunst: 'Kunst', sport: 'Sport',
  talk: 'Talk', essen: 'Essen', campus: 'Campus', sonstiges: 'Sonstiges',
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-stone-200 bg-white">
    <div v-if="event.imageUrl" class="relative">
      <img :src="event.imageUrl" alt="" class="max-h-72 w-full object-cover">
      <p v-if="event.imageCopyright" class="absolute bottom-0 right-0 bg-black/60 px-2 py-0.5 text-[10px] text-white">
        © {{ event.imageCopyright }}
      </p>
    </div>
    <div class="space-y-2.5 p-4">
      <p v-if="event.status === 'cancelled'" class="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
        Dieses Event wurde abgesagt.
      </p>
      <p v-else-if="event.status === 'past'" class="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
        Dieses Event ist vorbei.
      </p>

      <div class="flex items-start gap-2 text-[15px]">
        <span aria-hidden="true">🗓️</span>
        <span>{{ startLabel }}<template v-if="endLabel"> – {{ endLabel }}</template></span>
      </div>
      <div v-if="event.venue || event.address" class="flex items-start gap-2 text-[15px]">
        <span aria-hidden="true">📍</span>
        <span>
          <NuxtLink v-if="event.venue" :to="`/@${event.venue.handle}`" class="font-medium text-rose-600 hover:underline">
            {{ event.venue.displayName }}
          </NuxtLink>
          <template v-if="event.venue && event.address"> · </template>
          {{ event.address }}
        </span>
      </div>
      <div v-if="event.priceInfo" class="flex items-start gap-2 text-[15px]">
        <span class="font-medium text-stone-400">Preis:</span>
        <span>{{ event.priceInfo }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm text-stone-500">
        <span v-if="event.category" class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-600">
          {{ CATEGORY_LABELS[event.category] ?? event.category }}
        </span>
        <span>{{ event.goingCount }} zugesagt · {{ event.savedCount }} gespeichert</span>
      </div>

      <p v-if="event.description" class="whitespace-pre-line pt-1 text-[15px]">{{ event.description }}</p>

      <p v-if="event.createdBy" class="text-sm text-stone-500">
        Erstellt von
        <NuxtLink :to="`/@${event.createdBy.handle}`" class="text-rose-600 hover:underline">
          {{ event.createdBy.displayName }}
        </NuxtLink>
      </p>

      <a
        v-if="event.sourceUrl" :href="event.sourceUrl" target="_blank" rel="noopener noreferrer"
        class="inline-block text-sm text-rose-600 underline"
      >
        Zur Originalquelle ↗
      </a>

      <EventRsvpButtons :event-account-id="event.accountId" class="pt-2" />
    </div>
  </div>
</template>
