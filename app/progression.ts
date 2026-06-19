// progression.ts — pure geometry for the run-progression charts.
//
// Turns a list of run metrics (a value at a point in time, tagged with the
// build that was active) into plotted SVG coordinates plus the build-change
// markers that make "I reallocated here → the trend moved" visible. No I/O, no
// imports — pure and unit-tested. The view (components/reports.tsx) renders the
// returned geometry as a static <svg>.

// One run's value for a single metric. `t` is occurred_at as epoch milliseconds.
export interface Sample {
  id: number;
  t: number;
  value: number;
  buildId: number | null;
}

// A sample placed in the SVG viewport. `buildChanged` is true when this run's
// build differs from the chronologically previous run's — the spot to draw a
// vertical marker.
export interface Plotted {
  id: number;
  cx: number;
  cy: number;
  value: number;
  t: number;
  buildId: number | null;
  buildChanged: boolean;
}

export interface Chart {
  w: number;
  h: number;
  pad: number;
  plotted: Plotted[];
  polyline: string; // "x,y x,y …" for an <polyline points=…>
  vMin: number; // value-axis bounds actually used (after flat-series padding)
  vMax: number;
  tMin: number; // time range of the plotted samples (epoch ms)
  tMax: number;
}

export interface ChartOpts {
  w?: number;
  h?: number;
  pad?: number;
}

// Build chart geometry from samples. Samples are sorted ascending by time
// (stable on id for equal timestamps). Returns an empty chart for no samples.
// When all timestamps are equal, points are distributed evenly by index so a
// batch of same-dated runs still reads left→right. When all values are equal,
// the value axis is padded so the line sits mid-height instead of on an edge.
export function buildChart(samples: Sample[], opts: ChartOpts = {}): Chart {
  const w = opts.w ?? 640;
  const h = opts.h ?? 160;
  const pad = opts.pad ?? 28;

  const sorted = [...samples].sort((a, b) => a.t - b.t || a.id - b.id);
  const empty: Chart = {
    w,
    h,
    pad,
    plotted: [],
    polyline: "",
    vMin: 0,
    vMax: 0,
    tMin: 0,
    tMax: 0,
  };
  if (sorted.length === 0) return empty;

  const tMin = sorted[0].t;
  const tMax = sorted[sorted.length - 1].t;
  const tSpan = tMax - tMin;

  const values = sorted.map((s) => s.value);
  let vMin = Math.min(...values);
  let vMax = Math.max(...values);
  if (vMin === vMax) {
    // Flat series: pad around the value so the line is centered and visible.
    const bump = vMin === 0 ? 1 : Math.abs(vMin) * 0.1;
    vMin -= bump;
    vMax += bump;
  }
  const vSpan = vMax - vMin;

  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const n = sorted.length;

  const plotted: Plotted[] = sorted.map((s, i) => {
    const fx = tSpan === 0 ? (n === 1 ? 0.5 : i / (n - 1)) : (s.t - tMin) / tSpan;
    const fy = (s.value - vMin) / vSpan;
    const cx = pad + fx * innerW;
    const cy = pad + (1 - fy) * innerH; // invert: larger value sits higher
    const prev = i > 0 ? sorted[i - 1].buildId : null;
    const buildChanged = i > 0 && s.buildId !== prev;
    return {
      id: s.id,
      cx: round(cx),
      cy: round(cy),
      value: s.value,
      t: s.t,
      buildId: s.buildId,
      buildChanged,
    };
  });

  return {
    w,
    h,
    pad,
    plotted,
    polyline: plotted.map((p) => `${p.cx},${p.cy}`).join(" "),
    vMin,
    vMax,
    tMin,
    tMax,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
