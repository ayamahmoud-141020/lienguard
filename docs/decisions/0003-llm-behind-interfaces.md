# ADR-0003: LLM behind interfaces; fixtures in tests; no network in CI
Status: accepted · 2026-11-25
**Decision:** `Extractor` and `EmailWriter` are interfaces, each with an Anthropic version and a fixture version. The email sender works the same way (Resend or fake). The real versions are chosen only by env (`LIENGUARD_AI`, `LIENGUARD_EMAIL`). Tests and CI always use the fixture and fake versions.
**Consequences:** The test suite is deterministic, fast and free. Live extraction quality is checked by hand on the sample PDFs (an eval script is planned for v2).
