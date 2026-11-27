# LienGuard documentation

LienGuard tells a general contractor, for each subcontractor payment, whether it is **SAFE** to pay or must be put on **HOLD**, and why. It also shows the dollars at risk, and drafts follow-up emails that a person approves.

These pages describe the project as it is in this repo. Every claim links to the file, commit or pull request it comes from. The numbers are counted from the repo or taken from a real run.

- Live app: https://lienguard-one.vercel.app
- Repo: https://github.com/ayamahmoud-141020/lienguard
- The project's own README, with a guided tour and screenshots: [../README.md](../README.md)

## Start here

| File | What it covers |
|---|---|
| [00-overview.md](00-overview.md) | The problem, who it is for, and what LienGuard does end to end |
| [01-factory.md](01-factory.md) | How it was built: spec first, tests first, an independent auditor, two human gates |
| [02-specs-index.md](02-specs-index.md) | Every story, S-1 to S-25: goal, ACs, tests, audit result, PR, status |
| [03-architecture.md](03-architecture.md) | Components, data model, pipeline, rules, AI and automation |
| [04-decisions.md](04-decisions.md) | The nine architecture decision records (ADRs), summarised |
| [05-what-the-process-caught.md](05-what-the-process-caught.md) | Real problems that were found and fixed, and how they were caught |
| [06-quality-and-security.md](06-quality-and-security.md) | Tests, CI, AI accuracy, email and PDF checks, passcode, secrets |
| [07-run-and-deploy.md](07-run-and-deploy.md) | Running it locally, environment variable names, deploy, cost |
| [08-limitations-and-next.md](08-limitations-and-next.md) | What it does not do, and what could come next |

## Other sources in this folder

- The spec: [features/001-lienguard.md](features/001-lienguard.md). Requirements, acceptance criteria (ACs), stories and their stages.
- The original request: [requests/001-lienguard.md](requests/001-lienguard.md).
- Audit reports from the independent auditor: [checks/](checks/).
- Architecture decisions: [decisions/](decisions/).
- Screenshots: [screenshots/](screenshots/).

## How these pages stay true

[`tests/unit/docs.test.ts`](../tests/unit/docs.test.ts) runs with the other tests. It fails when:
- a file linked or named in these pages does not exist;
- a linked commit is not in the git history, or a linked PR is not merged (unless the page marks it "(open)");
- the AC or test counts in [02-specs-index.md](02-specs-index.md) stop matching the spec and the tests.

CI checks out only the latest commit, so the commit and PR part runs locally and in the auditor's run.
