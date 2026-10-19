// What a project's board looks like, shared by the Projects list and a project's
// own page so the two match: its signal colour (by its place in the list), the
// initials on its chip, and the caution tape across a private one.

/** Signal colours, from the home page's particle palette, as "r,g,b". */
export const INKS = ["141,255,240", "68,215,255", "202,121,255", "255,133,203", "255,220,112", "121,139,255"];
export const inkFor = (index: number) => INKS[((index % INKS.length) + INKS.length) % INKS.length];
export const TAPE = "PRIVATE ◆ DO NOT CROSS ◆ 私密项目 ◆ ";

/** The chip's label: the initials of the name before any colon (RetentionX → RX). */
export function initials(title: string) {
  const name = title.split(":")[0].trim();
  const words = name.split(/[\s-]+/).filter((word) => /^[A-Za-z]/.test(word));
  if (words.length > 1) return words.slice(0, 3).map((word) => word[0].toUpperCase()).join("");
  const capitals = name.replace(/[^A-Z]/g, "");
  return (capitals.length > 1 ? capitals : name.slice(0, 3)).slice(0, 4).toUpperCase();
}
export const pad = (value: number) => String(value).padStart(2, "0");
