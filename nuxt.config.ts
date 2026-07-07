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
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Was läuft in Basel? Events entdecken, Konten folgen, zusagen.' },
      ],
    },
  },
  nitro: {
    preset: process.env.VERCEL ? 'vercel' : undefined,
  },
})
