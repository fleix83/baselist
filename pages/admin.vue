<script setup lang="ts">
useHead({ title: 'Moderation – Baselist' })

const { data: me } = await useMe()
if (!me.value?.user?.isAdmin) {
  throw createError({ statusCode: 404, statusMessage: 'Seite nicht gefunden' })
}

interface QueueItem {
  targetKind: 'post' | 'event' | 'account'
  targetId: string
  openReports: number
  reasons: string[]
  notes: string[]
  moderationStatus: string | null
  preview: string | null
  authorHandle: string | null
  lastReportAt: string | null
}

const { data, refresh } = await useFetch<{ items: QueueItem[] }>('/api/admin/queue')
const busy = ref('')
const error = ref('')

const KIND_LABELS = { post: 'Post', event: 'Event', account: 'Konto' }
const STATUS_STYLES: Record<string, string> = {
  held: 'bg-red-100 text-red-700',
  limited: 'bg-amber-100 text-amber-700',
  visible: 'bg-green-100 text-green-700',
}

async function act(item: QueueItem, action: string) {
  busy.value = `${item.targetId}:${action}`
  error.value = ''
  try {
    await $fetch('/api/admin/action', {
      method: 'POST',
      body: { targetKind: item.targetKind, targetId: item.targetId, action },
    })
    await refresh()
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div>
    <h1 class="mb-1 text-2xl font-bold">Moderations-Queue</h1>
    <p class="mb-4 text-sm text-stone-500">
      Offene Meldungen und automatisch markierte Inhalte, nach Schwere sortiert.
    </p>
    <p v-if="error" class="mb-3 text-sm text-red-600">{{ error }}</p>

    <div v-if="!data?.items.length" class="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
      Nichts zu sichten. 🎉
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="item in data.items"
        :key="`${item.targetKind}-${item.targetId}`"
        class="rounded-xl border border-stone-200 bg-white p-4"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="rounded bg-stone-100 px-2 py-0.5 font-medium">{{ KIND_LABELS[item.targetKind] }}</span>
          <span
            v-if="item.moderationStatus"
            class="rounded px-2 py-0.5 text-xs font-medium"
            :class="STATUS_STYLES[item.moderationStatus] ?? 'bg-stone-100'"
          >{{ item.moderationStatus }}</span>
          <span v-if="item.openReports" class="text-stone-500">{{ item.openReports }} Meldung(en)</span>
          <span v-if="item.reasons?.length" class="text-stone-400">[{{ item.reasons.join(', ') }}]</span>
        </div>
        <p class="mt-2 text-[15px]">{{ item.preview ?? '(kein Inhalt)' }}</p>
        <p v-if="item.authorHandle" class="mt-1 text-sm text-stone-500">
          von
          <NuxtLink :to="`/@${item.authorHandle}`" class="text-rose-600 hover:underline">@{{ item.authorHandle }}</NuxtLink>
        </p>
        <ul v-if="item.notes?.length" class="mt-1 space-y-0.5 text-xs text-stone-400">
          <li v-for="(n, i) in item.notes" :key="i">· {{ n }}</li>
        </ul>
        <div class="mt-3 flex flex-wrap gap-2 text-sm">
          <template v-if="item.targetKind !== 'account'">
            <button
              class="rounded-lg bg-green-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
              :disabled="!!busy" @click="act(item, 'approve')"
            >Freigeben</button>
            <button
              class="rounded-lg border border-amber-300 px-3 py-1.5 font-medium text-amber-700 disabled:opacity-50"
              :disabled="!!busy" @click="act(item, 'limit')"
            >Reichweite begrenzen</button>
            <button
              class="rounded-lg border border-red-300 px-3 py-1.5 font-medium text-red-700 disabled:opacity-50"
              :disabled="!!busy" @click="act(item, 'remove')"
            >Entfernen</button>
          </template>
          <button
            class="rounded-lg border border-stone-300 px-3 py-1.5 font-medium text-stone-600 disabled:opacity-50"
            :disabled="!!busy" @click="act(item, 'warn')"
          >Verwarnen</button>
          <button
            class="rounded-lg bg-stone-900 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            :disabled="!!busy" @click="act(item, 'ban')"
          >Konto sperren</button>
        </div>
      </li>
    </ul>
  </div>
</template>
