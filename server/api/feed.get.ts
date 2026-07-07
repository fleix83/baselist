// Folge-Feed: eigene Posts plus Posts gefolgter Konten, sortiert nach
// Posting-Zeit. 'limited' ist im Feed der Follower sichtbar (begrenzte
// Reichweite heisst: nicht in Entdecken), 'held'/'removed' nie.
// Eigene Posts sieht man auch in 'held' (mit Badge), damit klar ist,
// dass sie in Prüfung sind.
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
        'handle', a.handle,
        'displayName', a.display_name,
        'avatarUrl', a.avatar_url
      ) as author,
      case when s.id is not null then json_build_object(
        'handle', s.handle,
        'displayName', s.display_name
      ) end as subject
    from posts p
    join accounts a on a.id = p.author_account_id and not a.banned
    left join accounts s on s.id = p.subject_account_id
    where
      (
        p.author_account_id = ${account.id}
        and p.moderation_status != 'removed'
      )
      or (
        exists (
          select 1 from follows f
          where f.follower_account_id = ${account.id}
            and f.followed_account_id = p.author_account_id
        )
        and p.moderation_status in ('visible', 'limited')
      )
    order by p.created_at desc
    limit 50
  `)

  return { posts: result.rows }
})
