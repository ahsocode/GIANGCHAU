export function slugifyRole(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (!c) continue;
    const slug = c
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (slug) return slug;
  }
  return "dashboard";
}
