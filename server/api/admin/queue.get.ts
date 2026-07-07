// Admin-Queue: offene Reports plus automatisch markierte Inhalte,
// nach Schwere sortiert (held vor limited vor visible).
import { sql } from 'drizzle-orm'
import { requireAdmin } from '../../utils/auth'
import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const result = await db.execute(sql`
    with report_targets as (
      select
        target_kind,
        target_id,
        count(*) filter (where status = 'open') as open_reports,
        array_agg(distinct reason) filter (where status = 'open') as reasons,
        array_agg(note) filter (where status = 'open' and note is not null) as notes,
        max(created_at) as last_report_at
      from reports
      group by target_kind, target_id
      having count(*) filter (where status = 'open') > 0
    ),
    flagged_posts as (
      select 'post' as target_kind, p.id as target_id
      from posts p where p.moderation_status in ('held', 'limited')
    ),
    flagged_events as (
      select 'event' as target_kind, e.account_id as target_id
      from events e where e.moderation_status in ('held', 'limited')
    ),
    all_targets as (
      select target_kind, target_id from report_targets
      union
      select target_kind, target_id from flagged_posts
      union
      select target_kind, target_id from flagged_events
    )
    select
      t.target_kind as "targetKind",
      t.target_id as "targetId",
      coalesce(rt.open_reports, 0)::int as "openReports",
      coalesce(rt.reasons, '{}') as reasons,
      coalesce(rt.notes, '{}') as notes,
      case t.target_kind
        when 'post' then (select p.moderation_status from posts p where p.id = t.target_id)
        when 'event' then (select e.moderation_status from events e where e.account_id = t.target_id)
        else null
      end as "moderationStatus",
      case t.target_kind
        when 'post' then (select left(coalesce(p.body, p.link_url, '(Bild)'), 200) from posts p where p.id = t.target_id)
        when 'event' then (select a.display_name from accounts a where a.id = t.target_id)
        when 'account' then (select a.display_name || ' (@' || a.handle || ')' from accounts a where a.id = t.target_id)
      end as preview,
      case t.target_kind
        when 'post' then (select a.handle from posts p join accounts a on a.id = p.author_account_id where p.id = t.target_id)
        when 'event' then (select a2.handle from events e left join accounts a2 on a2.id = e.created_by_account_id where e.account_id = t.target_id)
        when 'account' then (select a.handle from accounts a where a.id = t.target_id)
      end as "authorHandle",
      rt.last_report_at as "lastReportAt"
    from all_targets t
    left join report_targets rt using (target_kind, target_id)
    order by
      case when t.target_kind in ('post', 'event') then
        case (case t.target_kind
          when 'post' then (select p.moderation_status from posts p where p.id = t.target_id)
          else (select e.moderation_status from events e where e.account_id = t.target_id)
        end)
          when 'held' then 0
          when 'limited' then 1
          else 2
        end
      else 1 end asc,
      coalesce(rt.open_reports, 0) desc,
      rt.last_report_at desc nulls last
    limit 100
  `)

  return { items: result.rows }
})
