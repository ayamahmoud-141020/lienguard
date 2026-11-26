/** Business dates are ISO YYYY-MM-DD strings, date-only, no time zones (ADR-0002). */
export type IsoDate = string;

export type DateResult = { ok: true; date: IsoDate } | { ok: false; error: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function build(y: number, m: number, d: number): IsoDate | null {
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2200) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseDate(raw: string): DateResult {
  const s = raw.trim();
  let out: IsoDate | null = null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const named = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (iso) out = build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  else if (us) out = build(Number(us[3]), Number(us[1]), Number(us[2]));
  else if (named) {
    const idx = MONTHS.indexOf((named[1] ?? "").slice(0, 3).toLowerCase());
    if (idx >= 0) out = build(Number(named[3]), idx + 1, Number(named[2]));
  }
  return out ? { ok: true, date: out } : { ok: false, error: `not a date: "${raw}"` };
}

function parts(d: IsoDate): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number);
  return [y ?? 0, m ?? 0, day ?? 0];
}

function toDayNumber(d: IsoDate): number {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** The ISO date n days after d (n may be negative). Pure: no clock. */
export function addDays(d: IsoDate, n: number): IsoDate {
  return new Date((toDayNumber(d) + n) * 86_400_000).toISOString().slice(0, 10) as IsoDate;
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "2026-10-31" → "October 31, 2026" */
export function formatDate(d: IsoDate): string {
  const [y, m, day] = parts(d);
  return `${MONTH_NAMES[m - 1] ?? "?"} ${day}, ${y}`;
}

/** Excel serial day number (1900 date system) → ISO date. */
export function excelSerialToIso(serial: number): IsoDate | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  return build(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
