<script setup lang="ts">
const props = defineProps<{
  post: {
    id: string
    body: string | null
    imageUrl: string | null
    linkUrl: string | null
    moderationStatus?: string
    createdAt: string | Date
    author: { id?: string; handle: string; displayName: string; avatarUrl: string | null }
    subject?: { handle: string; displayName: string } | null
  }
  /** Konto-ID des Autors anzeigen lassen, um direkt aus dem Feed zu folgen */
  followableId?: string | null
}>()

const followState = ref<'idle' | 'busy' | 'done'>('idle')

async function follow() {
  if (!props.followableId || followState.value !== 'idle') return
  followState.value = 'busy'
  try {
    await $fetch('/api/follows', { method: 'POST', body: { accountId: props.followableId } })
    followState.value = 'done'
  } catch {
    followState.value = 'idle'
  }
}

const timeFormat = new Intl.DateTimeFormat('de-CH', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  timeZone: 'Europe/Zurich',
})
const createdLabel = computed(() => timeFormat.format(new Date(props.post.createdAt)))

// YouTube/Instagram nur als Embed rendern, kein Hosting
const embed = computed(() => {
  const url = props.post.linkUrl
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/)
  if (yt) return { kind: 'youtube' as const, src: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
  const insta = url.match(/instagram\.com\/(?:p|reel)\/([\w-]+)/)
  if (insta) return { kind: 'instagram' as const, src: `https://www.instagram.com/p/${insta[1]}/embed` }
  return { kind: 'link' as const, src: url }
})
</script>

<template>
  <article class="rounded-xl border border-stone-200 bg-white p-4">
    <div class="flex items-center gap-2.5">
      <NuxtLink :to="`/@${post.author.handle}`" class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-bold text-rose-600">
        <img v-if="post.author.avatarUrl" :src="post.author.avatarUrl" :alt="post.author.displayName" class="h-full w-full object-cover">
        <span v-else>{{ post.author.displayName.slice(0, 1).toUpperCase() }}</span>
      </NuxtLink>
      <div class="min-w-0 flex-1 text-sm">
        <NuxtLink :to="`/@${post.author.handle}`" class="font-semibold hover:underline">
          {{ post.author.displayName }}
        </NuxtLink>
        <span class="text-stone-400"> @{{ post.author.handle }} · {{ createdLabel }}</span>
        <button
          v-if="followableId && followState !== 'done'"
          class="ml-2 rounded-full border border-rose-200 px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          :disabled="followState === 'busy'"
          @click="follow"
        >
          + Folgen
        </button>
        <span v-else-if="followableId && followState === 'done'" class="ml-2 text-xs text-stone-400">
          Folgt ✓
        </span>
        <div v-if="post.subject" class="truncate text-xs text-stone-500">
          zu <NuxtLink :to="`/@${post.subject.handle}`" class="text-rose-600 hover:underline">{{ post.subject.displayName }}</NuxtLink>
        </div>
      </div>
      <span
        v-if="post.moderationStatus && post.moderationStatus !== 'visible'"
        class="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
      >{{ post.moderationStatus === 'held' ? 'in Prüfung' : 'eingeschränkt' }}</span>
    </div>

    <p v-if="post.body" class="mt-3 whitespace-pre-line text-[15px]">{{ post.body }}</p>

    <img
      v-if="post.imageUrl" :src="post.imageUrl" alt=""
      class="mt-3 max-h-96 w-full rounded-lg object-cover" loading="lazy"
    >

    <div v-if="embed" class="mt-3">
      <iframe
        v-if="embed.kind === 'youtube'" :src="embed.src"
        class="aspect-video w-full rounded-lg" allowfullscreen loading="lazy"
        referrerpolicy="no-referrer" title="YouTube-Video"
      />
      <iframe
        v-else-if="embed.kind === 'instagram'" :src="embed.src"
        class="h-[480px] w-full max-w-sm rounded-lg" loading="lazy"
        referrerpolicy="no-referrer" title="Instagram-Post"
      />
      <a
        v-else :href="embed.src" target="_blank" rel="noopener noreferrer nofollow"
        class="block truncate text-sm text-rose-600 underline"
      >{{ embed.src }}</a>
    </div>

    <div class="mt-2 flex items-center justify-end">
      <ReportButton target-kind="post" :target-id="post.id" />
    </div>
    <slot name="footer" />
  </article>
</template>
