import type { WriterInput } from "./issues";
import type { EmailWriter, WrittenEmail } from "./writer";

/** Deterministic stand-in for the AI writer (tests, CI, and LIENGUARD_AI=fixture). Uses placeholders only. */
export class FixtureEmailWriter implements EmailWriter {
  async write(input: WriterInput["forModel"]): Promise<WrittenEmail> {
    const items = input.issues.map((i) => `${i.n}. ${i.project} (invoice ${i.invoice}): ${i.problem} Could you please send ${i.needed}?`);
    return {
      subject: `${input.subcontractor}: ${input.issues.length} document${input.issues.length === 1 ? "" : "s"} needed to release your payments`,
      bodyTemplate: [
        `Hi ${input.contactName},`,
        "",
        "Thank you for your work on our projects. While preparing this month's payments, we found a few items we need from you to release them or to keep them on file correctly:",
        "",
        ...items,
        "",
        "Reply to this email with the documents attached and we'll take it from there.",
        "",
        "Best regards,",
        "Accounts Payable team",
      ].join("\n"),
    };
  }
}
