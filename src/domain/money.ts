/** Money is always integer cents. Parsing and formatting live only here (ADR-0002). */
export type Cents = number;

export type MoneyResult = { ok: true; cents: Cents } | { ok: false; error: string };

const MONEY = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

export function parseMoney(raw: string): MoneyResult {
  const text = raw.trim().replace(/\s*(usd|dollars)$/i, "");
  const m = MONEY.exec(text);
  if (!m || m[1] === undefined) return { ok: false, error: `not a dollar amount: "${raw}"` };
  const whole = Number(m[1].replace(/,/g, ""));
  const frac = Number((m[2] ?? "0").padEnd(2, "0"));
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) return { ok: false, error: `amount too large: "${raw}"` };
  return { ok: true, cents };
}

export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/** Converts a dollar number (for example a spreadsheet cell) to cents. */
export function dollarsToCents(dollars: number): Cents | null {
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
