alter table public.tasks
  add column if not exists project text default '',
  add column if not exists hours numeric default 1;

update public.tasks
set
  project = coalesce(project, ''),
  hours = coalesce(hours, 1);
