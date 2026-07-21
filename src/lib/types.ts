export type Locale = "en" | "zh";
export type Visibility = "public" | "protected" | "private";
export type PublishStatus = "draft" | "published" | "archived";
export type EntityType =
  | "competition" | "upcoming_competition" | "certificate" | "education"
  | "project" | "experience" | "award" | "skill" | "link" | "resume";

export interface LocalizedContent {
  title_en: string;
  title_zh?: string | null;
  summary_en?: string | null;
  summary_zh?: string | null;
  content_en?: string | null;
  content_zh?: string | null;
}

export interface ContentRecord extends LocalizedContent {
  id: string;
  slug: string;
  visibility: Visibility;
  status: PublishStatus;
  is_featured: boolean;
  sort_order: number;
  published_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
  category_id?: string | null;
  cover_path?: string | null;
}

export interface LocalizedValue {
  value: string;
  isFallback: boolean;
}

export function localized(
  record: Partial<LocalizedContent>,
  field: "title" | "summary" | "content",
  locale: Locale,
): LocalizedValue {
  const primary = record[`${field}_${locale}` as keyof LocalizedContent];
  const fallbackLocale = locale === "en" ? "zh" : "en";
  const fallback = record[`${field}_${fallbackLocale}` as keyof LocalizedContent];
  if (typeof primary === "string" && primary.trim()) return { value: primary, isFallback: false };
  return { value: typeof fallback === "string" ? fallback : "", isFallback: true };
}
