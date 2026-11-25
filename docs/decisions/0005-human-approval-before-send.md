# ADR-0005: Human approval before any email leaves the system
Status: accepted · 2026-11-25
**Decision:** Drafts start as `draft`. Only a human click sets `approved`, and only `approved` drafts can be sent. Numbers in AI-written emails come from placeholders filled by code, and a post-check rejects any amount or date not in the data.
**Consequences:** The send step is idempotent (the Resend idempotency key is the draft id). The demo redirects every email to `DEMO_EMAIL_OVERRIDE`.
