import { extractText, getDocumentProxy } from "unpdf";

/** The text layer of a PDF, read by code (R-23). A file that is not a readable PDF, or has no text, gives "". */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  try {
    // pdf.js may take over the buffer it is given, so it gets a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    return "";
  }
}
