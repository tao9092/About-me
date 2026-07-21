"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { saveContentAction } from "@/app/actions/content";
import type { EntityTable } from "@/lib/content";
import { slugify } from "@/lib/utils";

type Field = [name: string, label: string, type: string];

const fields: Record<EntityTable, Field[]> = {
  competitions: [["competition_date", "Competition date", "date"], ["organizer", "Organizer", "text"], ["competition_type", "Competition category", "text"], ["team_name", "Team name", "text"], ["placement", "Placement", "text"], ["award", "Award", "text"], ["github_url", "GitHub repository", "url"], ["demo_url", "Demo link", "url"], ["official_url", "Official website", "url"]],
  upcoming_competitions: [["competition_date", "Competition date", "date"], ["official_url", "Official link", "url"], ["registration_status", "Registration status: interested / planning / registered / completed / cancelled", "text"], ["competition_type", "Competition category", "text"]],
  certificates: [["issuer", "Issuing organization", "text"], ["issued_at", "Issue date", "date"], ["certificate_id", "Certificate ID", "text"], ["verification_url", "Verification link", "url"]],
  education: [["school", "School", "text"], ["course_name", "Course name", "text"], ["degree_level", "Degree level", "text"], ["start_year", "Start year", "number"], ["end_year", "End year", "number"], ["cgpa", "CGPA", "text"]],
  projects: [["role", "My role", "text"], ["project_date", "Project date", "date"], ["github_url", "GitHub repository", "url"], ["demo_url", "Live demo", "url"], ["tech_stack", "Technology stack, comma separated", "text"]],
  experiences: [["experience_type", "Type: work / internship / club / volunteer / event", "text"], ["organization", "Organization", "text"], ["position", "Position", "text"], ["start_date", "Start date", "date"], ["end_date", "End date", "date"], ["related_url", "Related link", "url"]],
  awards: [["award_level", "Award level", "text"], ["issuer", "Issuing organization", "text"], ["award_date", "Award date", "date"]],
  skills: [["skill_category", "Skill category", "text"], ["proficiency", "Level: learning / familiar / proficient / advanced / expert", "text"], ["icon", "Icon name", "text"]],
  links: [["url", "URL", "url"], ["link_category", "Link category", "text"], ["icon", "Icon name", "text"]],
};

const required: Record<EntityTable, string[]> = {
  competitions: ["competition_date"], upcoming_competitions: [], certificates: ["issuer", "issued_at"],
  education: ["school", "course_name", "degree_level", "start_year"], projects: [],
  experiences: ["experience_type", "organization", "position", "start_date"], awards: ["issuer", "award_date"],
  skills: ["skill_category", "proficiency"], links: ["url"],
};

function FieldInput({ field, record, isRequired }: { field: Field; record?: Record<string, unknown>; isRequired: boolean }) {
  const [name, label, type] = field;
  return <label>{label} {isRequired && <em aria-label="required">*</em>}<input name={name} type={type} required={isRequired} defaultValue={String(record?.[name] ?? "")} /></label>;
}

export function ContentForm({ entity, record }: { entity: EntityTable; record?: Record<string, unknown> }) {
  const [state, action] = useActionState(saveContentAction, null);
  const [title, setTitle] = useState(String(record?.title_en ?? ""));
  const [slug, setSlug] = useState(String(record?.slug ?? ""));
  const [certificatePreview, setCertificatePreview] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);
  useEffect(() => () => {
    if (certificatePreview) URL.revokeObjectURL(certificatePreview);
  }, [certificatePreview]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (title && !state?.success) event.preventDefault(); };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [title, state]);

  const requiredFields = fields[entity].filter(([name]) => required[entity].includes(name));
  const optionalFields = fields[entity].filter(([name]) => !required[entity].includes(name));

  return <form action={action} className="content-form simplified-form">
    <input type="hidden" name="entity" value={entity} />
    {Boolean(record?.id) && <input type="hidden" name="record_id" value={String(record?.id)} />}
    <p className="required-note"><span>*</span> Required — everything else, including Category, is optional.</p>
    <section className="form-panel">
      <div><h2>Essentials</h2><p>Enough to save your first Draft.</p></div>
      <div className="form-fields two-col">
        <label>Title <em aria-label="required">*</em><input name="title_en" value={title} onChange={(event) => { setTitle(event.target.value); if (!record) setSlug(slugify(event.target.value)); }} required minLength={2} /></label>
        <label>Slug <em aria-label="required">*</em><input name="slug" value={slug} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
        <label className="full-field">Short summary<textarea name="summary_en" defaultValue={String(record?.summary_en ?? "")} rows={4} /></label>
        <label>Visibility<select name="visibility" defaultValue={String(record?.visibility ?? "private")}><option value="private">Private — owner only</option><option value="protected">Protected — shared password</option><option value="public">Public — anyone</option></select></label>
        {requiredFields.map((field) => <FieldInput key={field[0]} field={field} record={record} isRequired />)}
        {entity === "certificates" && <div className="certificate-image-field full-field">
          <label htmlFor="certificate-image">Certificate image</label>
          <p>Optional · PNG, JPG or WEBP. Choose a file from your device.</p>
          <input id="certificate-image" name="certificate_image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            setCertificatePreview(file ? URL.createObjectURL(file) : null);
          }} />
          {certificatePreview && <div className="certificate-image-preview"><Image src={certificatePreview} alt="Selected certificate preview" fill unoptimized sizes="(max-width: 600px) 100vw, 680px" /></div>}
        </div>}
      </div>
    </section>
    <details className="optional-panel" open={Boolean(record)}>
      <summary><span><strong>Optional details</strong><small>Chinese content, full description, links, sorting and featured settings</small></span><b>Expand</b></summary>
      <div className="optional-panel-content">
        <section className="form-panel"><div><h2>More details</h2><p>Complete these whenever you are ready.</p></div><div className="form-fields two-col">{optionalFields.map((field) => <FieldInput key={field[0]} field={field} record={record} isRequired={false} />)}</div></section>
        <section className="form-panel"><div><h2>Full description</h2><p>Optional long-form content.</p></div><div className="form-fields"><textarea aria-label="Detailed content" name="content_en" defaultValue={String(record?.content_en ?? "")} rows={10} /></div></section>
        <section className="form-panel"><div><h2>简体中文</h2><p>留空时公开页面会使用英文内容。</p></div><div className="form-fields"><label>标题<input name="title_zh" defaultValue={String(record?.title_zh ?? "")} /></label><label>摘要<textarea name="summary_zh" defaultValue={String(record?.summary_zh ?? "")} rows={4} /></label><label>详细内容<textarea name="content_zh" defaultValue={String(record?.content_zh ?? "")} rows={8} /></label></div></section>
        <section className="form-panel"><div><h2>Display options</h2><p>Optional ordering and homepage placement.</p></div><div className="form-fields two-col"><label>Sort order<input name="sort_order" type="number" min="0" defaultValue={String(record?.sort_order ?? 0)} /></label><label className="check-label"><input name="is_featured" type="checkbox" defaultChecked={Boolean(record?.is_featured)} /> Feature this record</label></div></section>
      </div>
    </details>
    {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    <div className="sticky-actions"><span>New records always begin as Draft.</span><Submit /></div>
  </form>;
}

function Submit() {
  const { pending } = useFormStatus();
  return <button className="button" disabled={pending}>{pending ? "Saving…" : "Save draft"}</button>;
}
