import type { EntityTable } from "@/lib/content";

// The admin form shares one set of base fields, but some tables do not store all
// of them (see supabase/migrations/202607220001_initial_schema.sql). Supabase
// rejects a save that names a missing column, so those are left out.
const missingColumns: Partial<Record<EntityTable, readonly string[]>> = {
  upcoming_competitions: ["content_en", "content_zh"],
  certificates: ["content_en", "content_zh"],
  awards: ["content_en", "content_zh"],
  skills: ["content_en", "content_zh"],
  links: ["slug", "is_featured", "content_en", "content_zh"],
};

export function lacksColumn(table: EntityTable, column: string) {
  return missingColumns[table]?.includes(column) ?? false;
}

export function withoutMissingColumns(table: EntityTable, payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([column]) => !lacksColumn(table, column)));
}
