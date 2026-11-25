const SUFFIXES = new Set(["inc", "llc", "llp", "lp", "co", "corp", "corporation", "company", "ltd", "pllc"]);

/** "Summit Air Mechanical, L.L.C." → "summit air mechanical" */
export function normalizeName(raw: string): string {
  const words = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bl\.l\.c\.?/g, "llc")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1] ?? "")) words.pop();
  return words.join(" ");
}
