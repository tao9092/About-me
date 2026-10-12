import { describe, expect, it } from "vitest";
import { lacksColumn, withoutMissingColumns } from "@/lib/entity-columns";

const base = { title_en: "Record", slug: "record", content_en: "<p>Body</p>", content_zh: "", is_featured: false, sort_order: 0 };

describe("entity columns", () => {
  it("drops long-form content for tables that do not store it", () => {
    for (const table of ["certificates", "awards", "skills", "upcoming_competitions"] as const) {
      const payload = withoutMissingColumns(table, base);
      expect(payload).not.toHaveProperty("content_en");
      expect(payload).not.toHaveProperty("content_zh");
      expect(payload).toMatchObject({ title_en: "Record", slug: "record", is_featured: false });
    }
  });

  it("keeps content for tables that store it", () => {
    for (const table of ["competitions", "projects", "experiences", "education"] as const) {
      expect(withoutMissingColumns(table, base)).toEqual(base);
    }
  });

  it("drops slug and featured flag for links", () => {
    expect(withoutMissingColumns("links", base)).toEqual({ title_en: "Record", sort_order: 0 });
    expect(lacksColumn("links", "slug")).toBe(true);
    expect(lacksColumn("competitions", "slug")).toBe(false);
  });
});
