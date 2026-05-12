-- ─────────────────────────────────────────────────────────────
-- Community Notifications table
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  actor_id      uuid not null references auth.users(id) on delete cascade,
  type          text not null,           -- 'comment_on_post' | 'reply_on_comment'
  post_id       uuid not null references public.posts(id) on delete cascade,
  comment_preview text,                  -- first 100 chars of the comment
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Index for fast lookup per recipient
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- ── Row Level Security ──────────────────────────────────────
alter table public.notifications enable row level security;

-- Anyone can insert notifications (actor creates notif for recipient)
create policy "notifications_insert" on public.notifications
  for insert with check (auth.uid() = actor_id);

-- Only the recipient can read their own notifications
create policy "notifications_select" on public.notifications
  for select using (auth.uid() = recipient_id);

-- Only the recipient can update (mark as read)
create policy "notifications_update" on public.notifications
  for update using (auth.uid() = recipient_id);

-- Only the recipient can delete their own notifications
create policy "notifications_delete" on public.notifications
  for delete using (auth.uid() = recipient_id);

-- ── Enable Realtime for the table ──────────────────────────
alter publication supabase_realtime add table public.notifications;
