<script setup lang="ts">
useHead({ title: 'Anmelden – Baselist' })

const { signIn, verifyEmailOtp, sendVerificationOtp } = useAuthActions()

const email = ref('')
const password = ref('')
const otp = ref('')
const step = ref<'form' | 'verify'>('form')
const loading = ref(false)
const error = ref('')
const info = ref('')

async function afterLogin() {
  await refreshNuxtData('me')
  const me = await $fetch<{ account: unknown | null }>('/api/me')
  await navigateTo(me.account ? '/' : '/onboarding')
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    await afterLogin()
  } catch (err) {
    const anyErr = err as { data?: { code?: string } }
    // E-Mail noch nicht bestätigt -> Code anfordern und Verify-Schritt zeigen
    if (anyErr?.data?.code === 'EMAIL_NOT_VERIFIED') {
      try { await sendVerificationOtp(email.value) } catch { /* Resend-Knopf bleibt */ }
      step.value = 'verify'
      info.value = `Deine E-Mail ist noch nicht bestätigt. Wir haben einen Code an ${email.value} geschickt – prüfe auch den Spam-Ordner (Absender: Neon Auth).`
    } else {
      error.value = authErrorMessage(err)
    }
  } finally {
    loading.value = false
  }
}

async function resend() {
  error.value = ''
  try {
    await sendVerificationOtp(email.value)
    info.value = 'Neuer Code verschickt.'
  } catch (err) {
    error.value = authErrorMessage(err)
  }
}

async function verify() {
  error.value = ''
  loading.value = true
  try {
    await verifyEmailOtp(email.value, otp.value)
    await afterLogin()
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm py-8">
    <h1 class="mb-6 text-2xl font-bold">Anmelden</h1>

    <form v-if="step === 'form'" class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm font-medium" for="email">E-Mail</label>
        <input
          id="email" v-model="email" type="email" required autocomplete="email"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        >
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium" for="password">Passwort</label>
        <input
          id="password" v-model="password" type="password" required autocomplete="current-password"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        >
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {{ loading ? 'Einen Moment …' : 'Anmelden' }}
      </button>
      <p class="text-center text-sm text-stone-500">
        Noch kein Konto?
        <NuxtLink to="/auth/registrieren" class="font-medium text-rose-600">Registrieren</NuxtLink>
      </p>
    </form>

    <form v-else class="space-y-4" @submit.prevent="verify">
      <p class="text-sm text-stone-600">{{ info }}</p>
      <div>
        <label class="mb-1 block text-sm font-medium" for="otp">Bestätigungscode</label>
        <input
          id="otp" v-model="otp" type="text" inputmode="numeric" required
          class="w-full rounded-lg border border-stone-300 px-3 py-2 tracking-widest focus:border-rose-500 focus:outline-none"
        >
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        Bestätigen
      </button>
      <button type="button" class="w-full text-sm text-stone-500 underline" @click="resend">
        Code erneut senden
      </button>
    </form>
  </div>
</template>
