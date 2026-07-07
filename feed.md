# Feed-Mechanik

Referenzdokument für den Folge-/Community-Feed. Stand: Juli 2026 (MVP,
kleine Community). Implementierung: `server/api/feed.get.ts` (Query),
`pages/feed.vue` (Ansicht), `components/PostCard.vue` (Karte inkl.
Folgen-Chip).

## Heutiges Verhalten (Kaltstart-Modus)

Solange die Community klein ist, ist der Feed bewusst eine **globale,
chronologische Timeline** – er ist damit gleichzeitig die
Entdeckungsfläche für Konten (Personen ohne eigene Events wären sonst
nirgends auffindbar).

**Wer sieht was** (drei Stufen, in dieser Reihenfolge geprüft):

| Stufe | Quelle | Sichtbare Moderationsstatus |
|---|---|---|
| Eigene Posts | `author = ich` | `visible`, `limited`, `held` (Badge «in Prüfung») – nie `removed` |
| Gefolgte Konten | `follows`-Beziehung | `visible`, `limited` |
| Alle übrigen Konten | Rest der Instanz | nur `visible` |

Damit bleiben die Reichweitenregeln der Moderation (Phase 6) intakt:

- **`limited`** («Reichweite begrenzen») erreicht nur bestehende Follower,
  taucht also weder im globalen Teil des Feeds noch in Entdecken auf.
- **`held`** sieht ausschliesslich die Autorin selbst, markiert als
  «in Prüfung» – so wirkt ein gehaltener Post nicht wie verschwunden.
- **`removed`** sieht niemand, auch die Autorin nicht.
- Posts gesperrter Konten (`accounts.banned`) sind komplett raus.

**Weitere Eigenschaften:**

- Sortierung: streng nach Posting-Zeit (`created_at desc`), Limit 50.
- Nur eingeloggte Nutzer mit abgeschlossenem Onboarding (`requireUser`).
- Jeder Post liefert `isOwn` und `isFollowed` mit; bei fremden, noch
  nicht gefolgten Konten rendert `PostCard` einen **«+ Folgen»-Chip**
  direkt im Post-Kopf (Konten-Entdeckung in einem Tap).
- Events erscheinen im Feed über ihren automatischen Ankündigungs-Post
  (Autor = Ersteller, Subject = Event-Konto), der den Moderationsstatus
  des Events erbt.

## Später: Wenn der Feed voll wird

Grundsatz aus dem Implementierungsplan bleibt: **kein
Empfehlungsalgorithmus** – nur transparente, regelbasierte Anpassungen.
Vorgesehene Evolutionsstufen (in dieser Reihenfolge, jeweils erst bei
Bedarf):

1. **Gefolgte nach oben ranken** (ab spürbarem Volumen, grob ab
   ~50+ Posts/Tag): Chronologie beibehalten, aber Posts gefolgter Konten
   innerhalb eines Zeitfensters bevorzugen. Nur die `ORDER BY`-Zeile in
   `server/api/feed.get.ts` ändern, z.B.:

   ```sql
   order by
     -- Gefolgte/Eigene zuerst, aber nur innerhalb der letzten 48 h,
     -- damit alte gefolgte Posts frische globale nicht endlos verdrängen
     (("isFollowed" or "isOwn") and p.created_at > now() - interval '48 hours') desc,
     p.created_at desc
   ```

2. **Zwei Tabs statt Mischung** (falls 1. nicht mehr reicht):
   «Folge ich» (nur eigene + gefolgte, wie im ursprünglichen Plan) und
   «Alle» (globale Timeline). Query-Parameter `?scope=following|all`
   auf demselben Endpoint; die Stufen-Tabelle oben gilt pro Scope.

3. **Pagination** (unabhängig davon, sobald 50 Posts nicht mehr reichen):
   Keyset-Pagination über `created_at` + `id`
   (`where (created_at, id) < (:cursor_ts, :cursor_id)`), kein OFFSET.

**Nicht geplant** (bewusst, siehe PRD/Implementierungsplan):
Engagement-basiertes Ranking, personalisierte Empfehlungen,
Fremdinstanz-Inhalte. Änderungen an der Sichtbarkeitslogik immer gegen
die Stufen-Tabelle oben und die Moderationsregeln in
`server/utils/moderation.ts` prüfen.
