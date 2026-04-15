-- projects
create table if not exists public.projects (
  id text primary key,
  user_id text not null,
  title text not null,
  "order" integer not null default 0,
  created_at text not null,
  updated_at text not null
);

-- tasks
create table if not exists public.tasks (
  id text primary key,
  user_id text not null,
  title text not null,
  project text default '',
  project_id text references public.projects(id) on delete set null,
  hours numeric not null default 1,
  urgency integer not null default 0,
  status text not null default 'todo',
  "order" integer not null default 0,
  created_at text not null,
  updated_at text not null
);

-- plans
create table if not exists public.plans (
  id text primary key,
  user_id text not null,
  date text not null,
  title text not null,
  linked_task_id text references public.tasks(id) on delete set null,
  priority text not null,
  status text not null default 'planned',
  "order" integer not null default 0
);

-- distractions
create table if not exists public.distractions (
  id text primary key,
  user_id text not null,
  date text not null,
  content text not null,
  captured_at text not null,
  resolved boolean not null default false,
  linked_task_id text references public.tasks(id) on delete set null
);

-- notes
create table if not exists public.notes (
  id text primary key,
  user_id text not null,
  session_id text not null,
  content text not null,
  created_at text not null
);

-- sessions
create table if not exists public.sessions (
  id text primary key,
  user_id text not null,
  date text not null,
  project_title text not null,
  task_title text not null,
  hours numeric not null default 0,
  started_at text not null,
  ended_at text not null,
  start_time text not null,
  end_time text not null,
  raw_data jsonb not null
);

-- settings
create table if not exists public.settings (
  user_id text primary key,
  focus_minutes integer not null default 25,
  short_break_minutes integer not null default 5,
  long_break_minutes integer not null default 15,
  long_break_every integer not null default 4,
  auto_start_breaks boolean not null default false,
  auto_start_focus boolean not null default false,
  sound_enabled boolean not null default true,
  sound_type text not null default 'bell',
  notification_enabled boolean not null default false,
  theme text not null default 'system'
);

-- RLS
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.plans enable row level security;
alter table public.distractions enable row level security;
alter table public.notes enable row level security;
alter table public.settings enable row level security;
alter table public.sessions enable row level security;

-- Legacy reference: this migration is retained for historical comparison only.
-- The current app uses a local file-backed store instead of Supabase.

drop policy if exists "user_projects" on public.projects;
create policy "user_projects" on public.projects for all using (true) with check (true);

drop policy if exists "user_tasks" on public.tasks;
create policy "user_tasks" on public.tasks for all using (true) with check (true);

drop policy if exists "user_plans" on public.plans;
create policy "user_plans" on public.plans for all using (true) with check (true);

drop policy if exists "user_distractions" on public.distractions;
create policy "user_distractions" on public.distractions for all using (true) with check (true);

drop policy if exists "user_notes" on public.notes;
create policy "user_notes" on public.notes for all using (true) with check (true);

drop policy if exists "user_settings" on public.settings;
create policy "user_settings" on public.settings for all using (true) with check (true);

drop policy if exists "user_sessions" on public.sessions;
create policy "user_sessions" on public.sessions for all using (true) with check (true);
