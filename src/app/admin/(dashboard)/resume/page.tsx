import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createResumeAction } from "@/app/actions/admin-meta";
import { Badge, EmptyState } from "@/components/ui";
export default async function Page() {
  const supabase = await createClient();
  const [{ data: versions, error }, { data: pdfs }] = await Promise.all([
    supabase
      .from("resume_versions")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("files")
      .select("id,original_name")
      .eq("mime_type", "application/pdf")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Documents</p>
          <h1>Resume</h1>
          <p>Create versioned resume drafts from PDFs in the File Library.</p>
        </div>
        <Link className="button button-secondary" href="/admin/file-library">
          Upload PDF
        </Link>
      </header>
      <section className="admin-panel">
        <h2>Add resume version</h2>
        <form
          action={createResumeAction}
          className="meta-inline-form resume-form"
        >
          <label>
            Title <em aria-label="required">*</em>
            <input name="title_en" required placeholder="Current resume" />
          </label>
          <label>
            Version <em aria-label="required">*</em>
            <input name="version_label" required placeholder="2026.1" />
          </label>
          <label>
            PDF file <em aria-label="required">*</em>
            <select name="file_id" required defaultValue="">
              <option value="" disabled>
                Select uploaded PDF
              </option>
              {pdfs?.map((file) => (
                <option value={file.id} key={file.id}>
                  {file.original_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visibility <em aria-label="required">*</em>
            <select name="visibility" defaultValue="private">
              <option value="private">Private</option>
              <option value="protected">Protected</option>
              <option value="public">Public</option>
            </select>
          </label>
          <label className="check-label">
            <input type="checkbox" name="allow_download" /> Allow download
          </label>
          <button className="button">Create draft</button>
        </form>
      </section>
      {!versions?.length ? (
        <EmptyState
          title="No resume versions"
          description="Upload a PDF, then create the first version above."
          action="Open File Library"
          href="/admin/file-library"
        />
      ) : (
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Version history</h2>
            <Badge>{versions.length} versions</Badge>
          </div>
          <div className="taxonomy-list">
            {versions.map((version) => (
              <article key={version.id}>
                <div>
                  <strong>{version.title_en}</strong>
                  <span>{version.version_label}</span>
                </div>
                <Badge
                  tone={version.status === "published" ? "success" : "warning"}
                >
                  {version.status}
                </Badge>
                <span>{version.visibility}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
