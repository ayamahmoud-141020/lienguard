# ADR-0001: Rules in code, not in the LLM
Status: accepted · 2026-11-25
**Context:** SAFE/HOLD decisions move money and carry legal risk. They must be predictable, testable and explainable.
**Decision:** Every rule is a pure TypeScript function with unit tests. The LLM only extracts fields from PDFs and writes email wording. It never decides SAFE/HOLD and never computes amounts.
**Consequences:** Every HOLD lists rule ids with plain-English reasons. Changing a rule means changing code and tests, not a prompt.
