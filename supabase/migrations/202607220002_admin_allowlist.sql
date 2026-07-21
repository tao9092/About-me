-- Replaces the unsupported custom database setting approach on hosted Supabase.
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_admins
    where user_id = (select auth.uid())
      and lower(email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  )
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- No SELECT policy is added to site_admins, so it cannot be read through the API.
-- After creating the Auth user, insert it with:
-- insert into public.site_admins(user_id, email)
-- select id, email from auth.users where lower(email)=lower('owner@example.com')
-- on conflict (user_id) do update set email=excluded.email;
