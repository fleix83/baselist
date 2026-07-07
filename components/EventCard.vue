<script setup lang="ts">
const props = defineProps<{
  event: {
    handle: string
    title: string
    startsAt: string
    category: string | null
    priceInfo: string | null
    imageUrl: string | null
    address: string | null
    venueName: string | null
    goingCount: number
  }
  compact?: boolean
}>()

const CATEGORY_LABELS: Record<string, string> = {
  musik: 'Musik', nightlife: 'Nightlife', kunst: 'Kunst', sport: 'Sport',
  talk: 'Talk', essen: 'Essen', campus: 'Campus', sonstiges: 'Sonstiges',
}

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('de-CH', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  }).format(new Date(props.event.startsAt)),
)

const place = computed(() => props.event.venueName ?? props.event.address ?? '')
const isFree = computed(() => /gratis|kostenlos|kollekte|eintritt frei/i.test(props.event.priceInfo ?? ''))
</script>

<template>
  <NuxtLink
    :to="`/@${event.handle}`"
    class="block overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:shadow-md"
    :class="compact ? 'flex gap-3' : 'w-60 shrink-0 snap-start'"
  >
    <div
      class="bg-gradient-to-br from-rose-100 to-amber-100"
      :class="compact ? 'h-20 w-20 shrink-0' : 'h-28 w-full'"
    >
      <img
        v-if="event.imageUrl" :src="event.imageUrl" alt=""
        class="h-full w-full object-cover" loading="lazy"
      >
    </div>
    <div class="min-w-0 flex-1 p-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-rose-600">{{ dateLabel }}</p>
      <h3 class="mt-0.5 line-clamp-2 font-semibold leading-snug">{{ event.title }}</h3>
      <p v-if="place" class="mt-0.5 truncate text-sm text-stone-500">{{ place }}</p>
      <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
        <span v-if="isFree" class="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">gratis</span>
        <span v-if="event.category" class="rounded-full bg-stone-100 px-2 py-0.5">{{ CATEGORY_LABELS[event.category] ?? event.category }}</span>
        <span v-if="event.goingCount > 0">{{ event.goingCount }} zugesagt</span>
      </div>
    </div>
  </NuxtLink>
</template>
