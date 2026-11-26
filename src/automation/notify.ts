import { formatMoney } from "@/domain/money";
import type { DecisionChange } from "./diff";

/** The AP-inbox line for a payment that became safe (AC-18.3). */
export function safeToPayText(c: DecisionChange): string {
  return `${c.subName} is now safe to pay: ${c.invoice}, ${formatMoney(c.amountCents)}`;
}
