// Client-seitiger Auth-Zugriff: spricht ausschliesslich mit dem eigenen
// Proxy /api/auth/* (Better-Auth-REST) und /api/me — kein Auth-SDK im Client.
export interface Me {
  authUser: { id: string; email: string; emailVerified: boolean } | null
  user: { isAdmin: boolean; interests: string[] } | null
  account: {
    id: string
    handle: string
    displayName: string
    type: string
    bio: string | null
    avatarUrl: string | null
    verified: boolean
  } | null
}

export function useMe() {
  return useAsyncData<Me>('me', () => useRequestFetch()('/api/me') as Promise<Me>, {
    dedupe: 'defer',
  })
}

export function useAuthActions() {
  async function signUp(email: string, password: string) {
    return await $fetch<{ user?: unknown; token?: string | null }>('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email, password, name: email.split('@')[0] },
    })
  }

  async function signIn(email: string, password: string) {
    return await $fetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
    })
  }

  async function signOut() {
    await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
    await refreshNuxtData('me')
  }

  async function verifyEmailOtp(email: string, otp: string) {
    return await $fetch('/api/auth/email-otp/verify-email', {
      method: 'POST',
      body: { email, otp },
    })
  }

  async function sendVerificationOtp(email: string) {
    return await $fetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      body: { email, type: 'email-verification' },
    })
  }

  return { signUp, signIn, signOut, verifyEmailOtp, sendVerificationOtp }
}

/** Fehlermeldung aus einer Better-Auth-/$fetch-Antwort ziehen. */
export function authErrorMessage(err: unknown): string {
  const anyErr = err as { data?: { message?: string; statusMessage?: string } ; message?: string }
  return anyErr?.data?.message || anyErr?.data?.statusMessage || anyErr?.message || 'Unbekannter Fehler'
}
