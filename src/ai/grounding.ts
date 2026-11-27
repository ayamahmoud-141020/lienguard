import type { ExtractionT, FieldT } from "./schemas";

/**
 * R-23: every value the AI reads must appear in the PDF's own text. Pure: the text is passed in.
 * A value that is not found gets confidence 0, so toDocument marks the document for review (R12 HOLD).
 */

/** Lower case, with whitespace, `$` and commas removed (AC-24.1). */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[\s$,]+/g, "");
}

/** True when `value` appears in `text` after normalising both; a number is never found inside a longer number. */
export function foundIn(value: string, text: string): boolean {
  const v = normalizeForMatch(value);
  if (!v) return false;
  // Normalise the text, remembering where whitespace was removed: "2026 03/31" must not read as one number.
  let t = "";
  const spaceBefore: boolean[] = [];
  let gap = false;
  for (const ch of text.toLowerCase()) {
    if (/\s/.test(ch)) gap = true;
    else if (ch !== "$" && ch !== ",") {
      t += ch;
      spaceBefore.push(gap);
      gap = false;
    }
  }
  const digit = /[0-9]/;
  const joined = (at: number) => at > 0 && at < t.length && !spaceBefore[at] && digit.test(t[at - 1] ?? "") && digit.test(t[at] ?? "");
  for (let i = t.indexOf(v); i !== -1; i = t.indexOf(v, i + 1)) {
    if (joined(i) || joined(i + v.length)) continue;
    return true;
  }
  return false;
}

/** Words that show a sentence is addressed to an AI rather than being the document's own content (AC-24.4). */
const ADDRESSED_TO_AI = [
  /\b(ignore|disregard|forget|override)\b[^.!?]{0,60}\b(instructions?|prompts?|rules)\b/i,
  /\bnote to (the )?(ai|llm|assistant|model)/i,
  /\b(ai|llm)s? (systems?|models?|assistants?|agents?)\b/i,
  /\b(as an? )?(ai|language) model\b/i,
  /\bsystem prompt\b/i,
];

/** The PDF text without the sentences addressed to AI systems. */
export function ownText(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !ADDRESSED_TO_AI.some((re) => re.test(sentence)))
    .join(" ");
}

const WORDS: Record<string, RegExp> = {
  conditional: /\bconditional\b/i,
  unconditional: /\bunconditional\b/i,
  // The extraction prompt maps a partial waiver to "progress".
  progress: /\b(progress|partial)\b/i,
  final: /\bfinal\b/i,
};

type Check = (value: string) => boolean;

function check<T>(f: FieldT<T>, ok: Check, name: string, missing: string[]): FieldT<T> {
  if (f.value === null || typeof f.value === "boolean") return f;
  if (ok(String(f.value))) return f;
  missing.push(name);
  return { ...f, confidence: 0 };
}

/** Lowers to 0 the confidence of every value not found in the PDF's own text, and names them in the notes. */
export function groundExtraction(x: ExtractionT, pdfText: string): ExtractionT {
  const own = ownText(pdfText);
  const text: Check = (v) => foundIn(v, own);
  const word: Check = (v) => WORDS[v]?.test(own) ?? false;
  const missing: string[] = [];
  let out: ExtractionT = x;
  if (x.kind === "waiver" && x.waiver) {
    const w = x.waiver;
    out = {
      ...x,
      waiver: {
        ...w,
        claimantName: check(w.claimantName, text, "claimantName", missing),
        customerName: check(w.customerName, text, "customerName", missing),
        projectName: check(w.projectName, text, "projectName", missing),
        type: check(w.type, word, "type", missing),
        scope: check(w.scope, word, "scope", missing),
        amount: check(w.amount, text, "amount", missing),
        throughDate: check(w.throughDate, text, "throughDate", missing),
        exceptions: check(w.exceptions, text, "exceptions", missing),
      },
    };
  } else if (x.kind === "coi" && x.coi) {
    const c = x.coi;
    out = {
      ...x,
      coi: {
        insuredName: check(c.insuredName, text, "insuredName", missing),
        certificateHolder: check(c.certificateHolder, text, "certificateHolder", missing),
        glExpiry: check(c.glExpiry, text, "glExpiry", missing),
      },
    };
  }
  if (missing.length === 0) return x;
  const note = `Not found in the PDF's own text: ${missing.join(", ")}.`;
  return { ...out, notes: out.notes ? `${out.notes} ${note}` : note };
}
