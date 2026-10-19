// What a project's board looks like, shared by the Projects list and a project's
// own page so the two match: its signal colour, the initials on its chip, and
// the caution tape across a private one. Colours come from the projects' slugs
// rather than their order, so adding or reordering projects in the admin
// leaves the others' as they were.

/** Signal colours, from the home page's particle palette, as "r,g,b". */
export const INKS = ["141,255,240", "68,215,255", "202,121,255", "255,133,203", "255,220,112", "121,139,255"];
/** Each project's colour: the one its slug prefers, or, if a project before it
 * (in slug order) took that, the next one free while any are. */
export function inksFor(slugs: string[]) {
  const inks = new Map<string, string>();
  const taken = new Set<number>();
  for (const slug of [...new Set(slugs)].sort()) {
    let hash = 2166136261;
    for (let index = 0; index < slug.length; index += 1) hash = Math.imul(hash ^ slug.charCodeAt(index), 16777619);
    let pick = (hash >>> 0) % INKS.length;
    if (taken.size < INKS.length) while (taken.has(pick)) pick = (pick + 1) % INKS.length;
    taken.add(pick);
    inks.set(slug, INKS[pick]);
  }
  return inks;
}
export const TAPE = "PRIVATE ◆ DO NOT CROSS ◆ 私密项目 ◆ ";

/** The chip's label: the initials of the name before any colon (RetentionX → RX). */
export function initials(title: string) {
  const name = title.split(":")[0].trim();
  const words = name.split(/[\s-]+/).filter((word) => /^\p{L}/u.test(word));
  if (words.length > 1) return words.slice(0, 3).map((word) => word[0].toUpperCase()).join("");
  const capitals = name.replace(/[^A-Z]/g, "");
  return (capitals.length > 1 ? capitals : name.slice(0, 3)).slice(0, 4).toUpperCase();
}
export const pad = (value: number) => String(value).padStart(2, "0");
