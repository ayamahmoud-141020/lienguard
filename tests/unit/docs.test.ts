import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/** S-25: the documentation set must not drift from the repo. */
const DOCS = ["docs/README.md", ...readdirSync("docs").filter((f) => /^0\d-.*\.md$/.test(f)).map((f) => `docs/${f}`)];
const NINE = [
  "00-overview.md",
  "01-factory.md",
  "02-specs-index.md",
  "03-architecture.md",
  "04-decisions.md",
  "05-what-the-process-caught.md",
  "06-quality-and-security.md",
  "07-run-and-deploy.md",
  "08-limitations-and-next.md",
];
const REPO = "https://github.com/ayamahmoud-141020/lienguard";
const read = (f: string) => readFileSync(f, "utf8");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** Relative markdown link targets, without #anchors; external and anchor-only links are skipped. */
function linkTargets(text: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1]!)
    .filter((t) => !/^(https?:|mailto:|#)/.test(t))
    .map((t) => t.split("#")[0]!);
}

/** Repo paths written in backticks, e.g. `src/ai/grounding.ts` or `docs/checks/`. Globs and placeholders are skipped. */
function backtickPaths(text: string): string[] {
  return [...text.matchAll(/`([^`\s]+)`/g)]
    .map((m) => m[1]!)
    .filter((t) => /^(src|tests|docs|scripts|samples|config|prisma|\.claude|\.github|public)\//.test(t) || /^[\w.-]+\.(md|json|ts|yml|toml)$/.test(t))
    .filter((t) => !/[*<>{}]|\.\.\./.test(t))
    .map((t) => t.replace(/:\d+$/, ""));
}

describe("S-25 project documentation", () => {
  it("AC-25.1 docs/README.md links the nine docs, they all exist, and the main README links docs/README.md", () => {
    expect(existsSync("docs/README.md")).toBe(true);
    const index = read("docs/README.md");
    for (const f of NINE) {
      expect(existsSync(`docs/${f}`), f).toBe(true);
      expect(index, f).toContain(`](${f})`);
    }
    expect(read("README.md")).toContain("](docs/README.md)");
  });

  it("AC-25.2 every relative link and backticked repo path in the documentation set exists", () => {
    expect(DOCS.length).toBe(10);
    const missing: string[] = [];
    let checked = 0;
    for (const doc of DOCS) {
      const text = read(doc);
      for (const t of linkTargets(text)) {
        checked++;
        if (!existsSync(normalize(join(dirname(doc), decodeURI(t))))) missing.push(`${doc} → ${t}`);
      }
      for (const p of backtickPaths(text)) {
        checked++;
        if (!existsSync(p)) missing.push(`${doc} → \`${p}\``);
      }
    }
    expect(missing).toEqual([]);
    expect(checked).toBeGreaterThan(100);
  });

  it("AC-25.2 the path check catches a missing file", () => {
    expect(backtickPaths("see `src/ai/nope.ts` and `src/app/**` and `docs/<date>.md`")).toEqual(["src/ai/nope.ts"]);
    expect(linkTargets("[a](../src/x.ts#L1) [b](https://example.com) [c](#top)")).toEqual(["../src/x.ts"]);
  });

  it("AC-25.3 every commit link is in the git history; every PR link is merged or marked (open)", () => {
    const text = DOCS.map(read).join("\n");
    const commits = [...new Set([...text.matchAll(new RegExp(`${REPO}/commit/([0-9a-f]{7,40})`, "g"))].map((m) => m[1]!))];
    const prLines = text.split("\n").flatMap((line) => [...line.matchAll(new RegExp(`${REPO}/pull/(\\d+)`, "g"))].map((m) => ({ n: Number(m[1]), line })));
    expect(commits.length).toBeGreaterThan(10);
    expect(prLines.length).toBeGreaterThan(5);
    if (git("rev-parse", "--is-shallow-repository") === "true") {
      // CI checks out one commit: history can't be checked here (AC-25.3); local runs and the auditor check it.
      expect(git("rev-parse", "--is-shallow-repository")).toBe("true");
      return;
    }
    const unknown = commits.filter((c) => {
      try {
        git("cat-file", "-e", `${c}^{commit}`);
        return false;
      } catch {
        return true;
      }
    });
    expect(unknown).toEqual([]);
    const merged = new Set([...git("log", "--format=%s", "HEAD").matchAll(/^Merge pull request #(\d+)/gm)].map((m) => Number(m[1])));
    const wrong = prLines.filter(({ n, line }) => {
      // "(open)" must follow this PR's own link, before the next link or table cell.
      const markedOpen = new RegExp(`pull/${n}(?!\\d)\\)?[^|\\[]*\\(open\\)`).test(line);
      return merged.has(n) ? markedOpen : !markedOpen;
    });
    expect(wrong.map((w) => `#${w.n}: ${w.line.slice(0, 120)}`)).toEqual([]);
  });

  it("AC-25.4 the specs index numbers match the feature file, the tests and docs/checks", () => {
    const spec = read("docs/features/001-lienguard.md");
    const acSection = spec.slice(spec.indexOf("## 5. Acceptance"), spec.indexOf("## 6. Data"));
    const acs = new Map<number, number>();
    for (const m of acSection.matchAll(/^- \*\*AC-(\d+)\.\d+\*\*/gm)) acs.set(Number(m[1]), (acs.get(Number(m[1])) ?? 0) + 1);

    const testFiles = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? testFiles(join(dir, f)) : f.endsWith(".test.ts") ? [join(dir, f)] : []));
    const tests = new Map<number, number>();
    for (const f of testFiles("tests"))
      for (const m of read(f).matchAll(/\bit\(\s*["'`]AC-(\d+)\./g)) tests.set(Number(m[1]), (tests.get(Number(m[1])) ?? 0) + 1);

    const index = read("docs/02-specs-index.md");
    const rows = [...index.matchAll(/^\| \[?S-(\d+)\]?[^|]*\|[^|]*\|[^|]*\| (\d+) \| (\d+) \|/gm)].map((m) => ({ s: Number(m[1]), acs: Number(m[2]), tests: Number(m[3]) }));
    expect(rows.map((r) => r.s)).toEqual([...acs.keys()].sort((a, b) => a - b));
    for (const r of rows) {
      expect(r.acs, `S-${r.s} ACs`).toBe(acs.get(r.s));
      expect(r.tests, `S-${r.s} tests`).toBe(tests.get(r.s) ?? 0);
    }
    const total = index.match(/^\| \*\*Total\*\* \|[^|]*\|[^|]*\| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|/m);
    expect(total, "Total row").not.toBeNull();
    expect(Number(total![1])).toBe([...acs.values()].reduce((a, b) => a + b, 0));
    expect(Number(total![2])).toBe([...tests.values()].reduce((a, b) => a + b, 0));
    const reports = readdirSync("docs/checks").filter((f) => f.endsWith(".md")).length;
    expect(index).toContain(`${reports} check reports`);
  });
});
