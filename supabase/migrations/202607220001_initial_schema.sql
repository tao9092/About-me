-- Personal Achievement Hub: normalized schema, indexes, RLS, and storage policy.
create extension if not exists pgcrypto;

create type public.content_visibility as enum ('public', 'protected', 'private');
create type public.publish_status as enum ('draft', 'published', 'archived');
create type public.registration_status as enum ('interested', 'planning', 'registered', 'completed', 'cancelled');
create type public.file_kind as enum ('upload', 'external');

create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.site_admins
    where user_id = (select auth.uid())
      and lower(email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  )
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;

create table public.site_profile (
  id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check (singleton),
  name_en text not null default 'Your Name', name_zh text, headline_en text not null default 'Creator & problem solver', headline_zh text,
  bio_en text, bio_zh text, avatar_file_id uuid, resume_file_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.site_settings (
  id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check (singleton),
  site_title text not null default 'Personal Achievement Hub', default_locale text not null default 'en' check (default_locale in ('en','zh')),
  protected_password_hint text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), name_en text not null, name_zh text, slug text not null unique,
  entity_type text, sort_order integer not null default 0 check (sort_order >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tags (
  id uuid primary key default gen_random_uuid(), name_en text not null, name_zh text, slug text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.files (
  id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete restrict,
  kind public.file_kind not null default 'upload', original_name text not null, storage_path text unique, bucket text,
  external_url text, mime_type text, extension text, size_bytes bigint not null default 0 check (size_bytes >= 0),
  category_id uuid references public.categories(id) on delete set null, visibility public.content_visibility not null default 'private',
  status public.publish_status not null default 'draft', alt_en text, alt_zh text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((kind='upload' and storage_path is not null and bucket is not null) or (kind='external' and external_url is not null))
);
alter table public.site_profile add constraint site_profile_avatar_fk foreign key (avatar_file_id) references public.files(id) on delete set null;
alter table public.site_profile add constraint site_profile_resume_fk foreign key (resume_file_id) references public.files(id) on delete set null;

create table public.competitions (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text, content_en text, content_zh text,
  competition_date date not null, end_date date, location text, organizer text, competition_type text, team_name text, placement text, award text, contribution_en text, contribution_zh text,
  github_url text, demo_url text, official_url text, certificate_file_id uuid references public.files(id) on delete set null, cover_file_id uuid references public.files(id) on delete set null,
  category_id uuid references public.categories(id) on delete restrict, visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft',
  is_featured boolean not null default false, sort_order integer not null default 0 check(sort_order>=0), seo_title text, seo_description text,
  published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.upcoming_competitions (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text,
  competition_date date, official_url text, notes_en text, notes_zh text, registration_status public.registration_status not null default 'interested', competition_type text,
  category_id uuid references public.categories(id) on delete restrict, visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft',
  is_featured boolean not null default false, sort_order integer not null default 0 check(sort_order>=0), published_at timestamptz, archived_at timestamptz,
  is_demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.certificates (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text,
  issuer text not null, issued_at date not null, certificate_id text, verification_url text, image_file_id uuid references public.files(id) on delete restrict,
  pdf_file_id uuid references public.files(id) on delete set null, allow_download boolean not null default false, related_competition_id uuid references public.competitions(id) on delete set null,
  category_id uuid references public.categories(id) on delete restrict, visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft',
  is_featured boolean not null default false, sort_order integer not null default 0 check(sort_order>=0), published_at timestamptz, archived_at timestamptz,
  is_demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.education (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text, content_en text, content_zh text,
  school text not null, course_name text not null, degree_level text not null, start_year integer not null check(start_year between 1900 and 2200), end_year integer check(end_year between 1900 and 2200),
  is_current boolean not null default false, cgpa text, category_id uuid references public.categories(id) on delete restrict,
  visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft', is_featured boolean not null default false,
  sort_order integer not null default 0 check(sort_order>=0), published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_year is null or end_year >= start_year)
);
create table public.education_subjects (
  id uuid primary key default gen_random_uuid(), education_id uuid not null references public.education(id) on delete cascade, name text not null, grade text,
  visibility public.content_visibility not null default 'public', sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.education_projects (
  id uuid primary key default gen_random_uuid(), education_id uuid not null references public.education(id) on delete cascade, title text not null, description text, url text,
  sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text, content_en text, content_zh text,
  role text, github_url text, demo_url text, project_date date, tech_stack text[] not null default '{}', cover_file_id uuid references public.files(id) on delete set null,
  category_id uuid references public.categories(id) on delete restrict, visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft',
  is_featured boolean not null default false, sort_order integer not null default 0 check(sort_order>=0), seo_title text, seo_description text,
  published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_media (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, file_id uuid not null references public.files(id) on delete restrict,
  caption_en text, caption_zh text, sort_order integer not null default 0, created_at timestamptz not null default now(), unique(project_id,file_id)
);
create table public.experiences (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text, content_en text, content_zh text,
  experience_type text not null check(experience_type in ('work','internship','club','volunteer','event')), organization text not null, position text not null,
  start_date date not null, end_date date, is_current boolean not null default false, skills text[] not null default '{}', related_url text,
  category_id uuid references public.categories(id) on delete restrict, visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft',
  is_featured boolean not null default false, sort_order integer not null default 0, published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_date is null or end_date >= start_date)
);
create table public.awards (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text,
  award_level text, issuer text not null, award_date date not null, competition_id uuid references public.competitions(id) on delete set null, proof_file_id uuid references public.files(id) on delete set null,
  category_id uuid references public.categories(id) on delete restrict, visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft',
  is_featured boolean not null default false, sort_order integer not null default 0, published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.skills (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, slug text not null unique, summary_en text, summary_zh text,
  skill_category text not null, proficiency text check(proficiency is null or proficiency in ('learning','familiar','proficient','advanced','expert')), icon text,
  visibility public.content_visibility not null default 'public', status public.publish_status not null default 'draft', is_featured boolean not null default false,
  sort_order integer not null default 0, published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.links (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, url text not null, summary_en text, summary_zh text, icon text, link_category text,
  visibility public.content_visibility not null default 'public', status public.publish_status not null default 'draft', show_on_home boolean not null default false,
  sort_order integer not null default 0, published_at timestamptz, archived_at timestamptz, is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.resume_versions (
  id uuid primary key default gen_random_uuid(), title_en text not null, title_zh text, version_label text not null, notes_en text, notes_zh text,
  file_id uuid not null references public.files(id) on delete restrict, is_current boolean not null default false, allow_download boolean not null default true,
  visibility public.content_visibility not null default 'private', status public.publish_status not null default 'draft', published_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index resume_one_current on public.resume_versions(is_current) where is_current;

create table public.entity_tags (
  id uuid primary key default gen_random_uuid(), tag_id uuid not null references public.tags(id) on delete restrict,
  entity_type text not null check(entity_type in ('competition','upcoming_competition','certificate','education','project','experience','award','file')),
  entity_id uuid not null, created_at timestamptz not null default now(), unique(tag_id,entity_type,entity_id)
);
create table public.competition_files (
  competition_id uuid not null references public.competitions(id) on delete cascade, file_id uuid not null references public.files(id) on delete restrict,
  sort_order integer not null default 0, primary key(competition_id,file_id)
);
create table public.education_files (
  education_id uuid not null references public.education(id) on delete cascade, file_id uuid not null references public.files(id) on delete restrict,
  sort_order integer not null default 0, primary key(education_id,file_id)
);
create table public.experience_files (
  experience_id uuid not null references public.experiences(id) on delete cascade, file_id uuid not null references public.files(id) on delete restrict,
  sort_order integer not null default 0, primary key(experience_id,file_id)
);

-- Common filtering indexes.
create index competitions_listing on public.competitions(status,visibility,competition_date desc);
create index competitions_category on public.competitions(category_id); create index projects_listing on public.projects(status,visibility,project_date desc);
create index certificates_listing on public.certificates(status,visibility,issued_at desc); create index upcoming_listing on public.upcoming_competitions(status,visibility,competition_date);
create index education_listing on public.education(status,visibility,start_year desc); create index experience_listing on public.experiences(status,visibility,start_date desc);
create index awards_listing on public.awards(status,visibility,award_date desc); create index skills_listing on public.skills(status,visibility,sort_order);
create index files_listing on public.files(status,visibility,created_at desc); create index entity_tags_entity on public.entity_tags(entity_type,entity_id);

-- Public can only read public/published rows. Protected rows are intentionally served through
-- authenticated server routes after password-cookie verification; the anon key cannot read them.
do $$ declare t text; begin foreach t in array array['site_profile','site_settings','categories','tags','files','competitions','upcoming_competitions','certificates','education','education_subjects','education_projects','projects','project_media','experiences','awards','skills','links','resume_versions','entity_tags','competition_files','education_files','experience_files'] loop execute format('alter table public.%I enable row level security', t); end loop; end $$;

create policy "public profile read" on public.site_profile for select using (true);
create policy "public settings read" on public.site_settings for select using (true);
create policy "public categories read" on public.categories for select using (true);
create policy "public tags read" on public.tags for select using (true);
create policy "public files metadata read" on public.files for select using (status='published' and visibility='public');
create policy "public competitions read" on public.competitions for select using (status='published' and visibility='public');
create policy "public upcoming read" on public.upcoming_competitions for select using (status='published' and visibility='public');
create policy "public certificates read" on public.certificates for select using (status='published' and visibility='public');
create policy "public education read" on public.education for select using (status='published' and visibility='public');
create policy "public projects read" on public.projects for select using (status='published' and visibility='public');
create policy "public experiences read" on public.experiences for select using (status='published' and visibility='public');
create policy "public awards read" on public.awards for select using (status='published' and visibility='public');
create policy "public skills read" on public.skills for select using (status='published' and visibility='public');
create policy "public links read" on public.links for select using (status='published' and visibility='public');
create policy "public resumes read" on public.resume_versions for select using (status='published' and visibility='public');

-- Admin has complete table access. Authorization comes from a server-managed JWT email claim
-- matched against the private site_admins allow-list.
do $$ declare t text; begin foreach t in array array['site_profile','site_settings','categories','tags','files','competitions','upcoming_competitions','certificates','education','education_subjects','education_projects','projects','project_media','experiences','awards','skills','links','resume_versions','entity_tags','competition_files','education_files','experience_files'] loop execute format('create policy "admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t); end loop; end $$;

-- Child records additionally require a readable public parent.
create policy "public education subjects" on public.education_subjects for select using (exists(select 1 from public.education e where e.id=education_id and e.status='published' and e.visibility='public') and visibility='public');
create policy "public education projects" on public.education_projects for select using (exists(select 1 from public.education e where e.id=education_id and e.status='published' and e.visibility='public'));
create policy "public project media" on public.project_media for select using (exists(select 1 from public.projects p where p.id=project_id and p.status='published' and p.visibility='public'));
create policy "public competition files" on public.competition_files for select using (exists(select 1 from public.competitions c where c.id=competition_id and c.status='published' and c.visibility='public'));
create policy "public entity tags" on public.entity_tags for select using (true);

-- Storage: public bucket objects are readable; all writes and private reads require admin.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('public-files','public-files',true,26214400,array['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
 ('private-files','private-files',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip','video/mp4','video/webm','text/plain'])
on conflict(id) do nothing;
create policy "public storage read" on storage.objects for select using (bucket_id='public-files');
create policy "admin storage select" on storage.objects for select using (public.is_admin());
create policy "admin storage insert" on storage.objects for insert with check (public.is_admin());
create policy "admin storage update" on storage.objects for update using (public.is_admin()) with check (public.is_admin());
create policy "admin storage delete" on storage.objects for delete using (public.is_admin());

-- Maintain timestamps.
do $$ declare t text; begin foreach t in array array['site_profile','site_settings','categories','tags','files','competitions','upcoming_competitions','certificates','education','projects','experiences','awards','skills','links','resume_versions'] loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop; end $$;

insert into public.site_profile(singleton,name_en,name_zh,headline_en,headline_zh,bio_en,bio_zh) values
(true,'Your Name','你的名字','Builder, learner & creative technologist','创作者、学习者与科技实践者','Replace this demo profile in Site Settings.','请在网站设置中替换此示例简介。');
insert into public.site_settings(singleton) values(true);
