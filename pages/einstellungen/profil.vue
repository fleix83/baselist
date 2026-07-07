<script setup lang="ts">
useHead({ title: 'Profil bearbeiten – Baselist' })

const { data: me } = await useMe()
if (!me.value?.account) {
  await navigateTo('/auth/anmelden')
}

const displayName = ref(me.value?.account?.displayName ?? '')
const bio = ref(me.value?.account?.bio ?? '')
const loading = ref(false)
const error = ref('')
const saved = ref(false)

async function submit() {
  error.value = ''
  saved.value = false
  loading.value = true
  try {
    await $fetch('/api/settings/profile', {
      method: 'POST',
      body: { displayName: displayName.value, bio: bio.value || null },
    })
    await refreshNuxtData('me')
    saved.value = true
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm py-8">
    <h1 class="mb-6 text-2xl font-bold">Profil bearbeiten</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm font-medium" for="displayName">Anzeigename</label>
        <input
          id="displayName" v-model="displayName" type="text" required maxlength="60"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        >
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium" for="bio">Bio</label>
        <textarea
          id="bio" v-model="bio" rows="4" maxlength="500"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
          placeholder="Erzähl kurz, wer du bist."
        />
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-if="saved" class="text-sm text-green-700">Gespeichert.</p>
      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        Speichern
      </button>
    </form>
  </div>
</template>
