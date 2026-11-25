# ADR-0006: Postgres on Neon with Prisma 6; PDFs stored in the DB
Status: accepted · 2026-11-25
**Context:** The Vercel filesystem is ephemeral, so SQLite won't persist. The Hobby plan caps request bodies at 4.5 MB.
**Decision:** Neon Postgres with Prisma 6: `url` is the pooled `DATABASE_URL` and `directUrl` is `DIRECT_URL` for migrations. PDFs (max 4 MB each, uploaded one per request) are stored as `bytea`, so there is no Blob store for the MVP.
**Consequences:** One fewer service to set up. Large scans would need Blob client uploads (v2).
