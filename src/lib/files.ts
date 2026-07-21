import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/validation";

export function storagePath(fileName: string, ownerId: string) {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const date = new Date().toISOString().slice(0, 10);
  return `${ownerId}/${date}/${randomUUID()}.${ext}`;
}

export async function signedFileUrl(path: string) {
  const supabase = await createClient();
  const ttl = Math.min(3600, Math.max(60, Number(process.env.SIGNED_URL_TTL_SECONDS ?? 300)));
  const { data, error } = await supabase.storage.from("private-files").createSignedUrl(path, ttl);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadValidatedFile(file: File, ownerId: string, visibility: "public" | "protected" | "private") {
  const result = validateUpload(file);
  if (!result.valid) throw new Error(result.error);
  const supabase = await createClient();
  const path = storagePath(file.name, ownerId);
  const bucket = visibility === "public" ? "public-files" : "private-files";
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) throw error;
  return { path, bucket };
}
