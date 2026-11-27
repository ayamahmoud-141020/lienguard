/** Edge shapes on the /flows canvas: a gentle quadratic curve, so A→B and B→A don't overlap. */

export type Point = { x: number; y: number };
export type EdgeGeometry = { d: string; point: (t: number) => Point; self: boolean };

const BEND = 0.14;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function edgeGeometry(from: Point, to: Point): EdgeGeometry {
  if (from.x === to.x && from.y === to.y) {
    // A step inside one component: the packet circles just above the node.
    const r = 34;
    const cx = from.x;
    const cy = from.y - 44;
    return {
      self: true,
      d: `M ${from.x} ${from.y} m -${r} -44 a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 -${2 * r} 0`,
      point: (t) => (t <= 0 || t >= 1 ? { x: from.x, y: from.y } : { x: r1(cx + r * Math.sin(2 * Math.PI * t)), y: r1(cy + r * Math.cos(2 * Math.PI * t) * -1) }),
    };
  }
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Control point offset to the left of the direction of travel.
  const cx = mx - dy * BEND;
  const cy = my + dx * BEND;
  return {
    self: false,
    d: `M ${from.x} ${from.y} Q ${r1(cx)} ${r1(cy)} ${to.x} ${to.y}`,
    point: (t) => {
      if (t <= 0) return { x: from.x, y: from.y };
      if (t >= 1) return { x: to.x, y: to.y };
      const u = 1 - t;
      return { x: r1(u * u * from.x + 2 * u * t * cx + t * t * to.x), y: r1(u * u * from.y + 2 * u * t * cy + t * t * to.y) };
    },
  };
}

/** Where the packet is drawn. With reduced motion it sits at the target: no travel (AC-23.5). */
export function packetPosition(g: EdgeGeometry, t: number, reducedMotion: boolean): Point {
  return g.point(reducedMotion ? 1 : t);
}

/** Smooth start and stop. */
export function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
