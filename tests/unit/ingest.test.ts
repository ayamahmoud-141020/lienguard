import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readPaymentsWorkbook, readSubcontractorsWorkbook } from "@/ingest/spreadsheets";

function book(sheets: Record<string, unknown[][]>, opts?: { dateCells?: boolean }): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: opts?.dateCells ?? false }), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
}

const PAY_HEAD = ["Payment ID", "Project", "Sub", "Invoice", "Amount", "Period End", "Paid Date", "Final"];
const PROJ = [["Code", "Name", "State", "Owner"], ["RVR", "Riverside Medical Office", "CA", "Riverside Health Partners"]];

describe("S-3 spreadsheet ingest", () => {
  it("AC-3.1 a payments row becomes a typed payment in cents and ISO dates", () => {
    const r = readPaymentsWorkbook(
      book({
        Payments: [PAY_HEAD, ["PAY-01", "RVR", "SUM", "INV-1001", 20000, "2026-10-31", "2026-11-14", "No"], ["PAY-02", "RVR", "SUM", "INV-1002", 500, "2026-10-31", "", "No"]],
        Projects: PROJ,
      }),
    );
    expect(r.errors).toEqual([]);
    expect(r.payments[0]).toEqual({
      id: "PAY-01", projectCode: "RVR", subCode: "SUM", invoiceNo: "INV-1001",
      amountCents: 2000000, periodEnd: "2026-10-31", paidDate: "2026-11-14", isFinal: false,
    });
    expect(r.payments[1]?.paidDate).toBeNull();
  });

  it("AC-3.2 a bad row is reported with sheet, row and column; good rows are kept", () => {
    const r = readPaymentsWorkbook(
      book({
        Payments: [PAY_HEAD, ["PAY-01", "RVR", "SUM", "INV-1", 100, "2026-10-31", "", "No"], ["PAY-02", "RVR", "SUM", "INV-2", "abc", "2026-10-31", "", "No"], ["PAY-03", "RVR", "SUM", "INV-3", 300, "2026-10-31", "", "Yes"]],
        Projects: PROJ,
      }),
    );
    expect(r.payments).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ sheet: "Payments", row: 3, column: "Amount" });
    expect(r.payments[1]?.isFinal).toBe(true);
  });

  it("AC-3.3 Excel date cells and text dates both become ISO", () => {
    const r = readPaymentsWorkbook(
      book(
        {
          Payments: [PAY_HEAD, ["PAY-01", "RVR", "SUM", "INV-1", 100, new Date(Date.UTC(2026, 9, 31)), "10/31/2026", "No"]],
          Projects: PROJ,
        },
        { dateCells: true },
      ),
    );
    expect(r.errors).toEqual([]);
    expect(r.payments[0]?.periodEnd).toBe("2026-10-31");
    expect(r.payments[0]?.paidDate).toBe("2026-10-31");
  });

  it("AC-3.4 projects and subcontractors are typed; an invalid email is a row error", () => {
    const p = readPaymentsWorkbook(book({ Payments: [PAY_HEAD], Projects: PROJ }));
    expect(p.projects[0]).toEqual({ code: "RVR", name: "Riverside Medical Office", state: "CA", ownerName: "Riverside Health Partners" });
    const s = readSubcontractorsWorkbook(
      book({
        Subcontractors: [["Code", "Name", "Email", "Contact"], ["SUM", "Summit Air Mechanical", "ap@summitair.example", "Dana Reyes"], ["BLU", "BlueLine Plumbing", "not-an-email", "Sam Ortiz"]],
      }),
    );
    expect(s.subcontractors).toEqual([{ code: "SUM", name: "Summit Air Mechanical", email: "ap@summitair.example", contactName: "Dana Reyes" }]);
    expect(s.errors[0]).toMatchObject({ sheet: "Subcontractors", row: 3, column: "Email" });
  });
});
