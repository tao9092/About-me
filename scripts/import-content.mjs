// Bulk-import portfolio records from a JSON file into Supabase as drafts.
//
//   npm run import:content -- content-import/file.json           dry run (default)
//   npm run import:content -- content-import/file.json --apply   write the drafts
//
// The JSON maps table names to arrays of records, e.g. { "competitions": [...] }.
// Keys starting with "$" are notes and are ignored. Records are validated with
// the same rules as the admin forms, get a slug from their English title when
// none is given, and are always inserted as drafts so they can be reviewed and
// published from /admin. A record whose slug or title already exists is skipped,
// never overwritten.
//
// Certificates may name local files, relative to the JSON file: "image" (PNG,
// JPG or WEBP, shown on the public page) and "pdf". They are uploaded to Storage
// and recorded in the File Library exactly like the admin form's upload.
// "related_competition" takes a competition slug.
//
// Writing needs SUPABASE_SERVICE_ROLE_KEY in .env.local (server-only; .env* is
// gitignored). Without it a dry run can only see published, public rows.
import { randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Mirrors slugify() in src/lib/utils.ts so imported slugs match the admin's.
function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

// Mirrors sanitizeRichText() in src/lib/sanitize.ts.
function sanitizeRichText(value) {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "strong", "em", "s", "blockquote", "ul", "ol", "li", "h2", "h3", "h4", "code", "pre", "a", "hr"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
  });
}

const comparableTitle = (value) => slugify(value).replaceAll("-", "");

// Empty strings in the JSON mean "not set", like a blank admin form field.
const blank = (schema) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? null : value), schema.nullable().optional());
const text = (max = 180) => blank(z.string().trim().max(max));
const required = (max = 180) => z.string().trim().min(2).max(max);
const date = z.iso.date();
const url = z.url({ protocol: /^https?$/ });
const words = z.array(z.string().trim().min(1).max(60)).max(30).default([]);

const titles = { title_en: required(), title_zh: z.string().trim().max(180).default("") };
const summaries = { summary_en: z.string().trim().max(600).default(""), summary_zh: z.string().trim().max(600).default("") };
const contents = { content_en: z.string().max(100_000).default(""), content_zh: z.string().max(100_000).default("") };
const listing = {
  visibility: z.enum(["public", "protected", "private"]).default("public"),
  sort_order: z.number().int().min(0).max(100_000).default(0),
};
const record = (shape) =>
  z.strictObject({
    ...titles,
    slug: z.string().trim().min(2).max(180).regex(SLUG).optional(),
    ...summaries,
    ...listing,
    is_featured: z.boolean().default(false),
    ...shape,
  });
const endNotBefore = (start, end) => (row) => !row[end] || !row[start] || row[end] >= row[start];

const schemas = {
  competitions: record({
    ...contents,
    competition_date: date,
    end_date: blank(date),
    location: text(),
    organizer: text(),
    competition_type: text(),
    team_name: text(),
    placement: text(120),
    award: text(),
    contribution_en: text(2000),
    contribution_zh: text(2000),
    github_url: blank(url),
    demo_url: blank(url),
    official_url: blank(url),
  }).refine(endNotBefore("competition_date", "end_date"), { message: "must not be before competition_date", path: ["end_date"] }),
  upcoming_competitions: record({
    competition_date: blank(date),
    official_url: blank(url),
    notes_en: text(2000),
    notes_zh: text(2000),
    registration_status: z.enum(["interested", "planning", "registered", "completed", "cancelled"]).default("interested"),
    competition_type: text(),
  }),
  certificates: record({
    issuer: required(),
    issued_at: date,
    certificate_id: text(),
    verification_url: blank(url),
    allow_download: z.boolean().default(false),
    image: z.string().trim().min(1).optional(),
    pdf: z.string().trim().min(1).optional(),
    related_competition: z.string().trim().regex(SLUG).optional(),
  }),
  education: record({
    ...contents,
    school: required(),
    course_name: required(),
    degree_level: z.string().trim().min(1).max(120),
    start_year: z.number().int().min(1900).max(2200),
    end_year: blank(z.number().int().min(1900).max(2200)),
    is_current: z.boolean().default(false),
    cgpa: text(20),
  }).refine(endNotBefore("start_year", "end_year"), { message: "must not be before start_year", path: ["end_year"] }),
  projects: record({
    ...contents,
    role: text(160),
    project_date: blank(date),
    github_url: blank(url),
    demo_url: blank(url),
    tech_stack: words,
  }),
  experiences: record({
    ...contents,
    experience_type: z.enum(["work", "internship", "club", "volunteer", "event"]),
    organization: required(),
    position: required(),
    start_date: date,
    end_date: blank(date),
    is_current: z.boolean().default(false),
    skills: words,
    related_url: blank(url),
  }).refine(endNotBefore("start_date", "end_date"), { message: "must not be before start_date", path: ["end_date"] }),
  awards: record({ award_level: text(), issuer: required(), award_date: date }),
  // The four Capabilities / 03 dimensions; see getCapabilityId() in capability-atlas.tsx.
  skills: record({
    skill_category: z.enum(["learning", "adaptive", "physical", "social"]),
    proficiency: z.enum(["learning", "familiar", "proficient", "advanced", "expert"]),
    icon: text(60),
  }),
  links: z.strictObject({
    ...titles,
    ...summaries,
    ...listing,
    url,
    link_category: text(),
    icon: text(60),
    show_on_home: z.boolean().default(false),
  }),
};

// Same file rules as validateUpload() and the certificate form's image check.
const attachmentTypes = {
  image: { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" },
  pdf: { pdf: "application/pdf" },
};

function readAttachment(kind, value, baseDir) {
  const path = resolve(baseDir, value);
  const extension = extname(path).slice(1).toLowerCase();
  const mimeType = attachmentTypes[kind][extension];
  if (!mimeType) return { problem: `${kind}: must be a ${Object.keys(attachmentTypes[kind]).join(", ")} file` };
  let size;
  try {
    size = statSync(path).size;
  } catch {
    return { problem: `${kind}: no file at ${path}` };
  }
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 25);
  if (size <= 0 || size > maxMb * 1024 * 1024) return { problem: `${kind}: must be smaller than ${maxMb} MB` };
  return { attachment: { kind, path, name: basename(path), extension, mimeType, size } };
}

const kilobytes = (size) => `${Math.max(1, Math.round(size / 1024))} KB`;

// Thrown for expected problems; main() prints the message and exits non-zero.
// The script never calls process.exit(): on Windows that can abort Node while
// Supabase's HTTP connections are still closing.
class ImportError extends Error {}
function fail(message) {
  throw new ImportError(message);
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) fail("Usage: npm run import:content -- <file.json> [--apply]");
  const apply = flags.includes("--apply");

  try {
    process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
  } catch {
    fail("Could not read .env.local next to package.json.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is missing from .env.local.");
  if (apply && !serviceKey) {
    fail(
      "--apply needs SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
        "Copy the secret key from Supabase → Project Settings → API Keys and paste it after the = sign.",
    );
  }
  if (!serviceKey) {
    console.warn("No SUPABASE_SERVICE_ROLE_KEY: only published public rows are visible, so drafts are not checked for duplicates.");
  }
  const supabase = createClient(supabaseUrl, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Could not read ${file}: ${error.message}`);
  }
  const baseDir = dirname(resolve(file));

  // Competition slugs that exist or are inserted earlier in this run, for
  // certificates' related_competition.
  let competitionSlugs = null;
  const plannedCompetitions = new Set();
  async function competitionKnown(slug) {
    if (!competitionSlugs) {
      const { data: rows, error } = await supabase.from("competitions").select("slug");
      if (error) fail(`Could not read competitions: ${error.message}`);
      competitionSlugs = new Set(rows.map((row) => row.slug));
    }
    return competitionSlugs.has(slug) || plannedCompetitions.has(slug);
  }

  const plan = [];
  let invalid = 0;
  let skipped = 0;
  for (const [table, records] of Object.entries(data)) {
    if (table.startsWith("$")) continue;
    const schema = schemas[table];
    if (!schema) fail(`Unknown table "${table}". Expected one of: ${Object.keys(schemas).join(", ")}.`);
    if (!Array.isArray(records)) fail(`"${table}" must be an array of records.`);

    // Links have no slug; they are matched by URL instead.
    const keyColumn = table === "links" ? "url" : "slug";
    const { data: existing, error } = await supabase.from(table).select(`${keyColumn},title_en`);
    if (error) fail(`Could not read ${table}: ${error.message}`);
    const takenKeys = new Map(existing.map((row) => [row[keyColumn], row.title_en]));
    const takenTitles = new Map(existing.map((row) => [comparableTitle(row.title_en), row.title_en]));

    console.log(`\n${table} (${records.length})`);
    const items = [];
    for (const [index, input] of records.entries()) {
      const parsed = schema.safeParse(input);
      const problems = parsed.success
        ? []
        : parsed.error.issues.map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`);
      const row = parsed.data ?? {};
      const attachments = [];
      for (const kind of ["image", "pdf"]) {
        if (!row[kind]) continue;
        const { attachment, problem } = readAttachment(kind, row[kind], baseDir);
        delete row[kind];
        if (problem) problems.push(problem);
        else attachments.push(attachment);
      }
      const related = row.related_competition;
      delete row.related_competition;
      if (related && !(await competitionKnown(related))) {
        problems.push(`related_competition: no competition with slug "${related}"`);
      }
      if (problems.length) {
        invalid += 1;
        console.log(`  ! invalid  #${index + 1} ${input?.title_en ?? ""}\n             ${problems.join("\n             ")}`);
        continue;
      }

      if (table !== "links") row.slug ??= slugify(row.title_en);
      const key = row[keyColumn];
      const sameTitle = takenTitles.get(comparableTitle(row.title_en));
      if (takenKeys.has(key) || sameTitle) {
        skipped += 1;
        console.log(`  = skip     ${key}  (already exists as "${takenKeys.get(key) ?? sameTitle}")`);
        continue;
      }
      takenKeys.set(key, row.title_en);
      takenTitles.set(comparableTitle(row.title_en), row.title_en);
      if (table === "competitions") plannedCompetitions.add(row.slug);
      if ("content_en" in row) {
        row.content_en = sanitizeRichText(row.content_en);
        row.content_zh = sanitizeRichText(row.content_zh);
      }
      items.push({ row: { ...row, status: "draft", is_demo: false }, attachments, related });
      const extras = [
        ...attachments.map((attachment) => `${attachment.kind} ${kilobytes(attachment.size)}`),
        ...(related ? [`competition ${related}`] : []),
      ];
      console.log(`  + insert   ${key}  ${row.title_en}${extras.length ? `  [${extras.join(", ")}]` : ""}`);
    }
    if (items.length) plan.push({ table, items });
  }

  const inserts = plan.reduce((total, step) => total + step.items.length, 0);
  console.log(`\n${inserts} to insert as drafts, ${skipped} skipped, ${invalid} invalid.`);
  if (invalid) fail("Fix the invalid records above; nothing was written.");
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write them.");
    return;
  }

  // Uploads mirror uploadValidatedFile(): bucket by visibility, owner/date/uuid path.
  let ownerId;
  async function upload(attachment, visibility, created) {
    if (ownerId === undefined) {
      const { data: admins, error } = await supabase.from("site_admins").select("user_id").limit(1);
      if (error) fail(`Could not read the site owner: ${error.message}`);
      ownerId = admins[0]?.user_id ?? null;
    }
    const bucket = visibility === "public" ? "public-files" : "private-files";
    const path = `${ownerId ?? "import"}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${attachment.extension}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, readFileSync(attachment.path), { contentType: attachment.mimeType, upsert: false, cacheControl: "3600" });
    if (uploadError) fail(`Uploading ${attachment.name} failed: ${uploadError.message}`);
    created.objects.push({ bucket, path });
    const { data: fileRecord, error } = await supabase
      .from("files")
      .insert({
        owner_id: ownerId,
        kind: "upload",
        original_name: attachment.name,
        storage_path: path,
        bucket,
        mime_type: attachment.mimeType,
        extension: attachment.extension,
        size_bytes: attachment.size,
        visibility,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) fail(`Recording ${attachment.name} failed: ${error.message}`);
    created.files.push(fileRecord.id);
    return fileRecord.id;
  }

  for (const { table, items } of plan) {
    const created = { objects: [], files: [] };
    try {
      const rows = [];
      for (const { row, attachments, related } of items) {
        for (const attachment of attachments) {
          row[`${attachment.kind}_file_id`] = await upload(attachment, row.visibility, created);
        }
        if (related) {
          const { data: competition, error } = await supabase.from("competitions").select("id").eq("slug", related).single();
          if (error) fail(`Could not find competition "${related}": ${error.message}`);
          row.related_competition_id = competition.id;
        }
        rows.push(row);
      }
      const { error } = await supabase.from(table).insert(rows);
      if (error) fail(`Inserting into ${table} failed: ${error.message}`);
    } catch (error) {
      // Leave no orphaned uploads behind, like the admin form's cleanup.
      if (created.files.length) await supabase.from("files").delete().in("id", created.files);
      for (const bucket of new Set(created.objects.map((object) => object.bucket))) {
        await supabase.storage.from(bucket).remove(created.objects.filter((object) => object.bucket === bucket).map((object) => object.path));
      }
      throw error;
    }
    const uploads = created.objects.length ? ` with ${created.objects.length} uploaded file(s)` : "";
    console.log(`Inserted ${items.length} draft(s) into ${table}${uploads}. Review them at /admin/${table.replaceAll("_", "-")}.`);
  }
}

main().catch((error) => {
  if (!(error instanceof ImportError)) throw error;
  console.error(`\n${error.message}\n`);
  process.exitCode = 1;
});
