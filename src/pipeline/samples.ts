import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FixtureExtractor } from "@/ai/fixture-extractor";
import { sha256 } from "@/ai/hash";
import { Extraction, type ExtractionT } from "@/ai/schemas";
import { readPaymentsWorkbook, readSubcontractorsWorkbook } from "@/ingest/spreadsheets";
import type { BatchInput } from "./evaluate";
import type { InputDocument } from "./run-batch";

export function readBatchSpreadsheets(paymentsXlsx: Uint8Array, subsXlsx: Uint8Array) {
  const p = readPaymentsWorkbook(paymentsXlsx);
  const s = readSubcontractorsWorkbook(subsXlsx);
  return { input: { payments: p.payments, projects: p.projects, subs: s.subcontractors } satisfies BatchInput, errors: [...p.errors, ...s.errors] };
}

/** Loads samples/ as a batch. Document ids are the file names (stable across runs). */
export function loadSampleBatch(dir: string): BatchInput & { documents: InputDocument[] } {
  const { input, errors } = readBatchSpreadsheets(readFileSync(join(dir, "payments.xlsx")), readFileSync(join(dir, "subcontractors.xlsx")));
  if (errors.length) throw new Error(`sample spreadsheets have errors: ${JSON.stringify(errors)}`);
  const documents = readdirSync(join(dir, "pdfs"))
    .filter((f) => f.endsWith(".pdf"))
    .sort()
    .map((fileName) => ({ id: fileName.replace(/\.pdf$/, ""), fileName, bytes: new Uint8Array(readFileSync(join(dir, "pdfs", fileName))) }));
  return { ...input, documents };
}

/** Fixture extractor keyed by the SHA-256 of each sample PDF. */
export function loadFixtureExtractor(dir: string): FixtureExtractor {
  const map = new Map<string, ExtractionT>();
  for (const f of readdirSync(join(dir, "fixtures"))) {
    if (!f.endsWith(".json")) continue;
    const pdf = readFileSync(join(dir, "pdfs", f.replace(/\.json$/, ".pdf")));
    map.set(sha256(pdf), Extraction.parse(JSON.parse(readFileSync(join(dir, "fixtures", f), "utf8"))));
  }
  return new FixtureExtractor(map);
}
