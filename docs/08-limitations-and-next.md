# Limitations and next steps

## Limits today

**The data is fictional.** Every payment, company, person and PDF in [`samples/`](../samples/) is made up ([`scripts/sample-scenarios.ts`](../scripts/sample-scenarios.ts)). The accuracy figures in [06-quality-and-security.md](06-quality-and-security.md#ai-accuracy) come from these 17 PDFs, not from real paperwork.

**It is not legal advice.** LienGuard flags issues for a person to review. Lien-waiver law differs by state and changes over time ([`README.md`](../README.md), "Disclaimer").

**State rules are simplified.** [`config/states.json`](../config/states.json) has only two settings per state, whether a notary is needed and the grace period in days, for TX, CA, AZ and a default. They are demo defaults that a user must confirm for each state. Statutory waiver forms are not checked.

**Not every rule is built.** The rules are R01–R07, R09 and R12. These are left out of the MVP ([spec §3](features/001-lienguard.md#3-scope)):
- R08, lower-tier waivers (suppliers and sub-subcontractors);
- R10, COI limits;
- R11, a COI that will expire soon;
- R13, exceptions written on a waiver.

**There is no screen to correct a reading.** A document the AI was unsure of goes to needs review and holds the payment. Today a person can't fix the field in the app and re-run.

**The PDF-text check has known gaps** (R-23 in the [spec](features/001-lienguard.md#4-requirements)):
- `signed` and `notarized` are yes/no answers, not text, so they are not checked against the PDF.
- An injection that writes its value as ordinary document text, with no words addressed to AI, still passes the check.
- A PDF with no text layer, such as an image-only scan, always goes to review.

**Access control is a demo passcode**, not user accounts. One shared passcode guards uploads, edits and sending ([`src/server/access.ts`](../src/server/access.ts)).

**File size.** PDFs are stored in the database, up to 4 MB each. Larger scans would need a separate file store ([ADR-0006](decisions/0006-postgres-neon.md)).

**Email wording for uploaded batches varies** from run to run, because it is written live. The numbers are still filled in by code and post-checked, and a person approves each email ([ADR-0009](decisions/0009-claude-in-production.md)).

**Inbound documents need forwarding.** `/api/inbound` takes one PDF at a time. No mailbox is connected yet; the demo uses the "Simulate a subcontractor reply" button ([`src/app/api/batches/[id]/simulate-reply/route.ts`](../src/app/api/batches/[id]/simulate-reply/route.ts)).

## Next steps

These are listed in [`README.md`](../README.md), "Limitations and next steps". None of them is specified or built yet.

- **Inbox ingestion:** connect a real mailbox to `/api/inbound`, so PDFs that subcontractors email arrive on their own.
- **Certified payroll and change orders** through the same pipeline: an AI reads the document, code checks it against plain rules, and a person approves.
- **The rules left out:** lower-tier waivers (R08), COI limits (R10), COIs expiring soon (R11), waiver exceptions (R13).
- **A review screen** to correct low-confidence fields and re-run the rules.
- **Excel export** of the decisions.
- **Integrations** with Procore and QuickBooks.
- **Per-state statutory-form checks.**

Each would go through the same process: a spec agreed at Gate A, stories built test-first, the auditor, and a PR merged at Gate B ([01-factory.md](01-factory.md)).
