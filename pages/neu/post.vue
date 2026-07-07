<script setup lang="ts">
useHead({ title: 'Neuer Post – Baselist' })

const { data: me } = await useMe()
if (!me.value?.account) {
  await navigateTo('/auth/anmelden')
}

const route = useRoute()
// Optionaler Bezug (z.B. Post "am" Event): /neu/post?zu=<accountId>
const subjectAccountId = typeof route.query.zu === 'string' ? route.query.zu : null

const body = ref('')
const linkUrl = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const loading = ref(false)
const error = ref('')

const { upload } = useImageUpload()

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  imageFile.value = file
  imagePreview.value = file ? URL.createObjectURL(file) : ''
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    let imageUrl: string | null = null
    if (imageFile.value) {
      imageUrl = await upload(imageFile.value)
    }
    await $fetch('/api/posts', {
      method: 'POST',
      body: {
        body: body.value || null,
        linkUrl: linkUrl.value || null,
        imageUrl,
        subjectAccountId,
      },
    })
    await navigateTo(`/@${me.value!.account!.handle}`)
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg py-4">
    <h1 class="mb-4 text-2xl font-bold">Neuer Post</h1>
    <form class="space-y-4" @submit.prevent="submit">
      <textarea
        v-model="body" rows="5" maxlength="2000"
        class="w-full rounded-xl border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        placeholder="Was gibt's Neues in Basel?"
      />

      <div>
        <label class="mb-1 block text-sm font-medium" for="link">Link (optional, YouTube/Instagram wird eingebettet)</label>
        <input
          id="link" v-model="linkUrl" type="url" maxlength="600"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
          placeholder="https://…"
        >
      </div>

      <div v-if="me?.uploadsEnabled">
        <label class="mb-1 block text-sm font-medium" for="image">Bild (optional)</label>
        <input id="image" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm" @change="onFileChange">
        <img v-if="imagePreview" :src="imagePreview" alt="Vorschau" class="mt-2 max-h-60 rounded-lg">
      </div>
      <p v-else class="text-xs text-stone-400">Bildupload ist noch nicht konfiguriert.</p>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="loading || (!body && !linkUrl && !imageFile)"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {{ loading ? 'Wird gepostet …' : 'Posten' }}
      </button>
    </form>
  </div>
</template>
