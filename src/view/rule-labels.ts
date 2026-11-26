/** Short labels for reason chips (the full rule name and message are in the tooltip). Display only. */
export const RULE_SHORT: Record<string, string> = {
  R01: "No waiver",
  R02: "Amount short",
  R03: "Still conditional",
  R04: "Through date early",
  R05: "Not signed",
  R06: "Not notarized",
  R07: "Not a final waiver",
  R09: "Insurance",
  R12: "Unreadable",
};

export function ruleShort(id: string): string {
  return RULE_SHORT[id] ?? id;
}
