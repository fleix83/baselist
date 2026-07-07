// Feed: alle öffentlichen Posts chronologisch (Community ist klein –
// der Feed ist damit gleichzeitig die Entdeckungsfläche für Konten).
// Reichweitenregeln bleiben: 'limited' sehen nur Follower, 'held' nur
// die Autorin selbst (mit Badge), 'removed' niemand.
// Später, wenn der Feed voller wird: Posts gefolgter Konten nach oben
// ranken (nur die ORDER BY anpassen).
import { sql } from 'drizzle-orm'
import { requireUser } from '../utils/auth'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)

  const result = await db.execute(sql`
    select
      p.id,
      p.body,
      p.image_url as "imageUrl",
      p.link_url as "linkUrl",
      p.moderation_status as "moderationStatus",
      p.created_at as "createdAt",
      json_build_object(
        'id', a.id,
        'handle', a.handle,
        'displayName', a.display_name,
        'avatarUrl', a.avatar_url
      ) as author,
      case when s.id is not null then json_build_object(
        'handle', s.handle,
        'displayName', s.display_name
      ) end as subject,
      (p.author_account_id = ${account.id}) as "isOwn",
      exists (
        select 1 from follows f
        where f.follower_account_id = ${account.id}
          and f.followed_account_id = p.author_account_id
      ) as "isFollowed"
    from posts p
    join accounts a on a.id = p.author_account_id and not a.banned
    left join accounts s on s.id = p.subject_account_id
    where
      -- eigene Posts (auch 'held', als 'in Prüfung' markiert)
      (
        p.author_account_id = ${account.id}
        and p.moderation_status != 'removed'
      )
      -- Posts gefolgter Konten inkl. begrenzter Reichweite
      or (
        exists (
          select 1 from follows f
          where f.follower_account_id = ${account.id}
            and f.followed_account_id = p.author_account_id
        )
        and p.moderation_status in ('visible', 'limited')
      )
      -- alle übrigen: nur volle Sichtbarkeit
      or p.moderation_status = 'visible'
    order by p.created_at desc
    limit 50
  `)

  return { posts: result.rows }
})
