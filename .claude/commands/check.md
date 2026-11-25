---
description: Independent audit of built stories, fix loop, then open the PR for Gate B
argument-hint: <feature-file>
---

Run an independent check of the work on the current branch against `$ARGUMENTS`.

## 1. Audit
Spawn the `auditor` agent. Give it only:
- the feature file path,
- the list of stories at stage `checking`,
- the base branch (`main`).

Do **not** pass it your reasoning, your summary of what you built, or any claim that tests pass. It must find out for itself.

## 2. Report
Save the auditor's report, unchanged, as `docs/checks/<YYYY-MM-DD>-check.md`. If a report for that date exists, add `-2`, `-3`, and so on.

## 3. Fix loop (max 3 rounds)
If the report has any FAIL, an AC with no test, scope drift, or a skipped/removed test:
- Fix the cause, never by weakening a test. Commit as `fix(S-n): <what>`.
- Run the auditor again with the same minimal inputs, and save the new report.
- After **3 rounds** still failing: stop. Show Aya the last report and the remaining problems. Do not open a PR.

## 4. All clear
- Set every audited story to `awaiting-merge` in the stage table, and commit that.
- Check identity: `git log main..HEAD --format=%ae | sort -u` must show only the owner's personal email. `gh api user --jq .login` must be the owner's personal account. If either is wrong, stop.
- Push the branch and open a PR with `.github/pull_request_template.md` filled in. The Stories table has one row per AC. Link the latest check report.
- Print the PR link and end with:

> **Gate B:** please review and merge the PR. I won't merge it.

Never approve or merge the PR yourself.
