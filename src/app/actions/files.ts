"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadValidatedFile } from "@/lib/files";
export async function uploadFileAction(_: unknown, formData: FormData) {
  const admin = await requireAdmin();
  const file = formData.get("file");
  const visibility = String(formData.get("visibility"));
  if (
    !(file instanceof File) ||
    !["public", "protected", "private"].includes(visibility)
  )
    return { error: "Choose a valid file and visibility." };
  try {
    const stored = await uploadValidatedFile(
      file,
      admin.id,
      visibility as "public" | "protected" | "private",
    );
    const supabase = await createClient();
    const { error } = await supabase
      .from("files")
      .insert({
        owner_id: admin.id,
        kind: "upload",
        original_name: file.name,
        storage_path: stored.path,
        bucket: stored.bucket,
        mime_type: file.type,
        extension: file.name.split(".").pop()?.toLowerCase(),
        size_bytes: file.size,
        visibility,
        status: "draft",
      });
    if (error) {
      await supabase.storage.from(stored.bucket).remove([stored.path]);
      throw error;
    }
    revalidatePath("/admin/file-library");
    return { success: "Upload complete" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Upload failed" };
  }
}
