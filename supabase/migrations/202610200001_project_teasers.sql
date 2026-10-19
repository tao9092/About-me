-- Protected projects are listed on the public site by their teaser while their
-- write-up stays private. Anonymous visitors can't read protected rows of
-- public.projects (RLS); this view, which runs with its owner's rights, gives
-- them only these columns of published protected projects. The project page
-- shows such a project as private.
create view public.project_teasers with (security_invoker = false) as
  select id, slug, title_en, title_zh, summary_en, summary_zh, role, project_date, tech_stack,
         visibility, is_featured, sort_order, updated_at
  from public.projects
  where status = 'published' and visibility = 'protected';

revoke all on public.project_teasers from anon, authenticated;
grant select on public.project_teasers to anon, authenticated;
