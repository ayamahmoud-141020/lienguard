"use client";

import {
  Clock,
  Database,
  FileSpreadsheet,
  Inbox,
  Mail,
  MailCheck,
  Monitor,
  Pause,
  Play,
  Route,
  Scale,
  ScanText,
  Send,
  SkipBack,
  SkipForward,
  RotateCcw,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useSyncExternalStore } from "react";
import { cn } from "@/components/app/cn";
import { FLOWS, NODES, type FlowStep, type NodeId, type PacketKind } from "@/flows/flows";
import { ease, edgeGeometry, packetPosition } from "@/flows/geometry";
import { initialPlayer, keyToAction, nodesInFlow, packetDuration, playerReducer, SPEEDS, stepDuration } from "@/flows/player";

const W = 1000;
const H = 640;
const NODE_W = 152;
/** Wider boxes where the label is long. */
const NODE_W_OVERRIDE: Partial<Record<NodeId, number>> = { writer: 204, inbound: 172 };
const NODE_H = 58;

const ICONS: Record<NodeId, LucideIcon> = {
  ui: Monitor,
  api: Route,
  ingest: FileSpreadsheet,
  extractor: ScanText,
  matching: Waypoints,
  rules: Scale,
  db: Database,
  writer: MailCheck,
  resend: Send,
  inbound: Inbox,
  cron: Clock,
  apinbox: Mail,
};

/** Packet colours on the dark canvas. Not status colours: SAFE/HOLD keep green/red elsewhere in the app. */
const KIND: Record<PacketKind, { label: string; color: string; chip: string }> = {
  request: { label: "Request / event", color: "#7cb4ff", chip: "bg-[#7cb4ff]" },
  data: { label: "Data", color: "#4fd1a5", chip: "bg-[#4fd1a5]" },
  ai: { label: "AI call", color: "#c9a7ff", chip: "bg-[#c9a7ff]" },
};

const nodeById = new Map(NODES.map((n) => [n.id, n]));
const node = (id: NodeId) => {
  const n = nodeById.get(id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
};

const reducer = playerReducer(FLOWS.map((f) => f.steps.length));

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const REPO = "https://github.com/ayamahmoud-141020/lienguard/blob";

export function FlowExplorer({ sha }: { sha: string }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialPlayer);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const flow = FLOWS[state.flow] ?? FLOWS[0]!;
  const step = flow.steps[state.step] ?? flow.steps[0]!;
  const used = useMemo(() => new Set(nodesInFlow(flow)), [flow]);
  const edges = useMemo(() => {
    const seen = new Map<string, { from: NodeId; to: NodeId }>();
    for (const s of flow.steps) if (s.from !== s.to) seen.set(`${s.from}>${s.to}`, { from: s.from, to: s.to });
    return [...seen.values()];
  }, [flow]);
  const geometry = useMemo(() => edgeGeometry(node(step.from), node(step.to)), [step]);

  // Keyboard (AC-23.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      const action = keyToAction({ key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, tagName: t?.tagName ?? "BODY", isContentEditable: Boolean(t?.isContentEditable) });
      if (!action) return;
      e.preventDefault();
      if (e.type === "keydown" && !e.repeat) dispatch(action);
    };
    window.addEventListener("keydown", onKey);
    // A focused button would also "click" on Space key-up; swallow that so Space only plays/pauses.
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  // Auto-advance while playing.
  useEffect(() => {
    if (!state.playing) return;
    const id = window.setTimeout(() => dispatch({ type: "tick" }), stepDuration(state.speed));
    return () => window.clearTimeout(id);
  }, [state.playing, state.step, state.flow, state.speed]);

  // Packet travel: moved with refs, so React doesn't re-render every frame.
  const packetRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const place = useCallback(
    (t: number) => {
      const p = packetPosition(geometry, t, reduced);
      packetRef.current?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      const label = labelRef.current;
      if (label) {
        // Keep the whole label inside the canvas: clamp its centre by its own measured width.
        const box = label.parentElement?.clientWidth ?? 0;
        const half = label.offsetWidth / 2 + 8;
        const x = (p.x / W) * box;
        label.style.left = `${box > 2 * half ? Math.min(Math.max(x, half), box - half) : box / 2}px`;
        label.style.top = `${(p.y / H) * 100}%`;
        label.dataset.below = p.y < 120 ? "true" : "false";
      }
    },
    [geometry, reduced],
  );
  useEffect(() => {
    const ms = packetDuration(state.speed, reduced);
    if (ms === 0) {
      place(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      place(ease(t));
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    place(0);
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [place, state.speed, reduced, state.flow, state.step]);

  // Keep the current step visible inside the list without scrolling the page.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-step="${state.step}"]`);
    if (!list || !item) return;
    const top = item.offsetTop; // the list is position: relative, so this is relative to it
    if (top < list.scrollTop || top + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(top - 12, 0), behavior: reduced ? "auto" : "smooth" });
    }
  }, [state.step, state.flow, reduced]);

  const kind = KIND[step.kind];
  const ctrl =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb4ff] disabled:opacity-40";

  return (
    <div className="space-y-4">
      {/* Flow picker */}
      <div role="group" aria-label="Pick a flow" className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-1.5 shadow-xs">
        {FLOWS.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={i === state.flow}
            onClick={() => dispatch({ type: "flow", flow: i })}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i === state.flow ? "bg-primary text-primary-foreground shadow-xs" : "text-ink-2 hover:bg-accent",
            )}
          >
            <kbd className={cn("num rounded border px-1 text-[11px] leading-4", i === state.flow ? "border-white/40 text-white/90" : "border-line-strong text-muted-foreground")}>{i + 1}</kbd>
            {f.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,340px)] items-start gap-4">
        {/* Canvas */}
        <section aria-label={`Diagram: ${flow.title}`} className="overflow-hidden rounded-xl border border-[#1f3242] bg-[#0b1620] shadow-xs">
          <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
              <defs>
                <pattern id="flows-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#132332" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#flows-grid)" />
              {edges.map((e) => {
                const g = edgeGeometry(node(e.from), node(e.to));
                const active = e.from === step.from && e.to === step.to;
                return (
                  <path
                    key={`${e.from}>${e.to}`}
                    d={g.d}
                    fill="none"
                    stroke={active ? kind.color : "#3a5368"}
                    strokeWidth={active ? 2.5 : 1.5}
                    strokeDasharray={active ? undefined : "4 6"}
                    opacity={active ? 0.95 : 0.8}
                  />
                );
              })}
              {geometry.self ? <path d={geometry.d} fill="none" stroke={kind.color} strokeWidth={2} strokeDasharray="3 5" opacity={0.8} /> : null}
              <g ref={packetRef}>
                <circle r={18} fill={kind.color} opacity={0.18} />
                <circle r={8} fill={kind.color} stroke="#0b1620" strokeWidth={2} />
              </g>
            </svg>

            {/* Nodes */}
            {NODES.map((n) => {
              const Icon = ICONS[n.id];
              const on = used.has(n.id);
              const current = n.id === step.from || n.id === step.to;
              return (
                <div
                  key={n.id}
                  aria-hidden
                  className={cn(
                    "absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border px-2.5 text-left transition-[opacity,border-color,box-shadow] duration-300 motion-reduce:transition-none",
                    on ? "border-[#2c4256] bg-[#12212e] text-slate-100" : "border-[#1a2a38] bg-[#0e1b26] text-slate-500 opacity-40",
                  )}
                  style={{
                    left: `${(n.x / W) * 100}%`,
                    top: `${(n.y / H) * 100}%`,
                    width: `${((NODE_W_OVERRIDE[n.id] ?? NODE_W) / W) * 100}%`,
                    height: `${(NODE_H / H) * 100}%`,
                    ...(current ? { borderColor: kind.color, boxShadow: `0 0 0 1px ${kind.color}, 0 0 18px -4px ${kind.color}` } : {}),
                  }}
                >
                  <Icon className="size-3.5 shrink-0" style={current ? { color: kind.color } : undefined} />
                  <span className="text-[11.5px] font-medium leading-[14px]">{n.label.replace("-", "\u2011")}</span>
                </div>
              );
            })}

            {/* Packet label */}
            <div
              ref={labelRef}
              aria-hidden
              className="pointer-events-none absolute z-10 w-max max-w-[46%] -translate-x-1/2 -translate-y-[calc(100%+16px)] rounded-md border bg-[#0b1620]/95 px-2 py-1 font-mono text-[11px] leading-[15px] text-slate-100 shadow-lg data-[below=true]:translate-y-[16px]"
              style={{ borderColor: kind.color }}
            >
              {step.payload}
            </div>
          </div>

          {/* Legend + controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1f3242] px-3 py-2">
            <ul className="flex items-center gap-4 text-[12px] text-slate-300" aria-label="Packet colours">
              {Object.values(KIND).map((k) => (
                <li key={k.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", k.chip)} aria-hidden />
                  {k.label}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-1">
              <button type="button" className={ctrl} onClick={() => dispatch({ type: "restart" })} aria-label="Restart">
                <RotateCcw className="size-4" aria-hidden />
              </button>
              <button type="button" className={ctrl} onClick={() => dispatch({ type: "prev" })} disabled={state.step === 0} aria-label="Previous step">
                <SkipBack className="size-4" aria-hidden />
              </button>
              <button type="button" className={cn(ctrl, "w-20 bg-white/10")} onClick={() => dispatch({ type: "toggle" })} aria-label={state.playing ? "Pause" : "Play"}>
                {state.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {state.playing ? "Pause" : "Play"}
              </button>
              <button type="button" className={ctrl} onClick={() => dispatch({ type: "next" })} disabled={state.step === flow.steps.length - 1} aria-label="Next step">
                <SkipForward className="size-4" aria-hidden />
              </button>
              <div role="group" aria-label="Speed" className="ml-2 flex items-center rounded-md bg-white/5 p-0.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={state.speed === s}
                    onClick={() => dispatch({ type: "speed", speed: s })}
                    className={cn(
                      "num h-7 rounded px-2 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cb4ff]",
                      state.speed === s ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Step list: as tall as the canvas, scrolls inside. */}
        <div className="relative self-stretch">
          <section aria-label={`Steps: ${flow.title}`} className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="border-b px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-foreground">{flow.title}</h2>
                <span className="num shrink-0 text-xs text-muted-foreground" aria-live="polite">
                  Step {state.step + 1} of {flow.steps.length}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{flow.summary}</p>
            </div>
            <ol ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto p-2">
              {flow.steps.map((s, i) => (
                <StepItem key={i} index={i} step={s} active={i === state.step} sha={sha} onSelect={() => dispatch({ type: "goto", step: i })} />
              ))}
            </ol>
          </section>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {`Step ${state.step + 1}: ${step.text} Example: ${step.payload}`}
      </p>
    </div>
  );
}

function StepItem({ index, step, active, sha, onSelect }: { index: number; step: FlowStep; active: boolean; sha: string; onSelect: () => void }) {
  const k = KIND[step.kind];
  const ref = sha === "unknown" ? "main" : sha;
  return (
    <li data-step={index} className={cn("relative rounded-lg", active ? "bg-brand-soft/70 ring-1 ring-brand/25" : "hover:bg-subtle")}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "step" : undefined}
        className="flex w-full gap-3 rounded-lg px-2.5 pt-2.5 pb-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn("num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", active ? "text-[#0b1620]" : "bg-muted text-muted-foreground")}
          style={active ? { backgroundColor: k.color } : undefined}
        >
          {index + 1}
        </span>
        <span className={cn("text-[13px] leading-[18px]", active ? "text-foreground" : "text-ink-2")}>
          {step.text}
          <span className="sr-only"> ({k.label})</span>
        </span>
      </button>
      <ul className="space-y-0.5 pb-2.5 pl-[42px] pr-2.5">
        {step.files.map((f) => (
          <li key={`${f.path}#${f.symbol ?? ""}`} className="font-mono text-[11.5px] leading-[16px] [overflow-wrap:anywhere]">
            <a
              href={`${REPO}/${ref}/${f.path}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={f.symbol ? `${f.path} · ${f.symbol}` : f.path}
            >
              {f.path}
              {f.symbol ? <span className="text-brand"> · {f.symbol}</span> : null}
            </a>
          </li>
        ))}
        {active ? <li className="pt-1 font-mono text-[11.5px] leading-[16px] text-ink-2 break-words whitespace-normal">→ {step.payload}</li> : null}
      </ul>
    </li>
  );
}
