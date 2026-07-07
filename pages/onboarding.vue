<script setup lang="ts">
useHead({ title: 'Willkommen – Baselist' })

const { data: me } = await useMe()

// Ohne Session zurück zum Login; mit fertigem Konto direkt weiter.
if (!me.value?.authUser) {
  await navigateTo('/auth/anmelden')
} else if (me.value?.account) {
  await navigateTo('/')
}

const CATEGORIES = [
  { key: 'musik', label: 'Musik' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'kunst', label: 'Kunst' },
  { key: 'sport', label: 'Sport' },
  { key: 'talk', label: 'Talks' },
  { key: 'essen', label: 'Essen' },
  { key: 'campus', label: 'Campus' },
  { key: 'sonstiges', label: 'Sonstiges' },
]

const handle = ref('')
const displayName = ref('')
const interests = ref<string[]>([])
const loading = ref(false)
const error = ref('')

function toggleInterest(key: string) {
  interests.value = interests.value.includes(key)
    ? interests.value.filter((k) => k !== key)
    : [...interests.value, key]
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await $fetch<{ account: { handle: string } }>('/api/onboarding', {
      method: 'POST',
      body: {
        handle: handle.value,
        displayName: displayName.value,
        interests: interests.value,
      },
    })
    await refreshNuxtData('me')
    await navigateTo(`/@${res.account.handle}`)
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm py-8">
    <h1 class="mb-2 text-2xl font-bold">Fast geschafft!</h1>
    <p class="mb-6 text-sm text-stone-500">Wähle dein Handle und deinen Anzeigenamen.</p>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm font-medium" for="handle">Handle</label>
        <div class="flex items-center rounded-lg border border-stone-300 focus-within:border-rose-500">
          <span class="pl-3 text-stone-400">@</span>
          <input
            id="handle" v-model="handle" type="text" required
            pattern="[a-zA-Z0-9][a-zA-Z0-9-]{2,29}"
            class="w-full rounded-lg px-1.5 py-2 focus:outline-none"
            placeholder="dein-handle"
          >
        </div>
        <p class="mt-1 text-xs text-stone-500">3–30 Zeichen: Buchstaben, Zahlen, Bindestriche.</p>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium" for="displayName">Anzeigename</label>
        <input
          id="displayName" v-model="displayName" type="text" required maxlength="60"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
          placeholder="z.B. Anna Meier"
        >
      </div>
      <div>
        <p class="mb-2 text-sm font-medium">Was interessiert dich? <span class="font-normal text-stone-400">(optional)</span></p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in CATEGORIES" :key="cat.key" type="button"
            class="rounded-full border px-3 py-1.5 text-sm"
            :class="interests.includes(cat.key)
              ? 'border-rose-600 bg-rose-50 text-rose-700'
              : 'border-stone-300 text-stone-600 hover:border-stone-400'"
            @click="toggleInterest(cat.key)"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        Los geht's
      </button>
    </form>
  </div>
</template>
