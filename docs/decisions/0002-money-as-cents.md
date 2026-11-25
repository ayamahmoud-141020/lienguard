# ADR-0002: Money as integer cents, business dates as ISO date strings
Status: accepted · 2026-11-25
**Decision:** Amounts are stored and computed as integer cents, so there are no floating-point errors. Business dates are `YYYY-MM-DD` strings with no time zone. Parsing and formatting live only in `src/domain/money.ts` and `src/domain/dates.ts`.
**Consequences:** The model returns money and dates as raw text, and code parses them. A parse failure marks the document `needsReview`.
