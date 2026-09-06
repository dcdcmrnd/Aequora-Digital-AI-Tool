export interface Point {
  x: number;
  y: number;
}

/**
 * Rounds every corner of an arbitrary polygon by cutting in `radius` units along each
 * adjacent edge and bridging the cut with a quadratic curve through the original vertex.
 * Works for any convex polygon, which is all the isometric faces below ever need.
 */
export function roundedPolygonPath(points: Point[], radius: number): string {
  const n = points.length;
  const cut = (from: Point, to: Point, r: number): Point => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(r, len / 2) / len;
    return { x: from.x + dx * t, y: from.y + dy * t };
  };

  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const start = cut(curr, prev, radius);
    const end = cut(curr, next, radius);
    segments.push(i === 0 ? `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}` : `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`);
    segments.push(`Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
  }
  segments.push("Z");
  return segments.join(" ");
}

export interface IsoSlab {
  top: Point[];
  side: Point[];
  /** Frontmost (largest-y) vertex of the top face -- used to anchor shadows and connectors. */
  frontVertex: Point;
  /** Topmost (smallest-y) vertex of the top face -- where the numeral overlaps the corner. */
  backVertex: Point;
}

/**
 * True 2:1 isometric projection of a rectangular slab's two visible faces (top + right side),
 * given an origin at the slab's back corner, a width/depth footprint, and a height (extrusion).
 */
export function isoSlab(origin: Point, width: number, depth: number, height: number): IsoSlab {
  const p0 = origin;
  const p1: Point = { x: origin.x + width, y: origin.y + width * 0.5 };
  const p2: Point = { x: origin.x + width - depth, y: origin.y + width * 0.5 + depth * 0.5 };
  const p3: Point = { x: origin.x - depth, y: origin.y + depth * 0.5 };
  const top = [p0, p1, p2, p3];
  const side = [p1, p2, { x: p2.x, y: p2.y + height }, { x: p1.x, y: p1.y + height }];
  return { top, side, frontVertex: p2, backVertex: p0 };
}
