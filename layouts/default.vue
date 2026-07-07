<script setup lang="ts">
const tabs = [
  { to: '/feed', label: 'Feed', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/', label: 'Entdecken', icon: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' },
  { to: '/agenda', label: 'Agenda', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

const { data: me } = await useMe()
const { signOut } = useAuthActions()

async function logout() {
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <NuxtLink to="/" class="text-xl font-black tracking-tight text-rose-600">
          baselist
        </NuxtLink>
        <nav class="hidden gap-1 sm:flex">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.to"
            :to="tab.to"
            class="rounded-full px-4 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
            active-class="!bg-stone-900 !text-white"
          >
            {{ tab.label }}
          </NuxtLink>
        </nav>
        <div class="flex items-center gap-2">
          <template v-if="me?.account">
            <NuxtLink
              :to="`/@${me.account.handle}`"
              class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-sm font-bold text-rose-600"
              :title="me.account.displayName"
            >
              <img v-if="me.account.avatarUrl" :src="me.account.avatarUrl" :alt="me.account.displayName" class="h-full w-full object-cover">
              <span v-else>{{ me.account.displayName.slice(0, 1).toUpperCase() }}</span>
            </NuxtLink>
            <button class="text-sm text-stone-500 hover:text-stone-800" @click="logout">
              Abmelden
            </button>
          </template>
          <NuxtLink
            v-else-if="me?.authUser"
            to="/onboarding"
            class="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Profil vervollständigen
          </NuxtLink>
          <NuxtLink
            v-else
            to="/auth/anmelden"
            class="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Anmelden
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 sm:pb-8">
      <slot />
    </main>

    <!-- Mobile: Bottom-Navigation -->
    <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div class="mx-auto flex max-w-3xl">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="flex flex-1 flex-col items-center gap-0.5 py-2 text-stone-500"
          active-class="!text-rose-600"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" :d="tab.icon" />
          </svg>
          <span class="text-[11px] font-medium">{{ tab.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
