<script setup lang="ts">
const tabs = [
  { to: '/feed', label: 'Feed', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/', label: 'Entdecken', icon: 'M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' },
  { to: '/agenda', label: 'Agenda', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
]
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
          <slot name="header-actions" />
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
