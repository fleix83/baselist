<script setup lang="ts">
useHead({ title: 'Registrieren – Baselist' })

const { signUp, verifyEmailOtp, sendVerificationOtp } = useAuthActions()

const email = ref('')
const password = ref('')
const otp = ref('')
const step = ref<'form' | 'verify'>('form')
const loading = ref(false)
const error = ref('')
const info = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await signUp(email.value, password.value)
    // Ist E-Mail-Bestätigung aktiv, gibt es noch keine Session -> OTP-Schritt.
    // Sonst besteht direkt eine Session.
    if (res && 'token' in (res as object) && (res as { token: string | null }).token) {
      await refreshNuxtData('me')
      await navigateTo('/onboarding')
    } else {
      step.value = 'verify'
      info.value = `Wir haben einen Bestätigungscode an ${email.value} geschickt.`
    }
  } catch (err) {
    error.value = authErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function verify() {
  error.value = ''
  loading.value = true
  try {
    await verifyEmailOtp(email.value, otp.value)
    await refreshNuxtData('me')
    await navigateTo('/onboarding')
  } catch (err) {
    error.value = authErrorMessage(err)
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
</script>

<template>
  <div class="mx-auto max-w-sm py-8">
    <h1 class="mb-6 text-2xl font-bold">Konto erstellen</h1>

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
          id="password" v-model="password" type="password" required minlength="8" autocomplete="new-password"
          class="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-500 focus:outline-none"
        >
        <p class="mt-1 text-xs text-stone-500">Mindestens 8 Zeichen.</p>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="loading"
        class="w-full rounded-lg bg-rose-600 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {{ loading ? 'Einen Moment …' : 'Registrieren' }}
      </button>
      <p class="text-center text-sm text-stone-500">
        Schon dabei?
        <NuxtLink to="/auth/anmelden" class="font-medium text-rose-600">Anmelden</NuxtLink>
      </p>
      <p class="text-center text-xs text-stone-400">
        Mit der Registrierung akzeptierst du die
        <NuxtLink to="/regeln" class="underline">Community-Regeln</NuxtLink>.
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
