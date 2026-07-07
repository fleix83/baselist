<script setup lang="ts">
const route = useRoute()
const handle = computed(() => String(route.params.handle))

const { data: profile, error } = await useFetch(`/api/accounts/${handle.value}`)
if (error.value) {
  throw createError({ statusCode: error.value.statusCode ?? 404, statusMessage: 'Konto nicht gefunden' })
}

useHead(() => ({
  title: profile.value ? `${profile.value.account.displayName} (@${profile.value.account.handle}) – Baselist` : 'Profil – Baselist',
}))

// SEO/OG-Tags: geteilte Event-Links sehen in WhatsApp & Co. gut aus
const config = useRuntimeConfig()
const ogDescription = computed(() => {
  const p = profile.value
  if (!p) return ''
  if (p.event) {
    const date = new Intl.DateTimeFormat('de-CH', {
      weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Zurich',
    }).format(new Date(p.event.startsAt as string))
    const place = p.event.venue?.displayName ?? p.event.address ?? 'Basel'
    return [date, place, p.event.priceInfo].filter(Boolean).join(' · ')
  }
  return p.account.bio ?? `@${p.account.handle} auf Baselist – was läuft in Basel.`
})
useSeoMeta({
  ogTitle: () => profile.value?.account.displayName ?? 'Baselist',
  ogDescription: () => ogDescription.value,
  description: () => ogDescription.value,
  ogType: 'website',
  ogSiteName: 'Baselist',
  ogUrl: () => `${config.public.baseUrl}/@${handle.value}`,
  ogImage: () => (profile.value?.event?.imageUrl as string | null)
    ?? profile.value?.account.avatarUrl
    ?? `${config.public.baseUrl}/icons/icon-512.png`,
})

const TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  event: 'Event',
  venue: 'Venue',
  organizer: 'Veranstalter',
  business: 'Institution',
}
</script>

<template>
  <div v-if="profile">
    <!-- Kopf -->
    <div class="flex items-start gap-4">
      <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-2xl font-bold text-rose-600">
        <img v-if="profile.account.avatarUrl" :src="profile.account.avatarUrl" :alt="profile.account.displayName" class="h-full w-full object-cover">
        <span v-else>{{ profile.account.displayName.slice(0, 1).toUpperCase() }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-xl font-bold">{{ profile.account.displayName }}</h1>
          <span v-if="profile.account.verified" title="Verifiziert" class="text-rose-600">✓</span>
          <span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            {{ TYPE_LABELS[profile.account.type] ?? profile.account.type }}
          </span>
        </div>
        <p class="text-sm text-stone-500">@{{ profile.account.handle }}</p>
        <p class="mt-1 text-sm text-stone-500">
          {{ profile.followerCount }} Follower
          <template v-if="profile.account.type === 'person'"> · folgt {{ profile.followingCount }}</template>
        </p>
      </div>
      <ProfileActions :profile="profile" />
    </div>

    <p v-if="profile.account.bio" class="mt-4 whitespace-pre-line text-[15px]">{{ profile.account.bio }}</p>

    <div v-if="!profile.isOwn" class="mt-2">
      <ReportButton
        :target-kind="profile.account.type === 'event' ? 'event' : 'account'"
        :target-id="profile.account.id"
      />
    </div>

    <!-- Event-Infos für Konten vom Typ 'event' -->
    <EventDetails v-if="profile.event" :event="profile.event" class="mt-4" />

    <!-- Posts -->
    <div class="mb-3 mt-8 flex items-center justify-between">
      <h2 class="text-lg font-semibold">Posts</h2>
      <NuxtLink
        v-if="profile.event"
        :to="`/neu/post?zu=${profile.account.id}`"
        class="text-sm font-medium text-rose-600 hover:underline"
      >
        Update posten
      </NuxtLink>
    </div>
    <div v-if="profile.posts.length === 0" class="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
      Noch keine Posts.
    </div>
    <ul v-else class="space-y-3">
      <li v-for="post in profile.posts" :key="post.id">
        <PostCard :post="post" />
      </li>
    </ul>
  </div>
</template>
