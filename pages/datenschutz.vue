<script setup lang="ts">
useHead({ title: 'Datenschutz – Baselist' })
</script>

<template>
  <div class="prose prose-stone mx-auto max-w-lg py-6">
    <h1>Datenschutzerklärung</h1>
    <!-- TODO(Felix): finalen Text einsetzen (Vorlage unten als Gerüst) -->
    <p>
      Diese Datenschutzerklärung informiert darüber, welche Personendaten Baselist
      bearbeitet und wozu.
    </p>
    <h2>Welche Daten wir bearbeiten</h2>
    <ul>
      <li>Konto: E-Mail-Adresse, Passwort (verschlüsselt gespeichert), Handle, Anzeigename, optional Bio und Profilbild.</li>
      <li>Nutzung: Follows, Zusagen, Posts und Meldungen, die du selbst erstellst.</li>
      <li>Technisch: Server-Logs zur Fehlerbehebung.</li>
    </ul>
    <h2>Wo die Daten liegen</h2>
    <ul>
      <li>Datenbank und Login: Neon (Region Frankfurt, EU).</li>
      <li>Bilder: Cloudflare R2.</li>
      <li>Automatische Inhaltsprüfung: Infomaniak AI Tools (Schweiz) – geprüft wird nur der Text neuer Posts/Events.</li>
      <li>Hosting: Vercel.</li>
    </ul>
    <h2>Deine Rechte</h2>
    <p>
      Du kannst Auskunft, Berichtigung oder Löschung deiner Daten verlangen:
      [Kontakt-E-Mail].
    </p>
  </div>
</template>
