export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Baselist',
      htmlAttrs: { lang: 'de' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Was läuft in Basel? Events entdecken, Konten folgen, zusagen.' },
        { name: 'theme-color', content: '#e11d48' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/png', href: '/icons/icon-192.png' },
        { rel: 'apple-touch-icon', href: '/icons/icon-180.png' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      baseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
    },
  },
  nitro: {
    preset: process.env.VERCEL ? 'vercel' : undefined,
  },
})
