import * as XLSX from "xlsx";
import { z } from "zod";
import { dollarsToCents, parseMoney } from "@/domain/money";
import { excelSerialToIso, parseDate } from "@/domain/dates";
import type { Payment, Project, Subcontractor } from "@/domain/types";

/** Cell contents are untrusted data: they are only parsed, never interpreted. */
export type RowError = { sheet: string; row: number; column: string; message: string };

type Cell = string | number | boolean | Date | null | undefined;

function readSheet(wb: XLSX.WorkBook, name: string): { headers: string[]; rows: Cell[][] } | null {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  const aoa = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, blankrows: false, defval: null });
  const [head, ...rows] = aoa;
  return { headers: (head ?? []).map((h) => String(h ?? "").trim()), rows };
}

function text(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
}

function toCents(c: Cell): number | null {
  if (typeof c === "number") return dollarsToCents(c);
  const r = parseMoney(text(c));
  return r.ok ? r.cents : null;
}

function toDate(c: Cell): string | null {
  if (c instanceof Date) {
    // Excel date cells come back as UTC midnight dates; keep the calendar day.
    return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, "0")}-${String(c.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof c === "number") return excelSerialToIso(c);
  const r = parseDate(text(c));
  return r.ok ? r.date : null;
}

function toBool(c: Cell): boolean | null {
  const t = text(c).toLowerCase();
  if (["yes", "y", "true", "1"].includes(t)) return true;
  if (["no", "n", "false", "0", ""].includes(t)) return false;
  return null;
}

class RowReader {
  constructor(
    private sheet: string,
    private headers: string[],
    private row: Cell[],
    private rowNumber: number,
    private errors: RowError[],
  ) {}
  private cell(col: string): Cell {
    const i = this.headers.indexOf(col);
    return i < 0 ? undefined : this.row[i];
  }
  invalid(column: string, message: string): null {
    return this.fail(column, message);
  }
  private fail(column: string, message: string): null {
    this.errors.push({ sheet: this.sheet, row: this.rowNumber, column, message });
    return null;
  }
  str(col: string): string | null {
    const v = text(this.cell(col));
    return v ? v : this.fail(col, "required");
  }
  cents(col: string): number | null {
    const v = toCents(this.cell(col));
    return v === null ? this.fail(col, `not an amount: "${text(this.cell(col))}"`) : v;
  }
  date(col: string, optional = false): string | null | undefined {
    if (optional && text(this.cell(col)) === "") return undefined;
    const v = toDate(this.cell(col));
    return v === null ? this.fail(col, `not a date: "${text(this.cell(col))}"`) : v;
  }
  bool(col: string): boolean | null {
    const v = toBool(this.cell(col));
    return v === null ? this.fail(col, `expected Yes/No: "${text(this.cell(col))}"`) : v;
  }
  email(col: string): string | null {
    const v = text(this.cell(col));
    return z.string().email().safeParse(v).success ? v : this.fail(col, `not an email: "${v}"`);
  }
}

function eachRow<T>(sheet: string, data: { headers: string[]; rows: Cell[][] } | null, errors: RowError[], map: (r: RowReader) => T | null): T[] {
  if (!data) {
    errors.push({ sheet, row: 0, column: "", message: `missing sheet "${sheet}"` });
    return [];
  }
  const out: T[] = [];
  data.rows.forEach((row, i) => {
    const before = errors.length;
    const value = map(new RowReader(sheet, data.headers, row, i + 2, errors));
    if (value !== null && errors.length === before) out.push(value);
  });
  return out;
}

export function readPaymentsWorkbook(bytes: Uint8Array): { payments: Payment[]; projects: Project[]; errors: RowError[] } {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const errors: RowError[] = [];
  const payments = eachRow("Payments", readSheet(wb, "Payments"), errors, (r) => {
    const id = r.str("Payment ID");
    const projectCode = r.str("Project");
    const subCode = r.str("Sub");
    const invoiceNo = r.str("Invoice");
    const amountCents = r.cents("Amount");
    const periodEnd = r.date("Period End");
    const paidDate = r.date("Paid Date", true);
    const isFinal = r.bool("Final");
    if (!id || !projectCode || !subCode || !invoiceNo || amountCents === null || !periodEnd || paidDate === null || isFinal === null) return null;
    return { id, projectCode, subCode, invoiceNo, amountCents, periodEnd, paidDate: paidDate ?? null, isFinal };
  });
  const projects = eachRow("Projects", readSheet(wb, "Projects"), errors, (r) => {
    const code = r.str("Code");
    const name = r.str("Name");
    const state = r.str("State");
    const ownerName = r.str("Owner");
    if (!code || !name || !state || !ownerName) return null;
    if (!/^[A-Z]{2}$/.test(state)) return r.invalid("State", `not a 2-letter state: "${state}"`);
    return { code, name, state, ownerName };
  });
  return { payments, projects, errors };
}

export function readSubcontractorsWorkbook(bytes: Uint8Array): { subcontractors: Subcontractor[]; errors: RowError[] } {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const errors: RowError[] = [];
  const subcontractors = eachRow("Subcontractors", readSheet(wb, "Subcontractors"), errors, (r) => {
    const code = r.str("Code");
    const name = r.str("Name");
    const email = r.email("Email");
    const contactName = r.str("Contact");
    if (!code || !name || !email || !contactName) return null;
    return { code, name, email, contactName };
  });
  return { subcontractors, errors };
}
