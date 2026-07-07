<script setup lang="ts">
useHead({ title: 'Neues Event – Baselist' })

const { data: me } = await useMe()
if (!me.value?.account) {
  await navigateTo('/auth/anmelden')
}

const { data: venueData } = await useFetch<{ venues: { id: string; displayName: string }[] }>('/api/venues')

const CATEGORIES = [
  { key: 'musik', label: 'Musik' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'kunst', label: 'Kunst' },
  { key: 'sport', label: 'Sport' },
  { key: 'talk', label: 'Talk' },
  { key: 'essen', label: 'Essen' },
  { key: 'campus', label: 'Campus' },
  { key: 'sonstiges', label: 'Sonstiges' },
]

const form = reactive({
  title: '',
  startsAt: '',
  endsAt: '',
  address: '',
  venueAccountId: '',
  category: 'sonstiges',
  priceInfo: '',
  description: '',
})
const imageFile = ref<File | null>(null)
const loading = ref(false)
const error = ref('')

const { upload } = useImageUpload()

function onFileChange(e: Event) {
  imageFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    let imageUrl: string | null = null
    if (imageFile.value) {
      imageUrl = await upload(imageFile.value)
    }
    const res = await $fetch<{ account: { handle: string } }>('/api/events', {
      method: 'POST',
      body: {
        title: form.title,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        address: form.address || null,
        venueAccountId: form.venueAccountId || null,
        category: form.category,
        priceInfo: form.priceInfo || null,
        description: form.description || null,
        imageUrl,
      },
    })
    await navigateTo(`/@${res.account.handle}`)
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg py-4">
    <h1 class="mb-1 text-2xl font-bold">Neues Event</h1>
    <p class="mb-4 text-sm text-stone-500">
      Du bleibst als Ersteller:in sichtbar. Venues kannst du verlinken, aber nicht in ihrem Namen posten.
    </p>
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm font-medium" for="title">Titel</label>
        <input
          id="title" v-model="form.title" type="text" required minlength="3" maxlength="120"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        >
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-sm font-medium" for="startsAt">Beginn</label>
          <input
            id="startsAt" v-model="form.startsAt" type="datetime-local" required
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          >
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium" for="endsAt">Ende (optional)</label>
          <input
            id="endsAt" v-model="form.endsAt" type="datetime-local"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          >
        </div>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium" for="venue">Venue (optional, nur Verlinkung)</label>
        <select
          id="venue" v-model="form.venueAccountId"
          class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-rose-500 focus:outline-none"
        >
          <option value="">– keine –</option>
          <option v-for="v in venueData?.venues ?? []" :key="v.id" :value="v.id">{{ v.displayName }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium" for="address">Adresse</label>
        <input
          id="address" v-model="form.address" type="text" maxlength="200"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
          placeholder="Strasse Nr., PLZ Basel"
        >
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-sm font-medium" for="category">Kategorie</label>
          <select
            id="category" v-model="form.category" required
            class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-rose-500 focus:outline-none"
          >
            <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium" for="price">Preis-Info</label>
          <input
            id="price" v-model="form.priceInfo" type="text" maxlength="100"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
            placeholder="z.B. gratis, CHF 15"
          >
        </div>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium" for="description">Beschreibung</label>
        <textarea
          id="description" v-model="form.description" rows="4" maxlength="3000"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        />
      </div>
      <div v-if="me?.uploadsEnabled">
        <label class="mb-1 block text-sm font-medium" for="image">Bild (optional)</label>
        <input id="image" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm" @change="onFileChange">
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {{ loading ? 'Wird erstellt …' : 'Event erstellen' }}
      </button>
    </form>
  </div>
</template>
