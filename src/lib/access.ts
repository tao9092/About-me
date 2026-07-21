import type { PublishStatus, Visibility } from "@/lib/types";

export function canReadContent(
  record: { status: PublishStatus; visibility: Visibility },
  viewer: { isAdmin: boolean; hasProtectedAccess: boolean },
) {
  if (viewer.isAdmin) return true;
  if (record.status !== "published") return false;
  if (record.visibility === "public") return true;
  return record.visibility === "protected" && viewer.hasProtectedAccess;
}

export function shouldIndex(record: { status: PublishStatus; visibility: Visibility }) {
  return record.status === "published" && record.visibility === "public";
}
