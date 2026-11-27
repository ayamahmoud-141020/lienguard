# LienGuard in one page

## The problem

A general contractor (GC) pays subcontractors as work goes on. If a subcontractor, or someone under it, is not paid, it can file a **mechanic's lien** against the property. To protect itself, the GC collects a **lien waiver** with each payment. A lien waiver is a signed release of those lien rights, up to an amount and a date. The GC also checks that each subcontractor's **certificate of insurance (COI)** is still valid.

Checking this by hand is slow, and a missed waiver leaves money unprotected. That unprotected money is the **exposure**: dollars paid without a valid waiver. Source: the original request, [requests/001-lienguard.md](requests/001-lienguard.md), and the glossary in [`CLAUDE.md`](../CLAUDE.md).

Waivers come in four kinds. A **conditional** waiver takes effect only once the payment clears; an **unconditional** one takes effect at once. A **progress** waiver covers part of the job; a **final** one covers the whole job.

## Who it is for

From the spec, [features/001-lienguard.md §2](features/001-lienguard.md#2-users):

| User | What success looks like |
|---|---|
| AR/AP specialist | Clears a 12-payment batch in minutes and knows exactly what to chase |
| Project manager or controller | One number: the dollars exposed in the batch |
| Subcontractor (gets the email) | One clear email with a numbered list of what to send |

## What it does, end to end

1. **Input.** A payments spreadsheet, a subcontractors spreadsheet, and the waiver and COI PDFs that arrived. Spreadsheets are read into typed rows by [`src/ingest/spreadsheets.ts`](../src/ingest/spreadsheets.ts).
2. **AI reads each PDF.** It returns each field with a confidence and the words it read ([`src/ai/schemas.ts`](../src/ai/schemas.ts)). The prompt tells the model that the document is untrusted data ([`src/ai/prompts.ts`](../src/ai/prompts.ts)).
3. **Code checks what the AI read.** Every value must appear in the PDF's own text ([`src/ai/grounding.ts`](../src/ai/grounding.ts)). Code, not the model, turns amounts into cents and dates into ISO dates ([`src/ai/to-document.ts`](../src/ai/to-document.ts)). A missing, unclear or unfound value sends the document to **needs review**.
4. **Matching.** Code matches each waiver to a subcontractor, project and payment, and each COI to a subcontractor ([`src/domain/matching/match.ts`](../src/domain/matching/match.ts)).
5. **Rules.** Nine rules, written as plain tested code, decide SAFE or HOLD for each payment and compute the exposure ([`src/domain/rules/index.ts`](../src/domain/rules/index.ts)). See [03-architecture.md](03-architecture.md#rules).
6. **Follow-up emails.** One draft per subcontractor with a payment on hold. The AI writes the wording with placeholders, and code fills in every amount and date and checks the result ([`src/email/postcheck.ts`](../src/email/postcheck.ts)). Nothing is sent until a person approves it ([ADR-0005](decisions/0005-human-approval-before-send.md)).
7. **The loop keeps running.** New documents can arrive by an inbound endpoint. A daily job re-checks open batches, drafts reminders and sends a digest to the AP inbox ([`src/automation/engine.ts`](../src/automation/engine.ts)).

The sample batch has 12 fictional payments, 6 subcontractors and 17 PDFs. Its expected result is 2 SAFE, 10 HOLD and $162,500 exposed ([`samples/EXPECTED.md`](../samples/EXPECTED.md), checked by `AC-8.1` in [`tests/e2e/samples.test.ts`](../tests/e2e/samples.test.ts)).

## Where to see it

- **Live app:** https://lienguard-one.vercel.app. Click "Use sample data"; no passcode is needed. Uploading your own files, editing drafts and sending email need the demo passcode ([`src/server/access.ts`](../src/server/access.ts)).
- **Repo:** https://github.com/ayamahmoud-141020/lienguard
- **System flows page:** `/flows` on the live app (https://lienguard-one.vercel.app/flows). It plays six flows step by step and names the file that does each step. Its data is in [`src/flows/flows.ts`](../src/flows/flows.ts), and it is tested against the repo ([`tests/unit/flows.test.ts`](../tests/unit/flows.test.ts)).

## Not legal advice

All data is fictional. The state settings are demo defaults ([`config/states.json`](../config/states.json)). LienGuard flags issues for a person to review; it is not legal advice. See [08-limitations-and-next.md](08-limitations-and-next.md).
