<script setup lang="ts">
const props = defineProps<{
  profile: {
    account: { id: string; handle: string }
    isFollowing: boolean
    isOwn: boolean
  }
}>()

const { data: me } = await useMe()
const following = ref(props.profile.isFollowing)
const busy = ref(false)

async function toggleFollow() {
  if (!me.value?.account) {
    return navigateTo('/auth/anmelden')
  }
  busy.value = true
  try {
    if (following.value) {
      await $fetch(`/api/follows/${props.profile.account.id}`, { method: 'DELETE' })
      following.value = false
    } else {
      await $fetch('/api/follows', { method: 'POST', body: { accountId: props.profile.account.id } })
      following.value = true
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="shrink-0">
    <NuxtLink
      v-if="profile.isOwn"
      to="/einstellungen/profil"
      class="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium hover:bg-stone-100"
    >
      Bearbeiten
    </NuxtLink>
    <button
      v-else
      :disabled="busy"
      class="rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
      :class="following ? 'border border-stone-300 text-stone-700 hover:bg-stone-100' : 'bg-stone-900 text-white hover:bg-stone-700'"
      @click="toggleFollow"
    >
      {{ following ? 'Gefolgt' : 'Folgen' }}
    </button>
  </div>
</template>
