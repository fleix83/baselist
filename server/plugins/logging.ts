// Leichtgewichtiges Monitoring: strukturierte Fehler-Logs (in Vercel sichtbar).
// Bewusst schlicht gehalten; Sentry kann später an dieser Stelle andocken.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const statusCode = (error as { statusCode?: number }).statusCode
    // 4xx sind erwartbares Nutzerverhalten, nur 5xx/unbekannt loggen
    if (statusCode && statusCode < 500) return
    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      path: event?.path,
      method: event?.method,
      message: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 5).join(' | '),
    }))
  })
})
