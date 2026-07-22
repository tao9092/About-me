"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entityTables, type EntityTable } from "@/lib/content";
import { baseContentSchema } from "@/lib/validation";
import { sanitizeRichText } from "@/lib/sanitize";
import { uploadValidatedFile } from "@/lib/files";
import { z } from "zod";

type ActionState = {
  error?: string;
  success?: string;
  fields?: Record<string, string[] | undefined>;
};
function table(value: string): EntityTable {
  if (!entityTables.includes(value as EntityTable))
    throw new Error("Invalid content type");
  return value as EntityTable;
}

const optionalText=z.string().trim().transform(value=>value||null);
const optionalUrl=z.string().trim().transform(value=>value||null);
const detailSchemas:Record<EntityTable,z.ZodType<Record<string,unknown>>>={
  competitions:z.object({competition_date:z.iso.date(),organizer:optionalText,competition_type:optionalText,team_name:optionalText,placement:optionalText,award:optionalText,github_url:optionalUrl,demo_url:optionalUrl,official_url:optionalUrl}),
  upcoming_competitions:z.object({competition_date:z.union([z.iso.date(),z.literal("")]).transform(v=>v||null),official_url:optionalUrl,registration_status:z.enum(["interested","planning","registered","completed","cancelled"]).catch("interested"),competition_type:optionalText}),
  certificates:z.object({issuer:z.string().trim().min(2),issued_at:z.iso.date(),certificate_id:optionalText,verification_url:optionalUrl}),
  education:z.object({school:z.string().trim().min(2),course_name:z.string().trim().min(2),degree_level:z.string().trim().min(1),start_year:z.coerce.number().int().min(1900).max(2200),end_year:z.union([z.coerce.number().int().min(1900).max(2200),z.literal("")]).transform(v=>v===""?null:v),cgpa:optionalText}),
  projects:z.object({role:optionalText,project_date:z.union([z.iso.date(),z.literal("")]).transform(v=>v||null),github_url:optionalUrl,demo_url:optionalUrl,tech_stack:z.string().transform(v=>v.split(",").map(x=>x.trim()).filter(Boolean))}),
  experiences:z.object({experience_type:z.enum(["work","internship","club","volunteer","event"]),organization:z.string().trim().min(2),position:z.string().trim().min(2),start_date:z.iso.date(),end_date:z.union([z.iso.date(),z.literal("")]).transform(v=>v||null),related_url:optionalUrl}),
  awards:z.object({award_level:optionalText,issuer:z.string().trim().min(2),award_date:z.iso.date()}),
  skills:z.object({skill_category:z.string().trim().min(2),proficiency:z.enum(["learning","familiar","proficient","advanced","expert"]),icon:optionalText}),
  links:z.object({url:z.url({protocol:/^https?$/}),link_category:optionalText,icon:optionalText}),
};

export async function saveContentAction(
  _: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const entity = table(String(formData.get("entity")));
  const raw = Object.fromEntries(formData);
  const parsed = baseContentSchema.safeParse({
    ...raw,
    is_featured: raw.is_featured === "on",
    sort_order: raw.sort_order || 0,
  });
  if (!parsed.success)
    return {
      error: "Please correct the highlighted fields.",
      fields: parsed.error.flatten().fieldErrors,
    };
  const details=detailSchemas[entity].safeParse(raw);
  if(!details.success)return{error:"Please complete the required details for this content type."};
  const supabase = await createClient();
  let uploadedImage: { path: string; bucket: string } | null = null;
  let imageFileId: string | null = null;

  const certificateImage = formData.get("certificate_image");
  if (
    entity === "certificates" &&
    certificateImage instanceof File &&
    certificateImage.size > 0
  ) {
    const allowedImageTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
    if (!allowedImageTypes.has(certificateImage.type)) {
      return { error: "Certificate image must be a PNG, JPG, or WEBP file." };
    }

    try {
      uploadedImage = await uploadValidatedFile(
        certificateImage,
        admin.id,
        parsed.data.visibility,
      );
      const extension = certificateImage.name.split(".").pop()?.toLowerCase() ?? null;
      const { data: fileRecord, error: fileError } = await supabase
        .from("files")
        .insert({
          owner_id: admin.id,
          kind: "upload",
          original_name: certificateImage.name,
          storage_path: uploadedImage.path,
          bucket: uploadedImage.bucket,
          mime_type: certificateImage.type,
          extension,
          size_bytes: certificateImage.size,
          visibility: parsed.data.visibility,
          status: "draft",
        })
        .select("id")
        .single();
      if (fileError) throw fileError;
      imageFileId = fileRecord.id;
    } catch (error) {
      if (uploadedImage) {
        await supabase.storage
          .from(uploadedImage.bucket)
          .remove([uploadedImage.path]);
      }
      return {
        error: error instanceof Error ? error.message : "Image upload failed.",
      };
    }
  }

  const payload: Record<string, unknown> = {
    ...parsed.data,
    ...details.data,
    content_en: sanitizeRichText(parsed.data.content_en),
    content_zh: sanitizeRichText(parsed.data.content_zh),
    status: "draft" as const,
    updated_at: new Date().toISOString(),
  };
  if (imageFileId) payload.image_file_id = imageFileId;
  const id = String(formData.get("record_id") ?? "");
  const query = id
    ? supabase.from(entity).update(payload).eq("id", id)
    : supabase.from(entity).insert(payload);
  const { error } = await query;
  if (error) {
    if (imageFileId) await supabase.from("files").delete().eq("id", imageFileId);
    if (uploadedImage) {
      await supabase.storage.from(uploadedImage.bucket).remove([uploadedImage.path]);
    }
    return { error: error.message };
  }
  const collectionPath = `/admin/${entity.replaceAll("_", "-")}`;
  revalidatePath(collectionPath);
  redirect(collectionPath);
}

export async function setStatusAction(formData: FormData) {
  await requireAdmin();
  const entity = table(String(formData.get("entity")));
  const id = String(formData.get("id"));
  const intent = String(formData.get("intent"));
  const status =
    intent === "publish"
      ? "published"
      : intent === "archive"
        ? "archived"
        : intent === "restore"
          ? "draft"
          : null;
  if (!status) throw new Error("Invalid status action");
  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from(entity)
    .update({
      status,
      published_at: status === "published" ? now : undefined,
      archived_at: status === "archived" ? now : null,
    })
    .eq("id", id);
  if (error) throw error;
  if (entity === "certificates") {
    const { data: certificate } = await supabase
      .from("certificates")
      .select("image_file_id,visibility")
      .eq("id", id)
      .maybeSingle();
    if (certificate?.image_file_id) {
      const { error: fileError } = await supabase
        .from("files")
        .update({ status, visibility: certificate.visibility, archived_at: status === "archived" ? now : null, updated_at: now })
        .eq("id", certificate.image_file_id);
      if (fileError) throw fileError;
    }
  }
  revalidatePath("/admin", "layout");
}

export async function permanentlyDeleteAction(formData: FormData) {
  await requireAdmin();
  if (formData.get("confirmation") !== "DELETE")
    throw new Error("Deletion confirmation did not match");
  const entity = table(String(formData.get("entity")));
  const supabase = await createClient();
  const { error } = await supabase
    .from(entity)
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("status", "archived");
  if (error) throw error;
  revalidatePath("/admin/archive");
  redirect("/admin/archive");
}
