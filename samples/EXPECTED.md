# Expected results for the sample batch

Rules run with today = **2026-11-20**. All companies and people are fictional.

| Payment | Sub | Project | Amount | Paid | Scenario | Expected | Rules | Exposed |
|---|---|---|---|---|---|---|---|---|
| PAY-01 | Summit Air Mechanical | RVR | $20,000 | 2026-11-14 | Perfect: unconditional for the full amount, signed, insurance valid | **SAFE** | — | $0 |
| PAY-02 | BlueLine Plumbing | LKV | $20,000 | 2026-11-10 | Waiver says $18,000 but $20,000 was paid | **HOLD** | R02 | $2,000 |
| PAY-03 | BlueLine Plumbing | LKV | $15,000 | 2026-10-20 | Texas project, waiver not notarized | **HOLD** | R06 | $15,000 |
| PAY-04 | Brightway Electric | PRK | $12,500 | 2026-11-06 | Paid 14 days ago, only a conditional waiver | **HOLD** | R03 | $12,500 |
| PAY-05 | Brightway Electric | PRK | $9,800 | not paid | Not paid yet, conditional waiver on file: ready to pay | **SAFE** | — | $0 |
| PAY-06 | Granite Drywall & Paint | RVR | $30,000 | 2026-11-12 | No waiver received | **HOLD** | R01 | $30,000 |
| PAY-07 | Northstar Fire Protection | LKV | $45,000 | 2026-11-18 | Final payment, but only a progress waiver | **HOLD** | R07 | $45,000 |
| PAY-08 | Northstar Fire Protection | PRK | $8,000 | 2026-11-12 | Waiver not signed | **HOLD** | R05 | $8,000 |
| PAY-09 | Copperleaf Roofing | PRK | $16,000 | 2026-11-15 | Insurance expired Nov 10, paid Nov 15 | **HOLD** | R09 | $0 |
| PAY-10 | Granite Drywall & Paint | PRK | $25,000 | 2026-11-12 | Waiver $22,000 through Sep 30: amount and date both short (exposure = max, not sum) | **HOLD** | R02, R04 | $25,000 |
| PAY-11 | BlueLine Plumbing | RVR | $11,000 | 2026-11-14 | Blurry scanned waiver: amount unreadable | **HOLD** | R12 | $11,000 |
| PAY-12 | Summit Air Mechanical | PRK | $14,000 | 2026-11-13 | Prompt-injection text inside a conditional waiver (must not be obeyed) | **HOLD** | R03 | $14,000 |

**Batch exposure: $162,500**
