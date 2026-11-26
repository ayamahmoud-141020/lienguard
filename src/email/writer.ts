import { buildWriterInput, codeTemplate, type SubIssues, type WriterInput } from "./issues";
import { fillPlaceholders, postcheck } from "./postcheck";

export type WrittenEmail = { subject: string; bodyTemplate: string };

/** Writes wording only. Amounts and dates arrive as placeholders and are filled by code. ADR-0003/0005. */
export interface EmailWriter {
  write(input: WriterInput["forModel"], feedback?: string): Promise<WrittenEmail>;
}

export type Draft = { subject: string; body: string; source: "ai" | "template"; problems: string[] };

/** AI wording → fill placeholders → post-check; one regeneration; then the code template. */
export async function draftEmail(writer: EmailWriter, sub: SubIssues): Promise<Draft> {
  const input = buildWriterInput(sub);
  let feedback: string | undefined;
  const problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let written: WrittenEmail;
    try {
      written = await writer.write(input.forModel, feedback);
    } catch (e) {
      problems.push(`writer failed: ${e instanceof Error ? e.message.slice(0, 200) : "error"}`);
      continue;
    }
    const subject = fillPlaceholders(written.subject, input.tokens);
    const body = fillPlaceholders(written.bodyTemplate, input.tokens);
    if (!subject.ok || !body.ok) {
      feedback = !subject.ok ? subject.error : !body.ok ? body.error : "";
      problems.push(feedback);
      continue;
    }
    const check = postcheck(`${subject.text}\n${body.text}`, sub);
    if (check.ok) return { subject: subject.text, body: body.text, source: "ai", problems: [] };
    feedback = check.problems.join("; ");
    problems.push(...check.problems);
  }
  const t = codeTemplate(sub);
  return { subject: t.subject, body: t.body, source: "template", problems };
}
