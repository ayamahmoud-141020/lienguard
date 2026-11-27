import { FLOW_IDS, NODE_IDS, type Flow, type NodeId } from "./flows";

/** The /flows player as a pure reducer (AC-23.1). The page only wires timers and keys to it. */

export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export type PlayerState = { flow: number; step: number; playing: boolean; speed: Speed };

export type PlayerAction =
  | { type: "toggle" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "restart" }
  | { type: "tick" }
  | { type: "goto"; step: number }
  | { type: "flow"; flow: number }
  | { type: "speed"; speed: Speed };

export function initialPlayer(): PlayerState {
  return { flow: 0, step: 0, playing: false, speed: 1 };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** `stepCounts[i]` is the number of steps in flow i. */
export function playerReducer(stepCounts: readonly number[]) {
  return (s: PlayerState, a: PlayerAction): PlayerState => {
    const last = Math.max((stepCounts[s.flow] ?? 1) - 1, 0);
    switch (a.type) {
      case "next":
        return { ...s, step: clamp(s.step + 1, 0, last) };
      case "prev":
        return { ...s, step: clamp(s.step - 1, 0, last) };
      case "restart":
        return { ...s, step: 0 };
      case "goto":
        return { ...s, step: clamp(a.step, 0, last), playing: false };
      case "flow":
        if (a.flow < 0 || a.flow >= stepCounts.length) return s;
        return { ...s, flow: a.flow, step: 0, playing: false };
      case "toggle":
        if (s.playing) return { ...s, playing: false };
        return s.step >= last ? { ...s, step: 0, playing: true } : { ...s, playing: true };
      case "tick":
        if (!s.playing) return s;
        return s.step >= last ? { ...s, playing: false } : { ...s, step: s.step + 1 };
      case "speed":
        return { ...s, speed: a.speed };
    }
  };
}

const BASE_STEP_MS = 2600;
const BASE_PACKET_MS = 1400;

/** Time on one step while playing, packet move included. */
export function stepDuration(speed: Speed): number {
  return Math.round(BASE_STEP_MS / speed);
}

/** How long the packet takes to travel its edge; 0 with prefers-reduced-motion (AC-23.5). */
export function packetDuration(speed: Speed, reducedMotion: boolean): number {
  return reducedMotion ? 0 : Math.round(BASE_PACKET_MS / speed);
}

export type KeyInput = { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; tagName: string; isContentEditable: boolean };

/** Space = play/pause, ← → = step, 1–6 = flow (AC-23.2). Null means "not ours, let the browser have it". */
export function keyToAction(e: KeyInput): PlayerAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName.toUpperCase())) return null;
  if (e.key === " " || e.key === "Spacebar") return { type: "toggle" };
  if (e.key === "ArrowLeft") return { type: "prev" };
  if (e.key === "ArrowRight") return { type: "next" };
  const n = Number(e.key);
  if (/^[1-9]$/.test(e.key) && n <= FLOW_IDS.length) return { type: "flow", flow: n - 1 };
  return null;
}

/** The nodes a flow touches, in canvas order (AC-23.3). */
export function nodesInFlow(flow: Flow): NodeId[] {
  const used = new Set<NodeId>(flow.steps.flatMap((s) => [s.from, s.to]));
  return NODE_IDS.filter((id) => used.has(id));
}
