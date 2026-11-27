import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FLOWS, NODES } from "@/flows/flows";
import { initialPlayer, keyToAction, nodesInFlow, packetDuration, playerReducer, SPEEDS, stepDuration, type PlayerState } from "@/flows/player";
import { edgeGeometry, packetPosition } from "@/flows/geometry";
import { footerText, resolveCommitSha, shortSha } from "@/flows/commit";

const counts = FLOWS.map((f) => f.steps.length);
const reduce = playerReducer(counts);
const at = (patch: Partial<PlayerState>): PlayerState => ({ ...initialPlayer(), ...patch });

describe("S-23 player", () => {
  it("AC-23.1 next and previous stay inside the flow", () => {
    const last = counts[0]! - 1;
    expect(reduce(at({ step: 0 }), { type: "prev" }).step).toBe(0);
    expect(reduce(at({ step: 0 }), { type: "next" }).step).toBe(1);
    expect(reduce(at({ step: last }), { type: "next" }).step).toBe(last);
    expect(reduce(at({ step: 3 }), { type: "prev" }).step).toBe(2);
  });

  it("AC-23.1 restart goes to step 1; clicking a step jumps there and pauses", () => {
    expect(reduce(at({ step: 5 }), { type: "restart" }).step).toBe(0);
    expect(reduce(at({ step: 0, playing: true }), { type: "goto", step: 4 })).toMatchObject({ step: 4, playing: false });
    expect(reduce(at({ step: 0 }), { type: "goto", step: 99 }).step).toBe(counts[0]! - 1);
  });

  it("AC-23.1 picking a flow starts it at step 1, paused", () => {
    expect(reduce(at({ flow: 0, step: 5, playing: true }), { type: "flow", flow: 3 })).toMatchObject({ flow: 3, step: 0, playing: false });
    expect(reduce(at({ flow: 0 }), { type: "flow", flow: 6 }).flow).toBe(0);
  });

  it("AC-23.1 play on the last step starts again from step 1; auto-advance stops at the last step", () => {
    const last = counts[1]! - 1;
    expect(reduce(at({ flow: 1, step: last }), { type: "toggle" })).toMatchObject({ step: 0, playing: true });
    expect(reduce(at({ flow: 1, step: 2 }), { type: "toggle" })).toMatchObject({ step: 2, playing: true });
    expect(reduce(at({ flow: 1, step: 2, playing: true }), { type: "toggle" })).toMatchObject({ step: 2, playing: false });
    expect(reduce(at({ flow: 1, step: last - 1, playing: true }), { type: "tick" })).toMatchObject({ step: last, playing: true });
    expect(reduce(at({ flow: 1, step: last, playing: true }), { type: "tick" })).toMatchObject({ step: last, playing: false });
    expect(reduce(at({ flow: 1, step: 2, playing: false }), { type: "tick" })).toMatchObject({ step: 2, playing: false });
  });

  it("AC-23.1 speeds are 0.5×, 1× and 2×; faster means shorter steps", () => {
    expect(SPEEDS).toEqual([0.5, 1, 2]);
    expect(reduce(at({}), { type: "speed", speed: 2 }).speed).toBe(2);
    expect(stepDuration(2)).toBeLessThan(stepDuration(1));
    expect(stepDuration(1)).toBeLessThan(stepDuration(0.5));
    expect(packetDuration(1, false)).toBeLessThan(stepDuration(1));
  });
});

describe("S-23 keyboard", () => {
  const key = (k: string, extra: Partial<Parameters<typeof keyToAction>[0]> = {}) => keyToAction({ key: k, ctrlKey: false, altKey: false, metaKey: false, tagName: "BODY", isContentEditable: false, ...extra });

  it("AC-23.2 Space plays or pauses, arrows step, 1–6 pick a flow", () => {
    expect(key(" ")).toEqual({ type: "toggle" });
    expect(key("ArrowLeft")).toEqual({ type: "prev" });
    expect(key("ArrowRight")).toEqual({ type: "next" });
    expect(key("1")).toEqual({ type: "flow", flow: 0 });
    expect(key("6")).toEqual({ type: "flow", flow: 5 });
    expect(key("7")).toBeNull();
    expect(key("a")).toBeNull();
  });

  it("AC-23.2 keys with Ctrl, Alt or Meta, or typed in a text field, are ignored", () => {
    expect(key("ArrowRight", { ctrlKey: true })).toBeNull();
    expect(key("1", { altKey: true })).toBeNull();
    expect(key(" ", { metaKey: true })).toBeNull();
    expect(key(" ", { tagName: "INPUT" })).toBeNull();
    expect(key("2", { tagName: "TEXTAREA" })).toBeNull();
    expect(key("ArrowLeft", { tagName: "SELECT" })).toBeNull();
    expect(key("3", { isContentEditable: true })).toBeNull();
    expect(key(" ", { tagName: "BUTTON" })).toEqual({ type: "toggle" });
  });
});

describe("S-23 canvas", () => {
  it("AC-23.3 only the nodes a flow touches are highlighted", () => {
    const sample = nodesInFlow(FLOWS[0]!);
    expect(sample).toEqual(["ui", "api", "ingest", "extractor", "matching", "rules", "db", "writer"]);
    for (const n of ["inbound", "cron", "resend", "apinbox"] as const) expect(sample).not.toContain(n);
    for (const f of FLOWS) {
      const touched = new Set(f.steps.flatMap((s) => [s.from, s.to]));
      expect(new Set(nodesInFlow(f))).toEqual(touched);
    }
    expect(nodesInFlow(FLOWS[3]!)).toContain("apinbox");
    expect(nodesInFlow(FLOWS[4]!)).toContain("cron");
  });

  it("AC-23.5 the packet runs from the step's source to its target; reduced motion shows it at the target with 0 ms", () => {
    const from = NODES.find((n) => n.id === "ui")!;
    const to = NODES.find((n) => n.id === "api")!;
    const g = edgeGeometry(from, to);
    expect(g.point(0)).toEqual({ x: from.x, y: from.y });
    expect(g.point(1)).toEqual({ x: to.x, y: to.y });
    expect(g.d.startsWith(`M ${from.x} ${from.y}`)).toBe(true);
    expect(packetPosition(g, 0, true)).toEqual({ x: to.x, y: to.y });
    expect(packetPosition(g, 0, false)).toEqual({ x: from.x, y: from.y });
    expect(packetDuration(1, true)).toBe(0);
    expect(packetDuration(2, true)).toBe(0);
    expect(packetDuration(1, false)).toBeGreaterThan(0);
    // Steps and controls don't depend on motion: the reducer has no motion input at all.
    expect(reduce(at({ step: 0 }), { type: "next" }).step).toBe(1);
  });
});

describe("S-23 footer", () => {
  it("AC-23.4 the footer names the short commit SHA of the build", () => {
    expect(shortSha("5B9D6B2a1c0ffee0000000000000000000000000")).toBe("5b9d6b2");
    expect(shortSha("")).toBe("unknown");
    expect(shortSha(undefined)).toBe("unknown");
    expect(shortSha("not a sha")).toBe("unknown");
    expect(footerText("5b9d6b2")).toBe("Traced from lienguard main @ 5b9d6b2. Payloads are examples from the sample data.");
  });

  it("AC-23.4 the build takes Vercel's commit, else git rev-parse HEAD, else unknown", () => {
    const git = () => "abcdef1234567890abcdef1234567890abcdef12\n";
    expect(resolveCommitSha({ VERCEL_GIT_COMMIT_SHA: "1234567aaaa" }, git)).toBe("1234567");
    expect(resolveCommitSha({}, git)).toBe("abcdef1");
    expect(
      resolveCommitSha({}, () => {
        throw new Error("not a git repo");
      }),
    ).toBe("unknown");
    expect(readFileSync("next.config.ts", "utf8")).toMatch(/resolveCommitSha/);
  });
});

describe("S-23 links", () => {
  it('AC-23.6 "How it works", the sidebar and the README link to /flows', () => {
    expect(readFileSync("src/app/about/page.tsx", "utf8")).toMatch(/href="\/flows"/);
    const sidebar = readFileSync("src/components/app-sidebar.tsx", "utf8");
    expect(sidebar).toMatch(/href="\/flows"/);
    expect(sidebar).toMatch(/System flows/);
    expect(readFileSync("README.md", "utf8")).toMatch(/\/flows\b/);
  });
});
