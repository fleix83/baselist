import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Kontotypen laut PRD: alles Folgbare ist ein Konto.
export type AccountType = 'person' | 'event' | 'venue' | 'organizer' | 'business'
export type EventCategory =
  | 'musik' | 'nightlife' | 'kunst' | 'sport' | 'talk' | 'essen' | 'campus' | 'sonstiges'
export type EventStatus = 'planned' | 'live' | 'past' | 'cancelled'
export type ModerationStatus = 'visible' | 'limited' | 'held' | 'removed'
export type RsvpState = 'saved' | 'going'
export type ReportReason = 'spam' | 'hate' | 'illegal' | 'fake_event' | 'other'

// Einheitliches Kontomodell — föderationsbereit (handle + home_instance),
// Föderation selbst wird nicht gebaut.
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: text('handle').notNull(),
  homeInstance: text('home_instance').notNull().default('baselist'),
  type: text('type').$type<AccountType>().notNull(),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  verified: boolean('verified').notNull().default(false),
  trustLevel: integer('trust_level').notNull().default(0),
  banned: boolean('banned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('accounts_handle_unique').on(t.handle),
  index('accounts_type_idx').on(t.type),
])

// Verknüpfung Auth-User (Neon Auth) <-> Personen-Konto
export const users = pgTable('users', {
  authUserId: text('auth_user_id').primaryKey(),
  accountId: uuid('account_id').notNull().unique().references(() => accounts.id),
  email: text('email').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  interests: jsonb('interests').$type<EventCategory[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Aggregations-Quellen
export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // 'ical' = generischer ICS-Feed; 'unibas' = Uni-Basel-RSS + Per-Event-ICS
  kind: text('kind').$type<'eventfrog' | 'ical' | 'unibas'>().notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastStatus: text('last_status'),
})

// Event-Erweiterung eines Kontos vom Typ 'event'
export const events = pgTable('events', {
  accountId: uuid('account_id').primaryKey().references(() => accounts.id),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  venueAccountId: uuid('venue_account_id').references(() => accounts.id),
  address: text('address'),
  category: text('category').$type<EventCategory>(),
  priceInfo: text('price_info'),
  description: text('description'), // nur bei nutzererstellten Events, nie kopierte Fremdtexte
  imageUrl: text('image_url'),
  imageCopyright: text('image_copyright'), // Copyright-Hinweis aus der Quelle (Pflicht bei Quellbild)
  status: text('status').$type<EventStatus>().notNull().default('planned'),
  moderationStatus: text('moderation_status').$type<ModerationStatus>().notNull().default('visible'),
  sourceId: uuid('source_id').references(() => sources.id), // null = nutzererstellt
  sourceUrl: text('source_url'), // Pflicht bei Aggregation
  externalId: text('external_id'),
  dedupHash: text('dedup_hash'),
  createdByAccountId: uuid('created_by_account_id').references(() => accounts.id),
}, (t) => [
  uniqueIndex('events_source_external_unique').on(t.sourceId, t.externalId),
  index('events_starts_at_idx').on(t.startsAt),
  index('events_category_idx').on(t.category),
  index('events_dedup_hash_idx').on(t.dedupHash),
])

// Posts (News-Layer und Event-Updates)
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorAccountId: uuid('author_account_id').notNull().references(() => accounts.id),
  subjectAccountId: uuid('subject_account_id').references(() => accounts.id), // z.B. Post "am" Event
  body: text('body'),
  imageUrl: text('image_url'),
  linkUrl: text('link_url'), // Video/Links nur als Embed
  moderationStatus: text('moderation_status').$type<ModerationStatus>().notNull().default('visible'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('posts_author_created_idx').on(t.authorAccountId, t.createdAt),
  index('posts_subject_idx').on(t.subjectAccountId),
])

export const follows = pgTable('follows', {
  followerAccountId: uuid('follower_account_id').notNull().references(() => accounts.id),
  followedAccountId: uuid('followed_account_id').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.followerAccountId, t.followedAccountId] }),
  index('follows_follower_idx').on(t.followerAccountId),
  index('follows_followed_idx').on(t.followedAccountId),
])

export const rsvps = pgTable('rsvps', {
  userAccountId: uuid('user_account_id').notNull().references(() => accounts.id),
  eventAccountId: uuid('event_account_id').notNull().references(() => events.accountId),
  state: text('state').$type<RsvpState>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userAccountId, t.eventAccountId] }),
  index('rsvps_event_idx').on(t.eventAccountId),
])

// Moderation
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterAccountId: uuid('reporter_account_id').references(() => accounts.id), // null = System (AI-Check)
  targetKind: text('target_kind').$type<'post' | 'event' | 'account'>().notNull(),
  targetId: uuid('target_id').notNull(),
  reason: text('reason').$type<ReportReason>().notNull(),
  note: text('note'),
  status: text('status').$type<'open' | 'resolved'>().notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('reports_status_idx').on(t.status),
  index('reports_target_idx').on(t.targetKind, t.targetId),
])

export const moderationLog = pgTable('moderation_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actor: text('actor').notNull(), // Admin-Handle oder 'system'
  action: text('action').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: uuid('target_id').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rateLimits = pgTable('rate_limits', {
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  action: text('action').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.accountId, t.action, t.windowStart] }),
])
