import { z } from "zod";

export const visibilitySchema = z.enum(["public", "protected", "private"]);
export const statusSchema = z.enum(["draft", "published", "archived"]);

const optionalUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional();
export const baseContentSchema = z.object({
  id: z.uuid().optional(),
  title_en: z.string().trim().min(2).max(180),
  title_zh: z.string().trim().max(180).optional().default(""),
  slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary_en: z.string().trim().max(600).optional().default(""),
  summary_zh: z.string().trim().max(600).optional().default(""),
  content_en: z.string().max(100_000).optional().default(""),
  content_zh: z.string().max(100_000).optional().default(""),
  visibility: visibilitySchema.default("private"),
  is_featured: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(100_000).default(0),
});

export const certificateSchema = baseContentSchema.extend({
  issuer: z.string().trim().min(2).max(180),
  issued_at: z.iso.date(),
  certificate_id: z.string().trim().max(180).optional(),
  verification_url: optionalUrl,
  image_file_id: z.uuid().nullable().optional(),
  pdf_file_id: z.uuid().nullable().optional(),
  allow_download: z.boolean().default(false),
});

export const projectSchema = baseContentSchema.extend({
  role: z.string().trim().max(160).optional(),
  project_date: z.iso.date().optional().or(z.literal("")),
  github_url: optionalUrl,
  demo_url: optionalUrl,
  tech_stack: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export const competitionSchema = baseContentSchema.extend({
  competition_date: z.iso.date(),
  location: z.string().trim().max(180).optional(),
  organizer: z.string().trim().max(180).optional(),
  team_name: z.string().trim().max(180).optional(),
  placement: z.string().trim().max(120).optional(),
  award: z.string().trim().max(180).optional(),
  github_url: optionalUrl,
  demo_url: optionalUrl,
  official_url: optionalUrl,
});

export const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(200) });
export const protectedPasswordSchema = z.object({ password: z.string().min(8).max(200) });
export const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.string().max(40).optional(),
  year: z.coerce.number().int().min(1950).max(2200).optional(),
  visibility: visibilitySchema.optional(),
  status: statusSchema.optional(),
  category: z.string().max(80).optional(),
  tag: z.string().max(80).optional(),
  sort: z.enum(["newest", "oldest", "custom"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
});

export const allowedMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "video/mp4", "video/webm", "text/plain",
]);

export const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf", "doc", "docx", "ppt", "pptx", "zip", "mp4", "webm", "txt"]);

export function validateUpload(file: Pick<File, "name" | "type" | "size">, maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 25)) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(file.type)) return { valid: false, error: "Unsupported file type" } as const;
  if (file.size <= 0 || file.size > maxMb * 1024 * 1024) return { valid: false, error: `File must be smaller than ${maxMb} MB` } as const;
  return { valid: true } as const;
}
