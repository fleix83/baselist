<script setup lang="ts">
useHead({ title: 'Feed – Baselist' })

const { data: me } = await useMe()

const { data, refresh } = await useFetch<{ posts: Array<{ id: string } & Record<string, unknown>> }>('/api/feed', {
  immediate: !!me.value?.account,
  default: () => ({ posts: [] }),
})
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Feed</h1>
      <NuxtLink
        v-if="me?.account"
        to="/neu/post"
        class="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
      >
        + Post
      </NuxtLink>
    </div>

    <div v-if="!me?.account" class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
      <p class="font-medium">Dein Feed zeigt Posts von Konten, denen du folgst.</p>
      <p class="mt-1 text-sm">Melde dich an, um loszulegen.</p>
      <NuxtLink to="/auth/anmelden" class="mt-4 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">
        Anmelden
      </NuxtLink>
    </div>

    <div v-else-if="!data?.posts.length" class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
      <p class="font-medium">Hier ist noch nichts.</p>
      <p class="mt-1 text-sm">
        Folge Konten aus
        <NuxtLink to="/" class="text-rose-600 underline">Entdecken</NuxtLink>
        – ihre Posts landen dann hier.
      </p>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="post in data.posts" :key="post.id">
        <PostCard :post="post as any" />
      </li>
    </ul>
    <button v-if="me?.account && data?.posts.length" class="mt-4 w-full text-sm text-stone-400" @click="refresh()">
      Aktualisieren
    </button>
  </div>
</template>
