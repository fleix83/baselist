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

    <!-- Event-Infos für Konten vom Typ 'event' -->
    <EventDetails v-if="profile.event" :event="profile.event" class="mt-4" />

    <!-- Posts -->
    <h2 class="mb-3 mt-8 text-lg font-semibold">Posts</h2>
    <div v-if="profile.posts.length === 0" class="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
      Noch keine Posts.
    </div>
    <ul v-else class="space-y-3">
      <li v-for="post in profile.posts" :key="post.id">
        <PostCard :post="{ ...post, author: profile.account }" />
      </li>
    </ul>
  </div>
</template>
